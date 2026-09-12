import { supabase } from "../supabase";
import type { GoalProgress, MonthlyGoal } from "../../types/goal";

export async function getGoalProgress(month: number, year: number) {
  const { data, error } = await supabase
    .from("v_goal_progress")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  return data as GoalProgress | null;
}

export async function upsertGoal(input: {
  month: number;
  year: number;
  target_amount: number;
  name?: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("monthly_goals")
    .upsert(
      {
        month: input.month,
        year: input.year,
        target_amount: input.target_amount,
        name: input.name || null,
        notes: input.notes || null,
      },
      { onConflict: "month,year" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyGoal;
}

export async function listGoalsHistory() {
  const { data, error } = await supabase
    .from("monthly_goals")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data as MonthlyGoal[];
}

export async function listGoalProgressHistory() {
  const { data, error } = await supabase
    .from("v_goal_progress")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data as GoalProgress[];
}
