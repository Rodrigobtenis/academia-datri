import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBillingSummary, getCourseTypeSummaryRange } from "../../lib/api/management";
import { TextInput } from "../../components/ui/field";
import { formatMoney } from "../../lib/money";
import { formatDateAR, nowInArgentina } from "../../lib/date-ar";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../types/payment";

type Preset = "hoy" | "ayer" | "semana" | "mes" | "rango";

const PRESET_LABELS: Record<Preset, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  mes: "Este mes",
  rango: "Entre fechas",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return isoFromParts(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function rangeFor(preset: Exclude<Preset, "rango">): { from: string; to: string } {
  const { day, month, year } = nowInArgentina();
  const today = isoFromParts(year, month, day);
  if (preset === "hoy") return { from: today, to: today };
  if (preset === "ayer") {
    const y = addDays(today, -1);
    return { from: y, to: y };
  }
  if (preset === "mes") return { from: isoFromParts(year, month, 1), to: today };
  // Semana: de lunes a hoy.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return { from: addDays(today, -((dow + 6) % 7)), to: today };
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`${strong ? "text-2xl" : "text-xl"} font-semibold text-gray-900 mt-1`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function BillingPanel() {
  const [preset, setPreset] = useState<Preset>("hoy");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = preset === "rango" ? { from: customFrom, to: customTo } : rangeFor(preset);
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const singleDay = range.from === range.to;

  const { data: summary, isFetching } = useQuery({
    queryKey: ["billing-summary", range.from, range.to],
    queryFn: () => getBillingSummary(range.from, range.to),
    enabled: validRange,
  });

  const { data: courses } = useQuery({
    queryKey: ["billing-courses", range.from, range.to],
    queryFn: () => getCourseTypeSummaryRange(range.from, range.to),
    enabled: validRange,
  });

  const methods = Object.entries(summary?.byMethod ?? {}).sort((a, b) => b[1] - a[1]);
  const activeCourses = (courses ?? []).filter(
    (c) => c.enrollment_count > 0 || parseFloat(c.total_collected) !== 0 || parseFloat(c.total_sold ?? "0") !== 0
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Facturación</h2>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`text-xs rounded-full px-3 py-1.5 transition ${
                preset === p ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {preset === "rango" && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="!w-auto !py-1.5"
          />
          <span className="text-xs text-gray-400">a</span>
          <TextInput
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="!w-auto !py-1.5"
          />
        </div>
      )}

      {!validRange ? (
        <p className="text-sm text-gray-400">
          {customFrom && customTo ? "La fecha \"desde\" no puede ser posterior a \"hasta\"." : "Elegí las dos fechas."}
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {singleDay
              ? `Movimientos del ${formatDateAR(range.from)}.`
              : `Movimientos entre el ${formatDateAR(range.from)} y el ${formatDateAR(range.to)} (ambos incluidos).`}
            {isFetching ? " Actualizando..." : ""}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Cobrado"
              strong
              value={formatMoney(summary?.collected ?? 0)}
              sub={summary && summary.refunds > 0 ? `incluye reintegros por -${formatMoney(summary.refunds)}` : "plata que entró"}
            />
            <Stat
              label="Vendido"
              value={formatMoney(summary?.sold ?? 0)}
              sub={`${summary?.enrollmentCount ?? 0} inscripcion${summary?.enrollmentCount === 1 ? "" : "es"} nueva${summary?.enrollmentCount === 1 ? "" : "s"}`}
            />
            <Stat label="Pagos registrados" value={String(summary?.paymentCount ?? 0)} />
            <Stat
              label="Promedio por pago"
              value={formatMoney(summary && summary.paymentCount > 0 ? summary.collected / summary.paymentCount : 0)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3">Por medio de pago</h3>
              {methods.length === 0 ? (
                <p className="text-sm text-gray-400">Sin cobros en este período.</p>
              ) : (
                <div className="space-y-2">
                  {methods.map(([method, amount]) => {
                    const total = summary?.collected || 1;
                    const pct = Math.max(0, Math.min(100, (amount / total) * 100));
                    return (
                      <div key={method}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method}</span>
                          <span className="font-medium text-gray-900">{formatMoney(amount)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3">Por curso</h3>
              {activeCourses.length === 0 ? (
                <p className="text-sm text-gray-400">Sin actividad en este período.</p>
              ) : (
                <div className="divide-y divide-gray-100 text-sm">
                  {activeCourses.map((c) => (
                    <div key={c.course_type_id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-gray-500">
                        cobrado <span className="text-gray-900 font-medium">{formatMoney(c.total_collected)}</span>
                        {" · "}vendido {formatMoney(c.total_sold ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!singleDay && summary && summary.byDay.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 sm:px-4 py-3 font-medium">Día</th>
                      <th className="text-right px-3 sm:px-4 py-3 font-medium">Pagos</th>
                      <th className="text-right px-3 sm:px-4 py-3 font-medium">Cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.byDay.map((d) => (
                      <tr key={d.date}>
                        <td className="px-3 sm:px-4 py-2">{formatDateAR(d.date)}</td>
                        <td className="px-3 sm:px-4 py-2 text-right text-gray-500">{d.count}</td>
                        <td className="px-3 sm:px-4 py-2 text-right font-medium">{formatMoney(d.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
