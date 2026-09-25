import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createCourseType, listCourseTypes } from "../../lib/api/courses";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea } from "../../components/ui/field";
import { useAuth } from "../../lib/auth-context";
import { AlertsPanel } from "../../components/alerts-panel";
import { IconCalendar, IconMonitor, IconBolt } from "../../components/icons";
import { EDITION_MODALITY_LABELS, type EditionModality } from "../../types/course";

function CategoryPicker({ onPick }: { onPick: (tipo: EditionModality) => void }) {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Cursos</h1>
        <p className="text-sm text-gray-500">¿Presencial u online? Entrá a la que necesites.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <button
          onClick={() => onPick("presencial")}
          className="text-left bg-white rounded-xl border border-gray-200 p-8 hover:border-brand-300 hover:shadow-sm transition"
        >
          <IconCalendar className="w-8 h-8 text-brand-500 mb-3" />
          <div className="font-semibold text-gray-900 text-lg">Presencial</div>
          <p className="text-sm text-gray-500 mt-1">Cursos con fecha y sede, se ven en la Agenda.</p>
        </button>
        <button
          onClick={() => onPick("online")}
          className="text-left bg-white rounded-xl border border-gray-200 p-8 hover:border-brand-300 hover:shadow-sm transition"
        >
          <IconMonitor className="w-8 h-8 text-brand-500 mb-3" />
          <div className="font-semibold text-gray-900 text-lg">Online</div>
          <p className="text-sm text-gray-500 mt-1">Sin fecha fija — cuentan para el mes en curso.</p>
        </button>
      </div>
      <button
        onClick={() => navigate("/cursos/vigentes")}
        className="mt-4 w-full max-w-2xl text-left bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition"
      >
        <IconBolt className="w-6 h-6 text-emerald-500 shrink-0" />
        <div>
          <div className="font-semibold text-gray-900">Cursos vigentes</div>
          <p className="text-sm text-gray-500">Ir directo a las ediciones abiertas para inscripción ahora.</p>
        </div>
      </button>
    </div>
  );
}

export default function CursosList() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tipo = searchParams.get("tipo") as EditionModality | null;

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
      navigate(`/cursos/${type.id}?tipo=${tipo}`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  if (!tipo) {
    return <CategoryPicker onPick={(t) => setSearchParams({ tipo: t })} />;
  }

  return (
    <div className="p-8">
      <button
        onClick={() => setSearchParams({})}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← Presencial / Online
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Cursos — Modalidades <span className="text-gray-400 font-normal">· {EDITION_MODALITY_LABELS[tipo]}</span>
          </h1>
          <p className="text-sm text-gray-500">
            Entrá a una modalidad para ver y crear sus ediciones {tipo === "online" ? "online" : "presenciales"}.
          </p>
        </div>
        {isAdmin && <Button onClick={() => setCreating(true)}>+ Nueva modalidad</Button>}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {types?.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/cursos/${t.id}?tipo=${tipo}`)}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition"
          >
            <div className="font-semibold text-gray-900">{t.name}</div>
            {t.description && <div className="text-sm text-gray-500 mt-1">{t.description}</div>}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <AlertsPanel />
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
