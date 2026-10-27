import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listPaymentMovements, type PaymentMovement } from "../lib/api/movements";
import {
  facturaVigentePorCobro,
  listFacturas,
  numeroComprobante,
  TIPOS_COMPROBANTE,
  type Factura,
} from "../lib/api/facturacion";
import { RowMenu } from "./row-menu";
import { FacturarDialog, FacturaEmitidaDialog } from "../pages/facturacion/facturar-dialog";
import { QUICK_RANGE_LABELS, quickRange, type QuickRange } from "../lib/date-range";
import { formatDateAR } from "../lib/date-ar";
import { formatMoney } from "../lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "../types/payment";

function timeAR(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Lista de cobros del período: quién pagó, en qué curso, cuánto, qué tipo de pago (seña,
// parcial, completo...) y con qué medio. Sirve para el control diario/semanal de lo que
// ingresó y de lo que falta facturar: en los 3 puntitos de cada cobro se factura (o se ve la
// factura ya emitida). Al tocar el nombre se abre la inscripción.
export function MovementsList({ from, to, method }: { from: string; to: string; method?: string }) {
  const navigate = useNavigate();
  const multiDay = from !== to;
  const [soloSinFacturar, setSoloSinFacturar] = useState(false);
  const [facturando, setFacturando] = useState<PaymentMovement | null>(null);
  const [emitida, setEmitida] = useState<Factura | null>(null);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["payment-movements", from, to, method ?? ""],
    queryFn: () => listPaymentMovements(from, to, method),
  });
  const { data: facturas } = useQuery({ queryKey: ["facturas"], queryFn: listFacturas });
  const facturaPorCobro = facturaVigentePorCobro(facturas ?? []);

  if (isLoading) return <p className="text-sm text-gray-400">Cargando movimientos...</p>;
  if (!movements || movements.length === 0) {
    return <p className="text-sm text-gray-400">No hay cobros registrados en este período.</p>;
  }

  const total = movements.reduce((acc, m) => acc + m.amount, 0);
  const sinFacturar = movements.filter((m) => m.amount > 0 && !facturaPorCobro.has(m.id));
  const totalSinFacturar = sinFacturar.reduce((acc, m) => acc + m.amount, 0);
  const visibles = soloSinFacturar ? sinFacturar : movements;
  const byMethod = new Map<string, number>();
  for (const m of movements) byMethod.set(m.paymentMethod, (byMethod.get(m.paymentMethod) ?? 0) + m.amount);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div className="text-sm text-gray-500">
          {movements.length} cobro{movements.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-gray-900">{formatMoney(total)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from(byMethod.entries()).map(([m, amount]) => (
            <span key={m} className="text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
              {PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m}: {formatMoney(amount)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <span>
          Sin facturar: <b>{sinFacturar.length}</b> cobro{sinFacturar.length === 1 ? "" : "s"} por <b>{formatMoney(totalSinFacturar)}</b>
        </span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={soloSinFacturar} onChange={(e) => setSoloSinFacturar(e.target.checked)} />
          Mostrar solo los sin facturar
        </label>
      </div>

      <div className="divide-y divide-gray-100">
        {visibles.length === 0 && <p className="py-4 text-sm text-gray-400">No hay cobros sin facturar en este período.</p>}
        {visibles.map((m) => {
          const factura = facturaPorCobro.get(m.id);
          return (
            <div key={m.id} className="py-2.5 flex items-start justify-between gap-2">
              <button
                type="button"
                disabled={!m.courseTypeId || !m.editionId}
                onClick={() => navigate(`/cursos/${m.courseTypeId}/${m.editionId}/inscripciones/${m.enrollmentId}`)}
                className="min-w-0 flex-1 text-left rounded-md hover:bg-gray-50 px-1 -mx-1"
              >
                <span className="block text-sm font-medium text-gray-900 truncate">{m.studentName}</span>
                <span className="block text-xs text-gray-500">
                  {m.courseName}
                  {m.editionLabel ? ` · ${m.editionLabel}` : ""}
                </span>
                <span className="block text-xs text-gray-400">
                  {PAYMENT_TYPE_LABELS[m.paymentType]} · {PAYMENT_METHOD_LABELS[m.paymentMethod]}
                  {multiDay ? ` · ${formatDateAR(m.paymentDate)}` : ""} · {timeAR(m.createdAt)}
                </span>
                {m.amount > 0 && (
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      factura ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {factura
                      ? `Facturado · ${TIPOS_COMPROBANTE[factura.cbte_tipo]?.nombre} ${numeroComprobante(factura)}`
                      : "Sin facturar"}
                  </span>
                )}
              </button>
              <span className={`text-sm font-semibold shrink-0 pt-0.5 ${m.amount < 0 ? "text-red-600" : "text-gray-900"}`}>
                {formatMoney(m.amount)}
              </span>
              {m.amount > 0 && (
                <RowMenu
                  items={
                    factura
                      ? [{ label: "Ver factura (PDF)", onClick: () => window.open(`/facturas/${factura.id}/imprimir`, "_blank") }]
                      : [{ label: "Facturar", onClick: () => setFacturando(m) }]
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <FacturarDialog
        open={Boolean(facturando)}
        pagos={facturando ? [facturando] : undefined}
        onClose={() => setFacturando(null)}
        onEmitida={(f) => {
          setFacturando(null);
          setEmitida(f);
        }}
      />
      <FacturaEmitidaDialog factura={emitida} onClose={() => setEmitida(null)} />
    </div>
  );
}

const TABS: QuickRange[] = ["hoy", "ayer", "semana"];

// Tarjeta "Últimos movimientos" con Hoy / Ayer / Esta semana, para tener a mano en Cursos.
export function RecentMovementsCard() {
  const [tab, setTab] = useState<QuickRange>("hoy");
  const range = quickRange(tab);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Últimos movimientos</h2>
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
      <MovementsList from={range.from} to={range.to} />
    </section>
  );
}
