import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { listCourseTypes } from "../../lib/api/courses";
import { STUDENT_SOURCE_LABELS } from "../../types/student";
import { LEAD_STATUS_LABELS, type Lead, type LeadInput } from "../../types/lead";
import { useAuth } from "../../lib/auth-context";

function emptyForm(responsibleId: string | null): LeadInput {
  return {
    name: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    course_type_id: null,
    status: "nueva_consulta",
    source: null,
    contact_date: new Date().toISOString().slice(0, 10),
    next_followup: "",
    sales_responsible: responsibleId,
    notes: "",
  };
}

export function LeadForm({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: LeadInput) => void;
  initial?: Lead | null;
  saving?: boolean;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState<LeadInput>(() => ({
    ...emptyForm(profile?.id ?? null),
    ...initial,
  }));

  const { data: courseTypes } = useQuery({ queryKey: ["course-types"], queryFn: listCourseTypes });

  function update<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      instagram: form.instagram || null,
      next_followup: form.next_followup || null,
      notes: form.notes || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Editar consulta" : "Nueva consulta"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre *">
          <TextInput required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Teléfono">
            <TextInput value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <TextInput value={form.whatsapp ?? ""} onChange={(e) => update("whatsapp", e.target.value)} />
          </Field>
          <Field label="Instagram">
            <TextInput value={form.instagram ?? ""} onChange={(e) => update("instagram", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Curso de interés">
            <Select
              value={form.course_type_id ?? ""}
              onChange={(e) => update("course_type_id", e.target.value || null)}
            >
              <option value="">—</option>
              {courseTypes?.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Fecha de consulta">
            <TextInput
              type="date"
              value={form.contact_date}
              onChange={(e) => update("contact_date", e.target.value)}
            />
          </Field>
          <Field label="Próximo seguimiento">
            <TextInput
              type="date"
              value={form.next_followup ?? ""}
              onChange={(e) => update("next_followup", e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => update("status", e.target.value as never)}>
              {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
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
