import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput } from "../../components/ui/field";
import { RowMenu } from "../../components/row-menu";
import { MovementsList } from "../../components/payment-movements";
import { useAuth } from "../../lib/auth-context";
import { emitError } from "../../lib/toast-bus";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { QUICK_RANGE_LABELS, quickRange, type QuickRange } from "../../lib/date-range";
import {
  getFiscalConfig,
  listFacturas,
  llamarFacturacion,
  numeroComprobante,
  TIPOS_COMPROBANTE,
  updateFiscalConfig,
  type Factura,
  type FacturaConPagos,
} from "../../lib/api/facturacion";
import { FacturarDialog, FacturaEmitidaDialog } from "./facturar-dialog";

const TABS: QuickRange[] = ["hoy", "ayer", "semana", "mes"];

export default function FacturacionPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<QuickRange>("semana");
  const [nueva, setNueva] = useState(false);
  const [emitida, setEmitida] = useState<Factura | null>(null);
  const [anular, setAnular] = useState<FacturaConPagos | null>(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [probando, setProbando] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);

  const cfgQuery = useQuery({ queryKey: ["fiscal-config"], queryFn: getFiscalConfig });
  const { data: facturas, isLoading } = useQuery({ queryKey: ["facturas"], queryFn: listFacturas });
  const range = quickRange(tab);

  const anuladas = useMemo(
    () => new Set((facturas ?? []).filter((f) => f.factura_asociada_id).map((f) => f.factura_asociada_id as string)),
    [facturas]
  );
  const cfg = cfgQuery.data;
  const prueba = cfg?.ambiente === "homologacion";
  const faltanDatos = cfg && (!cfg.inicio_actividades || !cfg.iibb);

  const anularMutation = useMutation({
    mutationFn: (f: FacturaConPagos) => llamarFacturacion({ accion: "nota_credito", facturaId: f.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturas"] });
      setAnular(null);
    },
    onError: (e: Error) => emitError(e.message),
  });

  async function probarConexion() {
    setProbando(true);
    setEstado(null);
    try {
      const r = await llamarFacturacion<{ ambiente: string; puntoVenta: number; ultimoFacturaA: number; ultimoFacturaB: number }>({
        accion: "estado",
      });
      setEstado(
        `Conexión con ARCA OK (${r.ambiente === "produccion" ? "producción" : "pruebas"}, punto de venta ${r.puntoVenta}). Última Factura A: ${r.ultimoFacturaA}, última Factura B: ${r.ultimoFacturaB}.`
      );
    } catch (e) {
      emitError(e instanceof Error ? e.message : "No se pudo conectar con ARCA.");
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500">
            {cfg ? `${cfg.razon_social} · CUIT ${cfg.cuit} · ${cfg.condicion_iva} · Punto de venta ${cfg.punto_venta}` : "Facturas A/B con ARCA."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setEditandoDatos(true)}>
                Datos fiscales
              </Button>
              <Button variant="secondary" onClick={probarConexion} disabled={probando}>
                {probando ? "Probando..." : "Probar conexión con ARCA"}
              </Button>
            </>
          )}
          <Button onClick={() => setNueva(true)}>+ Nueva factura</Button>
        </div>
      </div>

      {prueba && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Estás en MODO PRUEBA: las facturas que se emiten ahora no tienen validez fiscal.
        </p>
      )}
      {faltanDatos && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Faltan cargar el <b>inicio de actividades</b> y/o <b>Ingresos Brutos</b> (se completan en "Datos fiscales"): salen en el encabezado de la
          factura.
        </p>
      )}
      {estado && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{estado}</p>}

      <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Cobros para facturar</h2>
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs rounded-full px-3 py-1.5 transition ${
                  tab === t ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {QUICK_RANGE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Del {formatDateAR(range.from)} al {formatDateAR(range.to)}. En los 3 puntitos de cada cobro: Facturar.
        </p>
        <MovementsList from={range.from} to={range.to} />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Facturas emitidas</h2>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Cargando...</p>
        ) : (facturas ?? []).length === 0 ? (
          <p className="p-6 text-sm text-gray-400">Todavía no se emitió ninguna factura desde la app.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium">Comprobante</th>
                  <th className="hidden sm:table-cell text-left px-3 sm:px-4 py-3 font-medium">Cliente</th>
                  <th className="text-right px-3 sm:px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium">Estado</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(facturas ?? []).map((f) => {
                  const t = TIPOS_COMPROBANTE[f.cbte_tipo];
                  const esNC = t?.esNotaCredito;
                  const estaAnulada = anuladas.has(f.id);
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap text-gray-600">{formatDateAR(f.fecha)}</td>
                      <td className="px-3 sm:px-4 py-2">
                        <span className="font-medium text-gray-900">{t?.nombre ?? `Comprobante ${f.cbte_tipo}`}</span>
                        <div className="text-xs text-gray-500 tabular-nums">{numeroComprobante(f)}</div>
                        <div className="sm:hidden text-xs text-gray-400">{f.receptor.nombre}</div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-4 py-2">{f.receptor.nombre}</td>
                      <td className={`px-3 sm:px-4 py-2 text-right font-semibold ${esNC ? "text-red-600" : ""}`}>
                        {esNC ? "−" : ""}
                        {formatMoney(f.total_cents / 100)}
                      </td>
                      <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                        {f.ambiente !== "produccion" && (
                          <span className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">PRUEBA</span>
                        )}
                        {esNC ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Nota de crédito</span>
                        ) : estaAnulada ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Anulada</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Vigente</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <RowMenu
                          items={[
                            { label: "Ver / descargar PDF", onClick: () => window.open(`/facturas/${f.id}/imprimir`, "_blank") },
                            ...(!esNC && !estaAnulada
                              ? [{ label: "Anular con nota de crédito", danger: true, onClick: () => setAnular(f) }]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FacturarDialog
        open={nueva}
        onClose={() => setNueva(false)}
        onEmitida={(f) => {
          setNueva(false);
          setEmitida(f);
        }}
      />
      <FacturaEmitidaDialog factura={emitida} onClose={() => setEmitida(null)} />

      {anular && (
        <Dialog open onClose={() => setAnular(null)} title="Anular factura">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Se emite una nota de crédito por <b>{formatMoney(anular.total_cents / 100)}</b> que anula la{" "}
              {TIPOS_COMPROBANTE[anular.cbte_tipo]?.nombre} {numeroComprobante(anular)}. Después los cobros se pueden volver a facturar. Esta acción
              no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnular(null)} disabled={anularMutation.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => anularMutation.mutate(anular)} disabled={anularMutation.isPending}>
                {anularMutation.isPending ? "Emitiendo..." : "Emitir nota de crédito"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {editandoDatos && cfg && <DatosFiscalesDialog onClose={() => setEditandoDatos(false)} />}
    </div>
  );
}

function DatosFiscalesDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ["fiscal-config"], queryFn: getFiscalConfig });
  const [razon, setRazon] = useState(cfg?.razon_social ?? "");
  const [domicilio, setDomicilio] = useState(cfg?.domicilio ?? "");
  const [inicio, setInicio] = useState(cfg?.inicio_actividades ?? "");
  const [iibb, setIibb] = useState(cfg?.iibb ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateFiscalConfig({
        razon_social: razon.trim(),
        domicilio: domicilio.trim(),
        inicio_actividades: inicio || null,
        iibb: iibb.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-config"] });
      onClose();
    },
    onError: (e: Error) => emitError(e.message),
  });

  return (
    <Dialog open onClose={onClose} title="Datos fiscales">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Salen en el encabezado de cada factura. El CUIT, el punto de venta y el ambiente no se editan desde acá.
        </p>
        <Field label="Razón social">
          <TextInput value={razon} onChange={(e) => setRazon(e.target.value)} />
        </Field>
        <Field label="Domicilio comercial">
          <TextInput value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Inicio de actividades">
            <TextInput type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Field>
          <Field label="Ingresos Brutos (N° o C.M.)">
            <TextInput value={iibb} onChange={(e) => setIibb(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !razon.trim() || !domicilio.trim()}>
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
