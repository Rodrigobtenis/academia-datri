import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { deleteEdition, getEdition, getOccupancy, updateEdition } from "../../lib/api/courses";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EditionForm } from "./edition-form";
import { EditionRoster } from "../inscripciones/edition-roster";
import { EditionExpenses } from "../gastos/edition-expenses";
import { EditionAttendance } from "../asistencia/edition-attendance";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { EDITION_STATUS_COLORS, EDITION_STATUS_LABELS, type CourseEditionInput } from "../../types/course";
import { useAuth } from "../../lib/auth-context";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm text-gray-800">{value || "—"}</div>
    </div>
  );
}

export default function EditionDetail() {
  const { courseTypeId, editionId } = useParams<{ courseTypeId: string; editionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: edition, isLoading } = useQuery({
    queryKey: ["edition", editionId],
    queryFn: () => getEdition(editionId!),
    enabled: Boolean(editionId),
  });

  const { data: occupancy } = useQuery({
    queryKey: ["occupancy-one", editionId],
    queryFn: () => getOccupancy(editionId!),
    enabled: Boolean(editionId),
  });

  const updateMutation = useMutation({
    mutationFn: (input: CourseEditionInput) => updateEdition(editionId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edition", editionId] });
      queryClient.invalidateQueries({ queryKey: ["editions", courseTypeId] });
      queryClient.invalidateQueries({ queryKey: ["occupancy", courseTypeId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEdition(editionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editions", courseTypeId] });
      queryClient.invalidateQueries({ queryKey: ["occupancy", courseTypeId] });
      navigate(`/cursos/${courseTypeId}`);
    },
    onError: (err: { code?: string; message: string }) => {
      if (err.code === "23503") {
        setDeleteError(
          "No se puede eliminar: esta edición ya tiene alumnas inscriptas, gastos u otros datos cargados. Cancelala en cambio (estado \"Cancelado\") si no va a dictarse."
        );
      } else {
        setDeleteError(err.message);
      }
    },
  });

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>;
  if (!edition) return <div className="p-8 text-gray-400 text-sm">No se encontró la edición.</div>;

  const full = Boolean(occupancy && occupancy.available <= 0);

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate(`/cursos/${courseTypeId}`)}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← Ediciones
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {edition.name || `Edición del ${formatDateAR(edition.start_date)}`}
            </h1>
            <Badge color={EDITION_STATUS_COLORS[edition.status]}>
              {EDITION_STATUS_LABELS[edition.status]}
            </Badge>
            {full && <Badge color="red">CURSO COMPLETO</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{formatDateAR(edition.start_date)}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteError(null);
                setDeleting(true);
              }}
            >
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Datos de la edición</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Sede" value={edition.location} />
              <InfoRow label="Docente" value={edition.teacher} />
              <InfoRow
                label="Precio"
                value={
                  edition.currency === "usd" && edition.list_price_usd
                    ? `USD ${edition.list_price_usd} (${formatMoney(edition.list_price)})`
                    : formatMoney(edition.list_price)
                }
              />
            </div>
            {edition.materials && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs text-gray-400 mb-1">Materiales incluidos</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{edition.materials}</p>
              </div>
            )}
          </section>

          <EditionRoster
            editionId={edition.id}
            listPrice={edition.list_price}
            listPriceCurrency={edition.currency}
            listPriceUsd={edition.list_price_usd}
            occupancy={occupancy}
          />

          <EditionAttendance editionId={edition.id} />
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Cupos</h2>
            {occupancy ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cupos totales</span>
                  <span className="font-medium text-gray-900">{occupancy.max_students}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Inscriptas</span>
                  <span className="font-medium text-gray-900">{occupancy.enrolled_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Disponibles</span>
                  <span className="font-medium text-gray-900">{occupancy.available}</span>
                </div>
                <div className="pt-2">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${full ? "bg-red-500" : "bg-brand-500"}`}
                      style={{ width: `${Math.min(100, occupancy.occupancy_pct ?? 0)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{occupancy.occupancy_pct ?? 0}% ocupación</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </section>

          {isAdmin && <EditionExpenses editionId={edition.id} />}
        </div>
      </div>

      {courseTypeId && (
        <EditionForm
          open={editing}
          onClose={() => setEditing(false)}
          onSubmit={(values) => updateMutation.mutate(values)}
          courseTypeId={courseTypeId}
          initial={edition}
          title="Editar edición"
          saving={updateMutation.isPending}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Eliminar edición</h3>
            <p className="text-sm text-gray-500 mb-4">
              ¿Seguro que querés eliminar{" "}
              <span className="font-medium text-gray-800">
                {edition.name || `la edición del ${formatDateAR(edition.start_date)}`}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
            {deleteError && <p className="text-sm text-red-600 mb-4">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(false)}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar definitivamente"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
