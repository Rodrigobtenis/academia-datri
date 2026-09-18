import { supabase } from "../supabase";
import { formatDateAR, nowInArgentina } from "../date-ar";

export type AlertSeverity = "info" | "warning" | "danger";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  subtitle: string;
  href: string;
}

function todayISO(): string {
  const { day, month, year } = nowInArgentina();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysISO(days: number): string {
  const { day, month, year } = nowInArgentina();
  const d = new Date(year, month - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Junta en paralelo las señales que a un admin le importa ver de un vistazo: ediciones que
// arrancan pronto, cupos por agotarse, alumnas con deuda y seguimientos de CRM vencidos.
export async function getAlerts(): Promise<Alert[]> {
  const today = todayISO();
  const soon = addDaysISO(14);

  const [editionsRes, leadsRes, enrollmentsRes] = await Promise.all([
    supabase
      .from("course_editions")
      .select("id, name, start_date, course_type_id, max_students, course_types(id, name)")
      .eq("modality", "presencial")
      .gte("start_date", today)
      .lte("start_date", soon)
      .in("status", ["abierto", "proximo", "completo"])
      .order("start_date", { ascending: true }),
    supabase
      .from("leads")
      .select("id, name, next_followup")
      .lte("next_followup", today)
      .not("next_followup", "is", null)
      .not("status", "in", "(perdida,inscripta)"),
    supabase.from("enrollments").select("id, final_price").neq("status", "cancelada"),
  ]);

  if (editionsRes.error) throw editionsRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (enrollmentsRes.error) throw enrollmentsRes.error;

  const alerts: Alert[] = [];

  type EditionRow = {
    id: string;
    name: string | null;
    start_date: string;
    course_type_id: string;
    course_types: { id: string; name: string } | null;
  };
  const editions = (editionsRes.data ?? []) as unknown as EditionRow[];

  const occMap: Record<string, { available: number; occupancy_pct: number | null }> = {};
  if (editions.length > 0) {
    const { data: occ, error } = await supabase
      .from("v_edition_occupancy")
      .select("course_edition_id, available, occupancy_pct")
      .in(
        "course_edition_id",
        editions.map((e) => e.id)
      );
    if (error) throw error;
    for (const o of occ as { course_edition_id: string; available: number; occupancy_pct: number | null }[]) {
      occMap[o.course_edition_id] = o;
    }
  }

  for (const e of editions) {
    const label = e.name || formatDateAR(e.start_date);
    const courseName = e.course_types?.name ?? "Curso";
    const occ = occMap[e.id];
    alerts.push({
      id: `edition-${e.id}`,
      severity: "info",
      title: `${courseName} — ${label}`,
      subtitle: `Arranca el ${formatDateAR(e.start_date)}`,
      href: `/cursos/${e.course_type_id}/${e.id}`,
    });
    if (occ && occ.available <= 0) {
      alerts.push({
        id: `full-${e.id}`,
        severity: "danger",
        title: `${courseName} — ${label} está completo`,
        subtitle: "Sin cupos disponibles",
        href: `/cursos/${e.course_type_id}/${e.id}`,
      });
    } else if (occ && (occ.occupancy_pct ?? 0) >= 80) {
      alerts.push({
        id: `low-${e.id}`,
        severity: "warning",
        title: `${courseName} — ${label} con pocos cupos`,
        subtitle: `Quedan ${occ.available} lugar${occ.available === 1 ? "" : "es"}`,
        href: `/cursos/${e.course_type_id}/${e.id}`,
      });
    }
  }

  const leads = (leadsRes.data ?? []) as { id: string; name: string; next_followup: string | null }[];
  for (const l of leads) {
    const overdue = l.next_followup && l.next_followup < today;
    alerts.push({
      id: `lead-${l.id}`,
      severity: overdue ? "warning" : "info",
      title: `Seguimiento con ${l.name}`,
      subtitle: overdue ? `Vencido — ${formatDateAR(l.next_followup)}` : "Seguimiento para hoy",
      href: `/crm`,
    });
  }

  const enrollmentIds = (enrollmentsRes.data ?? []).map((r) => r.id as string);
  if (enrollmentIds.length > 0) {
    const { data: balances, error } = await supabase
      .from("v_enrollment_balance")
      .select("enrollment_id, balance")
      .in("enrollment_id", enrollmentIds);
    if (error) throw error;
    const withDebt = (balances as { enrollment_id: string; balance: string }[]).filter(
      (b) => parseFloat(b.balance) > 0
    );
    if (withDebt.length > 0) {
      alerts.push({
        id: "deudas-total",
        severity: "warning",
        title: `${withDebt.length} alumna${withDebt.length === 1 ? "" : "s"} con saldo pendiente`,
        subtitle: "Ver el detalle en Reportes",
        href: "/reportes",
      });
    }
  }

  const severityOrder: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
