import { supabase } from "../supabase";
import type { Service } from "../../types/service";

// Todo este archivo corre SIN sesión (rol "anon" de Postgres) — solo puede tocar lo que las
// policies "*_select_public" y las funciones RPC de 0019_autoagenda_publica.sql permiten
// explícitamente. No usar nada de acá para pantallas de staff logueado.

export interface PublicProfessional {
  id: string;
  first_name: string;
  last_name: string;
}

export async function listPublicServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, category, duration_minutes, price, active, created_at")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data as Service[];
}

export async function listPublicProfessionals() {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, first_name, last_name")
    .eq("active", true)
    .order("first_name");
  if (error) throw error;
  return data as PublicProfessional[];
}

export interface BusySlot {
  start_time: string;
  end_time: string;
}

export async function getPublicBusySlots(professionalId: string, date: string) {
  const { data, error } = await supabase.rpc("get_public_busy_slots", {
    p_professional_id: professionalId,
    p_date: date,
  });
  if (error) throw error;
  return data as BusySlot[];
}

export interface PublicBookingInput {
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export async function createPublicAppointment(input: PublicBookingInput) {
  const { data, error } = await supabase.rpc("create_public_appointment", {
    p_service_id: input.serviceId,
    p_professional_id: input.professionalId,
    p_date: input.date,
    p_start_time: input.startTime,
    p_first_name: input.firstName,
    p_last_name: input.lastName || "-",
    p_phone: input.phone,
    p_email: input.email || null,
  });
  if (error) throw error;
  return data as string;
}
