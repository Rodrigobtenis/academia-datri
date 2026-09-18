import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProfessionals } from "../../lib/api/professionals";
import { listServices } from "../../lib/api/services";
import { createAppointment, listAppointmentsForDate } from "../../lib/api/appointments";
import { createAppointmentPayment } from "../../lib/api/appointment-payments";
import { Button } from "../../components/ui/button";
import { formatDateAR } from "../../lib/date-ar";
import { AppointmentForm, type AppointmentSena } from "./appointment-form";
import { AppointmentDetail } from "./appointment-detail";
import { APPOINTMENT_STATUS_COLORS, type AppointmentInput, type AppointmentWithDetails } from "../../types/appointment";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;
const ROW_HEIGHT = 28; // px por bloque de 30 min
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2;

const STATUS_BG: Record<string, string> = {
  gray: "bg-gray-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-red-400",
  amber: "bg-amber-500",
};

function timeToOffset(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return ((h - DAY_START_HOUR) * 60 + m) / 30;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarView() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [booking, setBooking] = useState<{ professionalId?: string; startTime?: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: listServices,
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments", date],
    queryFn: () => listAppointmentsForDate(date),
  });

  const activeProfessionals = (professionals ?? []).filter((p) => p.active);
  const activeServices = (services ?? []).filter((s) => s.active);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["appointments", date] });
  }

  const createMutation = useMutation({
    mutationFn: async ({ values, sena }: { values: AppointmentInput; sena: AppointmentSena | null }) => {
      const created = await createAppointment(values);
      if (sena) {
        await createAppointmentPayment({
          appointment_id: created.id,
          payment_date: date,
          amount: sena.amount,
          payment_type: "sena",
          payment_method: sena.method,
          reference: null,
          notes: null,
        });
      }
      return created;
    },
    onSuccess: () => {
      invalidate();
      setBooking(null);
    },
  });

  function changeDay(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  function appointmentsFor(professionalId: string) {
    return (appointments ?? []).filter((a) => a.professional_id === professionalId && a.status !== "cancelado");
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="secondary" onClick={() => changeDay(-1)}>
          ←
        </Button>
        <Button variant="secondary" onClick={() => setDate(todayISO())}>
          Hoy
        </Button>
        <Button variant="secondary" onClick={() => changeDay(1)}>
          →
        </Button>
        <span className="text-sm font-medium text-gray-800">{formatDateAR(date)}</span>
        <div className="ml-auto">
          <Button onClick={() => setBooking({})}>+ Nuevo turno</Button>
        </div>
      </div>

      {activeProfessionals.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no hay profesionales activos — agregá uno en la pestaña "Profesionales".
        </p>
      ) : activeServices.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no hay servicios cargados — agregá uno en la pestaña "Servicios".
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <div className="flex min-w-[600px]">
            <div className="w-14 shrink-0">
              <div className="h-9 border-b border-gray-100" />
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i).map((h) => (
                <div key={h} className="text-[10px] text-gray-400 text-right pr-1" style={{ height: ROW_HEIGHT * 2 }}>
                  {h}:00
                </div>
              ))}
            </div>
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${activeProfessionals.length}, 1fr)` }}>
              {activeProfessionals.map((p) => (
                <div key={p.id} className="border-l border-gray-100">
                  <div className="h-9 border-b border-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 px-1 text-center">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="relative" style={{ height: TOTAL_SLOTS * ROW_HEIGHT }}>
                    {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
                      const h = DAY_START_HOUR + Math.floor(slot / 2);
                      const m = slot % 2 === 0 ? "00" : "30";
                      return (
                        <button
                          key={slot}
                          onClick={() => setBooking({ professionalId: p.id, startTime: `${String(h).padStart(2, "0")}:${m}` })}
                          className="absolute inset-x-0 border-t border-gray-50 hover:bg-brand-50 transition-colors"
                          style={{ top: slot * ROW_HEIGHT, height: ROW_HEIGHT }}
                        />
                      );
                    })}
                    {appointmentsFor(p.id).map((a: AppointmentWithDetails) => {
                      const top = timeToOffset(a.start_time) * ROW_HEIGHT;
                      const height = Math.max(ROW_HEIGHT, (timeToOffset(a.end_time) - timeToOffset(a.start_time)) * ROW_HEIGHT);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAppointmentId(a.id)}
                          className={`absolute inset-x-0.5 rounded-md px-1.5 py-0.5 text-left text-[11px] text-white overflow-hidden ${
                            STATUS_BG[APPOINTMENT_STATUS_COLORS[a.status]]
                          }`}
                          style={{ top, height }}
                        >
                          <div className="font-medium truncate">
                            {a.students?.last_name}, {a.students?.first_name}
                          </div>
                          <div className="truncate opacity-90">{a.services?.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {booking && (
        <AppointmentForm
          open
          onClose={() => setBooking(null)}
          onSubmit={(values, sena) => createMutation.mutate({ values, sena })}
          saving={createMutation.isPending}
          date={date}
          professionals={activeProfessionals}
          services={activeServices}
          defaultProfessionalId={booking.professionalId}
          defaultStartTime={booking.startTime}
        />
      )}

      {selectedAppointmentId && (
        <AppointmentDetail appointmentId={selectedAppointmentId} onClose={() => setSelectedAppointmentId(null)} />
      )}
    </div>
  );
}
