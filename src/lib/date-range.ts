import { nowInArgentina } from "./date-ar";

export type QuickRange = "hoy" | "ayer" | "semana" | "mes";

export const QUICK_RANGE_LABELS: Record<QuickRange, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  mes: "Este mes",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return isoFromParts(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Rangos de fechas (ambas incluidas) según el día de hoy en Argentina.
export function quickRange(kind: QuickRange): { from: string; to: string } {
  const { day, month, year } = nowInArgentina();
  const today = isoFromParts(year, month, day);
  if (kind === "hoy") return { from: today, to: today };
  if (kind === "ayer") {
    const y = addDays(today, -1);
    return { from: y, to: y };
  }
  if (kind === "mes") return { from: isoFromParts(year, month, 1), to: today };
  // Semana: de lunes a hoy.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return { from: addDays(today, -((dow + 6) % 7)), to: today };
}
