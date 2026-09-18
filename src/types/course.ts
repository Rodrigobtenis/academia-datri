export interface CourseType {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export type EditionStatus =
  | "borrador"
  | "abierto"
  | "proximo"
  | "completo"
  | "finalizado"
  | "cancelado";

export type EditionModality = "presencial" | "online";

export interface CourseEdition {
  id: string;
  course_type_id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  teacher: string | null;
  max_students: number;
  list_price: string;
  promo_price: string | null;
  status: EditionStatus;
  modality: EditionModality;
  description: string | null;
  includes: string | null;
  materials: string | null;
  requirements: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseEditionInput = Omit<CourseEdition, "id" | "created_at" | "updated_at">;

export interface EditionOccupancy {
  course_edition_id: string;
  max_students: number;
  enrolled_count: number;
  available: number;
  occupancy_pct: number | null;
}

export const EDITION_STATUS_LABELS: Record<EditionStatus, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  proximo: "Próximo",
  completo: "Completo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const EDITION_STATUS_COLORS: Record<EditionStatus, "gray" | "green" | "blue" | "amber" | "red"> = {
  borrador: "gray",
  abierto: "green",
  proximo: "blue",
  completo: "amber",
  finalizado: "gray",
  cancelado: "red",
};

export const EDITION_MODALITY_LABELS: Record<EditionModality, string> = {
  presencial: "Presencial",
  online: "Online",
};

export const EDITION_MODALITY_COLORS: Record<EditionModality, "blue" | "brand"> = {
  presencial: "blue",
  online: "brand",
};
