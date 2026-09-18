import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProfessional, getProfessionalCommissions, listProfessionals, updateProfessional } from "../../lib/api/professionals";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { formatMoney } from "../../lib/money";
import { MONTHS } from "../../lib/months";
import { useAuth } from "../../lib/auth-context";
import type { ProfessionalInput } from "../../types/professional";

export function ProfessionalsList() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("0");
  const [notes, setNotes] = useState("");

  const { data: professionals } = useQuery({ queryKey: ["professionals"], queryFn: listProfessionals });
  const { data: commissions } = useQuery({
    queryKey: ["professional-commissions", month, year],
    queryFn: () => getProfessionalCommissions(month, year),
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setCommissionPercent("0");
    setNotes("");
  }

  const createMutation = useMutation({
    mutationFn: (input: ProfessionalInput) => createProfessional(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      setCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProfessionalInput> }) => updateProfessional(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      setEditing(null);
    },
  });

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      commission_percent: commissionPercent || "0",
      active: true,
      notes: notes || null,
    });
  }

  function commissionFor(professionalId: string) {
    return commissions?.find((c) => c.professional_id === professionalId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
        {isAdmin && <Button onClick={() => setCreating(true)}>+ Nuevo profesional</Button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Profesional</th>
                <th className="text-right px-4 py-3 font-medium">% Comisión</th>
                <th className="text-right px-4 py-3 font-medium">Turnos atendidos</th>
                <th className="text-right px-4 py-3 font-medium">Facturado</th>
                <th className="text-right px-4 py-3 font-medium">Comisión del mes</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {professionals?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Todavía no hay profesionales cargados.
                  </td>
                </tr>
              )}
              {professionals?.map((p) => {
                const c = commissionFor(p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {p.first_name} {p.last_name}
                      {p.phone && <span className="block text-xs text-gray-400 font-normal">{p.phone}</span>}
                    </td>
                    <td className="px-4 py-2 text-right">{p.commission_percent}%</td>
                    <td className="px-4 py-2 text-right">{c?.appointment_count ?? 0}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(c?.total_billed ?? 0)}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-600">
                      {formatMoney(c?.commission_amount ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEditing(p.id)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => updateMutation.mutate({ id: p.id, input: { active: !p.active } })}
                          >
                            {p.active ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo profesional">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *">
              <TextInput required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Apellido *">
              <TextInput required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="% de comisión *">
              <TextInput
                type="number"
                step="0.01"
                min={0}
                max={100}
                required
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Notas">
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Guardando..." : "Crear"}
            </Button>
          </div>
        </form>
      </Dialog>

      {editing && (
        <EditProfessionalDialog
          professional={professionals!.find((p) => p.id === editing)!}
          onClose={() => setEditing(null)}
          onSave={(input) => updateMutation.mutate({ id: editing, input })}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditProfessionalDialog({
  professional,
  onClose,
  onSave,
  saving,
}: {
  professional: { first_name: string; last_name: string; phone: string | null; commission_percent: string; notes: string | null };
  onClose: () => void;
  onSave: (input: Partial<ProfessionalInput>) => void;
  saving?: boolean;
}) {
  const [firstName, setFirstName] = useState(professional.first_name);
  const [lastName, setLastName] = useState(professional.last_name);
  const [phone, setPhone] = useState(professional.phone ?? "");
  const [commissionPercent, setCommissionPercent] = useState(professional.commission_percent);
  const [notes, setNotes] = useState(professional.notes ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      commission_percent: commissionPercent,
      notes: notes || null,
    });
  }

  return (
    <Dialog open onClose={onClose} title="Editar profesional">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *">
            <TextInput required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Apellido *">
            <TextInput required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Teléfono">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="% de comisión *">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              max={100}
              required
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notas">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
