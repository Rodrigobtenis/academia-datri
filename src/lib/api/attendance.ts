import { supabase } from "../supabase";
import type { AttendanceRecord, AttendanceStatus, CertificateRecord, CertificateStatus } from "../../types/attendance";

export async function listAttendanceDates(editionId: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("attendance_date")
    .eq("course_edition_id", editionId);
  if (error) throw error;
  const dates = [...new Set((data as { attendance_date: string }[]).map((r) => r.attendance_date))];
  return dates.sort();
}

export async function listAttendanceForDate(editionId: string, date: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("course_edition_id", editionId)
    .eq("attendance_date", date);
  if (error) throw error;
  return data as AttendanceRecord[];
}

export async function setAttendance(
  studentId: string,
  editionId: string,
  date: string,
  status: AttendanceStatus
) {
  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      { student_id: studentId, course_edition_id: editionId, attendance_date: date, status },
      { onConflict: "student_id,course_edition_id,attendance_date" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as AttendanceRecord;
}

export async function listCertificates(editionId: string) {
  const { data, error } = await supabase.from("certificates").select("*").eq("course_edition_id", editionId);
  if (error) throw error;
  return data as CertificateRecord[];
}

export async function setCertificateStatus(studentId: string, editionId: string, status: CertificateStatus) {
  const { data, error } = await supabase
    .from("certificates")
    .upsert(
      {
        student_id: studentId,
        course_edition_id: editionId,
        status,
        delivered_at: status === "entregado" ? new Date().toISOString() : null,
      },
      { onConflict: "student_id,course_edition_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as CertificateRecord;
}
