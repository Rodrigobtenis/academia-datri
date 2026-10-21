import { supabase } from "../supabase";
import type { CourseEdition } from "../../types/course";
import type { Enrollment } from "../../types/enrollment";
import type { Student, StudentInput } from "../../types/student";
import { digitsOnly, mapPaymentMethod, normalizeText } from "../tiendup/match";
import type { TiendupSale } from "../tiendup/parse";

export interface StudentCandidate {
  student: Student;
  reasons: string[];
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function sortedTokens(value: string) {
  return normalizeText(value).split(" ").filter(Boolean).sort().join(" ");
}

// Busca en la base de alumnas/clientas a la persona de la venta: primero por email, después
// por teléfono (últimos 8 dígitos) y por último por nombre completo. Devuelve todas las
// coincidencias con el motivo, para que la persona confirme cuál es.
export async function findStudentCandidates(sale: TiendupSale): Promise<StudentCandidate[]> {
  const found = new Map<string, { student: Student; reasons: Set<string> }>();
  const add = (students: Student[] | null, reason: string) => {
    for (const s of students ?? []) {
      const entry = found.get(s.id) ?? { student: s, reasons: new Set<string>() };
      entry.reasons.add(reason);
      found.set(s.id, entry);
    }
  };

  const email = sale.email.trim();
  if (email) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .ilike("email", escapeLike(email))
      .limit(10);
    if (error) throw error;
    add(data as Student[], "mismo email");
  }

  const phoneDigits = digitsOnly(sale.phone);
  if (phoneDigits.length >= 8) {
    const last8 = phoneDigits.slice(-8);
    const last4 = phoneDigits.slice(-4);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .or(`phone.ilike.%${last4}%,whatsapp.ilike.%${last4}%`)
      .limit(80);
    if (error) throw error;
    add(
      (data as Student[]).filter(
        (s) => digitsOnly(s.phone ?? "").endsWith(last8) || digitsOnly(s.whatsapp ?? "").endsWith(last8)
      ),
      "mismo teléfono"
    );
  }

  const lastToken = sale.lastName.trim().split(/\s+/)[0] ?? "";
  if (lastToken.length >= 3) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .ilike("last_name", `%${escapeLike(lastToken)}%`)
      .limit(80);
    if (error) throw error;
    const target = sortedTokens(`${sale.firstName} ${sale.lastName}`);
    add(
      (data as Student[]).filter((s) => sortedTokens(`${s.first_name} ${s.last_name}`) === target),
      "mismo nombre"
    );
  }

  const weight = (reasons: Set<string>) =>
    reasons.has("mismo email") ? 0 : reasons.has("mismo teléfono") ? 1 : 2;
  return Array.from(found.values())
    .sort((a, b) => weight(a.reasons) - weight(b.reasons))
    .map((e) => ({ student: e.student, reasons: Array.from(e.reasons) }));
}

export type ImportModality = "online" | "presencial";

// Todas las ediciones del curso que no estén canceladas, de la más antigua a la más nueva.
// Online y presencial son cursos distintos: quien llama separa por modalidad, nunca las mezcla.
export async function listEditionsForImport(courseTypeId: string) {
  const { data, error } = await supabase
    .from("course_editions")
    .select("*")
    .eq("course_type_id", courseTypeId)
    .neq("status", "cancelado")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as CourseEdition[];
}

// Números de venta de Tiendup que ya se importaron antes (quedan anotados en las notas de la
// inscripción), para no cargar dos veces la misma venta.
export async function listImportedOrderNumbers(): Promise<Set<string>> {
  const { data, error } = await supabase.from("enrollments").select("notes").ilike("notes", "%Tiendup #%");
  if (error) throw error;
  const numbers = new Set<string>();
  for (const row of data as { notes: string | null }[]) {
    for (const m of (row.notes ?? "").matchAll(/Tiendup #(\d+)/g)) numbers.add(m[1]);
  }
  return numbers;
}

export async function findExistingEnrollment(studentId: string, editionId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("course_edition_id", editionId)
    .limit(1);
  if (error) throw error;
  return (data as Pick<Enrollment, "id" | "status">[])[0] ?? null;
}

export interface ImportSaleInput {
  sale: TiendupSale;
  existingStudentId: string | null;
  newStudent: { first_name: string; last_name: string; email: string; phone: string } | null;
  courseTypeId: string;
  modality: ImportModality;
  editionId: string;
  salesResponsible: string | null;
}

export interface ImportSaleResult {
  studentId: string;
  enrollmentId: string;
  createdStudent: boolean;
  paymentRegistered: boolean;
}

export async function importSale(input: ImportSaleInput): Promise<ImportSaleResult> {
  const { sale } = input;

  let studentId = input.existingStudentId;
  let createdStudent = false;
  if (!studentId) {
    if (!input.newStudent) throw new Error("Falta elegir o completar la alumna.");
    const student: StudentInput = {
      first_name: input.newStudent.first_name.trim(),
      last_name: input.newStudent.last_name.trim(),
      dni: null,
      birth_date: null,
      phone: input.newStudent.phone.trim() || null,
      whatsapp: null,
      email: input.newStudent.email.trim() || null,
      instagram: null,
      city: null,
      province: null,
      country: "Argentina",
      profession: null,
      specialty: null,
      source: "otro",
      notes: `Alta desde importación de Tiendup (venta #${sale.orderNumber})`,
      status: "activa",
      photo_url: null,
    };
    const { data, error } = await supabase.from("students").insert(student).select().single();
    if (error) throw error;
    studentId = (data as Student).id;
    createdStudent = true;
  }

  // La edición tiene que existir: la importación nunca crea cursos ni ediciones.
  const editionId = input.editionId;

  const finalPrice = sale.totalAmount;
  const originalPrice = Math.max(sale.unitPrice * sale.quantity, finalPrice);
  const discount = originalPrice - finalPrice;
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .insert({
      student_id: studentId,
      course_edition_id: editionId,
      original_price: String(originalPrice),
      discount_type: discount > 0 ? "monto" : null,
      discount_value: discount > 0 ? String(discount) : null,
      discount_reason: discount > 0 ? "Descuento aplicado en Tiendup" : null,
      discount_authorized_by: discount > 0 ? input.salesResponsible : null,
      final_price: String(finalPrice),
      status: sale.isPaid ? "pagada" : "reservada",
      sales_responsible: input.salesResponsible,
      override_capacity: false,
      override_authorized_by: null,
      access_sent: false,
      notes: `Importado de Tiendup #${sale.orderNumber} (${sale.paymentDate.split("-").reverse().join("/")})`,
      created_at: sale.createdAt,
    })
    .select()
    .single();
  if (enrollmentError) throw enrollmentError;
  const enrollmentId = (enrollment as Enrollment).id;

  let paymentRegistered = false;
  if (sale.isPaid && sale.totalAmount > 0) {
    const { error: paymentError } = await supabase.from("payments").insert({
      enrollment_id: enrollmentId,
      payment_date: sale.paymentDate,
      amount: String(sale.totalAmount),
      payment_type: "completo",
      payment_method: mapPaymentMethod(sale.paymentMethod),
      reference: `Tiendup #${sale.orderNumber}`,
      notes: null,
    });
    if (paymentError) {
      // No dejar una inscripción "pagada" sin su pago: se deshace y se avisa del error.
      await supabase.from("enrollments").delete().eq("id", enrollmentId);
      throw paymentError;
    }
    paymentRegistered = true;
  }

  return { studentId, enrollmentId, createdStudent, paymentRegistered };
}
