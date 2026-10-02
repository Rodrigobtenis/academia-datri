import { useQuery } from "@tanstack/react-query";
import { getGoalProgress } from "../lib/api/goals";
import { formatMoney } from "../lib/money";
import { nowInArgentina } from "../lib/date-ar";
import { goalState, GOAL_STATE_COLORS, GOAL_STATE_LABELS } from "../types/goal";
import { GoalBar } from "./goal-bar";

export function GoalProgressCard({ compact }: { compact?: boolean }) {
  const { day, month, year, daysInMonth } = nowInArgentina();

  const { data: progress, isLoading } = useQuery({
    queryKey: ["goal-progress", month, year],
    queryFn: () => getGoalProgress(month, year),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
        Cargando objetivo...
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
        Todavía no se definió un objetivo para este mes.
      </div>
    );
  }

  const target = parseFloat(progress.target_amount);
  const collected = parseFloat(progress.collected);
  const remaining = target - collected;
  const percent = progress.percent_complete ?? 0;
  const state = goalState(percent);

  const daysRemaining = Math.max(0, daysInMonth - day);
  const dailyPaceNeeded = remaining > 0 && daysRemaining > 0 ? remaining / daysRemaining : 0;

  const expectedPercent = (day / daysInMonth) * 100;
  const paceDiff = percent - expectedPercent;

  const dailyAverageSoFar = day > 0 ? collected / day : 0;
  const projection = dailyAverageSoFar * daysInMonth;
  const projectionPercent = target > 0 ? (projection / target) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase">
          Objetivo {new Date(year, month - 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${GOAL_STATE_COLORS[state]}`}>
          {GOAL_STATE_LABELS[state]}
        </span>
      </div>

      <div className="mb-1">
        <GoalBar percent={percent} expectedPercent={expectedPercent} />
      </div>
      <p className={`text-xs mb-2 ${state === "cumplido" || paceDiff >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
        {state === "cumplido"
          ? "¡Objetivo cumplido!"
          : paceDiff >= 0
            ? "Vas adelantada al ritmo del mes — la línea gris marca dónde deberías estar hoy."
            : `Estás ${Math.abs(paceDiff).toFixed(0)} puntos por debajo de donde deberías ir hoy (línea gris).`}
      </p>

      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-gray-900">{percent.toFixed(0)}%</span>
        <span className="text-sm text-gray-500">
          {formatMoney(collected)} de {formatMoney(target)}
        </span>
      </div>

      {remaining > 0 ? (
        <p className="text-sm text-gray-500 mt-1">Faltan {formatMoney(remaining)}</p>
      ) : (
        <p className="text-sm text-emerald-600 mt-1">Objetivo superado por {formatMoney(-remaining)}</p>
      )}

      {!compact && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-400">Ritmo necesario</div>
            <div className="text-gray-800">
              {dailyPaceNeeded > 0 ? `${formatMoney(dailyPaceNeeded)}/día` : "Ya alcanzado"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Vs. ritmo esperado a hoy</div>
            <div className={paceDiff >= 0 ? "text-emerald-600" : "text-red-500"}>
              {paceDiff >= 0 ? "+" : ""}
              {paceDiff.toFixed(0)} puntos
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-gray-400">Proyección de cierre (estimación matemática)</div>
            <div className="text-gray-800">
              {formatMoney(projection)} ({projectionPercent.toFixed(0)}% del objetivo)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
