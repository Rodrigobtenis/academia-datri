import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createService, listServices, updateService } from "../../lib/api/services";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, Select } from "../../components/ui/field";
import { formatMoney } from "../../lib/money";
import { useAuth } from "../../lib/auth-context";
import type { Service, ServiceInput } from "../../types/service";

export function ServicesList() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("0");
  const [category, setCategory] = useState("");

  const { data: services } = useQuery({ queryKey: ["services"], queryFn: listServices });

  const categories = useMemo(() => {
    const set = new Set((services ?? []).map((s) => s.category).filter((c): c is string => Boolean(c)));
    return Array.from(set).sort();
  }, [services]);

  const filteredServices = categoryFilter
    ? (services ?? []).filter((s) => s.category === categoryFilter)
    : services;

  function resetForm() {
    setName("");
    setDuration("60");
    setPrice("0");
    setCategory("");
  }

  const createMutation = useMutation({
    mutationFn: (input: ServiceInput) => createService(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ServiceInput> }) => updateService(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setEditing(null);
    },
  });

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      duration_minutes: Number(duration),
      price,
      category: category || null,
      active: true,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-56">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {isAdmin && <Button onClick={() => setCreating(true)}>+ Nuevo servicio</Button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Servicio</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-right px-4 py-3 font-medium">Duración</th>
                <th className="text-right px-4 py-3 font-medium">Precio</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredServices?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Todavía no hay servicios cargados.
                  </td>
                </tr>
              )}
              {filteredServices?.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-2 text-gray-500">{s.category || "—"}</td>
                  <td className="px-4 py-2 text-right">{s.duration_minutes} min</td>
                  <td className="px-4 py-2 text-right">{formatMoney(s.price)}</td>
                  <td className="px-4 py-2 text-center">
                    {s.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditing(s)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => updateMutation.mutate({ id: s.id, input: { active: !s.active } })}
                        >
                          {s.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo servicio">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Field label="Nombre *">
            <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Categoría">
            <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Cejas" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duración (min) *">
              <TextInput
                type="number"
                min={1}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label="Precio *">
              <TextInput
                type="number"
                step="0.01"
                min={0}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>
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
        <EditServiceDialog
          service={editing}
          onClose={() => setEditing(null)}
          onSave={(input) => updateMutation.mutate({ id: editing.id, input })}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditServiceDialog({
  service,
  onClose,
  onSave,
  saving,
}: {
  service: Service;
  onClose: () => void;
  onSave: (input: Partial<ServiceInput>) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [price, setPrice] = useState(service.price);
  const [category, setCategory] = useState(service.category ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ name, duration_minutes: Number(duration), price, category: category || null });
  }

  return (
    <Dialog open onClose={onClose} title="Editar servicio">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre *">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Categoría">
          <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Cejas" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración (min) *">
            <TextInput type="number" min={1} required value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label="Precio *">
            <TextInput type="number" step="0.01" min={0} required value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
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
