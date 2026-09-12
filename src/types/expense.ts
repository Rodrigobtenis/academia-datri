export type ExpenseCategory =
  | "materiales"
  | "docentes"
  | "publicidad"
  | "catering"
  | "alquiler"
  | "servicios"
  | "impresion"
  | "certificados"
  | "insumos"
  | "otros";

export interface Expense {
  id: string;
  course_edition_id: string | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ExpenseInput = Omit<Expense, "id" | "created_at" | "created_by">;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materiales: "Materiales",
  docentes: "Docentes",
  publicidad: "Publicidad",
  catering: "Catering",
  alquiler: "Alquiler",
  servicios: "Servicios",
  impresion: "Impresión",
  certificados: "Certificados",
  insumos: "Insumos",
  otros: "Otros",
};
