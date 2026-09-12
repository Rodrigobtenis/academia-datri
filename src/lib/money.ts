// Postgres NUMERIC llega vía supabase-js como string — nunca lo pasamos por Number()
// para operaciones intermedias, solo para mostrarlo formateado o sumarlo con cuidado.

export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : parseFloat(value);
}

export function formatMoney(value: string | number | null | undefined): string {
  const n = parseMoney(value);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function sumMoney(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + parseMoney(v), 0);
}
