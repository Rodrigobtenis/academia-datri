import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { StudentPicker } from "../../components/student-picker";
import { listProfessionalAppointmentsForDate } from "../../lib/api/appointments";
import { listProfessionalBlocksForDate } from "../../lib/api/blocks";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../types/payment";
import type { AppointmentInput } from "../../types/appointment";
import type { Professional } from "../../types/professional";
import type { Service } from "../../types/service";
import type { Student } from "../../types/student";

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

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
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? professionals[0]?.id ?? "");
  const [startTime, setStartTime] = useState(defaultStartTime ?? "09:00");
  const [price, setPrice] = useState(services[0]?.price ?? "0");
  const [notes, setNotes] = useState("");
  const [addSena, setAddSena] = useState(false);
  const [senaAmount, setSenaAmount] = useState("");
  const [senaMethod, setSenaMethod] = useState<PaymentMethod>("efectivo");

  const [conflicts, setConflicts] = useState<{ label: string } [] | null>(null);
  const [checking, setChecking] = useState(false);

  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const serviceBoxRef = useRef<HTMLDivElement>(null);

  const service = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceDropdownOpen) setServiceQuery(service ? service.name : "");
  }, [service, serviceDropdownOpen]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (serviceBoxRef.current && !serviceBoxRef.current.contains(e.target as Node)) {
        setServiceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const endTime = useMemo(
    () => (service ? addMinutes(startTime, service.duration_minutes) : startTime),
    [startTime, service]
  );

  const matchingServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    const filtered = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
    const groups = new Map<string, Service[]>();
    for (const s of filtered) {
      const key = s.category || "Sin categoría";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services, serviceQuery]);

  function reset() {
    setStudent(null);
    setServiceId(services[0]?.id ?? "");
    setServiceQuery(services[0]?.name ?? "");
    setServiceDropdownOpen(false);
    setProfessionalId(defaultProfessionalId ?? professionals[0]?.id ?? "");
    setStartTime(defaultStartTime ?? "09:00");
    setPrice(services[0]?.price ?? "0");
    setNotes("");
    setAddSena(false);
    setSenaAmount("");
    setSenaMethod("efectivo");
    setConflicts(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    const s = services.find((sv) => sv.id === id);
    if (s) {
      setPrice(s.price);
      setServiceQuery(s.name);
    }
    setServiceDropdownOpen(false);
    setConflicts(null);
  }

  async function checkConflicts(): Promise<boolean> {
    setChecking(true);
    try {
      const [existing, blocks] = await Promise.all([
        listProfessionalAppointmentsForDate(professionalId, date),
        listProfessionalBlocksForDate(professionalId, date),
      ]);
      // Normalizamos a "HH:MM": la base devuelve "HH:MM:SS" y comparar strings de distinta
      // longitud como "10:00" vs "10:00:00" da un falso "mayor que" aunque sea la misma hora.
      const overlapsRange = (start: string, end: string) => start.slice(0, 5) < endTime && end.slice(0, 5) > startTime;
      const overlappingAppointments = existing.filter((a) => overlapsRange(a.start_time, a.end_time));
      const overlappingBlocks = blocks.filter((b) => overlapsRange(b.start_time, b.end_time));

      if (overlappingAppointments.length > 0 || overlappingBlocks.length > 0) {
        setConflicts([
          ...overlappingAppointments.map((a) => ({
            label: `${a.students?.last_name ?? "—"}, ${a.students?.first_name ?? ""} (${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)})`,
          })),
          ...overlappingBlocks.map((b) => ({
            label: `Horario bloqueado${b.reason ? ` — ${b.reason}` : ""} (${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)})`,
          })),
        ]);
        return false;
      }
      setConflicts(null);
      return true;
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!student || !professionalId || !serviceId) return;

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
    reset();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nuevo turno" wide>
      {!student ? (
        <StudentPicker onSelect={setStudent} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Servicio *">
              <div ref={serviceBoxRef} className="relative">
                <TextInput
                  value={serviceQuery}
                  onChange={(e) => {
                    setServiceQuery(e.target.value);
                    setServiceDropdownOpen(true);
                  }}
                  onFocus={() => setServiceDropdownOpen(true)}
                  placeholder="Buscar servicio..."
                  required
                />
                {serviceDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {matchingServices.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">Sin resultados.</div>
                    )}
                    {matchingServices.map(([category, group]) => (
                      <div key={category}>
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
                          {category}
                        </div>
                        {group.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleServiceChange(s.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{s.duration_minutes} min</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
      )}
    </Dialog>
  );
}
