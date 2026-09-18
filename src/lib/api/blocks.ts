import { supabase } from "../supabase";
import type { ProfessionalBlock, ProfessionalBlockInput } from "../../types/appointment";

export async function listBlocksForDate(date: string) {
  const { data, error } = await supabase.from("professional_blocks").select("*").eq("block_date", date);
  if (error) throw error;
  return data as ProfessionalBlock[];
}

export async function listProfessionalBlocksForDate(professionalId: string, date: string) {
  const { data, error } = await supabase
    .from("professional_blocks")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("block_date", date);
  if (error) throw error;
  return data as ProfessionalBlock[];
}

export async function createBlock(input: ProfessionalBlockInput) {
  const { data, error } = await supabase.from("professional_blocks").insert(input).select().single();
  if (error) throw error;
  return data as ProfessionalBlock;
}

export async function deleteBlock(id: string) {
  const { error } = await supabase.from("professional_blocks").delete().eq("id", id);
  if (error) throw error;
}
