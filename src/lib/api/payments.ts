import { supabase } from "../supabase";
import type { Payment, PaymentFormValues, PaymentInput } from "../../types/payment";

export async function listPaymentsByEnrollment(enrollmentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function listPaymentsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, enrollments!inner(student_id, course_edition_id)")
    .eq("enrollments.student_id", studentId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data as (Payment & { enrollments: { student_id: string; course_edition_id: string } })[];
}

export async function createPayment(input: PaymentInput) {
  const { data, error } = await supabase.from("payments").insert(input).select().single();
  if (error) throw error;
  return data as Payment;
}

// El monto de "input" es el NOMINAL (lo que se carga antes del descuento). La función de
// base de datos calcula cuánto se cobra realmente, reduce el precio final de la
// inscripción por la diferencia, y guarda todo en una sola transacción.
export async function createPaymentWithCashDiscount(input: PaymentInput & { cash_discount_percent: number }) {
  const { data, error } = await supabase.rpc("register_cash_discount_payment", {
    p_enrollment_id: input.enrollment_id,
    p_payment_date: input.payment_date,
    p_nominal_amount: input.amount,
    p_discount_percent: input.cash_discount_percent,
    p_payment_type: input.payment_type,
    p_reference: input.reference,
    p_notes: input.notes,
  });
  if (error) throw error;
  return data as Payment;
}

export async function submitPayment(values: PaymentFormValues) {
  if (values.cash_discount_percent && values.cash_discount_percent > 0) {
    return createPaymentWithCashDiscount({ ...values, cash_discount_percent: values.cash_discount_percent });
  }
  return createPayment(values);
}

// Pasa por una función de base de datos (no un update directo) porque si el pago tenía un
// descuento por efectivo, anularlo tiene que devolver ese descuento al precio final de la
// inscripción en la misma transacción — ver 0012_descuento_pago_efectivo.sql.
export async function voidPayment(id: string, reason: string, voidedBy: string | null) {
  const { data, error } = await supabase.rpc("void_payment", {
    p_payment_id: id,
    p_reason: reason,
    p_voided_by: voidedBy,
  });
  if (error) throw error;
  return data as Payment;
}
