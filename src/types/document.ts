export type DocumentType = "comprobante" | "dni" | "formulario" | "consentimiento" | "certificado" | "otro";

export interface DocumentRow {
  id: string;
  student_id: string | null;
  enrollment_id: string | null;
  type: DocumentType;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  comprobante: "Comprobante de pago",
  dni: "DNI",
  formulario: "Formulario",
  consentimiento: "Consentimiento",
  certificado: "Certificado",
  otro: "Otro",
};
