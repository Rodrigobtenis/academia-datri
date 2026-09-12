import { useAuth } from "../../lib/auth-context";

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          Hola, {profile?.full_name ?? "👋"}
        </h1>
        <p className="text-sm text-gray-500">
          Este es el punto de partida del Dashboard — objetivo del mes, cursos próximos, cupos y
          pagos pendientes se agregan en las próximas etapas (Etapa 8 en adelante).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Cursos próximos", "Alumnas este mes", "Cupos disponibles", "Objetivo del mes"].map(
          (label) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400"
            >
              {label}
              <div className="mt-2 text-2xl font-semibold text-gray-300">—</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
