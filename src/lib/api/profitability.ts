import { supabase } from "../supabase";

export interface EditionProfitability {
  course_edition_id: string;
  name: string | null;
  course_type_id: string;
  income: string;
  expenses_total: string;
  profit: string;
  edition_date?: string;
  course_type_name?: string;
}

export async function listProfitability() {
  const { data: rows, error } = await supabase.from("v_edition_profitability").select("*");
  if (error) throw error;
  const profitRows = rows as EditionProfitability[];
  if (profitRows.length === 0) return [];

  const editionIds = profitRows.map((r) => r.course_edition_id);
  const { data: editions, error: e2 } = await supabase
    .from("course_editions")
    .select("id, start_date, course_types(name)")
    .in("id", editionIds);
  if (e2) throw e2;

  const map: Record<string, { start_date: string; course_types: { name: string } | null }> = {};
  for (const ed of editions as unknown as { id: string; start_date: string; course_types: { name: string } | null }[]) {
    map[ed.id] = ed;
  }

  return profitRows.map((r) => ({
    ...r,
    edition_date: map[r.course_edition_id]?.start_date,
    course_type_name: map[r.course_edition_id]?.course_types?.name ?? "—",
  }));
}
