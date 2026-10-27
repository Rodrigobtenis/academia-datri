import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field, Select, TextInput } from "../../components/ui/field";
import { emitError } from "../../lib/toast-bus";
import { formatMoney } from "../../lib/money";
import {
  buscarEnPadron,
  CONDICIONES_IVA,
  getFiscalConfig,
  llamarFacturacion,
  numeroComprobante,
  TIPOS_COMPROBANTE,
  type DatosPadron,
  type Factura,
  type ReceptorFactura,
} from "../../lib/api/facturacion";
import type { PaymentMovement } from "../../lib/api/movements";
import { PAYMENT_TYPE_LABELS } from "../../types/payment";

const soloDigitos = (s: string) => s.replace(/\D/g, "");

// Neto + IVA 21 % de un total con IVA incluido (mismo cálculo que hace el servidor).
function partir(totalCents: number) {
  const neto = Math.round(totalCents / 1.21);
  return { neto, iva: totalCents - neto };
}

const CONDICIONES_A = [1, 6, 13, 16];
const CONDICIONES_B = [5, 4, 6, 7, 13, 16];

// "Pérez, Ana" -> "Ana Pérez"
function nombreNatural(studentName: string) {
  const [apellido, nombre] = studentName.split(",").map((s) => s.trim());
  return nombre ? `${nombre} ${apellido}` : studentName;
}

interface Renglon {
  nombre: string;
  cantidad: string;
  precio: string;
}

// Ventana "Facturar": con cobros ya registrados (desde Últimos movimientos) o libre (desde
// la solapa Facturación). Elegís Factura A o B, completás el cliente (el CUIT se completa con
// el padrón de ARCA) y se emite. Es siempre manual y una factura real no se puede borrar.
export function FacturarDialog({
  open,
  pagos,
  onClose,
  onEmitida,
}: {
  open: boolean;
  pagos?: PaymentMovement[];
  onClose: () => void;
  onEmitida: (f: Factura) => void;
}) {
  const queryClient = useQueryClient();
  const cfgQuery = useQuery({ queryKey: ["fiscal-config"], queryFn: getFiscalConfig, enabled: open });
  const prueba = cfgQuery.data?.ambiente === "homologacion";
  const conPagos = Boolean(pagos && pagos.length > 0);

  const [tipo, setTipo] = useState<1 | 6>(6);
  const [docTipo, setDocTipo] = useState(99);
  const [docNro, setDocNro] = useState("");
  const [nombre, setNombre] = useState("");
  const [condicion, setCondicion] = useState(5);
  const [domicilio, setDomicilio] = useState("");
  const [obs, setObs] = useState("");
  const [renglones, setRenglones] = useState<Renglon[]>([{ nombre: "", cantidad: "1", precio: "" }]);
  const [confirmo, setConfirmo] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [padron, setPadron] = useState<DatosPadron | null>(null);
  const [errorPadron, setErrorPadron] = useState<string | null>(null);

  // Cada vez que se abre, arranca limpio (con el nombre de quien pagó si viene de un cobro).
  const pagosKey = pagos?.map((p) => p.id).join(",") ?? "";
  useEffect(() => {
    if (!open) return;
    setTipo(6);
    setDocTipo(99);
    setDocNro("");
    setNombre(pagos && pagos[0] ? nombreNatural(pagos[0].studentName) : "");
    setCondicion(5);
    setDomicilio("");
    setObs("");
    setRenglones([{ nombre: "", cantidad: "1", precio: "" }]);
    setConfirmo(false);
    setError(null);
    setPadron(null);
    setErrorPadron(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pagosKey]);

  const cuitDigitos = soloDigitos(docNro);
  const usaCuit = tipo === 1 || docTipo === 80 || docTipo === 86;

  async function buscar() {
    setErrorPadron(null);
    setBuscando(true);
    try {
      const d = await buscarEnPadron(cuitDigitos);
      setPadron(d);
      if (d.nombre) setNombre(d.nombre);
      if ((tipo === 1 ? CONDICIONES_A : CONDICIONES_B).includes(d.condicion_iva_id)) setCondicion(d.condicion_iva_id);
      if (d.domicilio) setDomicilio(d.domicilio);
    } catch (e) {
      setPadron(null);
      setErrorPadron(e instanceof Error ? e.message : "No se pudo consultar ARCA.");
    } finally {
      setBuscando(false);
    }
  }

  // Al completar los 11 números se busca solo.
  useEffect(() => {
    setPadron(null);
    setErrorPadron(null);
    if (open && usaCuit && cuitDigitos.length === 11) void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuitDigitos, usaCuit, open]);

  function elegirTipo(t: 1 | 6) {
    setTipo(t);
    setError(null);
    if (t === 1) {
      setDocTipo(80);
      setCondicion(1);
    } else {
      setDocTipo(99);
      setCondicion(5);
      setDocNro("");
    }
  }

  const totalCents = conPagos
    ? Math.round((pagos ?? []).reduce((a, p) => a + p.amount, 0) * 100)
    : renglones.reduce((a, r) => a + Math.round((parseFloat(r.precio) || 0) * 100) * Math.max(1, Math.round(parseFloat(r.cantidad) || 1)), 0);
  const { neto, iva } = partir(totalCents);

  async function emitir() {
    setError(null);
    setEmitiendo(true);
    try {
      const receptor: ReceptorFactura = {
        doc_tipo: tipo === 6 && docTipo === 99 ? 99 : docTipo,
        doc_nro: tipo === 6 && docTipo === 99 ? "0" : soloDigitos(docNro),
        nombre: nombre.trim() || "Consumidor Final",
        condicion_iva_id: condicion,
        domicilio: domicilio.trim() || undefined,
      };
      const r = await llamarFacturacion<{ factura: Factura }>({
        accion: "emitir",
        cbteTipo: tipo,
        receptor,
        observaciones: obs.trim() || undefined,
        ...(conPagos
          ? { pagoIds: (pagos ?? []).map((p) => p.id) }
          : {
              items: renglones.map((r) => ({
                nombre: r.nombre,
                cantidad: parseFloat(r.cantidad) || 1,
                precio_unit: parseFloat(r.precio) || 0,
              })),
            }),
      });
      await queryClient.invalidateQueries({ queryKey: ["facturas"] });
      onEmitida(r.factura);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo emitir la factura.";
      setError(msg);
      emitError(msg);
    } finally {
      setEmitiendo(false);
    }
  }

  const puedeEmitir = !emitiendo && totalCents > 0 && (!cfgQuery.data || prueba || confirmo);

  return (
    <Dialog open={open} onClose={onClose} title="Facturar" wide>
      <div className="space-y-4">
        {prueba && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            MODO PRUEBA: esta factura se emite en el ambiente de pruebas de ARCA y NO tiene validez.
          </p>
        )}

        {conPagos ? (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm space-y-1">
            {pagos!.map((p) => (
              <div key={p.id} className="flex justify-between gap-3">
                <span className="text-gray-600">
                  {p.studentName} · {p.courseName} · {PAYMENT_TYPE_LABELS[p.paymentType]}
                </span>
                <b className="shrink-0">{formatMoney(p.amount)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Qué se factura (importe unitario con IVA incluido)</p>
            {renglones.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-7">
                  <TextInput
                    placeholder="Descripción (ej. Curso de Pigmentología)"
                    value={r.nombre}
                    onChange={(e) => setRenglones(renglones.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <TextInput
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={r.cantidad}
                    onChange={(e) => setRenglones(renglones.map((x, k) => (k === i ? { ...x, cantidad: e.target.value } : x)))}
                  />
                </div>
                <div className="col-span-8 sm:col-span-3">
                  <TextInput
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Importe"
                    value={r.precio}
                    onChange={(e) => setRenglones(renglones.map((x, k) => (k === i ? { ...x, precio: e.target.value } : x)))}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-brand-600 hover:text-brand-700"
              onClick={() => setRenglones([...renglones, { nombre: "", cantidad: "1", precio: "" }])}
            >
              + Agregar renglón
            </button>
          </div>
        )}

        <div className="flex justify-between text-sm text-gray-600 rounded-lg bg-brand-50 px-3 py-2">
          <span>
            Neto {formatMoney(neto / 100)} + IVA 21 % {formatMoney(iva / 100)}
          </span>
          <b className="text-gray-900">Total {formatMoney(totalCents / 100)}</b>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Tipo de factura</p>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(
              [
                [6, "Factura B (consumidor final)"],
                [1, "Factura A (Resp. Inscripto / Monotributo, con CUIT)"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => elegirTipo(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tipo === t ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tipo === 6 ? (
            <Field label="Documento">
              <Select value={docTipo} onChange={(e) => setDocTipo(Number(e.target.value))}>
                <option value={99}>Consumidor final sin identificar</option>
                <option value={96}>DNI</option>
                <option value={80}>CUIT</option>
                <option value={86}>CUIL</option>
              </Select>
            </Field>
          ) : (
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Documento</span>
              <p className="flex h-[38px] items-center text-sm font-medium text-gray-700">CUIT</p>
            </div>
          )}
          {!(tipo === 6 && docTipo === 99) && (
            <Field label={tipo === 1 || docTipo === 80 ? "CUIT (11 números)" : "Número"}>
              <div className="flex gap-2">
                <TextInput
                  inputMode="numeric"
                  value={docNro}
                  onChange={(e) => setDocNro(e.target.value)}
                  placeholder={tipo === 1 ? "30-12345678-9" : "Sin puntos"}
                />
                {usaCuit && (
                  <Button type="button" variant="secondary" onClick={buscar} disabled={buscando || cuitDigitos.length !== 11}>
                    {buscando ? "..." : "Buscar"}
                  </Button>
                )}
              </div>
            </Field>
          )}
          {usaCuit && (padron || errorPadron) && (
            <div className="sm:col-span-2">
              {errorPadron && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorPadron}</p>}
              {padron && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <p>
                    ARCA: <b>{padron.nombre}</b> — {CONDICIONES_IVA[padron.condicion_iva_id] ?? "—"}
                    {padron.domicilio ? ` — ${padron.domicilio}` : ""}
                  </p>
                  {!padron.activo && <p className="mt-1 font-semibold text-red-700">Ojo: este CUIT figura inactivo en ARCA.</p>}
                  {tipo === 1 && !CONDICIONES_A.includes(padron.condicion_iva_id) && (
                    <p className="mt-1 font-semibold text-red-700">
                      Este CUIT no es Responsable Inscripto ni Monotributista: le corresponde Factura B, no A.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label={tipo === 1 ? "Razón social" : "Nombre (opcional)"}>
              <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
          </div>
          <Field label="Condición frente al IVA del cliente">
            <Select value={condicion} onChange={(e) => setCondicion(Number(e.target.value))}>
              {(tipo === 1 ? CONDICIONES_A : CONDICIONES_B).map((c) => (
                <option key={c} value={c}>
                  {CONDICIONES_IVA[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domicilio (opcional)">
            <TextInput value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observaciones (opcional, salen en la factura)">
              <TextInput value={obs} onChange={(e) => setObs(e.target.value)} />
            </Field>
          </div>
        </div>

        {!prueba && cfgQuery.data && (
          <label className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
            <span>
              Confirmo los datos. Se emite una factura <b>REAL</b> en ARCA a nombre de {cfgQuery.data.razon_social}: no se puede borrar, solo
              anular con una nota de crédito.
            </span>
          </label>
        )}

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={emitiendo}>
            Cancelar
          </Button>
          <Button onClick={emitir} disabled={!puedeEmitir}>
            {emitiendo ? "Emitiendo..." : `Emitir ${tipo === 1 ? "Factura A" : "Factura B"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// Aviso después de emitir: acceso directo al comprobante en PDF.
export function FacturaEmitidaDialog({ factura, onClose }: { factura: Factura | null; onClose: () => void }) {
  if (!factura) return null;
  const nombre = TIPOS_COMPROBANTE[factura.cbte_tipo]?.nombre ?? "Comprobante";
  return (
    <Dialog open onClose={onClose} title="Factura emitida">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {nombre} <b>{numeroComprobante(factura)}</b> por <b>{formatMoney(factura.total_cents / 100)}</b> a nombre de{" "}
          {factura.receptor.nombre}.
        </p>
        <p className="text-xs text-gray-500">CAE {factura.cae}. Ya quedó registrada en ARCA.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => window.open(`/facturas/${factura.id}/imprimir`, "_blank")}>Ver / descargar PDF</Button>
        </div>
      </div>
    </Dialog>
  );
}
