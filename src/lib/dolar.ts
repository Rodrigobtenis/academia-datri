// Tipo de cambio oficial (dolarapi.com, público, sin autenticación) para poder cargar
// precios/pagos en USD y convertirlos a pesos. Se usa la cotización "venta" — es la que
// habitualmente se cita como "el dólar está a $X" — como tasa única de conversión, tanto
// para pasar precios en USD a pesos como para pasar pagos en pesos a su equivalente USD.
export interface DolarOficial {
  compra: number;
  venta: number;
  fecha: string;
}

export async function getOficialRate(): Promise<DolarOficial> {
  const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
  if (!res.ok) throw new Error("No se pudo obtener la cotización del dólar oficial");
  const data = await res.json();
  return { compra: data.compra, venta: data.venta, fecha: data.fechaActualizacion };
}
