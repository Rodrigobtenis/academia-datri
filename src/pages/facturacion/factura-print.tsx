import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import {
  CONDICIONES_IVA,
  TIPOS_COMPROBANTE,
  TIPOS_DOCUMENTO,
  getFactura,
  getFiscalConfig,
  numeroComprobante,
  type Factura,
} from "../../lib/api/facturacion";

const cents = (n: number) => formatMoney(n / 100);
const codigo = (n: number) => String(n).padStart(3, "0");

// Texto que lleva el QR de ARCA (https://www.afip.gob.ar/fe/qr/?p=...).
function urlQr(f: Factura, cuit: string): string {
  const datos = {
    ver: 1,
    fecha: f.fecha,
    cuit: Number(cuit),
    ptoVta: f.punto_venta,
    tipoCmp: f.cbte_tipo,
    nroCmp: Number(f.numero),
    importe: f.total_cents / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: f.receptor.doc_tipo,
    nroDocRec: Number(f.receptor.doc_nro || 0),
    tipoCodAut: "E",
    codAut: Number(f.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datos))}`;
}

// Comprobante listo para imprimir o guardar como PDF (el botón abre el diálogo de impresión).
export default function FacturaPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const facturaQuery = useQuery({ queryKey: ["factura", id], queryFn: () => getFactura(id!) });
  const cfgQuery = useQuery({ queryKey: ["fiscal-config"], queryFn: getFiscalConfig });
  const asociadaQuery = useQuery({
    queryKey: ["factura-asociada", facturaQuery.data?.factura_asociada_id],
    enabled: Boolean(facturaQuery.data?.factura_asociada_id),
    queryFn: async () => {
      const { data } = await supabase
        .from("facturas")
        .select("cbte_tipo, punto_venta, numero")
        .eq("id", facturaQuery.data!.factura_asociada_id!)
        .single();
      return data as { cbte_tipo: number; punto_venta: number; numero: number } | null;
    },
  });
  const [qr, setQr] = useState<string | null>(null);
  const f = facturaQuery.data;
  const cfg = cfgQuery.data;

  useEffect(() => {
    if (!f || !cfg) return;
    QRCode.toDataURL(urlQr(f, cfg.cuit), { margin: 0, width: 220 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [f, cfg]);

  useEffect(() => {
    if (f) {
      const t = TIPOS_COMPROBANTE[f.cbte_tipo];
      document.title = `${t?.nombre ?? "Comprobante"} ${numeroComprobante(f)} - ${f.receptor.nombre}`;
    }
  }, [f]);

  if (facturaQuery.isLoading || cfgQuery.isLoading) return <div className="p-8 text-sm text-gray-400">Armando la factura...</div>;
  if (!f || !cfg) return <div className="p-8 text-sm text-gray-500">No encontré esa factura.</div>;

  const tipo = TIPOS_COMPROBANTE[f.cbte_tipo];
  const esA = tipo.letra === "A";
  const prueba = f.ambiente !== "produccion";
  const r = f.receptor;
  const neto = (c: number) => Math.round(c / 1.21);
  const ajuste = f.total_cents - f.items.reduce((s, i) => s + i.subtotal_cents, 0);
  const ajusteNeto = f.neto_cents - f.items.reduce((s, i) => s + neto(i.subtotal_cents), 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white py-6 print:py-0">
      <div className="max-w-[820px] mx-auto mb-4 flex gap-2 px-4 print:hidden">
        <button onClick={() => navigate(-1)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Volver
        </button>
        <button onClick={() => window.print()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="relative mx-auto max-w-[820px] bg-white p-6 text-[11px] leading-snug text-gray-900 shadow-sm print:shadow-none">
        {prueba && (
          <>
            <p className="mb-2 rounded border border-red-400 bg-red-50 px-2 py-1 text-center text-xs font-bold text-red-700">
              COMPROBANTE DE PRUEBA — SIN VALIDEZ FISCAL
            </p>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-[30deg] text-[110px] font-black tracking-widest text-red-500/10">PRUEBA</span>
            </div>
          </>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch border border-gray-800">
          <div className="p-3">
            <p className="text-sm font-bold">{cfg.razon_social}</p>
            <p>{cfg.domicilio}</p>
            <p className="mt-1">Condición frente al IVA: {cfg.condicion_iva}</p>
          </div>
          <div className="flex w-20 flex-col items-center border-x border-gray-800 px-2 py-1 text-center">
            <p className="text-4xl font-black leading-none">{tipo.letra}</p>
            <p className="mt-1 text-[10px] font-semibold">COD. {codigo(f.cbte_tipo)}</p>
          </div>
          <div className="p-3">
            <p className="text-base font-bold">{tipo.nombre.toUpperCase()}</p>
            <p className="font-semibold">N° {numeroComprobante(f)}</p>
            <p>Fecha de emisión: {formatDateAR(f.fecha)}</p>
            <p className="mt-1">CUIT: {cfg.cuit}</p>
            <p>Ingresos Brutos: {cfg.iibb ?? "—"}</p>
            <p>Inicio de actividades: {cfg.inicio_actividades ? formatDateAR(cfg.inicio_actividades) : "—"}</p>
          </div>
        </div>

        <div className="mt-2 border border-gray-800 p-2">
          <div className="grid grid-cols-2 gap-x-4">
            <p>
              <b>{TIPOS_DOCUMENTO[r.doc_tipo] ?? "Documento"}:</b>{" "}
              {r.doc_tipo === 99 ? "Consumidor final sin identificar" : r.doc_nro}
            </p>
            <p>
              <b>Condición frente al IVA:</b> {CONDICIONES_IVA[r.condicion_iva_id] ?? "—"}
            </p>
            <p>
              <b>Apellido y nombre / Razón social:</b> {r.nombre}
            </p>
            <p>
              <b>Condición de venta:</b> Contado
            </p>
            {r.domicilio && (
              <p className="col-span-2">
                <b>Domicilio:</b> {r.domicilio}
              </p>
            )}
            {f.factura_asociada_id && asociadaQuery.data && (
              <p className="col-span-2">
                <b>Comprobante asociado:</b> {TIPOS_COMPROBANTE[asociadaQuery.data.cbte_tipo]?.nombre}{" "}
                {numeroComprobante(asociadaQuery.data)}
              </p>
            )}
          </div>
        </div>

        <table className="mt-2 w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-800 px-2 py-1">Descripción</th>
              <th className="border border-gray-800 px-2 py-1 text-right">Cant.</th>
              <th className="border border-gray-800 px-2 py-1 text-right">{esA ? "Precio unit. (sin IVA)" : "Precio unit."}</th>
              {esA && <th className="border border-gray-800 px-2 py-1 text-right">IVA</th>}
              <th className="border border-gray-800 px-2 py-1 text-right">{esA ? "Subtotal (sin IVA)" : "Subtotal"}</th>
            </tr>
          </thead>
          <tbody>
            {f.items.map((i, k) => (
              <tr key={k}>
                <td className="border border-gray-300 px-2 py-1">{i.nombre}</td>
                <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{i.cantidad}</td>
                <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">
                  {cents(esA ? neto(i.precio_unit_cents) : i.precio_unit_cents)}
                </td>
                {esA && <td className="border border-gray-300 px-2 py-1 text-right">21 %</td>}
                <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">
                  {cents(esA ? neto(i.subtotal_cents) : i.subtotal_cents)}
                </td>
              </tr>
            ))}
            {(esA ? ajusteNeto : ajuste) !== 0 && (
              <tr>
                <td className="border border-gray-300 px-2 py-1 italic" colSpan={esA ? 4 : 3}>
                  Ajuste de redondeo
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{cents(esA ? ajusteNeto : ajuste)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-2 flex justify-end">
          <div className="w-64 border border-gray-800">
            {esA && (
              <>
                <Fila label="Importe neto gravado" valor={cents(f.neto_cents)} />
                <Fila label="IVA 21 %" valor={cents(f.iva_cents)} />
              </>
            )}
            <Fila label="IMPORTE TOTAL" valor={cents(f.total_cents)} fuerte />
          </div>
        </div>

        {!esA && (
          <p className="mt-2 text-[10px] text-gray-600">
            Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) — IVA contenido: {cents(f.iva_cents)}
          </p>
        )}
        {f.observaciones && (
          <p className="mt-2">
            <b>Observaciones:</b> {f.observaciones}
          </p>
        )}

        <div className="mt-4 flex items-end justify-between gap-4 border-t border-gray-800 pt-3">
          <div className="flex items-center gap-3">
            {qr ? <img src={qr} alt="QR de ARCA" className="h-24 w-24" /> : <div className="h-24 w-24 bg-gray-100" />}
            <p className="text-[10px] text-gray-500">Comprobante autorizado</p>
          </div>
          <div className="text-right">
            <p>
              <b>CAE N°:</b> {f.cae}
            </p>
            <p>
              <b>Vencimiento del CAE:</b> {formatDateAR(f.cae_vto)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between px-2 py-1 ${fuerte ? "bg-gray-100 text-sm font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
