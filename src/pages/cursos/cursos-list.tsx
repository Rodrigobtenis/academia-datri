import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createCourseType, listCourseTypes } from "../../lib/api/courses";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea } from "../../components/ui/field";
import { useAuth } from "../../lib/auth-context";

export default function CursosList() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: types, isLoading } = useQuery({
    queryKey: ["course-types"],
    queryFn: listCourseTypes,
  });

  const createMutation = useMutation({
    mutationFn: () => createCourseType(name, description),
    onSuccess: (type) => {
      queryClient.invalidateQueries({ queryKey: ["course-types"] });
      setCreating(false);
      setName("");
      setDescription("");
      navigate(`/cursos/${type.id}`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Cursos — Modalidades</h1>
          <p className="text-sm text-gray-500">
            Entrá a una modalidad para ver y crear sus ediciones.
          </p>
        </div>
        {isAdmin && <Button onClick={() => setCreating(true)}>+ Nueva modalidad</Button>}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {types?.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/cursos/${t.id}`)}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition"
          >
            <div className="font-semibold text-gray-900">{t.name}</div>
            {t.description && <div className="text-sm text-gray-500 mt-1">{t.description}</div>}
          </button>
        ))}
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva modalidad">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre *">
            <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Descripción">
            <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
    </div>
  );
}
