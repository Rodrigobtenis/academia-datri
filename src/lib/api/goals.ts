import { supabase } from "../supabase";
import { getMonthlyCollection } from "./management";
import type { GoalProgress, MonthlyGoal } from "../../types/goal";

// Objetivo de un mes con su avance. Si ese mes todavía no tiene objetivo propio, no queda en
// blanco: se repite el último objetivo definido antes (y se avisa de cuál mes viene) hasta que
// se cargue uno nuevo en Configuración.
export async function getGoalProgress(month: number, year: number) {
  const { data, error } = await supabase
    .from("v_goal_progress")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as GoalProgress;

  const { data: prev, error: prevError } = await supabase
    .from("monthly_goals")
    .select("*")
    .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevError) throw prevError;
  if (!prev) return null;

  const collectedRow = await getMonthlyCollection(month, year);
  const target = parseFloat((prev as MonthlyGoal).target_amount);
  const collected = parseFloat(collectedRow?.net_collected ?? "0");
  return {
    goal_id: (prev as MonthlyGoal).id,
    month,
    year,
    target_amount: String(target),
    collected: String(collected),
    remaining: String(target - collected),
    percent_complete: target > 0 ? Math.round((1000 * collected) / target) / 10 : null,
    inherited_from: { month: (prev as MonthlyGoal).month, year: (prev as MonthlyGoal).year },
  } satisfies GoalProgress;
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
