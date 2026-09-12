import { supabase } from "../supabase";
import type { CourseEdition, CourseEditionInput, CourseType, EditionOccupancy } from "../../types/course";

export async function listCourseTypes() {
  const { data, error } = await supabase.from("course_types").select("*").order("name");
  if (error) throw error;
  return data as CourseType[];
}

export async function createCourseType(name: string, description?: string) {
  const { data, error } = await supabase
    .from("course_types")
    .insert({ name, description: description || null })
    .select()
    .single();
  if (error) throw error;
  return data as CourseType;
}

export async function getCourseType(id: string) {
  const { data, error } = await supabase.from("course_types").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CourseType;
}

export async function listEditions(courseTypeId: string) {
  const { data, error } = await supabase
    .from("course_editions")
    .select("*")
    .eq("course_type_id", courseTypeId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data as CourseEdition[];
}

export async function getEdition(id: string) {
  const { data, error } = await supabase.from("course_editions").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CourseEdition;
}

export async function createEdition(input: CourseEditionInput) {
  const { data, error } = await supabase.from("course_editions").insert(input).select().single();
  if (error) throw error;
  return data as CourseEdition;
}

export async function updateEdition(id: string, input: Partial<CourseEditionInput>) {
  const { data, error } = await supabase
    .from("course_editions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CourseEdition;
}

export async function getOccupancy(editionId: string) {
  const { data, error } = await supabase
    .from("v_edition_occupancy")
    .select("*")
    .eq("course_edition_id", editionId)
    .maybeSingle();
  if (error) throw error;
  return data as EditionOccupancy | null;
}

export async function listOccupancyByType(courseTypeId: string) {
  const editions = await listEditions(courseTypeId);
  if (editions.length === 0) return {} as Record<string, EditionOccupancy>;
  const { data, error } = await supabase
    .from("v_edition_occupancy")
    .select("*")
    .in(
      "course_edition_id",
      editions.map((e) => e.id)
    );
  if (error) throw error;
  const map: Record<string, EditionOccupancy> = {};
  for (const row of data as EditionOccupancy[]) map[row.course_edition_id] = row;
  return map;
}
