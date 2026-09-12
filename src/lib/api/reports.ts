import { supabase } from "../supabase";
import { formatDateAR } from "../date-ar";

export interface CobroRow {
  payment_id: string;
  payment_date: string;
  amount: string;
  payment_type: string;
  payment_method: string;
  student_name: string;
  course_name: string;
  edition_label: string;
}

export async function getCobrosReport(from: string, to: string) {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, payment_date, amount, payment_type, payment_method, status, enrollments(students(first_name,last_name), course_editions(name, start_date, course_types(name)))"
    )
    .eq("status", "valido")
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("payment_date", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    payment_date: string;
    amount: string;
    payment_type: string;
    payment_method: string;
    enrollments: {
      students: { first_name: string; last_name: string } | null;
      course_editions: { name: string | null; start_date: string; course_types: { name: string } | null } | null;
    } | null;
  };

  return (data as unknown as Row[]).map((r) => ({
    payment_id: r.id,
    payment_date: r.payment_date,
    amount: r.amount,
    payment_type: r.payment_type,
    payment_method: r.payment_method,
    student_name: r.enrollments?.students
      ? `${r.enrollments.students.last_name}, ${r.enrollments.students.first_name}`
      : "—",
    course_name: r.enrollments?.course_editions?.course_types?.name ?? "—",
    edition_label:
      r.enrollments?.course_editions?.name ||
      (r.enrollments?.course_editions ? formatDateAR(r.enrollments.course_editions.start_date) : "—"),
  })) as CobroRow[];
}

export interface DeudaRow {
  enrollment_id: string;
  student_name: string;
  course_name: string;
  edition_label: string;
  final_price: string;
  paid: string;
  balance: string;
}

export async function getDeudasReport() {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, final_price, status, students(first_name,last_name), course_editions(name, start_date, course_types(name))"
    )
    .neq("status", "cancelada");
  if (error) throw error;

  const ids = (data as { id: string }[]).map((r) => r.id);
  const { data: balances, error: e2 } = await supabase
    .from("v_enrollment_balance")
    .select("*")
    .in("enrollment_id", ids);
  if (e2) throw e2;
  const balanceMap: Record<string, { paid_amount: string; balance: string }> = {};
  for (const b of balances as { enrollment_id: string; paid_amount: string; balance: string }[]) {
    balanceMap[b.enrollment_id] = b;
  }

  type Row = {
    id: string;
    final_price: string;
    students: { first_name: string; last_name: string } | null;
    course_editions: { name: string | null; start_date: string; course_types: { name: string } | null } | null;
  };

  return (data as unknown as Row[])
    .map((r) => {
      const bal = balanceMap[r.id];
      return {
        enrollment_id: r.id,
        student_name: r.students ? `${r.students.last_name}, ${r.students.first_name}` : "—",
        course_name: r.course_editions?.course_types?.name ?? "—",
        edition_label:
          r.course_editions?.name ||
          (r.course_editions?.start_date ? formatDateAR(r.course_editions.start_date) : "—"),
        final_price: r.final_price,
        paid: bal?.paid_amount ?? "0",
        balance: bal?.balance ?? r.final_price,
      };
    })
    .filter((r) => parseFloat(r.balance) > 0) as DeudaRow[];
}

export interface OcupacionRow {
  course_name: string;
  edition_label: string;
  max_students: number;
  enrolled_count: number;
  occupancy_pct: number | null;
}

export async function getOcupacionReport() {
  const { data, error } = await supabase
    .from("course_editions")
    .select("id, name, start_date, course_types(name)")
    .order("start_date", { ascending: false });
  if (error) throw error;

  const ids = (data as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data: occ, error: e2 } = await supabase.from("v_edition_occupancy").select("*").in("course_edition_id", ids);
  if (e2) throw e2;
  const occMap: Record<string, { max_students: number; enrolled_count: number; occupancy_pct: number | null }> = {};
  for (const o of occ as { course_edition_id: string; max_students: number; enrolled_count: number; occupancy_pct: number | null }[]) {
    occMap[o.course_edition_id] = o;
  }

  type Row = { id: string; name: string | null; start_date: string; course_types: { name: string } | null };
  return (data as unknown as Row[]).map((r) => ({
    course_name: r.course_types?.name ?? "—",
    edition_label: r.name || formatDateAR(r.start_date),
    max_students: occMap[r.id]?.max_students ?? 0,
    enrolled_count: occMap[r.id]?.enrolled_count ?? 0,
    occupancy_pct: occMap[r.id]?.occupancy_pct ?? 0,
  })) as OcupacionRow[];
}

export interface OrigenRow {
  source: string;
  cantidad: number;
}

export async function getOrigenReport() {
  const { data, error } = await supabase.from("students").select("source");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data as { source: string | null }[]) {
    const key = row.source ?? "sin_dato";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([source, cantidad]) => ({ source, cantidad })) as OrigenRow[];
}
