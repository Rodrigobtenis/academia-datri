import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  createEdition,
  getCourseType,
  listEditions,
  listOccupancyByType,
} from "../../lib/api/courses";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EditionForm } from "./edition-form";
import { formatMoney } from "../../lib/money";
import { EDITION_STATUS_COLORS, EDITION_STATUS_LABELS, type CourseEdition, type CourseEditionInput } from "../../types/course";
import { useAuth } from "../../lib/auth-context";

export default function ModalidadDetail() {
  const { courseTypeId } = useParams<{ courseTypeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [creating, setCreating] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<CourseEdition | null>(null);

  const { data: courseType } = useQuery({
    queryKey: ["course-type", courseTypeId],
    queryFn: () => getCourseType(courseTypeId!),
    enabled: Boolean(courseTypeId),
  });

  const { data: editions, isLoading } = useQuery({
    queryKey: ["editions", courseTypeId],
    queryFn: () => listEditions(courseTypeId!),
    enabled: Boolean(courseTypeId),
  });

  const { data: occupancy } = useQuery({
    queryKey: ["occupancy", courseTypeId],
    queryFn: () => listOccupancyByType(courseTypeId!),
    enabled: Boolean(courseTypeId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CourseEditionInput) => createEdition(input),
    onSuccess: (edition) => {
      queryClient.invalidateQueries({ queryKey: ["editions", courseTypeId] });
      queryClient.invalidateQueries({ queryKey: ["occupancy", courseTypeId] });
      setCreating(false);
      setDuplicateFrom(null);
      navigate(`/cursos/${courseTypeId}/${edition.id}`);
    },
  });

  return (
    <div className="p-8">
      <button
        onClick={() => navigate("/cursos")}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← Modalidades
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{courseType?.name}</h1>
          {courseType?.description && (
            <p className="text-sm text-gray-500">{courseType.description}</p>
          )}
        </div>
        {isAdmin && <Button onClick={() => setCreating(true)}>+ Nueva edición</Button>}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {!isLoading && editions?.length === 0 && (
        <p className="text-sm text-gray-400">Todavía no hay ediciones para esta modalidad.</p>
      )}

      <div className="space-y-3">
        {editions?.map((ed) => {
          const occ = occupancy?.[ed.id];
          return (
            <div
              key={ed.id}
              className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-brand-300 transition cursor-pointer"
              onClick={() => navigate(`/cursos/${courseTypeId}/${ed.id}`)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {ed.name || `Edición del ${new Date(ed.start_date).toLocaleDateString("es-AR")}`}
                  </span>
                  <Badge color={EDITION_STATUS_COLORS[ed.status]}>
                    {EDITION_STATUS_LABELS[ed.status]}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {new Date(ed.start_date).toLocaleDateString("es-AR")}
                  {ed.location ? ` · ${ed.location}` : ""}
                  {ed.teacher ? ` · ${ed.teacher}` : ""}
                  {" · "}
                  {formatMoney(ed.list_price)}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {occ && (
                  <div className="text-right text-sm">
                    <div className="text-gray-900 font-medium">
                      {occ.enrolled_count}/{occ.max_students}
                    </div>
                    <div className="text-gray-400 text-xs">{occ.occupancy_pct ?? 0}% ocupado</div>
                  </div>
                )}
                {isAdmin && (
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDuplicateFrom(ed);
                    }}
                  >
                    Duplicar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {courseTypeId && (
        <EditionForm
          open={creating}
          onClose={() => setCreating(false)}
          onSubmit={(values) => createMutation.mutate(values)}
          courseTypeId={courseTypeId}
          title="Nueva edición"
          saving={createMutation.isPending}
        />
      )}

      {courseTypeId && duplicateFrom && (
        <EditionForm
          open={Boolean(duplicateFrom)}
          onClose={() => setDuplicateFrom(null)}
          onSubmit={(values) => createMutation.mutate(values)}
          courseTypeId={courseTypeId}
          title={`Duplicar: ${duplicateFrom.name || "edición"}`}
          initial={{ ...duplicateFrom, name: duplicateFrom.name ? `${duplicateFrom.name} (copia)` : "" }}
          saving={createMutation.isPending}
        />
      )}
    </div>
  );
}
