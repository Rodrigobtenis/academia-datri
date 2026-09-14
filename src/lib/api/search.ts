import { supabase } from "../supabase";

export type SearchResultKind = "alumna" | "modelo" | "lead" | "modalidad";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

// Búsqueda global liviana: dispara en paralelo contra alumnas, modelos, leads (CRM)
// y modalidades de curso, todo con ilike sobre pocos campos e limitado a 5 por categoría.
export async function globalSearch(term: string): Promise<SearchResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [students, models, leads, courseTypes] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, phone, dni")
      .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},dni.ilike.${like}`)
      .limit(5),
    supabase
      .from("models")
      .select("id, first_name, last_name, phone")
      .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`)
      .limit(5),
    supabase
      .from("leads")
      .select("id, name, phone, status")
      .or(`name.ilike.${like},phone.ilike.${like}`)
      .limit(5),
    supabase.from("course_types").select("id, name").ilike("name", like).limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const s of students.data ?? []) {
    results.push({
      kind: "alumna",
      id: s.id,
      title: `${s.last_name}, ${s.first_name}`,
      subtitle: s.phone ?? s.dni ?? null,
      href: `/alumnas/${s.id}`,
    });
  }

  for (const m of models.data ?? []) {
    results.push({
      kind: "modelo",
      id: m.id,
      title: `${m.last_name}, ${m.first_name}`,
      subtitle: m.phone ?? null,
      href: `/modelos`,
    });
  }

  for (const l of leads.data ?? []) {
    results.push({
      kind: "lead",
      id: l.id,
      title: l.name,
      subtitle: l.phone ?? null,
      href: `/crm`,
    });
  }

  for (const c of courseTypes.data ?? []) {
    results.push({
      kind: "modalidad",
      id: c.id,
      title: c.name,
      subtitle: "Modalidad de curso",
      href: `/cursos/${c.id}`,
    });
  }

  return results;
}

export const SEARCH_KIND_LABELS: Record<SearchResultKind, string> = {
  alumna: "Alumna",
  modelo: "Modelo",
  lead: "CRM",
  modalidad: "Modalidad",
};
