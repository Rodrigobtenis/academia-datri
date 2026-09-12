// Postgres NUMERIC llega vía supabase-js como string — nunca lo pasamos por Number()
// para operaciones intermedias, solo para mostrarlo formateado o sumarlo con cuidado.

export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : parseFloat(value);
}

// Intl.NumberFormat con style:"currency" inserta un espacio entre "$" y el número en es-AR
// (ej. "$ 100.000"); acá lo armamos a mano para que quede pegado: "$100.000".
export function formatMoney(value: string | number | null | undefined): string {
  const n = parseMoney(value);
  const sign = n < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(n));
  return `${sign}$${formatted}`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function sumMoney(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + parseMoney(v), 0);
}
