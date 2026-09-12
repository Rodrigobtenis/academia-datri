import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { EDITION_STATUS_LABELS, type CourseEdition, type CourseEditionInput } from "../../types/course";

function emptyForm(courseTypeId: string): CourseEditionInput {
  return {
    course_type_id: courseTypeId,
    name: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    teacher: "",
    max_students: 10,
    list_price: "0",
    promo_price: "",
    status: "borrador",
    description: "",
    includes: "",
    materials: "",
    requirements: "",
    internal_notes: "",
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
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CourseEditionInput) => void;
  courseTypeId: string;
  initial?: Partial<CourseEdition> | null;
  title: string;
  saving?: boolean;
}) {
  const [form, setForm] = useState<CourseEditionInput>(() => ({
    ...emptyForm(courseTypeId),
    ...initial,
  }));

  function update<K extends keyof CourseEditionInput>(key: K, value: CourseEditionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      teacher: form.teacher || null,
      promo_price: form.promo_price || null,
      description: form.description || null,
      includes: form.includes || null,
      materials: form.materials || null,
      requirements: form.requirements || null,
      internal_notes: form.internal_notes || null,
      name: form.name || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Field label="Nombre (opcional)">
          <TextInput
            placeholder="Ej: Edición Septiembre 2026"
            value={form.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de inicio *">
            <TextInput
              type="date"
              required
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
            />
          </Field>
          <Field label="Fecha de finalización">
            <TextInput
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => update("end_date", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hora de inicio">
            <TextInput
              type="time"
              value={form.start_time ?? ""}
              onChange={(e) => update("start_time", e.target.value)}
            />
          </Field>
          <Field label="Hora de finalización">
            <TextInput
              type="time"
              value={form.end_time ?? ""}
              onChange={(e) => update("end_time", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección / sede">
            <TextInput value={form.location ?? ""} onChange={(e) => update("location", e.target.value)} />
          </Field>
          <Field label="Docente">
            <TextInput value={form.teacher ?? ""} onChange={(e) => update("teacher", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Cupos máximos *">
            <TextInput
              type="number"
              min={1}
              required
              value={form.max_students}
              onChange={(e) => update("max_students", Number(e.target.value))}
            />
          </Field>
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
          <Field label="Precio promocional">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              value={form.promo_price ?? ""}
              onChange={(e) => update("promo_price", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Estado">
          <Select value={form.status} onChange={(e) => update("status", e.target.value as never)}>
            {Object.entries(EDITION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Descripción">
          <TextArea rows={2} value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} />
        </Field>
        <Field label="Qué incluye">
          <TextArea rows={2} value={form.includes ?? ""} onChange={(e) => update("includes", e.target.value)} />
        </Field>
        <Field label="Materiales incluidos">
          <TextArea rows={2} value={form.materials ?? ""} onChange={(e) => update("materials", e.target.value)} />
        </Field>
        <Field label="Requisitos">
          <TextArea rows={2} value={form.requirements ?? ""} onChange={(e) => update("requirements", e.target.value)} />
        </Field>
        <Field label="Observaciones internas">
          <TextArea
            rows={2}
            value={form.internal_notes ?? ""}
            onChange={(e) => update("internal_notes", e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white">
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
