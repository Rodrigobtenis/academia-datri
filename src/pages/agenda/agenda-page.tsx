import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listEditionsInRange } from "../../lib/api/courses";
import { formatDateAR } from "../../lib/date-ar";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EDITION_STATUS_COLORS, EDITION_STATUS_LABELS } from "../../types/course";
import { MONTHS } from "../../lib/months";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

export default function AgendaPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState<"mes" | "lista">("mes");
  const navigate = useNavigate();

  const rangeStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const rangeEnd = new Date(year, month, 1).toISOString().slice(0, 10);

  const { data: editions } = useQuery({
    queryKey: ["agenda", month, year],
    queryFn: () => listEditionsInRange(rangeStart, rangeEnd),
  });

  const byDay = useMemo(() => {
    const map: Record<number, typeof editions> = {};
    for (const ed of editions ?? []) {
      const day = Number(ed.start_date.slice(8, 10));
      if (!map[day]) map[day] = [];
      map[day]!.push(ed);
    }
    return map;
  }, [editions]);

  function changeMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  }

  const cells = buildMonthGrid(year, month);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500">Cursos programados por fecha.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setView(view === "mes" ? "lista" : "mes")}>
            Ver {view === "mes" ? "lista" : "mes"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button variant="secondary" onClick={() => changeMonth(-1)}>
          ←
        </Button>
        <span className="text-sm font-medium text-gray-800 w-40 text-center">
          {MONTHS[month - 1]} {year}
        </span>
        <Button variant="secondary" onClick={() => changeMonth(1)}>
          →
        </Button>
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
            {cells.map((day, i) => (
              <div key={i} className="min-h-24 border-t border-l border-gray-100 p-1 first:border-l-0">
                {day && (
                  <>
                    <div className="text-xs text-gray-400 px-1">{day}</div>
                    <div className="space-y-1 mt-1">
                      {(byDay[day] ?? []).map((ed) => (
                        <button
                          key={ed.id}
                          onClick={() => navigate(`/cursos/${ed.course_type_id}/${ed.id}`)}
                          className={`w-full text-left text-xs rounded px-1.5 py-1 text-white ${
                            { gray: "bg-gray-400", green: "bg-emerald-500", blue: "bg-blue-500", amber: "bg-amber-500", red: "bg-red-500" }[
                              EDITION_STATUS_COLORS[ed.status]
                            ]
                          }`}
                          title={ed.course_types?.name}
                        >
                          {ed.course_types?.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Modalidad</th>
                <th className="text-left px-4 py-3 font-medium">Sede</th>
                <th className="text-left px-4 py-3 font-medium">Cupos</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editions?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Sin cursos programados este mes.
                  </td>
                </tr>
              )}
              {editions?.map((ed) => (
                <tr
                  key={ed.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/cursos/${ed.course_type_id}/${ed.id}`)}
                >
                  <td className="px-4 py-2">{formatDateAR(ed.start_date)}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{ed.course_types?.name}</td>
                  <td className="px-4 py-2 text-gray-600">{ed.location || "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{ed.max_students}</td>
                  <td className="px-4 py-2">
                    <Badge color={EDITION_STATUS_COLORS[ed.status]}>{EDITION_STATUS_LABELS[ed.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
