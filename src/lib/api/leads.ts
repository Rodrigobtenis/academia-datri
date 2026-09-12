import { supabase } from "../supabase";
import { createStudent } from "./students";
import type { Lead, LeadInput } from "../../types/lead";

export async function listLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*, course_types(id, name)")
    .order("next_followup", { ascending: true, nullsFirst: false })
    .order("contact_date", { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

export async function createLead(input: LeadInput) {
  const { data, error } = await supabase.from("leads").insert(input).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, input: Partial<LeadInput>) {
  const { data, error } = await supabase.from("leads").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function convertLeadToStudent(lead: Lead) {
  const [firstName, ...rest] = lead.name.trim().split(" ");
  const student = await createStudent({
    first_name: firstName || lead.name,
    last_name: rest.join(" ") || "-",
    dni: null,
    birth_date: null,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: null,
    instagram: lead.instagram,
    city: null,
    province: null,
    country: "Argentina",
    profession: null,
    specialty: null,
    source: lead.source,
    notes: lead.notes,
    status: "activa",
    photo_url: null,
  });

  const { data, error } = await supabase
    .from("leads")
    .update({ status: "inscripta", converted_student_id: student.id })
    .eq("id", lead.id)
    .select()
    .single();
  if (error) throw error;

  return { lead: data as Lead, student };
}
