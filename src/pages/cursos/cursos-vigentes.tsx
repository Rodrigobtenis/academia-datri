import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listOpenEditions } from "../../lib/api/courses";
import { Badge } from "../../components/ui/badge";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { EDITION_MODALITY_COLORS, EDITION_MODALITY_LABELS } from "../../types/course";

export default function CursosVigentes() {
  const navigate = useNavigate();

  const { data: editions, isLoading } = useQuery({
    queryKey: ["editions-open"],
    queryFn: listOpenEditions,
  });

  return (
    <div className="p-8">
      <button onClick={() => navigate("/cursos")} className="text-sm text-gray-400 hover:text-gray-600 mb-4">
        ← Presencial / Online
      </button>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Cursos vigentes</h1>
        <p className="text-sm text-gray-500">Todas las ediciones abiertas para inscripción ahora mismo.</p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {!isLoading && editions?.length === 0 && (
        <p className="text-sm text-gray-400">No hay ninguna edición abierta en este momento.</p>
      )}

      <div className="space-y-3">
        {editions?.map((ed) => (
          <div
            key={ed.id}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-brand-300 transition cursor-pointer"
            onClick={() => navigate(`/cursos/${ed.course_type_id}/${ed.id}`)}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{ed.course_types?.name ?? "—"}</span>
                <Badge color={EDITION_MODALITY_COLORS[ed.modality]}>{EDITION_MODALITY_LABELS[ed.modality]}</Badge>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {ed.name || (ed.modality === "online" ? "Edición online" : `Edición del ${formatDateAR(ed.start_date)}`)}
                {ed.modality !== "online" ? ` · ${formatDateAR(ed.start_date)}` : ""}
                {ed.location ? ` · ${ed.location}` : ""}
                {" · "}
                {formatMoney(ed.list_price)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
