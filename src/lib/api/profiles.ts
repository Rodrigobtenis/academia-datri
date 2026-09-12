import { supabase } from "../supabase";
import type { Profile, Role } from "../../types/profile";

export async function listActiveProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").eq("active", true).order("full_name");
  if (error) throw error;
  return data as Profile[];
}

// Solo admin ve todos los profiles (RLS: is_admin() habilita ver filas de otros usuarios).
export async function listAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return data as Profile[];
}

export async function updateProfileRole(id: string, role: Role) {
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", id).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfileActive(id: string, active: boolean) {
  const { data, error } = await supabase.from("profiles").update({ active }).eq("id", id).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfileName(id: string, fullName: string) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
