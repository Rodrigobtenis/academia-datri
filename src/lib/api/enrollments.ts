import { supabase } from "../supabase";
import type {
  Enrollment,
  EnrollmentBalance,
  EnrollmentInput,
  EnrollmentWithEdition,
  EnrollmentWithStudent,
} from "../../types/enrollment";

export async function listEnrollmentsByEdition(editionId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, students(id, first_name, last_name)")
    .eq("course_edition_id", editionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as EnrollmentWithStudent[];
}

export async function listEnrollmentsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, course_editions(id, name, start_date, course_type_id)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EnrollmentWithEdition[];
}

export async function getEnrollmentFull(id: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, students(id, first_name, last_name), course_editions(id, name, start_date, course_type_id, list_price)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Enrollment & {
    students: { id: string; first_name: string; last_name: string } | null;
    course_editions: {
      id: string;
      name: string | null;
      start_date: string;
      course_type_id: string;
      list_price: string;
    } | null;
  };
}

export async function createEnrollment(input: EnrollmentInput) {
  const { data, error } = await supabase.from("enrollments").insert(input).select().single();
  if (error) throw error;
  return data as Enrollment;
}

export async function updateEnrollment(id: string, input: Partial<EnrollmentInput>) {
  const { data, error } = await supabase
    .from("enrollments")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Enrollment;
}

export async function getBalancesByEdition(editionId: string) {
  const { data: enrollmentIds, error: e1 } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_edition_id", editionId);
  if (e1) throw e1;
  const ids = (enrollmentIds ?? []).map((r) => r.id);
  if (ids.length === 0) return {} as Record<string, EnrollmentBalance>;

  const { data, error } = await supabase.from("v_enrollment_balance").select("*").in("enrollment_id", ids);
  if (error) throw error;
  const map: Record<string, EnrollmentBalance> = {};
  for (const row of data as EnrollmentBalance[]) map[row.enrollment_id] = row;
  return map;
}

export async function getBalance(enrollmentId: string) {
  const { data, error } = await supabase
    .from("v_enrollment_balance")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  if (error) throw error;
  return data as EnrollmentBalance | null;
}
