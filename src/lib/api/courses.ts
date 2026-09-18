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

// Solo presenciales: se usa para Agenda y "cursos próximos", donde una fecha real
// importa. Las ediciones online no tienen agenda (se registran con la fecha de carga
// solo para que cuenten en el mes corriente en reportes/gestión).
export async function listEditionsInRange(start: string, end: string) {
  const { data, error } = await supabase
    .from("course_editions")
    .select("*, course_types(id, name)")
    .eq("modality", "presencial")
    .gte("start_date", start)
    .lt("start_date", end)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as (CourseEdition & { course_types: { id: string; name: string } | null })[];
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

export async function deleteEdition(id: string) {
  const { error } = await supabase.from("course_editions").delete().eq("id", id);
  if (error) throw error;
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
