import { supabase } from "../supabase";
import type { Expense, ExpenseInput } from "../../types/expense";

export interface ExpenseWithEdition extends Expense {
  course_editions: { id: string; name: string | null; start_date: string; course_type_id: string } | null;
}

export async function listExpenses(month?: number, year?: number) {
  let query = supabase
    .from("expenses")
    .select("*, course_editions(id, name, start_date, course_type_id)")
    .order("expense_date", { ascending: false });

  if (month && year) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 1).toISOString().slice(0, 10);
    query = query.gte("expense_date", start).lt("expense_date", end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ExpenseWithEdition[];
}

export async function listExpensesByEdition(courseEditionId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("course_edition_id", courseEditionId)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(input: ExpenseInput) {
  const { data, error } = await supabase.from("expenses").insert(input).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
