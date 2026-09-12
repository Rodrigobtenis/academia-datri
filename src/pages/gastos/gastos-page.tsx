import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createExpense, deleteExpense, listExpenses } from "../../lib/api/expenses";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/field";
import { ExpenseForm } from "./expense-form";
import { formatMoney, sumMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { EXPENSE_CATEGORY_LABELS, type ExpenseInput } from "../../types/expense";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function GastosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", month, year],
    queryFn: () => listExpenses(month, year),
  });

  const createMutation = useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const total = sumMoney((expenses ?? []).map((e) => e.amount));
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500">Privado — solo Admin.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Registrar gasto</Button>
      </div>

      <div className="flex gap-2 mb-6">
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

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 max-w-xs">
        <div className="text-xs text-gray-400">Total del mes</div>
        <div className="text-2xl font-semibold text-gray-900">{formatMoney(total)}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Categoría</th>
              <th className="text-left px-4 py-3 font-medium">Descripción</th>
              <th className="text-left px-4 py-3 font-medium">Edición</th>
              <th className="text-right px-4 py-3 font-medium">Monto</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && expenses?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Sin gastos este mes.
                </td>
              </tr>
            )}
            {expenses?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2">{formatDateAR(e.expense_date)}</td>
                <td className="px-4 py-2">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                <td className="px-4 py-2 text-gray-600">{e.description || "—"}</td>
                <td className="px-4 py-2 text-gray-600">
                  {e.course_editions?.name || (e.course_editions ? formatDateAR(e.course_editions.start_date) : "General")}
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatMoney(e.amount)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => deleteMutation.mutate(e.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <ExpenseForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        saving={createMutation.isPending}
      />
    </div>
  );
}
