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

export async function uploadDocument(params: {
  file: File;
  type: DocumentType;
  studentId?: string;
  enrollmentId?: string;
  uploadedBy: string | null;
}) {
  const folder = params.studentId ?? params.enrollmentId ?? "otros";
  const path = `${folder}/${crypto.randomUUID()}-${params.file.name}`;

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
