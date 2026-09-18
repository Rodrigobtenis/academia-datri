import { supabase } from "../supabase";
import type { Appointment, AppointmentBalance, AppointmentInput, AppointmentWithDetails } from "../../types/appointment";

const DETAILS_SELECT =
  "*, students(id, first_name, last_name, phone), professionals(id, first_name, last_name), services(id, name, duration_minutes)";

export async function listAppointmentsForDate(date: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select(DETAILS_SELECT)
    .eq("appointment_date", date)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data as unknown as AppointmentWithDetails[];
}

export async function listAppointmentsInRange(start: string, end: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select(DETAILS_SELECT)
    .gte("appointment_date", start)
    .lt("appointment_date", end)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data as unknown as AppointmentWithDetails[];
}

// Turnos del mismo profesional en la misma fecha, para chequear superposición de horarios
// antes de agendar. Se excluyen los cancelados: un turno cancelado libera el horario.
export async function listProfessionalAppointmentsForDate(professionalId: string, date: string, excludeId?: string) {
  let query = supabase
    .from("appointments")
    .select("id, start_time, end_time, status, students(first_name, last_name)")
    .eq("professional_id", professionalId)
    .eq("appointment_date", date)
    .neq("status", "cancelado");
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    students: { first_name: string; last_name: string } | null;
  }[];
}

export async function getAppointment(id: string) {
  const { data, error } = await supabase.from("appointments").select(DETAILS_SELECT).eq("id", id).single();
  if (error) throw error;
  return data as unknown as AppointmentWithDetails;
}

export async function createAppointment(input: AppointmentInput) {
  const { data, error } = await supabase.from("appointments").insert(input).select().single();
  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointment(id: string, input: Partial<AppointmentInput>) {
  const { data, error } = await supabase
    .from("appointments")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function getAppointmentBalance(appointmentId: string) {
  const { data, error } = await supabase
    .from("v_appointment_balance")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  return data as AppointmentBalance | null;
}

// Para pintar el calendario según cuánto se pagó de cada turno (ver getAppointmentDisplayState
// en types/appointment.ts) sin hacer una consulta por turno.
export async function getAppointmentBalancesByIds(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, AppointmentBalance>;
  const { data, error } = await supabase.from("v_appointment_balance").select("*").in("appointment_id", ids);
  if (error) throw error;
  const map: Record<string, AppointmentBalance> = {};
  for (const row of data as AppointmentBalance[]) map[row.appointment_id] = row;
  return map;
}
