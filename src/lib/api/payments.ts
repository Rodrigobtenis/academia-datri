import { supabase } from "../supabase";
import type { Payment, PaymentInput } from "../../types/payment";

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

export async function voidPayment(id: string, reason: string, voidedBy: string | null) {
  const { data, error } = await supabase
    .from("payments")
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
  return data as Payment;
}
