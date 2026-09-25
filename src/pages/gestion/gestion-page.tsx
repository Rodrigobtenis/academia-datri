import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCourseTypeSummary,
  getCourseTypeSummaryRange,
  getMonthPaymentBreakdown,
  getMonthSoldTotal,
  getMonthlyCollection,
  getPendingTotal,
  getYearCollections,
} from "../../lib/api/management";
import { listProfitability } from "../../lib/api/profitability";
import { listGoalProgressHistory } from "../../lib/api/goals";
import { GoalProgressCard } from "../../components/goal-progress-card";
import { TextInput, Select } from "../../components/ui/field";
import { formatMoney, sumMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { MONTHS } from "../../lib/months";
import { goalState, GOAL_STATE_COLORS, GOAL_STATE_LABELS } from "../../types/goal";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function GestionPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const { data: current } = useQuery({
    queryKey: ["mgmt-collection", month, year],
    queryFn: () => getMonthlyCollection(month, year),
  });
  const { data: previous } = useQuery({
    queryKey: ["mgmt-collection", prevMonth, prevYear],
    queryFn: () => getMonthlyCollection(prevMonth, prevYear),
  });
  const { data: yearCollections } = useQuery({
    queryKey: ["mgmt-year-collections", year],
    queryFn: () => getYearCollections(year),
  });
  const { data: pending } = useQuery({ queryKey: ["mgmt-pending"], queryFn: getPendingTotal });
  const { data: breakdown } = useQuery({
    queryKey: ["mgmt-breakdown", month, year],
    queryFn: () => getMonthPaymentBreakdown(month, year),
  });
  const { data: soldMonth } = useQuery({
    queryKey: ["mgmt-sold", month, year],
    queryFn: () => getMonthSoldTotal(month, year),
  });
  const [facturacionFrom, setFacturacionFrom] = useState("");
  const [facturacionTo, setFacturacionTo] = useState("");
  const hasFacturacionRange = Boolean(facturacionFrom && facturacionTo);

  const { data: courseSummary, isFetching: loadingCourseSummary } = useQuery({
    queryKey: hasFacturacionRange
      ? ["mgmt-course-summary-range", facturacionFrom, facturacionTo]
      : ["mgmt-course-summary"],
    queryFn: () =>
      hasFacturacionRange ? getCourseTypeSummaryRange(facturacionFrom, facturacionTo) : getCourseTypeSummary(),
  });

  const { data: profitability } = useQuery({
    queryKey: ["mgmt-profitability"],
    queryFn: listProfitability,
  });

  const { data: goalHistory } = useQuery({
    queryKey: ["mgmt-goal-history"],
    queryFn: listGoalProgressHistory,
  });

  const currentAmount = parseFloat(current?.net_collected ?? "0");
  const previousAmount = parseFloat(previous?.net_collected ?? "0");
  const variation = previousAmount !== 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : null;
  const yearTotal = sumMoney((yearCollections ?? []).map((r) => r.net_collected));

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Gestión</h1>
        <p className="text-sm text-gray-500">Panel privado — solo vos lo ves.</p>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Cobranza — {MONTHS[month - 1]} {year}</h2>
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-40">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Cobrado este mes" value={formatMoney(currentAmount)} />
          <Stat label="Cobrado mes anterior" value={formatMoney(previousAmount)} />
          <Stat
            label="Variación %"
            value={variation === null ? "—" : `${variation >= 0 ? "+" : ""}${variation.toFixed(0)}%`}
          />
          <Stat label="Cobrado del año" value={formatMoney(yearTotal)} />
          <Stat label="Vendido este mes" value={formatMoney(soldMonth ?? 0)} />
          <Stat label="Pendiente de cobro" value={formatMoney(pending ?? 0)} sub="Saldo total a hoy, no depende del mes elegido" />
          <Stat label="Total de señas (mes)" value={formatMoney(breakdown?.totalSenas ?? 0)} />
          <Stat
            label="Reintegros (mes)"
            value={formatMoney(breakdown?.totalReintegros ?? 0)}
            sub={`${breakdown?.totalPagos ?? 0} movimientos de pago en el mes`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Objetivo del mes</h2>
        <GoalProgressCard />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Historial de objetivos</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Mes</th>
                  <th className="text-right px-4 py-3 font-medium">Objetivo</th>
                  <th className="text-right px-4 py-3 font-medium">Cobrado</th>
                  <th className="text-left px-4 py-3 font-medium w-40">Progreso</th>
                  <th className="text-right px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {goalHistory?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Todavía no hay objetivos cargados.
                    </td>
                  </tr>
                )}
                {goalHistory?.map((g) => {
                  const percent = g.percent_complete ?? 0;
                  const state = goalState(percent);
                  const barPercent = Math.min(100, Math.max(0, percent));
                  return (
                    <tr key={g.goal_id}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {MONTHS[g.month - 1]} {g.year}
                      </td>
                      <td className="px-4 py-2 text-right">{formatMoney(g.target_amount)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(g.collected)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full ${GOAL_STATE_COLORS[state]}`} style={{ width: `${barPercent}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-9 text-right shrink-0">{percent.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${GOAL_STATE_COLORS[state]}`}>
                          {GOAL_STATE_LABELS[state]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Facturación por modalidad</h2>
          <div className="flex items-center gap-2">
            <TextInput
              type="date"
              value={facturacionFrom}
              onChange={(e) => setFacturacionFrom(e.target.value)}
              className="!w-auto !py-1.5 text-xs"
            />
            <span className="text-xs text-gray-400">a</span>
            <TextInput
              type="date"
              value={facturacionTo}
              onChange={(e) => setFacturacionTo(e.target.value)}
              className="!w-auto !py-1.5 text-xs"
            />
            {hasFacturacionRange && (
              <button
                onClick={() => {
                  setFacturacionFrom("");
                  setFacturacionTo("");
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0"
              >
                Ver todo
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {hasFacturacionRange
            ? `Vendido y cobrado entre el ${formatDateAR(facturacionFrom)} y el ${formatDateAR(facturacionTo)}.`
            : "Mostrando el histórico completo — elegí un rango de fechas para filtrar."}
        </p>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Modalidad</th>
                <th className="text-right px-4 py-3 font-medium">Ediciones</th>
                <th className="text-right px-4 py-3 font-medium">Alumnas</th>
                <th className="text-right px-4 py-3 font-medium">Vendido</th>
                <th className="text-right px-4 py-3 font-medium">Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loadingCourseSummary && courseSummary?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Sin actividad en el rango elegido.
                  </td>
                </tr>
              )}
              {courseSummary?.map((c) => (
                <tr key={c.course_type_id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-2 text-right">{c.edition_count}</td>
                  <td className="px-4 py-2 text-right">{c.enrollment_count}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(c.total_sold ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(c.total_collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Rentabilidad por edición</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Edición</th>
                <th className="text-left px-4 py-3 font-medium">Modalidad</th>
                <th className="text-right px-4 py-3 font-medium">Ingresos</th>
                <th className="text-right px-4 py-3 font-medium">Gastos</th>
                <th className="text-right px-4 py-3 font-medium">Resultado</th>
                <th className="text-right px-4 py-3 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profitability?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Sin datos todavía.
                  </td>
                </tr>
              )}
              {profitability
                ?.slice()
                .sort((a, b) => (b.edition_date ?? "").localeCompare(a.edition_date ?? ""))
                .map((p) => {
                  const income = parseFloat(p.income);
                  const margin = income > 0 ? (parseFloat(p.profit) / income) * 100 : 0;
                  return (
                    <tr key={p.course_edition_id}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {p.name || formatDateAR(p.edition_date)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{p.course_type_name}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(p.income)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(p.expenses_total)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${parseFloat(p.profit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatMoney(p.profit)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{income > 0 ? `${margin.toFixed(0)}%` : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}
