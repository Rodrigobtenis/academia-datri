export type AttendanceStatus = "asistio" | "no_asistio" | "tarde" | "justifico";
export type CertificateStatus = "pendiente" | "preparado" | "entregado";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  course_edition_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
}

export interface CertificateRecord {
  id: string;
  student_id: string;
  course_edition_id: string;
  status: CertificateStatus;
  delivered_at: string | null;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  asistio: "Asistió",
  no_asistio: "No asistió",
  tarde: "Llegó tarde",
  justifico: "Justificó ausencia",
};

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  pendiente: "Pendiente",
  preparado: "Preparado",
  entregado: "Entregado",
};
