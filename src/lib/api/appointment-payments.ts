import { supabase } from "../supabase";
import type { AppointmentPayment, AppointmentPaymentInput } from "../../types/appointment";

export async function listAppointmentPayments(appointmentId: string) {
  const { data, error } = await supabase
    .from("appointment_payments")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AppointmentPayment[];
}

export async function createAppointmentPayment(input: AppointmentPaymentInput) {
  const { data, error } = await supabase.from("appointment_payments").insert(input).select().single();
  if (error) throw error;
  return data as AppointmentPayment;
}

export async function voidAppointmentPayment(id: string, reason: string, voidedBy: string | null) {
  const { data, error } = await supabase
    .from("appointment_payments")
    .update({
      status: "anulado",
      voided_at: new Date().toISOString(),
      voided_by: voidedBy,
      void_reason: reason,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AppointmentPayment;
}
