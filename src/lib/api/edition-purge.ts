import { supabase } from "../supabase";

export interface EditionDeletionSummary {
  enrollmentCount: number;
  paymentCount: number;
  totalCollected: number;
  attendanceCount: number;
  certificateCount: number;
  waitlistCount: number;
  expenseCount: number;
  documentCount: number;
}

export async function getEditionDeletionSummary(editionId: string): Promise<EditionDeletionSummary> {
  const { data: enrollments, error: e1 } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_edition_id", editionId);
  if (e1) throw e1;
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);

  let paymentCount = 0;
  let totalCollected = 0;
  let documentCount = 0;
  if (enrollmentIds.length > 0) {
    const { data: payments, error: e2 } = await supabase
      .from("payments")
      .select("amount, status")
      .in("enrollment_id", enrollmentIds);
    if (e2) throw e2;
    paymentCount = payments?.length ?? 0;
    totalCollected = (payments ?? [])
      .filter((p) => p.status === "valido")
      .reduce((acc, p) => acc + parseFloat(p.amount), 0);

    const { count } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("enrollment_id", enrollmentIds);
    documentCount = count ?? 0;
  }

  const [{ count: attendanceCount }, { count: certificateCount }, { count: waitlistCount }, { count: expenseCount }] =
    await Promise.all([
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("course_edition_id", editionId),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("course_edition_id", editionId),
      supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("course_edition_id", editionId),
      supabase.from("expenses").select("id", { count: "exact", head: true }).eq("course_edition_id", editionId),
    ]);

  return {
    enrollmentCount: enrollmentIds.length,
    paymentCount,
    totalCollected,
    attendanceCount: attendanceCount ?? 0,
    certificateCount: certificateCount ?? 0,
    waitlistCount: waitlistCount ?? 0,
    expenseCount: expenseCount ?? 0,
    documentCount,
  };
}

// Borra por completo una edición y todo lo que depende de ella: pagos, inscripciones,
// asistencia, certificados, lista de espera, gastos y documentos (incluyendo los archivos
// en Storage). Irreversible — el dinero de los pagos borrados deja de sumar en
// comisiones/objetivos/gestión para siempre. Solo se llama tras la doble confirmación
// del usuario en la UI.
export async function forceDeleteEditionCascade(editionId: string) {
  const { data: enrollments, error: e1 } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_edition_id", editionId);
  if (e1) throw e1;
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);

  if (enrollmentIds.length > 0) {
    const { data: docs, error: eDocs } = await supabase
      .from("documents")
      .select("id, file_url")
      .in("enrollment_id", enrollmentIds);
    if (eDocs) throw eDocs;
    const paths = (docs ?? []).map((d) => d.file_url);
    if (paths.length > 0) {
      await supabase.storage.from("documentos").remove(paths);
    }
    if (docs && docs.length > 0) {
      const { error } = await supabase.from("documents").delete().in("enrollment_id", enrollmentIds);
      if (error) throw error;
    }
  }

  // Pagos y gastos de la edición se borran vía RPC (SECURITY DEFINER) en vez de un
  // delete directo a la tabla: así cualquier activo puede ejecutar esta cascada
  // puntual sin que eso abra una policy general de "borrar pagos/gastos" en la app.
  const { error: eFinancials } = await supabase.rpc("purge_edition_financials", { p_edition_id: editionId });
  if (eFinancials) throw eFinancials;

  const { error: eAttendance } = await supabase.from("attendance").delete().eq("course_edition_id", editionId);
  if (eAttendance) throw eAttendance;

  const { error: eCertificates } = await supabase.from("certificates").delete().eq("course_edition_id", editionId);
  if (eCertificates) throw eCertificates;

  const { error: eWaitlist } = await supabase.from("waitlist").delete().eq("course_edition_id", editionId);
  if (eWaitlist) throw eWaitlist;

  if (enrollmentIds.length > 0) {
    const { error: eEnrollments } = await supabase.from("enrollments").delete().eq("course_edition_id", editionId);
    if (eEnrollments) throw eEnrollments;
  }

  const { error: eEdition } = await supabase.from("course_editions").delete().eq("id", editionId);
  if (eEdition) throw eEdition;
}
