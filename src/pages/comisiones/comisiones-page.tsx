import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMonthlyCommissionDetail } from "../../lib/api/commissions";
import { Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney, sumMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { exportToExcel } from "../../lib/excel-export";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "../../types/payment";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ComisionesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: rows, isLoading } = useQuery({
    queryKey: ["commissions", month, year],
    queryFn: () => getMonthlyCommissionDetail(month, year),
  });

  const totals = useMemo(() => {
    const totalCobrado = sumMoney((rows ?? []).map((r) => r.amount));
    const totalComision = sumMoney((rows ?? []).map((r) => r.commission_amount));
    return { totalCobrado, totalComision };
  }, [rows]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  function handleExport() {
    exportToExcel(
      `Comisiones ${MONTHS[month - 1]} ${year}`,
      "Comisiones",
      [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Alumna", key: "alumna", width: 25 },
        { header: "Curso", key: "curso", width: 18 },
        { header: "Edición", key: "edicion", width: 20 },
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Método", key: "metodo", width: 16 },
        { header: "Monto", key: "monto", width: 14 },
        { header: "%", key: "porcentaje", width: 8 },
        { header: "Comisión", key: "comision", width: 14 },
      ],
      (rows ?? []).map((r) => ({
        fecha: formatDateAR(r.payment_date),
        alumna: r.student_name,
        curso: r.course_name,
        edicion: r.edition_label,
        tipo: PAYMENT_TYPE_LABELS[r.payment_type],
        metodo: PAYMENT_METHOD_LABELS[r.payment_method],
        monto: parseFloat(r.amount),
        porcentaje: parseFloat(r.rate_percent),
        comision: parseFloat(r.commission_amount),
      }))
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Comisiones</h1>
          <p className="text-sm text-gray-500">
            Calculada sobre el dinero efectivamente cobrado ese mes, según la fecha real de cada pago.
          </p>
        </div>
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
          <Button variant="secondary" onClick={handleExport} disabled={!rows || rows.length === 0}>
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-400">Total cobrado</div>
          <div className="text-2xl font-semibold text-gray-900">{formatMoney(totals.totalCobrado)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-400">Comisión</div>
          <div className="text-2xl font-semibold text-brand-700">{formatMoney(totals.totalComision)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Alumna</th>
              <th className="text-left px-4 py-3 font-medium">Curso</th>
              <th className="text-left px-4 py-3 font-medium">Edición</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Método</th>
              <th className="text-right px-4 py-3 font-medium">Monto</th>
              <th className="text-right px-4 py-3 font-medium">%</th>
              <th className="text-right px-4 py-3 font-medium">Comisión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && rows?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No hay pagos cobrados en este mes.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.payment_id}>
                <td className="px-4 py-2">{formatDateAR(r.payment_date)}</td>
                <td className="px-4 py-2">{r.student_name}</td>
                <td className="px-4 py-2">{r.course_name}</td>
                <td className="px-4 py-2">{r.edition_label}</td>
                <td className="px-4 py-2">{PAYMENT_TYPE_LABELS[r.payment_type]}</td>
                <td className="px-4 py-2">{PAYMENT_METHOD_LABELS[r.payment_method]}</td>
                <td className="px-4 py-2 text-right">{formatMoney(r.amount)}</td>
                <td className="px-4 py-2 text-right text-gray-400">{r.rate_percent}%</td>
                <td className="px-4 py-2 text-right font-medium">{formatMoney(r.commission_amount)}</td>
              </tr>
            ))}
          </tbody>
          {rows && rows.length > 0 && (
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right">
                  Totales
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(totals.totalCobrado)}</td>
                <td />
                <td className="px-4 py-3 text-right">{formatMoney(totals.totalComision)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    </div>
  );
}
