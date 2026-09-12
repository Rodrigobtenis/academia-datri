export interface MonthlyGoal {
  id: string;
  month: number;
  year: number;
  target_amount: string;
  name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal_id: string;
  month: number;
  year: number;
  target_amount: string;
  collected: string;
  remaining: string;
  percent_complete: number | null;
}

export type GoalState = "bajo" | "en_camino" | "muy_cerca" | "cumplido";

export function goalState(percent: number): GoalState {
  if (percent >= 100) return "cumplido";
  if (percent >= 80) return "muy_cerca";
  if (percent >= 50) return "en_camino";
  return "bajo";
}

export const GOAL_STATE_LABELS: Record<GoalState, string> = {
  bajo: "Bajo",
  en_camino: "En camino",
  muy_cerca: "Muy cerca",
  cumplido: "Objetivo cumplido",
};

export const GOAL_STATE_COLORS: Record<GoalState, string> = {
  bajo: "bg-red-500",
  en_camino: "bg-amber-500",
  muy_cerca: "bg-blue-500",
  cumplido: "bg-emerald-500",
};
