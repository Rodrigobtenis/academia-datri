import { supabase } from "../supabase";
import { formatDateAR } from "../date-ar";
import type { PaymentMethod, PaymentType } from "../../types/payment";

export interface PaymentMovement {
  id: string;
  paymentDate: string;
  createdAt: string;
  amount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  reference: string | null;
  studentName: string;
  courseName: string;
  editionLabel: string;
  enrollmentId: string;
  courseTypeId: string | null;
  editionId: string | null;
}

type Row = {
  id: string;
  payment_date: string;
  created_at: string;
  amount: string;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  reference: string | null;
  enrollments: {
    id: string;
    students: { first_name: string; last_name: string } | null;
    course_editions: {
      id: string;
      name: string | null;
      start_date: string;
      modality: string;
      course_type_id: string;
      course_types: { name: string } | null;
    } | null;
  } | null;
};

// Cobros registrados entre dos fechas (ambas incluidas, por fecha real del pago), del más
// reciente al más viejo, con quién pagó, en qué curso, cuánto, de qué tipo y con qué medio.
export async function listPaymentMovements(from: string, to: string, method?: string): Promise<PaymentMovement[]> {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("payments")
      .select(
        "id, payment_date, created_at, amount, payment_type, payment_method, reference, enrollments(id, students(first_name, last_name), course_editions(id, name, start_date, modality, course_type_id, course_types(name)))"
      )
      .eq("status", "valido")
      .gte("payment_date", from)
      .lte("payment_date", to);
    if (method) query = query.eq("payment_method", method);
    const { data, error } = await query
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as unknown as Row[]));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return rows.map((r) => {
    const edition = r.enrollments?.course_editions ?? null;
    const student = r.enrollments?.students ?? null;
    return {
      id: r.id,
      paymentDate: r.payment_date,
      createdAt: r.created_at,
      amount: parseFloat(r.amount),
      paymentType: r.payment_type,
      paymentMethod: r.payment_method,
      reference: r.reference,
      studentName: student ? `${student.last_name}, ${student.first_name}` : "—",
      courseName: edition?.course_types?.name ?? "—",
      editionLabel: edition ? edition.name || (edition.modality === "online" ? "Online" : formatDateAR(edition.start_date)) : "",
      enrollmentId: r.enrollments?.id ?? "",
      courseTypeId: edition?.course_type_id ?? null,
      editionId: edition?.id ?? null,
    };
  });
}
