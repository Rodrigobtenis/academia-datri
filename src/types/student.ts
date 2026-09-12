export type StudentSource =
  | "instagram"
  | "google"
  | "recomendacion"
  | "whatsapp"
  | "alumna_anterior"
  | "publicidad"
  | "tiktok"
  | "otro";

export type StudentStatus = "activa" | "inactiva" | "potencial";

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  profession: string | null;
  specialty: string | null;
  source: StudentSource | null;
  notes: string | null;
  status: StudentStatus;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentInput = Omit<Student, "id" | "created_at" | "updated_at">;

export const STUDENT_SOURCE_LABELS: Record<StudentSource, string> = {
  instagram: "Instagram",
  google: "Google",
  recomendacion: "Recomendación",
  whatsapp: "WhatsApp",
  alumna_anterior: "Alumna anterior",
  publicidad: "Publicidad",
  tiktok: "TikTok",
  otro: "Otro",
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  activa: "Activa",
  inactiva: "Inactiva",
  potencial: "Potencial alumna",
};
