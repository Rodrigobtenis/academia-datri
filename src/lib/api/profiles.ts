import { supabase } from "../supabase";
import type { Profile } from "../../types/profile";

export async function listActiveProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").eq("active", true).order("full_name");
  if (error) throw error;
  return data as Profile[];
}
