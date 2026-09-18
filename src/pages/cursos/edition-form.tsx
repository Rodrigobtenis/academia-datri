import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import {
  EDITION_MODALITY_LABELS,
  EDITION_STATUS_LABELS,
  type CourseEdition,
  type CourseEditionInput,
  type EditionModality,
} from "../../types/course";

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyForm(courseTypeId: string, defaultModality: EditionModality): CourseEditionInput {
  return {
    course_type_id: courseTypeId,
    name: "",
    start_date: defaultModality === "online" ? todayISO() : "",
    end_date: null,
    start_time: null,
    end_time: null,
    location: "",
    teacher: "",
    max_students: 10,
    list_price: "0",
    promo_price: null,
    status: "borrador",
    modality: defaultModality,
    description: null,
    includes: null,
    materials: "",
    requirements: null,
    internal_notes: null,
  };
}

export function EditionForm({
  open,
  onClose,
  onSubmit,
  courseTypeId,
  initial,
  title,
  saving,
  defaultModality = "presencial",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CourseEditionInput) => void;
  courseTypeId: string;
  initial?: Partial<CourseEdition> | null;
  title: string;
  saving?: boolean;
  defaultModality?: EditionModality;
}) {
  const [form, setForm] = useState<CourseEditionInput>(() => ({
    ...emptyForm(courseTypeId, defaultModality),
    ...initial,
  }));

  function update<K extends keyof CourseEditionInput>(key: K, value: CourseEditionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setModality(modality: EditionModality) {
    setForm((f) => ({
      ...f,
      modality,
      start_date: modality === "online" ? todayISO() : f.start_date === todayISO() ? "" : f.start_date,
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      start_date: form.modality === "online" ? todayISO() : form.start_date,
      location: form.location || null,
      teacher: form.teacher || null,
      materials: form.materials || null,
      name: form.name || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre (opcional)">
          <TextInput
            placeholder="Ej: Edición Septiembre 2026"
            value={form.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <Field label="Modalidad">
          <Select value={form.modality} onChange={(e) => setModality(e.target.value as EditionModality)}>
            {Object.entries(EDITION_MODALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {form.modality === "online" ? (
            <Field label="Fecha">
              <div className="flex items-center h-[38px] px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-400">
                Sin agenda — cuenta para el mes en curso
              </div>
            </Field>
          ) : (
            <Field label="Fecha *">
              <TextInput
                type="date"
                required
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
              />
            </Field>
          )}
          <Field label="Dirección / sede">
            <TextInput
              disabled={form.modality === "online"}
              placeholder={form.modality === "online" ? "No aplica" : undefined}
              value={form.location ?? ""}
              onChange={(e) => update("location", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Docente">
            <TextInput value={form.teacher ?? ""} onChange={(e) => update("teacher", e.target.value)} />
          </Field>
          <Field label="Cupos máximos *">
            <TextInput
              type="number"
              min={1}
              required
              value={form.max_students}
              onChange={(e) => update("max_students", Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio *">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              required
              value={form.list_price}
              onChange={(e) => update("list_price", e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => update("status", e.target.value as never)}>
              {Object.entries(EDITION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Materiales incluidos">
          <TextArea rows={2} value={form.materials ?? ""} onChange={(e) => update("materials", e.target.value)} />
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
