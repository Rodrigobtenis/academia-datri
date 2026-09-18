import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProfessionals } from "../../lib/api/professionals";
import { listServices } from "../../lib/api/services";
import { createAppointment, listAppointmentsForDate, listAppointmentsInRange } from "../../lib/api/appointments";
import { createAppointmentPayment } from "../../lib/api/appointment-payments";
import { createBlock, deleteBlock, listBlocksForDate } from "../../lib/api/blocks";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { TextInput } from "../../components/ui/field";
import { formatDateAR } from "../../lib/date-ar";
import { AppointmentForm, type AppointmentSena } from "./appointment-form";
import { AppointmentDetail } from "./appointment-detail";
import { BlockForm } from "./block-form";
import { MONTHS } from "../../lib/months";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentInput,
  type AppointmentWithDetails,
  type ProfessionalBlock,
  type ProfessionalBlockInput,
} from "../../types/appointment";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;
const ROW_HEIGHT = 28; // px por bloque de 30 min
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Franja de color a la izquierda del bloque según el estado del turno — el bloque en sí
// queda celeste claro para todos, como en la referencia (AgendaPro).
const STATUS_BORDER: Record<string, string> = {
  gray: "border-l-gray-400",
  blue: "border-l-blue-500",
  green: "border-l-emerald-500",
  red: "border-l-red-400",
  amber: "border-l-amber-500",
};

function timeToOffset(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return ((h - DAY_START_HOUR) * 60 + m) / 30;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarView() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<"mes" | "grid" | "list">("mes");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  const [booking, setBooking] = useState<{ professionalId?: string; startTime?: string } | null>(null);
  const [blocking, setBlocking] = useState<{ professionalId?: string; startTime?: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<ProfessionalBlock | null>(null);

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

  const { data: blocks } = useQuery({
    queryKey: ["blocks", date],
    queryFn: () => listBlocksForDate(date),
  });

  const monthStart = `${monthCursor.year}-${String(monthCursor.month).padStart(2, "0")}-01`;
  const monthEnd = new Date(monthCursor.year, monthCursor.month, 1).toISOString().slice(0, 10);

  const { data: monthAppointments } = useQuery({
    queryKey: ["appointments-month", monthCursor.year, monthCursor.month],
    queryFn: () => listAppointmentsInRange(monthStart, monthEnd),
    enabled: view === "mes",
  });

  const activeProfessionals = (professionals ?? []).filter((p) => p.active);
  const activeServices = (services ?? []).filter((s) => s.active);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["appointments", date] });
    queryClient.invalidateQueries({ queryKey: ["blocks", date] });
    queryClient.invalidateQueries({ queryKey: ["appointments-month"] });
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

  const blockMutation = useMutation({
    mutationFn: (input: ProfessionalBlockInput) => createBlock(input),
    onSuccess: () => {
      invalidate();
      setBlocking(null);
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => deleteBlock(id),
    onSuccess: () => {
      invalidate();
      setDeletingBlock(null);
    },
  });

  function changeDay(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  function changeMonth(delta: number) {
    const d = new Date(monthCursor.year, monthCursor.month - 1 + delta, 1);
    setMonthCursor({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  function goToToday() {
    const today = todayISO();
    setDate(today);
    const d = new Date();
    setMonthCursor({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  function openDay(day: number) {
    const iso = `${monthCursor.year}-${String(monthCursor.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setDate(iso);
    setView("grid");
  }

  const appointmentCountByDay = (monthAppointments ?? []).reduce<Record<number, number>>((acc, a) => {
    if (a.status === "cancelado") return acc;
    const day = Number(a.appointment_date.slice(8, 10));
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});

  const monthCells = buildMonthGrid(monthCursor.year, monthCursor.month);
  const todayDayNumber =
    todayISO().slice(0, 7) === `${monthCursor.year}-${String(monthCursor.month).padStart(2, "0")}`
      ? Number(todayISO().slice(8, 10))
      : null;

  function appointmentsFor(professionalId: string) {
    return (appointments ?? []).filter((a) => a.professional_id === professionalId && a.status !== "cancelado");
  }

  function blocksFor(professionalId: string) {
    return (blocks ?? []).filter((b) => b.professional_id === professionalId);
  }

  function professionalName(id: string) {
    const p = activeProfessionals.find((pr) => pr.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  }

  const sortedDayItems = [
    ...(appointments ?? [])
      .filter((a) => a.status !== "cancelado")
      .map((a) => ({ kind: "appointment" as const, time: a.start_time, data: a })),
    ...(blocks ?? []).map((b) => ({ kind: "block" as const, time: b.start_time, data: b })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {view === "mes" ? (
          <>
            <Button variant="secondary" onClick={() => changeMonth(-1)}>
              ←
            </Button>
            <Button variant="secondary" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="secondary" onClick={() => changeMonth(1)}>
              →
            </Button>
            <span className="text-sm font-medium text-gray-800">
              {MONTHS[monthCursor.month - 1]} {monthCursor.year}
            </span>
          </>
        ) : (
          <>
            <button
              onClick={() => setView("mes")}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← Mes
            </button>
            <Button variant="secondary" onClick={() => changeDay(-1)}>
              ←
            </Button>
            <Button variant="secondary" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="secondary" onClick={() => changeDay(1)}>
              →
            </Button>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
            <span className="text-sm font-medium text-gray-800 hidden sm:inline">{formatDateAR(date)}</span>
          </>
        )}

        <div className="flex rounded-md border border-gray-300 overflow-hidden ml-2">
          <button
            onClick={() => setView("mes")}
            className={`px-3 py-1.5 text-xs font-medium ${view === "mes" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Mes
          </button>
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 ${view === "grid" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Grilla
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 ${view === "list" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Lista
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setBlocking({})}>
            Bloquear horario
          </Button>
          <Button onClick={() => setBooking({})}>+ Nuevo turno</Button>
        </div>
      </div>

      {view === "mes" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 text-xs text-gray-400 uppercase">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day, i) => (
              <button
                key={i}
                disabled={!day}
                onClick={() => day && openDay(day)}
                className={`min-h-20 border-t border-l border-gray-100 p-2 text-left first:border-l-0 hover:bg-brand-50 transition-colors disabled:hover:bg-transparent disabled:cursor-default ${
                  day === todayDayNumber ? "bg-brand-50/60" : ""
                }`}
              >
                {day && (
                  <>
                    <div className={`text-xs ${day === todayDayNumber ? "font-semibold text-brand-700" : "text-gray-500"}`}>
                      {day}
                    </div>
                    {appointmentCountByDay[day] > 0 && (
                      <div className="mt-1 inline-block text-[11px] rounded-full bg-brand-100 text-brand-700 px-2 py-0.5">
                        {appointmentCountByDay[day]} turno{appointmentCountByDay[day] === 1 ? "" : "s"}
                      </div>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : activeProfessionals.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no hay profesionales activos — agregá uno en la pestaña "Profesionales".
        </p>
      ) : activeServices.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no hay servicios cargados — agregá uno en la pestaña "Servicios".
        </p>
      ) : view === "grid" ? (
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
                  <div className="border-b border-gray-100 flex flex-col items-center justify-center gap-1 py-2 px-1 text-center">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {p.first_name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate max-w-full">
                      {p.first_name} {p.last_name}
                    </span>
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
                    {blocksFor(p.id).map((b) => {
                      const top = timeToOffset(b.start_time) * ROW_HEIGHT;
                      const height = Math.max(ROW_HEIGHT, (timeToOffset(b.end_time) - timeToOffset(b.start_time)) * ROW_HEIGHT);
                      return (
                        <button
                          key={b.id}
                          onClick={() => setDeletingBlock(b)}
                          className="absolute inset-x-0.5 rounded-md px-2 py-1 text-left text-[11px] text-gray-500 bg-gray-200 overflow-hidden"
                          style={{ top, height }}
                          title="Click para eliminar el bloqueo"
                        >
                          <div className="font-medium truncate">{b.reason || "Profesional no disponible"}</div>
                          <div className="truncate opacity-80">
                            {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                          </div>
                        </button>
                      );
                    })}
                    {appointmentsFor(p.id).map((a: AppointmentWithDetails) => {
                      const top = timeToOffset(a.start_time) * ROW_HEIGHT;
                      const height = Math.max(ROW_HEIGHT, (timeToOffset(a.end_time) - timeToOffset(a.start_time)) * ROW_HEIGHT);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAppointmentId(a.id)}
                          className={`absolute inset-x-0.5 rounded-md pl-2 pr-1.5 py-1 text-left text-[11px] text-gray-800 bg-sky-100 border-l-4 overflow-hidden ${
                            STATUS_BORDER[APPOINTMENT_STATUS_COLORS[a.status]]
                          }`}
                          style={{ top, height }}
                        >
                          <div className="font-semibold truncate">
                            {a.students?.last_name}, {a.students?.first_name}
                          </div>
                          <div className="truncate text-gray-600">{a.services?.name}</div>
                          <div className="truncate text-gray-500">
                            {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Hora</th>
                  <th className="text-left px-4 py-3 font-medium">Profesional</th>
                  <th className="text-left px-4 py-3 font-medium">Clienta / Motivo</th>
                  <th className="text-left px-4 py-3 font-medium">Servicio</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDayItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Sin turnos ni bloqueos para este día.
                    </td>
                  </tr>
                )}
                {sortedDayItems.map((item) =>
                  item.kind === "appointment" ? (
                    <tr
                      key={item.data.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedAppointmentId(item.data.id)}
                    >
                      <td className="px-4 py-2">
                        {item.data.start_time.slice(0, 5)}–{item.data.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2">{professionalName(item.data.professional_id)}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {item.data.students?.last_name}, {item.data.students?.first_name}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{item.data.services?.name}</td>
                      <td className="px-4 py-2">
                        <Badge color={APPOINTMENT_STATUS_COLORS[item.data.status]}>
                          {APPOINTMENT_STATUS_LABELS[item.data.status]}
                        </Badge>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={item.data.id}
                      className="hover:bg-gray-50 cursor-pointer text-gray-400"
                      onClick={() => setDeletingBlock(item.data)}
                    >
                      <td className="px-4 py-2">
                        {item.data.start_time.slice(0, 5)}–{item.data.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2">{professionalName(item.data.professional_id)}</td>
                      <td className="px-4 py-2 italic" colSpan={2}>
                        {item.data.reason || "No disponible"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge color="gray">Bloqueado</Badge>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
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

      {blocking && (
        <BlockForm
          open
          onClose={() => setBlocking(null)}
          onSubmit={(values) => blockMutation.mutate(values)}
          saving={blockMutation.isPending}
          date={date}
          professionals={activeProfessionals}
          defaultProfessionalId={blocking.professionalId}
          defaultStartTime={blocking.startTime}
        />
      )}

      {selectedAppointmentId && (
        <AppointmentDetail appointmentId={selectedAppointmentId} onClose={() => setSelectedAppointmentId(null)} />
      )}

      {deletingBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Eliminar bloqueo</h3>
            <p className="text-sm text-gray-500 mb-4">
              {professionalName(deletingBlock.professional_id)} · {deletingBlock.start_time.slice(0, 5)}–
              {deletingBlock.end_time.slice(0, 5)}
              {deletingBlock.reason ? ` · ${deletingBlock.reason}` : ""}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingBlock(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={deleteBlockMutation.isPending}
                onClick={() => deleteBlockMutation.mutate(deletingBlock.id)}
              >
                {deleteBlockMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
