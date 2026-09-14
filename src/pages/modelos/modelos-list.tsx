import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createModel, deleteModel, getModelPhotoUrl, listModels, updateModel } from "../../lib/api/models";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { TextInput } from "../../components/ui/field";
import { ModelForm } from "./model-form";
import { useAuth } from "../../lib/auth-context";
import type { ModelInput, ModelWithServices } from "../../types/model";

export default function ModelosList() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ModelWithServices | null>(null);

  const { data: models, isLoading } = useQuery({ queryKey: ["models"], queryFn: listModels });

  const filtered = (models ?? []).filter((m) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(term);
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["models"] });
  }

  const createMutation = useMutation({
    mutationFn: ({ input, services, photo }: { input: ModelInput; services: string[]; photo: File | null }) =>
      createModel(input, services, photo, profile?.id ?? null),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
      services,
      photo,
    }: {
      id: string;
      input: ModelInput;
      services: string[];
      photo: File | null;
    }) => updateModel(id, input, services, photo, profile?.id ?? null),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (model: ModelWithServices) => deleteModel(model),
    onSuccess: invalidate,
  });

  async function handleViewPhoto(path: string) {
    const url = await getModelPhotoUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Modelos</h1>
          <p className="text-sm text-gray-500">{models?.length ?? 0} en total</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Nueva modelo</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <TextInput
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Edad</th>
                <th className="text-left px-4 py-3 font-medium">Servicios</th>
                <th className="text-left px-4 py-3 font-medium">Foto</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No hay modelos cargadas todavía.
                  </td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td
                    className="px-4 py-2 font-medium text-gray-900 cursor-pointer"
                    onClick={() => setEditing(m)}
                  >
                    {m.last_name}, {m.first_name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{m.age ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.course_type_names.length === 0 && <span className="text-gray-400">—</span>}
                      {m.course_type_names.map((name, i) => (
                        <Badge key={i} color="brand">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {m.photo_url ? (
                      <button
                        className="text-brand-600 hover:text-brand-700 text-xs"
                        onClick={() => handleViewPhoto(m.photo_url!)}
                      >
                        Ver foto
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin foto</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && (
                      <button
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(m)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModelForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(input, services, photo) => createMutation.mutate({ input, services, photo })}
        saving={createMutation.isPending}
      />

      {editing && (
        <ModelForm
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(input, services, photo) =>
            updateMutation.mutate({ id: editing.id, input, services, photo })
          }
          initial={editing}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
