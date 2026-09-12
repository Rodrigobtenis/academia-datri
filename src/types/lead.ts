import type { StudentSource } from "./student";

export type LeadStatus =
  | "nueva_consulta"
  | "contactada"
  | "interesada"
  | "pendiente_respuesta"
  | "reservo"
  | "perdida"
  | "inscripta";

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  course_type_id: string | null;
  status: LeadStatus;
  source: StudentSource | null;
  contact_date: string;
  next_followup: string | null;
  sales_responsible: string | null;
  notes: string | null;
  converted_student_id: string | null;
  converted_enrollment_id: string | null;
  created_at: string;
  course_types: { id: string; name: string } | null;
}

export type LeadInput = Omit<Lead, "id" | "created_at" | "course_types" | "converted_student_id" | "converted_enrollment_id">;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nueva_consulta: "Nueva consulta",
  contactada: "Contactada",
  interesada: "Interesada",
  pendiente_respuesta: "Pendiente de respuesta",
  reservo: "Reservó",
  perdida: "Perdida",
  inscripta: "Inscripta",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, "gray" | "blue" | "brand" | "amber" | "green" | "red"> = {
  nueva_consulta: "gray",
  contactada: "blue",
  interesada: "brand",
  pendiente_respuesta: "amber",
  reservo: "green",
  perdida: "red",
  inscripta: "green",
};
