import { useMemo, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { StudentPicker } from "../../components/student-picker";
import { ServicePicker } from "./service-picker";
import { addMinutes, findScheduleConflicts, type ScheduleConflict } from "./schedule-utils";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../types/payment";
import type { AppointmentInput } from "../../types/appointment";
import type { Professional } from "../../types/professional";
import type { Service } from "../../types/service";
import type { Student } from "../../types/student";

export interface AppointmentSena {
  amount: string;
  method: PaymentMethod;
}

export function AppointmentForm({
  open,
  onClose,
  onSubmit,
  saving,
  date,
  professionals,
  services,
  defaultProfessionalId,
  defaultStartTime,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AppointmentInput, sena: AppointmentSena | null) => void;
  saving?: boolean;
  date: string;
  professionals: Professional[];
  services: Service[];
  defaultProfessionalId?: string;
  defaultStartTime?: string;
}) {
  const [student, setStudent] = useState<Student | null>(null);
  // Sin service/profesional preseleccionados a propósito: con 190 servicios cargados,
  // arrancar en "el primero alfabético" invita a agendar el servicio equivocado por
  // descuido — se obliga a elegir uno de forma activa.
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [startTime, setStartTime] = useState(defaultStartTime ?? "09:00");
  const [price, setPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [addSena, setAddSena] = useState(false);
  const [senaAmount, setSenaAmount] = useState("");
  const [senaMethod, setSenaMethod] = useState<PaymentMethod>("efectivo");

  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);

  const endTime = useMemo(
    () => (service ? addMinutes(startTime, service.duration_minutes) : startTime),
    [startTime, service]
  );

  function reset() {
    setStudent(null);
    setServiceId("");
    setProfessionalId(defaultProfessionalId ?? "");
    setStartTime(defaultStartTime ?? "09:00");
    setPrice("0");
    setNotes("");
    setAddSena(false);
    setSenaAmount("");
    setSenaMethod("efectivo");
    setConflicts(null);
    setFormError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleServiceChange(s: Service) {
    setServiceId(s.id);
    setPrice(s.price);
    setConflicts(null);
  }

  async function checkConflicts(): Promise<boolean> {
    setChecking(true);
    try {
      const found = await findScheduleConflicts(professionalId, date, startTime, endTime);
      setConflicts(found.length > 0 ? found : null);
      return found.length === 0;
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!student) {
      setFormError("Falta elegir la clienta.");
      return;
    }
    if (!serviceId) {
      setFormError("Falta elegir un servicio de la lista (no alcanza con escribir el nombre).");
      return;
    }
    if (!professionalId) {
      setFormError("Falta elegir un profesional.");
      return;
    }

    if (!conflicts) {
      const ok = await checkConflicts();
      if (!ok) return; // se pisa: mostramos el aviso y esperamos un segundo click para confirmar
    }

    const sena: AppointmentSena | null =
      addSena && parseFloat(senaAmount) > 0 ? { amount: senaAmount, method: senaMethod } : null;

    onSubmit(
      {
        student_id: student.id,
        professional_id: professionalId,
        service_id: serviceId,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        price,
        status: "reservado",
        notes: notes || null,
        created_by: null,
      },
      sena
    );
    // No se resetea acá: si la mutación en el padre falla, el diálogo sigue abierto y el
    // formulario se vaciaría de golpe sin que se haya guardado nada. El padre se encarga de
    // cerrar (y por lo tanto desmontar/limpiar este formulario) solo cuando sale bien.
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nuevo turno" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Clienta *">
          {!student ? (
            <StudentPicker onSelect={setStudent} personLabel="clienta" />
          ) : (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-gray-800">
                {student.last_name}, {student.first_name}
              </span>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setStudent(null)}
              >
                cambiar
              </button>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
            <Field label="Servicio *">
              <ServicePicker services={services} selectedId={serviceId} onSelect={handleServiceChange} />
            </Field>
            <Field label="Profesional *">
              <Select
                value={professionalId}
                onChange={(e) => {
                  setProfessionalId(e.target.value);
                  setConflicts(null);
                }}
                required
              >
                <option value="" disabled>
                  Elegí un profesional
                </option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Hora de inicio *">
              <TextInput
                type="time"
                required
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setConflicts(null);
                }}
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

          <p className="text-xs text-gray-400">
            Termina a las {endTime.slice(0, 5)} ({service?.duration_minutes ?? 0} min).
          </p>

          <Field label="Notas">
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={addSena} onChange={(e) => setAddSena(e.target.checked)} />
              Cobrar una seña ahora
            </label>
            {addSena && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <Field label="Monto *">
                  <TextInput
                    type="number"
                    step="0.01"
                    min={0}
                    required={addSena}
                    value={senaAmount}
                    onChange={(e) => setSenaAmount(e.target.value)}
                  />
                </Field>
                <Field label="Método">
                  <Select value={senaMethod} onChange={(e) => setSenaMethod(e.target.value as PaymentMethod)}>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          {conflicts && conflicts.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium mb-1">Este horario se pisa con:</p>
              <ul className="list-disc list-inside">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.label}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Podés agendarlo igual si querés.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" variant={conflicts ? "danger" : "primary"} disabled={saving || checking}>
              {checking
                ? "Comprobando horario..."
                : saving
                  ? "Guardando..."
                  : conflicts
                    ? "Agendar de todos modos"
                    : "Agendar"}
            </Button>
          </div>
      </form>
    </Dialog>
  );
}
