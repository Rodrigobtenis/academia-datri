import { supabase } from "../supabase";
import type { Student, StudentInput } from "../../types/student";

export async function listStudents(search?: string) {
  let query = supabase.from("students").select("*").order("last_name", { ascending: true });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},dni.ilike.${term},email.ilike.${term},phone.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Student[];
}

export async function getStudent(id: string) {
  const { data, error } = await supabase.from("students").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Student;
}

export async function createStudent(input: StudentInput) {
  const { data, error } = await supabase.from("students").insert(input).select().single();
  if (error) throw error;
  return data as Student;
}

export async function updateStudent(id: string, input: Partial<StudentInput>) {
  const { data, error } = await supabase
    .from("students")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Student;
}
