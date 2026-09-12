import { supabase } from "../supabase";
import type { WaitlistEntry, WaitlistInput } from "../../types/waitlist";

export async function listWaitlist(editionId: string) {
  const { data, error } = await supabase
    .from("waitlist")
    .select("*, students(id, first_name, last_name)")
    .eq("course_edition_id", editionId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as WaitlistEntry[];
}

export async function addToWaitlist(input: WaitlistInput) {
  const { data, error } = await supabase.from("waitlist").insert(input).select().single();
  if (error) throw error;
  return data as WaitlistEntry;
}

export async function removeFromWaitlist(id: string) {
  const { error } = await supabase.from("waitlist").delete().eq("id", id);
  if (error) throw error;
}
