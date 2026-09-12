const TZ = "America/Argentina/Buenos_Aires";

// Todo cálculo de "día del mes" para ritmo/proyección usa la hora de Argentina,
// para que no dependa de en qué huso horario esté corriendo el navegador o el servidor.
export function nowInArgentina(): { day: number; month: number; year: number; daysInMonth: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const daysInMonth = new Date(year, month, 0).getDate();

  return { day, month, year, daysInMonth };
}
