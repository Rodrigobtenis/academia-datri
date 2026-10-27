import { supabase } from "../supabase";

export type Ambiente = "homologacion" | "produccion";

export interface FiscalConfig {
  cuit: string;
  razon_social: string;
  domicilio: string;
  inicio_actividades: string | null;
  iibb: string | null;
  condicion_iva: string;
  punto_venta: number;
  ambiente: Ambiente;
}

export interface ReceptorFactura {
  doc_tipo: number;
  doc_nro: string;
  nombre: string;
  condicion_iva_id: number;
  domicilio?: string;
}

export interface ItemFactura {
  nombre: string;
  cantidad: number;
  precio_unit_cents: number;
  subtotal_cents: number;
}

export interface Factura {
  id: string;
  factura_asociada_id: string | null;
  ambiente: Ambiente;
  cbte_tipo: number;
  punto_venta: number;
  numero: number;
  fecha: string;
  cae: string;
  cae_vto: string;
  receptor: ReceptorFactura;
  items: ItemFactura[];
  neto_cents: number;
  iva_cents: number;
  total_cents: number;
  observaciones: string | null;
  created_at: string;
}

export type FacturaConPagos = Factura & { factura_pagos: { payment_id: string }[] };

export const TIPOS_COMPROBANTE: Record<number, { letra: "A" | "B"; nombre: string; esNotaCredito: boolean }> = {
  1: { letra: "A", nombre: "Factura A", esNotaCredito: false },
  6: { letra: "B", nombre: "Factura B", esNotaCredito: false },
  3: { letra: "A", nombre: "Nota de crédito A", esNotaCredito: true },
  8: { letra: "B", nombre: "Nota de crédito B", esNotaCredito: true },
};

export const CONDICIONES_IVA: Record<number, string> = {
  1: "Responsable Inscripto",
  4: "IVA Sujeto Exento",
  5: "Consumidor Final",
  6: "Responsable Monotributo",
  7: "Sujeto No Categorizado",
  13: "Monotributista Social",
  16: "Monotributo Trabajador Independiente Promovido",
};

export const TIPOS_DOCUMENTO: Record<number, string> = { 80: "CUIT", 86: "CUIL", 96: "DNI", 99: "Sin identificar" };

export function numeroComprobante(f: { punto_venta: number; numero: number }): string {
  return `${String(f.punto_venta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
}

export async function getFiscalConfig(): Promise<FiscalConfig | null> {
  const { data, error } = await supabase.from("fiscal_config").select("*").maybeSingle();
  if (error) throw error;
  return (data as FiscalConfig | null) ?? null;
}

export async function updateFiscalConfig(values: Partial<FiscalConfig>) {
  const { error } = await supabase
    .from("fiscal_config")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
}

export async function listFacturas(): Promise<FacturaConPagos[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("*, factura_pagos(payment_id)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data as FacturaConPagos[]) ?? [];
}

export async function getFactura(id: string): Promise<Factura> {
  const { data, error } = await supabase.from("facturas").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Factura;
}

// Facturas A/B vigentes (sin nota de crédito que las anule) por cobro: sirve para marcar qué
// cobros ya están facturados y cuáles faltan.
export function facturaVigentePorCobro(facturas: FacturaConPagos[]): Map<string, FacturaConPagos> {
  const anuladas = new Set(facturas.filter((f) => f.factura_asociada_id).map((f) => f.factura_asociada_id as string));
  const map = new Map<string, FacturaConPagos>();
  for (const f of facturas) {
    if (TIPOS_COMPROBANTE[f.cbte_tipo]?.esNotaCredito || anuladas.has(f.id)) continue;
    for (const p of f.factura_pagos ?? []) map.set(p.payment_id, f);
  }
  return map;
}

export interface DatosPadron {
  cuit: string;
  nombre: string;
  tipoPersona: string;
  activo: boolean;
  condicion_iva_id: number;
  domicilio: string;
}

// Llama a la función del servidor (api/facturar.ts) con la sesión de quien está usando la app.
export async function llamarFacturacion<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tenés que iniciar sesión.");
  const r = await fetch("/api/facturar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status} al facturar.`);
  return j as T;
}

export async function buscarEnPadron(cuit: string): Promise<DatosPadron> {
  const r = await llamarFacturacion<{ datos: DatosPadron }>({ accion: "padron", cuit });
  return r.datos;
}
