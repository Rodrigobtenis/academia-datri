import { supabase } from "../supabase";
import { formatDateAR } from "../date-ar";
import type { CommissionPaymentRow, CommissionRateEntry } from "../../types/commission";

function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1); // día 1 del mes siguiente
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export async function getMonthlyCommissionDetail(month: number, year: number) {
  const { start, end } = monthRange(month, year);

  const { data: rows, error } = await supabase
    .from("v_payment_commission")
    .select("*")
    .eq("status", "valido")
    .gte("payment_date", start)
    .lt("payment_date", end)
    .order("payment_date", { ascending: true });
  if (error) throw error;

  const commissionRows = rows as CommissionPaymentRow[];
  if (commissionRows.length === 0) return [];

  const enrollmentIds = [...new Set(commissionRows.map((r) => r.enrollment_id))];
  const { data: enrollments, error: e2 } = await supabase
    .from("enrollments")
    .select(
      "id, students(first_name, last_name), course_editions(name, start_date, course_types(name))"
    )
    .in("id", enrollmentIds);
  if (e2) throw e2;

  type EnrollmentJoin = {
    id: string;
    students: { first_name: string; last_name: string } | null;
    course_editions: {
      name: string | null;
      start_date: string;
      course_types: { name: string } | null;
    } | null;
  };

  const map: Record<string, EnrollmentJoin> = {};
  for (const e of enrollments as unknown as EnrollmentJoin[]) map[e.id] = e;

  return commissionRows.map((r) => {
    const e = map[r.enrollment_id];
    return {
      ...r,
      student_name: e?.students ? `${e.students.last_name}, ${e.students.first_name}` : "—",
      course_name: e?.course_editions?.course_types?.name ?? "—",
      edition_label:
        e?.course_editions?.name ||
        (e?.course_editions ? formatDateAR(e.course_editions.start_date) : "—"),
    } satisfies CommissionPaymentRow;
  });
}

export async function listCommissionRateHistory() {
  const { data, error } = await supabase
    .from("commission_rate_history")
    .select("*")
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return data as CommissionRateEntry[];
}

export async function getCurrentCommissionRate() {
  const { data, error } = await supabase
    .from("commission_rate_history")
    .select("*")
    .lte("effective_from", new Date().toISOString().slice(0, 10))
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CommissionRateEntry | null;
}

export async function addCommissionRate(ratePercent: number, effectiveFrom: string, notes?: string) {
  const { data, error } = await supabase
    .from("commission_rate_history")
    .insert({ rate_percent: ratePercent, effective_from: effectiveFrom, notes: notes || null })
    .select()
    .single();
  if (error) throw error;
  return data as CommissionRateEntry;
}
