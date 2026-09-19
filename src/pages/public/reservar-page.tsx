import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Field, TextInput } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { ServicePicker } from "../turnos/service-picker";
import { addMinutes } from "../turnos/schedule-utils";
import { formatMoney } from "../../lib/money";
import {
  listPublicServices,
  listPublicProfessionals,
  getPublicBusySlots,
  createPublicAppointment,
} from "../../lib/api/public-booking";
import type { Service } from "../../types/service";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowMinutesLocal() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function generateSlots(service: Service, busy: { start_time: string; end_time: string }[], date: string) {
  const slots: string[] = [];
  const isToday = date === todayISO();
  const nowMin = nowMinutesLocal();
  for (let t = DAY_START_HOUR * 60; t + service.duration_minutes <= DAY_END_HOUR * 60; t += 30) {
    if (isToday && t <= nowMin) continue;
    const start = addMinutes("00:00", t);
    const end = addMinutes("00:00", t + service.duration_minutes);
    const overlaps = busy.some((b) => start < b.end_time.slice(0, 5) && end > b.start_time.slice(0, 5));
    if (!overlaps) slots.push(start);
  }
  return slots;
}

export default function ReservarPage() {
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const servicesQuery = useQuery({ queryKey: ["public-services"], queryFn: listPublicServices });
  const professionalsQuery = useQuery({ queryKey: ["public-professionals"], queryFn: listPublicProfessionals });

  const service = servicesQuery.data?.find((s) => s.id === serviceId);

  const busyQuery = useQuery({
    queryKey: ["public-busy", professionalId, date],
    queryFn: () => getPublicBusySlots(professionalId, date),
    enabled: Boolean(professionalId && date),
  });

  const slots = useMemo(() => {
    if (!service || !busyQuery.data) return [];
    return generateSlots(service, busyQuery.data, date);
  }, [service, busyQuery.data, date]);

  const bookingMutation = useMutation({
    mutationFn: createPublicAppointment,
    onSuccess: () => setConfirmed(true),
    onError: (error: unknown) => {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
      setFormError(message || "No se pudo reservar. Probá de nuevo.");
      setStartTime("");
      busyQuery.refetch();
    },
  });

  function handleServiceChange(s: Service) {
    setServiceId(s.id);
    setStartTime("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!serviceId) return setFormError("Elegí un servicio.");
    if (!professionalId) return setFormError("Elegí un profesional.");
    if (!startTime) return setFormError("Elegí un horario.");
    if (!firstName.trim()) return setFormError("Falta tu nombre.");
    if (!phone.trim()) return setFormError("Falta tu teléfono.");

    bookingMutation.mutate({
      serviceId,
      professionalId,
      date,
      startTime,
      firstName,
      lastName,
      phone,
      email,
    });
  }

  if (confirmed) {
    const professional = professionalsQuery.data?.find((p) => p.id === professionalId);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-3">
          <div className="text-4xl">✓</div>
          <h1 className="text-lg font-semibold text-gray-900">¡Turno reservado!</h1>
          <p className="text-sm text-gray-600">
            {service?.name} con {professional?.first_name} {professional?.last_name}
            <br />
            {new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            a las {startTime}
          </p>
          <p className="text-xs text-gray-400 pt-2">
            Te vamos a contactar para confirmarlo. La seña, si corresponde, se abona en el local.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">Reservá tu turno</h1>
          <p className="text-xs text-gray-400 mt-1">Estudio Datri</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Servicio *">
            <ServicePicker
              services={servicesQuery.data ?? []}
              selectedId={serviceId}
              onSelect={handleServiceChange}
            />
            {service && <p className="text-xs text-gray-400 mt-1">{formatMoney(service.price)}</p>}
          </Field>

          <Field label="Profesional *">
            <div className="flex flex-wrap gap-2">
              {(professionalsQuery.data ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProfessionalId(p.id);
                    setStartTime("");
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    professionalId === p.id
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p.first_name} {p.last_name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Fecha *">
            <TextInput
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setStartTime("");
              }}
              required
            />
          </Field>

          {service && professionalId && (
            <Field label="Horario *">
              {busyQuery.isLoading ? (
                <p className="text-sm text-gray-400">Buscando horarios...</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-400">No hay horarios libres ese día para este servicio.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStartTime(t)}
                      className={`px-2 py-1.5 rounded-md text-sm border ${
                        startTime === t
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          {startTime && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre *">
                  <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </Field>
                <Field label="Apellido">
                  <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
              <Field label="Teléfono *">
                <TextInput
                  type="tel"
                  placeholder="11 2345 6789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email">
                <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <Button type="submit" className="w-full" disabled={bookingMutation.isPending}>
            {bookingMutation.isPending ? "Reservando..." : "Confirmar reserva"}
          </Button>
        </form>
      </div>
    </div>
  );
}
