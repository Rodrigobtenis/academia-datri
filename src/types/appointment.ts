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

// Estado "visual" del turno: distingue reservado / necesita confirmación urgente (falta
// menos de 48hs y no está confirmado) / confirmado / abonado (saldo en $0) — además de los
// dos estados terminales cancelado/no_asistio. Es lo que se pinta en el calendario; el
// estado real sigue siendo AppointmentStatus (lo que se cambia en el desplegable).
export type AppointmentDisplayState = "reservado" | "urgente" | "confirmado" | "abonado" | "cancelado" | "no_asistio";

export const APPOINTMENT_DISPLAY_LABELS: Record<AppointmentDisplayState, string> = {
  reservado: "Reservado",
  urgente: "Sin confirmar (falta menos de 48hs)",
  confirmado: "Confirmado",
  abonado: "Abonado",
  cancelado: "Cancelado",
  no_asistio: "No asistió",
};

export const APPOINTMENT_DISPLAY_COLORS: Record<AppointmentDisplayState, "gray" | "amber" | "blue" | "green" | "red" | "brand"> = {
  reservado: "gray",
  urgente: "amber",
  confirmado: "blue",
  abonado: "green",
  cancelado: "red",
  no_asistio: "brand",
};

const CONFIRMATION_DEADLINE_HOURS = 48;

export function getAppointmentDisplayState(
  appointment: { status: AppointmentStatus; appointment_date: string; start_time: string; price: string },
  paidAmount: number
): AppointmentDisplayState {
  if (appointment.status === "cancelado") return "cancelado";
  if (appointment.status === "no_asistio") return "no_asistio";

  const price = parseFloat(appointment.price);
  if (price > 0 && paidAmount >= price) return "abonado";

  if (appointment.status === "confirmado" || appointment.status === "atendido") return "confirmado";

  const start = new Date(`${appointment.appointment_date}T${appointment.start_time.slice(0, 8)}`);
  const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart <= CONFIRMATION_DEADLINE_HOURS) return "urgente";
  return "reservado";
}

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
  cash_discount_percent: string | null;
  cash_discount_amount: string | null;
}

export type AppointmentPaymentInput = Pick<
  AppointmentPayment,
  "appointment_id" | "payment_date" | "amount" | "payment_type" | "payment_method" | "reference" | "notes"
>;

export type AppointmentPaymentFormValues = AppointmentPaymentInput & { cash_discount_percent: number | null };

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
