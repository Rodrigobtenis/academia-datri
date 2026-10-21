import { supabase } from "../supabase";
import type { DocumentRow, DocumentType } from "../../types/document";

const BUCKET = "documentos";

export async function listDocumentsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as DocumentRow[];
}

export async function listDocumentsByEnrollment(enrollmentId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as DocumentRow[];
}

export async function listContractsByEnrollments(enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return [] as DocumentRow[];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("type", "contrato")
    .in("enrollment_id", enrollmentIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as DocumentRow[];
}

export async function uploadDocument(params: {
  file: File;
  type: DocumentType;
  studentId?: string;
  enrollmentId?: string;
  uploadedBy: string | null;
}) {
  const folder = params.studentId ?? params.enrollmentId ?? "otros";
  // Storage rechaza algunos caracteres (acentos, símbolos) en el nombre de la clave.
  const safeName = params.file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      student_id: params.studentId ?? null,
      enrollment_id: params.enrollmentId ?? null,
      type: params.type,
      file_url: path,
      uploaded_by: params.uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DocumentRow;
}

export async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(doc: DocumentRow) {
  await supabase.storage.from(BUCKET).remove([doc.file_url]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}
