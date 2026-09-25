import { supabase } from "../supabase";

export interface EnrollmentDeletionSummary {
  paymentCount: number;
  totalCollected: number;
  documentCount: number;
}

export async function getEnrollmentDeletionSummary(enrollmentId: string): Promise<EnrollmentDeletionSummary> {
  const { data: payments, error: e1 } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("enrollment_id", enrollmentId);
  if (e1) throw e1;
  const paymentCount = payments?.length ?? 0;
  const totalCollected = (payments ?? [])
    .filter((p) => p.status === "valido")
    .reduce((acc, p) => acc + parseFloat(p.amount), 0);

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId);

  return { paymentCount, totalCollected, documentCount: count ?? 0 };
}

// Borra por completo una inscripción cargada por error (ej. curso equivocado) y todo lo que
// depende de ella: pagos y documentos adjuntos (incluyendo los archivos en Storage).
// Irreversible — el dinero de los pagos borrados deja de sumar en comisiones/objetivos/
// gestión para siempre. Solo se llama tras la doble confirmación del usuario en la UI.
export async function forceDeleteEnrollmentCascade(enrollmentId: string) {
  const { data: docs, error: eDocs } = await supabase
    .from("documents")
    .select("id, file_url")
    .eq("enrollment_id", enrollmentId);
  if (eDocs) throw eDocs;
  const paths = (docs ?? []).map((d) => d.file_url);
  if (paths.length > 0) {
    await supabase.storage.from("documentos").remove(paths);
  }
  if (docs && docs.length > 0) {
    const { error } = await supabase.from("documents").delete().eq("enrollment_id", enrollmentId);
    if (error) throw error;
  }

  // Pagos de la inscripción se borran vía RPC (SECURITY DEFINER) en vez de un delete
  // directo a la tabla: así cualquier activo puede ejecutar esta cascada puntual sin que
  // eso abra una policy general de "borrar pagos" en la app.
  const { error: eFinancials } = await supabase.rpc("purge_enrollment_financials", {
    p_enrollment_id: enrollmentId,
  });
  if (eFinancials) throw eFinancials;

  const { error: eEnrollment } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
  if (eEnrollment) throw eEnrollment;
}
