import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getAlerts, type AlertSeverity } from "../lib/api/alerts";
import { IconBell } from "./icons";

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  danger: "border-red-100 bg-red-50",
  warning: "border-amber-100 bg-amber-50",
  info: "border-sky-100 bg-sky-50",
};

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export function AlertsPanel() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: getAlerts,
  });

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <IconBell className="w-[18px] h-[18px] text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Alertas internas</h2>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}

      {!isLoading && (alerts?.length ?? 0) === 0 && (
        <p className="text-sm text-gray-400">Todo tranquilo — sin alertas por ahora.</p>
      )}

      {!isLoading && (alerts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {alerts?.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(a.href)}
              className={`w-full flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition hover:brightness-95 ${SEVERITY_STYLE[a.severity]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[a.severity]}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800 truncate">{a.title}</span>
                <span className="block text-xs text-gray-500 truncate">{a.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
