export type DiscountType = "monto" | "porcentaje";
export type Currency = "ars" | "usd";

export type EnrollmentStatus =
  | "consulta"
  | "reservada"
  | "confirmada"
  | "pagando"
  | "pagada"
  | "asistio"
  | "finalizada"
  | "cancelada"
  | "no_asistio";

export interface Enrollment {
  id: string;
  student_id: string;
  course_edition_id: string;
  original_price: string;
  discount_type: DiscountType | null;
  discount_value: string | null;
  discount_reason: string | null;
  discount_authorized_by: string | null;
  final_price: string;
  status: EnrollmentStatus;
  sales_responsible: string | null;
  override_capacity: boolean;
  override_authorized_by: string | null;
  notes: string | null;
  currency: Currency;
  original_price_usd: string | null;
  final_price_usd: string | null;
  fx_rate: string | null;
  created_at: string;
  updated_at: string;
}

export type EnrollmentInput = Omit<Enrollment, "id" | "created_at" | "updated_at">;

export interface EnrollmentBalance {
  enrollment_id: string;
  final_price: string;
  paid_amount: string;
  balance: string;
}

// Con datos de la alumna embebidos (join), para listados
export interface EnrollmentWithStudent extends Enrollment {
  students: { id: string; first_name: string; last_name: string } | null;
}

export interface EnrollmentWithEdition extends Enrollment {
  course_editions: {
    id: string;
    name: string | null;
    start_date: string;
    course_type_id: string;
  } | null;
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  consulta: "Consulta",
  reservada: "Reservada",
  confirmada: "Confirmada",
  pagando: "Pagando",
  pagada: "Pagada",
  asistio: "Asistió",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

export const ENROLLMENT_STATUS_COLORS: Record<
  EnrollmentStatus,
  "gray" | "green" | "blue" | "amber" | "red" | "brand"
> = {
  consulta: "gray",
  reservada: "blue",
  confirmada: "blue",
  pagando: "amber",
  pagada: "green",
  asistio: "green",
  finalizada: "gray",
  cancelada: "red",
  no_asistio: "red",
};
