import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import {
  STUDENT_SOURCE_LABELS,
  STUDENT_STATUS_LABELS,
  type Student,
  type StudentInput,
} from "../../types/student";

const emptyForm: StudentInput = {
  first_name: "",
  last_name: "",
  dni: "",
  birth_date: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  city: "",
  province: "",
  country: "Argentina",
  profession: "",
  specialty: "",
  source: null,
  notes: "",
  status: "activa",
  photo_url: "",
};

export function StudentForm({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: StudentInput) => void;
  initial?: Student | null;
  saving?: boolean;
}) {
  const [form, setForm] = useState<StudentInput>(() =>
    initial ? { ...emptyForm, ...initial } : emptyForm
  );

  function update<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned: StudentInput = {
      ...form,
      dni: form.dni || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      instagram: form.instagram || null,
      city: form.city || null,
      province: form.province || null,
      profession: form.profession || null,
      specialty: form.specialty || null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
    };
    onSubmit(cleaned);
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Editar alumna" : "Nueva alumna"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *">
            <TextInput
              required
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </Field>
          <Field label="Apellido *">
            <TextInput
              required
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="DNI">
            <TextInput value={form.dni ?? ""} onChange={(e) => update("dni", e.target.value)} />
          </Field>
          <Field label="Fecha de nacimiento">
            <TextInput
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => update("birth_date", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Teléfono">
            <TextInput value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={form.whatsapp ?? ""}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </Field>
          <Field label="Instagram">
            <TextInput
              value={form.instagram ?? ""}
              onChange={(e) => update("instagram", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email">
          <TextInput
            type="email"
            value={form.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Ciudad">
            <TextInput value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="Provincia">
            <TextInput
              value={form.province ?? ""}
              onChange={(e) => update("province", e.target.value)}
            />
          </Field>
          <Field label="País">
            <TextInput
              value={form.country ?? ""}
              onChange={(e) => update("country", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Profesión">
            <TextInput
              value={form.profession ?? ""}
              onChange={(e) => update("profession", e.target.value)}
            />
          </Field>
          <Field label="Especialidad">
            <TextInput
              value={form.specialty ?? ""}
              onChange={(e) => update("specialty", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cómo nos conoció">
            <Select
              value={form.source ?? ""}
              onChange={(e) => update("source", (e.target.value || null) as never)}
            >
              <option value="">—</option>
              {Object.entries(STUDENT_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => update("status", e.target.value as never)}>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notas">
          <TextArea rows={3} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
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
