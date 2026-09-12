import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCobrosReport, getDeudasReport, getOcupacionReport, getOrigenReport } from "../../lib/api/reports";
import { Button } from "../../components/ui/button";
import { TextInput } from "../../components/ui/field";
import { formatMoney, sumMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { exportToExcel } from "../../lib/excel-export";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "../../types/payment";
import { STUDENT_SOURCE_LABELS } from "../../types/student";

type Tab = "cobros" | "deudas" | "ocupacion" | "origen";

const TABS: { id: Tab; label: string }[] = [
  { id: "cobros", label: "Cobros" },
  { id: "deudas", label: "Deudas" },
  { id: "ocupacion", label: "Ocupación" },
  { id: "origen", label: "Origen de alumnas" },
];

function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("cobros");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());

  const { data: cobros } = useQuery({
    queryKey: ["report-cobros", from, to],
    queryFn: () => getCobrosReport(from, to),
    enabled: tab === "cobros",
  });

  const { data: deudas } = useQuery({
    queryKey: ["report-deudas"],
    queryFn: getDeudasReport,
    enabled: tab === "deudas",
  });

  const { data: ocupacion } = useQuery({
    queryKey: ["report-ocupacion"],
    queryFn: getOcupacionReport,
    enabled: tab === "ocupacion",
  });

  const { data: origen } = useQuery({
    queryKey: ["report-origen"],
    queryFn: getOrigenReport,
    enabled: tab === "origen",
  });

  function exportCurrent() {
    if (tab === "cobros" && cobros) {
      exportToExcel(
        `Cobros ${from} a ${to}`,
        "Cobros",
        [
          { header: "Fecha", key: "fecha", width: 12 },
          { header: "Alumna", key: "alumna", width: 25 },
          { header: "Curso", key: "curso", width: 18 },
          { header: "Edición", key: "edicion", width: 20 },
          { header: "Tipo", key: "tipo", width: 14 },
          { header: "Método", key: "metodo", width: 16 },
          { header: "Monto", key: "monto", width: 14 },
        ],
        cobros.map((r) => ({
          fecha: formatDateAR(r.payment_date),
          alumna: r.student_name,
          curso: r.course_name,
          edicion: r.edition_label,
          tipo: PAYMENT_TYPE_LABELS[r.payment_type as keyof typeof PAYMENT_TYPE_LABELS] ?? r.payment_type,
          metodo: PAYMENT_METHOD_LABELS[r.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.payment_method,
          monto: parseFloat(r.amount),
        }))
      );
    } else if (tab === "deudas" && deudas) {
      exportToExcel(
        "Deudas",
        "Deudas",
        [
          { header: "Alumna", key: "alumna", width: 25 },
          { header: "Curso", key: "curso", width: 18 },
          { header: "Edición", key: "edicion", width: 20 },
          { header: "Precio final", key: "precio", width: 14 },
          { header: "Pagado", key: "pagado", width: 14 },
          { header: "Saldo", key: "saldo", width: 14 },
        ],
        deudas.map((r) => ({
          alumna: r.student_name,
          curso: r.course_name,
          edicion: r.edition_label,
          precio: parseFloat(r.final_price),
          pagado: parseFloat(r.paid),
          saldo: parseFloat(r.balance),
        }))
      );
    } else if (tab === "ocupacion" && ocupacion) {
      exportToExcel(
        "Ocupacion",
        "Ocupación",
        [
          { header: "Curso", key: "curso", width: 18 },
          { header: "Edición", key: "edicion", width: 20 },
          { header: "Cupos", key: "cupos", width: 10 },
          { header: "Inscriptas", key: "inscriptas", width: 12 },
          { header: "% Ocupación", key: "pct", width: 14 },
        ],
        ocupacion.map((r) => ({
          curso: r.course_name,
          edicion: r.edition_label,
          cupos: r.max_students,
          inscriptas: r.enrolled_count,
          pct: r.occupancy_pct ?? 0,
        }))
      );
    } else if (tab === "origen" && origen) {
      exportToExcel(
        "Origen de alumnas",
        "Origen",
        [
          { header: "Origen", key: "origen", width: 20 },
          { header: "Cantidad", key: "cantidad", width: 12 },
        ],
        origen.map((r) => ({
          origen: STUDENT_SOURCE_LABELS[r.source as keyof typeof STUDENT_SOURCE_LABELS] ?? "Sin dato",
          cantidad: r.cantidad,
        }))
      );
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">Filtrá y exportá a Excel.</p>
        </div>
        <Button variant="secondary" onClick={exportCurrent}>
          Exportar Excel
        </Button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cobros" && (
        <>
          <div className="flex gap-4 mb-4">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Alumna</th>
                    <th className="text-left px-4 py-3 font-medium">Curso</th>
                    <th className="text-left px-4 py-3 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium">Método</th>
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cobros?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        Sin cobros en el rango elegido.
                      </td>
                    </tr>
                  )}
                  {cobros?.map((r) => (
                    <tr key={r.payment_id}>
                      <td className="px-4 py-2">{formatDateAR(r.payment_date)}</td>
                      <td className="px-4 py-2">{r.student_name}</td>
                      <td className="px-4 py-2">{r.course_name}</td>
                      <td className="px-4 py-2">{PAYMENT_TYPE_LABELS[r.payment_type as keyof typeof PAYMENT_TYPE_LABELS] ?? r.payment_type}</td>
                      <td className="px-4 py-2">{PAYMENT_METHOD_LABELS[r.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.payment_method}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {cobros && cobros.length > 0 && (
                  <tfoot className="bg-gray-50 font-medium">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">{formatMoney(sumMoney(cobros.map((r) => r.amount)))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "deudas" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Alumna</th>
                  <th className="text-left px-4 py-3 font-medium">Curso</th>
                  <th className="text-right px-4 py-3 font-medium">Precio final</th>
                  <th className="text-right px-4 py-3 font-medium">Pagado</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deudas?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No hay deudas pendientes.
                    </td>
                  </tr>
                )}
                {deudas?.map((r) => (
                  <tr key={r.enrollment_id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{r.student_name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {r.course_name} · {r.edition_label}
                    </td>
                    <td className="px-4 py-2 text-right">{formatMoney(r.final_price)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{formatMoney(r.paid)}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-medium">{formatMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "ocupacion" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Curso</th>
                  <th className="text-left px-4 py-3 font-medium">Edición</th>
                  <th className="text-right px-4 py-3 font-medium">Cupos</th>
                  <th className="text-right px-4 py-3 font-medium">Inscriptas</th>
                  <th className="text-right px-4 py-3 font-medium">% Ocupación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ocupacion?.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-gray-900">{r.course_name}</td>
                    <td className="px-4 py-2 text-gray-600">{r.edition_label}</td>
                    <td className="px-4 py-2 text-right">{r.max_students}</td>
                    <td className="px-4 py-2 text-right">{r.enrolled_count}</td>
                    <td className="px-4 py-2 text-right">{r.occupancy_pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "origen" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Origen</th>
                  <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {origen?.map((r) => (
                  <tr key={r.source}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {STUDENT_SOURCE_LABELS[r.source as keyof typeof STUDENT_SOURCE_LABELS] ?? "Sin dato"}
                    </td>
                    <td className="px-4 py-2 text-right">{r.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
