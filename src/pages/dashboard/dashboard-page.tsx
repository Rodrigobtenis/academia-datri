import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { GoalProgressCard } from "../../components/goal-progress-card";
import { getPendingTotal } from "../../lib/api/management";
import { listEditionsInRange } from "../../lib/api/courses";
import { formatMoney } from "../../lib/money";
import { formatDateAR, nowInArgentina } from "../../lib/date-ar";
import { IconCap, IconWallet } from "../../components/icons";

function todayISO(): string {
  const { day, month, year } = nowInArgentina();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inDaysISO(days: number): string {
  const { day, month, year } = nowInArgentina();
  const d = new Date(year, month - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["dashboard-upcoming-editions"],
    queryFn: () => listEditionsInRange(todayISO(), inDaysISO(14)),
  });

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ["dashboard-pending-total"],
    queryFn: getPendingTotal,
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Hola, {profile?.full_name ?? "👋"}</h1>
        <p className="text-sm text-gray-500">Un vistazo rápido a lo que se viene y lo que falta cobrar.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GoalProgressCard />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => navigate("/agenda")}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <IconCap className="w-4 h-4 text-brand-500" />
              Cursos próximos (14 días)
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loadingUpcoming ? "—" : upcoming?.length ?? 0}
            </div>
            {!loadingUpcoming && (upcoming?.length ?? 0) > 0 && (
              <ul className="mt-2 space-y-0.5">
                {upcoming!.slice(0, 3).map((e) => (
                  <li key={e.id} className="text-xs text-gray-500 truncate">
                    {e.course_types?.name ?? "Curso"} — {formatDateAR(e.start_date)}
                  </li>
                ))}
              </ul>
            )}
            {!loadingUpcoming && (upcoming?.length ?? 0) === 0 && (
              <p className="mt-2 text-xs text-gray-400">Nada arrancando en las próximas dos semanas.</p>
            )}
          </button>

          <button
            onClick={() => navigate("/reportes")}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <IconWallet className="w-4 h-4 text-brand-500" />
              Pagos pendientes
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loadingPending ? "—" : formatMoney(pending ?? 0)}
            </div>
            <p className="mt-2 text-xs text-gray-400">Saldo total sin cobrar de alumnas activas.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
