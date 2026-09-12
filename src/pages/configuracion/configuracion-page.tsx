import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCommissionRate, getCurrentCommissionRate, listCommissionRateHistory } from "../../lib/api/commissions";
import { getGoalProgress, upsertGoal } from "../../lib/api/goals";
import { Field, TextInput } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ConfiguracionPage() {
  const now = new Date();
  const queryClient = useQueryClient();

  const [goalMonth, setGoalMonth] = useState(now.getMonth() + 1);
  const [goalYear, setGoalYear] = useState(now.getFullYear());
  const [targetAmount, setTargetAmount] = useState("");
  const [goalName, setGoalName] = useState("");

  const [newRate, setNewRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(now.toISOString().slice(0, 10));

  const { data: currentGoal } = useQuery({
    queryKey: ["goal-progress", goalMonth, goalYear],
    queryFn: () => getGoalProgress(goalMonth, goalYear),
  });

  const { data: currentRate } = useQuery({
    queryKey: ["commission-rate-current"],
    queryFn: getCurrentCommissionRate,
  });

  const { data: rateHistory } = useQuery({
    queryKey: ["commission-rate-history"],
    queryFn: listCommissionRateHistory,
  });

  const goalMutation = useMutation({
    mutationFn: () =>
      upsertGoal({
        month: goalMonth,
        year: goalYear,
        target_amount: parseFloat(targetAmount || "0"),
        name: goalName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal-progress"] });
      setTargetAmount("");
      setGoalName("");
    },
  });

  const rateMutation = useMutation({
    mutationFn: () => addCommissionRate(parseFloat(newRate || "0"), effectiveFrom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rate-current"] });
      queryClient.invalidateQueries({ queryKey: ["commission-rate-history"] });
      setNewRate("");
    },
  });

  function handleGoalSubmit(e: FormEvent) {
    e.preventDefault();
    goalMutation.mutate();
  }

  function handleRateSubmit(e: FormEvent) {
    e.preventDefault();
    rateMutation.mutate();
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Privado — solo vos podés definir objetivos y el % de comisión.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Objetivo mensual</h2>
        <form onSubmit={handleGoalSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Mes">
              <select
                value={goalMonth}
                onChange={(e) => setGoalMonth(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Año">
              <select
                value={goalYear}
                onChange={(e) => setGoalYear(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto objetivo *">
              <TextInput
                type="number"
                step="0.01"
                min={0}
                required
                placeholder={currentGoal ? currentGoal.target_amount : "0"}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Nombre (opcional)">
            <TextInput value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Ej: Meta Septiembre" />
          </Field>

          {currentGoal && (
            <p className="text-xs text-gray-400">
              Objetivo actual de {MONTHS[goalMonth - 1]} {goalYear}: {formatMoney(currentGoal.target_amount)}
            </p>
          )}

          <Button type="submit" disabled={goalMutation.isPending}>
            {goalMutation.isPending ? "Guardando..." : "Guardar objetivo"}
          </Button>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Porcentaje de comisión</h2>
        <p className="text-sm text-gray-500 mb-4">
          Vigente actualmente: <span className="font-medium text-gray-800">{currentRate?.rate_percent ?? "—"}%</span>
        </p>
        <form onSubmit={handleRateSubmit} className="flex items-end gap-4">
          <Field label="Nuevo % *" className="w-32">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              max={100}
              required
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
            />
          </Field>
          <Field label="Vigente desde *" className="w-48">
            <TextInput
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={rateMutation.isPending}>
            {rateMutation.isPending ? "Guardando..." : "Actualizar"}
          </Button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Los pagos ya cobrados antes de esta fecha siguen calculando con el % que estaba vigente en
          ese momento — nunca se recalcula el pasado.
        </p>

        {rateHistory && rateHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
            {rateHistory.map((r) => (
              <div key={r.id} className="flex justify-between text-sm text-gray-600">
                <span>Desde {new Date(r.effective_from).toLocaleDateString("es-AR")}</span>
                <span className="font-medium">{r.rate_percent}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
