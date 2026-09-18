import { listProfessionalAppointmentsForDate } from "../../lib/api/appointments";
import { listProfessionalBlocksForDate } from "../../lib/api/blocks";

export function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface ScheduleConflict {
  label: string;
}

// Compartido entre "Nuevo turno" y "Reprogramar": mismo profesional, misma fecha, ¿se pisa
// el rango con otro turno o un bloqueo? Al reprogramar hay que excluir el propio turno de la
// comparación (si no, siempre "chocaría" contra sí mismo).
export async function findScheduleConflicts(
  professionalId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
): Promise<ScheduleConflict[]> {
  const [existing, blocks] = await Promise.all([
    listProfessionalAppointmentsForDate(professionalId, date, excludeAppointmentId),
    listProfessionalBlocksForDate(professionalId, date),
  ]);
  // Normalizamos a "HH:MM": la base devuelve "HH:MM:SS" y comparar strings de distinta
  // longitud como "10:00" vs "10:00:00" da un falso "mayor que" aunque sea la misma hora.
  const overlapsRange = (start: string, end: string) => start.slice(0, 5) < endTime && end.slice(0, 5) > startTime;
  const overlappingAppointments = existing.filter((a) => overlapsRange(a.start_time, a.end_time));
  const overlappingBlocks = blocks.filter((b) => overlapsRange(b.start_time, b.end_time));

  return [
    ...overlappingAppointments.map((a) => ({
      label: `${a.students?.last_name ?? "—"}, ${a.students?.first_name ?? ""} (${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)})`,
    })),
    ...overlappingBlocks.map((b) => ({
      label: `Horario bloqueado${b.reason ? ` — ${b.reason}` : ""} (${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)})`,
    })),
  ];
}
