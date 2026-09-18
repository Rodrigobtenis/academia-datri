import { supabase } from "../supabase";
import type { Service, ServiceInput } from "../../types/service";

export async function listServices() {
  const { data, error } = await supabase.from("services").select("*").order("name");
  if (error) throw error;
  return data as Service[];
}

export async function createService(input: ServiceInput) {
  const { data, error } = await supabase.from("services").insert(input).select().single();
  if (error) throw error;
  return data as Service;
}

export async function updateService(id: string, input: Partial<ServiceInput>) {
  const { data, error } = await supabase.from("services").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Service;
}
