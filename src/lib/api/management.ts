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

export async function getPendingTotal() {
  const { data, error } = await supabase.from("v_enrollment_balance").select("balance");
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
