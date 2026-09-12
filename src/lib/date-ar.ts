const TZ = "America/Argentina/Buenos_Aires";

// Postgres devuelve columnas `date` como "YYYY-MM-DD" (sin hora ni offset). Si eso se pasa
// directo a `new Date(...)`, JS lo interpreta como medianoche UTC — y en un huso horario
// negativo como Argentina (UTC-3), toLocaleDateString() termina mostrando el día ANTERIOR.
// Esta función arma "DD/MM/YYYY" a partir del string sin pasar por conversión de zona horaria.
export function formatDateAR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
}

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
