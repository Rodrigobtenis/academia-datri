import { supabase } from "../supabase";
import type { Professional, ProfessionalCommission, ProfessionalInput } from "../../types/professional";

export async function listProfessionals() {
  const { data, error } = await supabase.from("professionals").select("*").order("first_name");
  if (error) throw error;
  return data as Professional[];
}

export async function createProfessional(input: ProfessionalInput) {
  const { data, error } = await supabase.from("professionals").insert(input).select().single();
  if (error) throw error;
  return data as Professional;
}

export async function updateProfessional(id: string, input: Partial<ProfessionalInput>) {
  const { data, error } = await supabase
    .from("professionals")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Professional;
}

export async function getProfessionalCommissions(month: number, year: number) {
  const { data, error } = await supabase
    .from("v_professional_commission")
    .select("*")
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
  return data as ProfessionalCommission[];
}
