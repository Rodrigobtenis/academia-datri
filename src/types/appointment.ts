import { formatMoney } from "../lib/money";
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

// El color del turno refleja el estado real tal cual (Reservado/Confirmado/Atendido/...) —
// el pago es independiente y se muestra aparte como texto ("Falta abonar $X" / "Pago $X").

const CONFIRMATION_DEADLINE_HOURS = 48;

// Aviso liviano (no cambia el color, solo agrega un indicador) para un reservado al que le
// queda menos de 48hs y todavía no se confirmó.
export function needsConfirmationSoon(appointment: {
  status: AppointmentStatus;
  appointment_date: string;
  start_time: string;
}): boolean {
  if (appointment.status !== "reservado") return false;
  const start = new Date(`${appointment.appointment_date}T${appointment.start_time.slice(0, 8)}`);
  const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart <= CONFIRMATION_DEADLINE_HOURS;
}

// Un turno reservado/confirmado cuya hora de fin ya pasó pasa solo a "atendido" — estar
// atendido no implica que esté pago, eso se resuelve aparte con el saldo real.
export function hasElapsed(appointment: { status: AppointmentStatus; appointment_date: string; end_time: string }): boolean {
  if (appointment.status !== "reservado" && appointment.status !== "confirmado") return false;
  const end = new Date(`${appointment.appointment_date}T${appointment.end_time.slice(0, 8)}`);
  return end.getTime() < Date.now();
}

export function paymentStatusLabel(price: string, paidAmount: number): { text: string; color: "red" | "green" } {
  const priceNum = parseFloat(price);
  const balance = priceNum - paidAmount;
  if (priceNum > 0 && balance <= 0) {
    return { text: `Pago ${formatMoney(paidAmount)}`, color: "green" };
  }
  return { text: `Falta abonar ${formatMoney(Math.max(0, balance))}`, color: "red" };
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
