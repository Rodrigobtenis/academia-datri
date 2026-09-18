import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import type { ProfessionalBlockInput } from "../../types/appointment";
import type { Professional } from "../../types/professional";

function addOneHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function BlockForm({
  open,
  onClose,
  onSubmit,
  saving,
  date,
  professionals,
  defaultProfessionalId,
  defaultStartTime,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProfessionalBlockInput) => void;
  saving?: boolean;
  date: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  defaultStartTime?: string;
}) {
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? professionals[0]?.id ?? "");
  const [startTime, setStartTime] = useState(defaultStartTime ?? "13:00");
  const [endTime, setEndTime] = useState(addOneHour(defaultStartTime ?? "13:00"));
  const [reason, setReason] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      professional_id: professionalId,
      block_date: date,
      start_time: startTime,
      end_time: endTime,
      reason: reason || null,
      created_by: null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Bloquear horario">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Profesional *">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Desde *">
            <TextInput type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Hasta *">
            <TextInput type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Motivo">
          <TextInput placeholder="Almuerzo, día libre..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || endTime <= startTime}>
            {saving ? "Guardando..." : "Bloquear"}
          </Button>
        </div>
        {endTime <= startTime && <p className="text-xs text-red-500">El horario de fin debe ser posterior al de inicio.</p>}
      </form>
    </Dialog>
  );
}
