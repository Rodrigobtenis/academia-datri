import type { PaymentMethod, PaymentStatus, PaymentType } from "./payment";

export type AppointmentStatus = "reservado" | "confirmado" | "atendido" | "cancelado" | "no_asistio";

export interface Appointment {
  id: string;
  student_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  price: string;
  status: AppointmentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentInput = Omit<Appointment, "id" | "created_at" | "updated_at">;

export interface AppointmentWithDetails extends Appointment {
  students: { id: string; first_name: string; last_name: string; phone: string | null } | null;
  professionals: { id: string; first_name: string; last_name: string } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
}

export interface AppointmentBalance {
  appointment_id: string;
  final_price: string;
  paid_amount: string;
  balance: string;
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  reservado: "Reservado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  no_asistio: "No asistió",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, "gray" | "blue" | "green" | "red" | "amber"> = {
  reservado: "gray",
  confirmado: "blue",
  atendido: "green",
  cancelado: "red",
  no_asistio: "amber",
};

// Mismo esquema que Payment (types/payment.ts) pero para turnos en vez de inscripciones.
export interface AppointmentPayment {
  id: string;
  appointment_id: string;
  payment_date: string;
  amount: string;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export type AppointmentPaymentInput = Pick<
  AppointmentPayment,
  "appointment_id" | "payment_date" | "amount" | "payment_type" | "payment_method" | "reference" | "notes"
>;

export interface ProfessionalBlock {
  id: string;
  professional_id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export type ProfessionalBlockInput = Omit<ProfessionalBlock, "id" | "created_at">;
