import { supabase } from "../supabase";
import type { AppointmentPayment, AppointmentPaymentFormValues, AppointmentPaymentInput } from "../../types/appointment";

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

// El monto de "input" es el NOMINAL (lo que se carga antes del descuento) — la función de
// base de datos calcula cuánto se cobra realmente y baja el precio del turno por la
// diferencia, todo en una sola transacción (ver 0018_pagos_turnos_descuento.sql).
export async function createAppointmentPaymentWithCashDiscount(
  input: AppointmentPaymentInput & { cash_discount_percent: number }
) {
  const { data, error } = await supabase.rpc("register_appointment_cash_discount_payment", {
    p_appointment_id: input.appointment_id,
    p_payment_date: input.payment_date,
    p_nominal_amount: input.amount,
    p_discount_percent: input.cash_discount_percent,
    p_payment_type: input.payment_type,
    p_reference: input.reference,
    p_notes: input.notes,
  });
  if (error) throw error;
  return data as AppointmentPayment;
}

export async function submitAppointmentPayment(values: AppointmentPaymentFormValues) {
  if (values.cash_discount_percent && values.cash_discount_percent > 0) {
    return createAppointmentPaymentWithCashDiscount({ ...values, cash_discount_percent: values.cash_discount_percent });
  }
  return createAppointmentPayment(values);
}

// Editar el monto de un pago ya cargado (p.ej. si se tipeó mal la seña). Solo tiene sentido
// para pagos sin descuento aplicado — uno con descuento ya movió el precio del turno, y
// cambiarle el monto a mano rompería esa cuenta (la UI no ofrece esta acción en ese caso).
export async function updateAppointmentPaymentAmount(id: string, amount: string) {
  const { data, error } = await supabase.from("appointment_payments").update({ amount }).eq("id", id).select().single();
  if (error) throw error;
  return data as AppointmentPayment;
}

// Pasa por una función de base de datos (no un update directo) porque si el pago tenía un
// descuento por efectivo, anularlo tiene que devolver ese descuento al precio del turno en
// la misma transacción — ver 0018_pagos_turnos_descuento.sql.
export async function voidAppointmentPayment(id: string, reason: string, voidedBy: string | null) {
  const { data, error } = await supabase.rpc("void_appointment_payment", {
    p_payment_id: id,
    p_reason: reason,
    p_voided_by: voidedBy,
  });
  if (error) throw error;
  return data as AppointmentPayment;
}
