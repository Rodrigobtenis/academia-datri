import { supabase } from "../supabase";

export interface MonthlyCollection {
  month_start: string;
  month: number;
  year: number;
  net_collected: string;
}

export interface CourseTypeSummary {
  course_type_id: string;
  name: string;
  edition_count: number;
  enrollment_count: number;
  total_sold: string | null;
  total_collected: string;
}

export async function getMonthlyCollection(month: number, year: number) {
  const { data, error } = await supabase
    .from("v_monthly_net_collections")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyCollection | null;
}

export async function getYearCollections(year: number) {
  const { data, error } = await supabase.from("v_monthly_net_collections").select("*").eq("year", year);
  if (error) throw error;
  return data as MonthlyCollection[];
}

export async function getCourseTypeSummary() {
  const { data, error } = await supabase.from("v_course_type_summary").select("*").order("name");
  if (error) throw error;
  return data as CourseTypeSummary[];
}

function nextDayISO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

// Misma idea que v_course_type_summary (ver 0004_fix_course_type_summary_fanout.sql) pero
// filtrada por rango de fechas: "vendido" cuenta inscripciones creadas en el rango, "cobrado"
// cuenta pagos válidos con payment_date en el rango. Se calcula en JS con consultas separadas
// (en vez de un solo join) para no repetir el bug de fan-out que ya se arregló en la vista.
export async function getCourseTypeSummaryRange(from: string, to: string): Promise<CourseTypeSummary[]> {
  const createdBefore = nextDayISO(to);

  const [typesRes, editionsRes, enrollmentsRes, paymentsRes] = await Promise.all([
    supabase.from("course_types").select("id, name").order("name"),
    supabase.from("course_editions").select("id, course_type_id").gte("start_date", from).lte("start_date", to),
    supabase
      .from("enrollments")
      .select("id, final_price, course_edition_id, course_editions(course_type_id)")
      .neq("status", "cancelada")
      .gte("created_at", from)
      .lt("created_at", createdBefore),
    supabase
      .from("payments")
      .select("amount, enrollments(course_edition_id, course_editions(course_type_id))")
      .eq("status", "valido")
      .gte("payment_date", from)
      .lte("payment_date", to),
  ]);

  if (typesRes.error) throw typesRes.error;
  if (editionsRes.error) throw editionsRes.error;
  if (enrollmentsRes.error) throw enrollmentsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const editionCounts: Record<string, number> = {};
  for (const e of editionsRes.data as { id: string; course_type_id: string }[]) {
    editionCounts[e.course_type_id] = (editionCounts[e.course_type_id] ?? 0) + 1;
  }

  type EnrollmentRow = {
    id: string;
    final_price: string;
    course_editions: { course_type_id: string } | null;
  };
  const enrollmentCounts: Record<string, number> = {};
  const soldTotals: Record<string, number> = {};
  for (const en of enrollmentsRes.data as unknown as EnrollmentRow[]) {
    const typeId = en.course_editions?.course_type_id;
    if (!typeId) continue;
    enrollmentCounts[typeId] = (enrollmentCounts[typeId] ?? 0) + 1;
    soldTotals[typeId] = (soldTotals[typeId] ?? 0) + parseFloat(en.final_price);
  }

  type PaymentRow = {
    amount: string;
    enrollments: { course_editions: { course_type_id: string } | null } | null;
  };
  const collectedTotals: Record<string, number> = {};
  for (const p of paymentsRes.data as unknown as PaymentRow[]) {
    const typeId = p.enrollments?.course_editions?.course_type_id;
    if (!typeId) continue;
    collectedTotals[typeId] = (collectedTotals[typeId] ?? 0) + parseFloat(p.amount);
  }

  return (typesRes.data as { id: string; name: string }[]).map((t) => ({
    course_type_id: t.id,
    name: t.name,
    edition_count: editionCounts[t.id] ?? 0,
    enrollment_count: enrollmentCounts[t.id] ?? 0,
    total_sold: String(soldTotals[t.id] ?? 0),
    total_collected: String(collectedTotals[t.id] ?? 0),
  }));
}

export async function getPendingTotal() {
  // Igual criterio que Reportes > Deudas y la ficha de alumna: una inscripción cancelada
  // nunca se va a cobrar, así que no debe sumar al "pendiente de cobro" del negocio.
  const { data: active, error: e1 } = await supabase.from("enrollments").select("id").neq("status", "cancelada");
  if (e1) throw e1;
  const ids = (active as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return 0;

  const { data, error } = await supabase.from("v_enrollment_balance").select("balance").in("enrollment_id", ids);
  if (error) throw error;
  return (data as { balance: string }[]).reduce((acc, r) => acc + Math.max(0, parseFloat(r.balance)), 0);
}

function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 1).toISOString().slice(0, 10);
  return { start, end };
}

export async function getMonthPaymentBreakdown(month: number, year: number) {
  const { start, end } = monthRange(month, year);
  const { data, error } = await supabase
    .from("payments")
    .select("amount, payment_type")
    .eq("status", "valido")
    .gte("payment_date", start)
    .lt("payment_date", end);
  if (error) throw error;
  const rows = data as { amount: string; payment_type: string }[];
  const totalSenas = rows.filter((r) => r.payment_type === "sena").reduce((a, r) => a + parseFloat(r.amount), 0);
  const totalReintegros = rows
    .filter((r) => r.payment_type === "reintegro")
    .reduce((a, r) => a + Math.abs(parseFloat(r.amount)), 0);
  const totalPagos = rows.length;
  return { totalSenas, totalReintegros, totalPagos };
}

export async function getMonthSoldTotal(month: number, year: number) {
  const { start, end } = monthRange(month, year);
  const { data, error } = await supabase
    .from("enrollments")
    .select("final_price")
    .neq("status", "cancelada")
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) throw error;
  return (data as { final_price: string }[]).reduce((a, r) => a + parseFloat(r.final_price), 0);
}
