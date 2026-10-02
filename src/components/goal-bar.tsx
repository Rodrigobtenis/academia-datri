import { useEffect, useState } from "react";
import { goalState, GOAL_STATE_COLORS } from "../types/goal";

const AVATAR_SRC = "/objetivo-avatar.jpg";

// Barra de progreso de un objetivo: se llena animada al cargar, tiene una línea fina con
// el ritmo esperado a hoy (si se pasó de la línea, va adelantada) y la cara de la
// responsable "viajando" en la punta del progreso.
export function GoalBar({
  percent,
  expectedPercent,
  size = "md",
}: {
  percent: number;
  expectedPercent?: number;
  size?: "sm" | "md";
}) {
  const target = Math.min(100, Math.max(0, percent));
  const state = goalState(percent);
  const [shown, setShown] = useState(0);

  // Arranca en 0 y salta al valor real en el frame siguiente para que la transición CSS
  // haga la animación de llenado.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const avatar = size === "sm" ? 22 : 34;
  const barHeight = size === "sm" ? "h-2" : "h-3";
  const done = state === "cumplido";
  // La cara no se sale de la barra: se frena a medio avatar de cada borde.
  const left = `clamp(${avatar / 2}px, ${shown}%, calc(100% - ${avatar / 2}px))`;

  return (
    <div className="relative" style={{ paddingTop: avatar / 2 - 2, paddingBottom: avatar / 2 - 2 }}>
      <div className={`relative ${barHeight} rounded-full bg-gray-100 overflow-hidden`}>
        <div
          className={`relative h-full rounded-full ${GOAL_STATE_COLORS[state]} overflow-hidden`}
          style={{ width: `${shown}%`, transition: "width 1400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <span className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-goal-shine" />
        </div>
        {expectedPercent !== undefined && expectedPercent > 0 && expectedPercent < 100 && (
          <span
            className="absolute inset-y-0 w-0.5 bg-gray-900/40"
            style={{ left: `${expectedPercent}%` }}
            title="Dónde deberías ir a hoy"
          />
        )}
      </div>

      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ left, width: avatar, height: avatar, transition: "left 1400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="animate-goal-float relative h-full w-full">
          {done && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-goal-ping" />}
          <img
            src={AVATAR_SRC}
            alt=""
            width={avatar}
            height={avatar}
            className="relative rounded-full object-cover border-2 border-white shadow-md"
            style={{ width: avatar, height: avatar }}
          />
        </div>
      </div>
    </div>
  );
}
