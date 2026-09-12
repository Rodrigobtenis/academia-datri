import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCommissionRate, getCurrentCommissionRate, listCommissionRateHistory } from "../../lib/api/commissions";
import { getGoalProgress, upsertGoal } from "../../lib/api/goals";
import { listAllProfiles, updateProfileActive, updateProfileName, updateProfileRole } from "../../lib/api/profiles";
import { Field, TextInput, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { useAuth } from "../../lib/auth-context";
import type { Role } from "../../types/profile";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ConfiguracionPage() {
  const now = new Date();
  const queryClient = useQueryClient();
  const { profile: myProfile } = useAuth();
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

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

  const { data: users } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: listAllProfiles,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => updateProfileRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-profiles"] }),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateProfileActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-profiles"] }),
  });

  const nameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateProfileName(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      setEditingNameId(null);
    },
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
                <span>Desde {formatDateAR(r.effective_from)}</span>
                <span className="font-medium">{r.rate_percent}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Usuarios</h2>
        <p className="text-sm text-gray-500 mb-4">
          Para crear un usuario nuevo, agregalo primero en Supabase (Authentication → Users) con su
          email y contraseña — acá le asignás el nombre, el rol y podés desactivarlo.
        </p>
        <div className="space-y-3">
          {users?.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-b border-gray-100 last:border-0"
            >
              <div className="w-48 shrink-0">
                {editingNameId === u.id ? (
                  <div className="flex items-center gap-2">
                    <TextInput
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="!py-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => nameMutation.mutate({ id: u.id, name: nameDraft })}
                      disabled={nameMutation.isPending}
                    >
                      Guardar
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-gray-900 hover:text-brand-600"
                    onClick={() => {
                      setEditingNameId(u.id);
                      setNameDraft(u.full_name ?? "");
                    }}
                  >
                    {u.full_name || "Sin nombre — asignar"}
                  </button>
                )}
                {u.id === myProfile?.id && <span className="text-xs text-gray-400 ml-1">(vos)</span>}
              </div>

              <Select
                value={u.role}
                onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value as Role })}
                disabled={u.id === myProfile?.id}
                className="!py-1 text-xs w-32 shrink-0"
              >
                <option value="admin">Admin</option>
                <option value="empleada">Empleada</option>
              </Select>

              <div className="shrink-0">
                {u.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={u.id === myProfile?.id}
                onClick={() => activeMutation.mutate({ id: u.id, active: !u.active })}
                className="ml-auto shrink-0"
              >
                {u.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
