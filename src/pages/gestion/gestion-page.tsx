import { useQuery } from "@tanstack/react-query";
import {
  getCourseTypeSummary,
  getMonthPaymentBreakdown,
  getMonthSoldTotal,
  getMonthlyCollection,
  getPendingTotal,
  getYearCollections,
} from "../../lib/api/management";
import { listProfitability } from "../../lib/api/profitability";
import { GoalProgressCard } from "../../components/goal-progress-card";
import { formatMoney, sumMoney } from "../../lib/money";

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
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
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
  const { data: courseSummary } = useQuery({
    queryKey: ["mgmt-course-summary"],
    queryFn: getCourseTypeSummary,
  });

  const { data: profitability } = useQuery({
    queryKey: ["mgmt-profitability"],
    queryFn: listProfitability,
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
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Cobranza</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Cobrado este mes" value={formatMoney(currentAmount)} />
          <Stat label="Cobrado mes anterior" value={formatMoney(previousAmount)} />
          <Stat
            label="Variación %"
            value={variation === null ? "—" : `${variation >= 0 ? "+" : ""}${variation.toFixed(0)}%`}
          />
          <Stat label="Cobrado del año" value={formatMoney(yearTotal)} />
          <Stat label="Vendido este mes" value={formatMoney(soldMonth ?? 0)} />
          <Stat label="Pendiente de cobro" value={formatMoney(pending ?? 0)} />
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
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Facturación por modalidad</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Rentabilidad por edición</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                        {p.name || (p.edition_date ? new Date(p.edition_date).toLocaleDateString("es-AR") : "—")}
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
      </section>
    </div>
  );
}
