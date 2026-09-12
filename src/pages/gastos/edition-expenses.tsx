import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createExpense, deleteExpense, listExpensesByEdition } from "../../lib/api/expenses";
import { Button } from "../../components/ui/button";
import { ExpenseForm } from "./expense-form";
import { formatMoney, sumMoney } from "../../lib/money";
import { EXPENSE_CATEGORY_LABELS, type ExpenseInput } from "../../types/expense";

export function EditionExpenses({ editionId }: { editionId: string }) {
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses } = useQuery({
    queryKey: ["edition-expenses", editionId],
    queryFn: () => listExpensesByEdition(editionId),
  });

  const createMutation = useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edition-expenses", editionId] });
      setCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["edition-expenses", editionId] }),
  });

  const total = sumMoney((expenses ?? []).map((e) => e.amount));

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Gastos de esta edición</h2>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          + Gasto
        </Button>
      </div>

      {(expenses?.length ?? 0) === 0 ? (
        <p className="text-sm text-gray-400">Sin gastos registrados.</p>
      ) : (
        <div className="space-y-2">
          {expenses?.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {EXPENSE_CATEGORY_LABELS[e.category]}
                {e.description ? ` — ${e.description}` : ""}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatMoney(e.amount)}</span>
                <button
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(e.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100 font-medium">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      )}

      <ExpenseForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        defaultEditionId={editionId}
        saving={createMutation.isPending}
      />
    </section>
  );
}
