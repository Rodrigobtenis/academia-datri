import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { listCourseTypes } from "../../lib/api/courses";
import type { ModelInput, ModelWithServices } from "../../types/model";

export function ModelForm({
  open,
  onClose,
  onSubmit,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ModelInput, courseTypeIds: string[], photo: File | null) => void;
  initial?: ModelWithServices | null;
  saving?: boolean;
}) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [age, setAge] = useState(initial?.age ? String(initial.age) : "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [selectedServices, setSelectedServices] = useState<string[]>(initial?.course_type_ids ?? []);
  const [photo, setPhoto] = useState<File | null>(null);

  const { data: courseTypes } = useQuery({ queryKey: ["course-types"], queryFn: listCourseTypes });

  function toggleService(id: string) {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(
      {
        first_name: firstName,
        last_name: lastName,
        age: age ? Number(age) : null,
        phone: phone || null,
        notes: notes || null,
      },
      selectedServices,
      photo
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Editar modelo" : "Nueva modelo"} wide>
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
          <Field label="Edad">
            <TextInput type="number" min={0} max={119} value={age} onChange={(e) => setAge(e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>

        <Field label="Qué servicio quiere hacerse (podés elegir más de uno)">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-gray-200 rounded-lg p-3">
            {courseTypes?.map((ct) => (
              <label key={ct.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(ct.id)}
                  onChange={() => toggleService(ct.id)}
                />
                {ct.name}
              </label>
            ))}
          </div>
        </Field>

        <Field label={initial?.photo_url ? "Reemplazar fotografía" : "Fotografía"}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>

        <Field label="Notas">
          <TextArea rows={2} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
