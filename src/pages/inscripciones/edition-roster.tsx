import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { createEnrollment, getBalancesByEdition, listEnrollmentsByEdition, updateEnrollment } from "../../lib/api/enrollments";
import { createPayment } from "../../lib/api/payments";
import { addToWaitlist, listWaitlist, removeFromWaitlist } from "../../lib/api/waitlist";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Select, TextInput, Field } from "../../components/ui/field";
import { Dialog } from "../../components/ui/dialog";
import { StudentPicker } from "../../components/student-picker";
import { EnrollmentForm } from "./enrollment-form";
import { formatMoney } from "../../lib/money";
import {
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentInput,
  type EnrollmentStatus,
} from "../../types/enrollment";
import type { Student } from "../../types/student";
import type { EditionOccupancy } from "../../types/course";
import { useAuth } from "../../lib/auth-context";

export function EditionRoster({
  editionId,
  listPrice,
  occupancy,
}: {
  editionId: string;
  listPrice: string;
  occupancy: EditionOccupancy | null | undefined;
}) {
  const navigate = useNavigate();
  const { courseTypeId } = useParams<{ courseTypeId: string }>();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [enrolling, setEnrolling] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [addingToWaitlist, setAddingToWaitlist] = useState(false);
  const [promoteStudent, setPromoteStudent] = useState<Student | null>(null);
  const [confirming, setConfirming] = useState<{ enrollmentId: string; suggested: string } | null>(null);
  const [senaAmount, setSenaAmount] = useState("");

  const full = Boolean(occupancy && occupancy.available <= 0);

  function goToInscripcion(enrollmentId: string) {
    navigate(`/cursos/${courseTypeId}/${editionId}/inscripciones/${enrollmentId}`);
  }

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments", editionId],
    queryFn: () => listEnrollmentsByEdition(editionId),
  });

  const { data: balances } = useQuery({
    queryKey: ["balances", editionId],
    queryFn: () => getBalancesByEdition(editionId),
  });

  const { data: waitlist } = useQuery({
    queryKey: ["waitlist", editionId],
    queryFn: () => listWaitlist(editionId),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["enrollments", editionId] });
    queryClient.invalidateQueries({ queryKey: ["balances", editionId] });
    queryClient.invalidateQueries({ queryKey: ["occupancy-one", editionId] });
    queryClient.invalidateQueries({ queryKey: ["waitlist", editionId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: EnrollmentInput) => createEnrollment(input),
    onSuccess: () => {
      invalidateAll();
      setEnrolling(false);
      setOverriding(false);
      if (promoteStudent) {
        const entry = waitlist?.find((w) => w.student_id === promoteStudent.id);
        if (entry) removeFromWaitlist(entry.id).then(invalidateAll);
      }
      setPromoteStudent(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnrollmentStatus }) =>
      updateEnrollment(id, { status }),
    onSuccess: invalidateAll,
  });

  const confirmWithSenaMutation = useMutation({
    mutationFn: async ({ enrollmentId, amount }: { enrollmentId: string; amount: string }) => {
      await createPayment({
        enrollment_id: enrollmentId,
        payment_date: new Date().toISOString().slice(0, 10),
        amount,
        payment_type: "sena",
        payment_method: "efectivo",
        reference: null,
        notes: null,
      });
      await updateEnrollment(enrollmentId, { status: "confirmada" });
    },
    onSuccess: () => {
      invalidateAll();
      setConfirming(null);
      setSenaAmount("");
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: (student: Student) =>
      addToWaitlist({
        student_id: student.id,
        course_edition_id: editionId,
        priority: 0,
        phone: student.phone,
        notes: null,
      }),
    onSuccess: () => {
      invalidateAll();
      setAddingToWaitlist(false);
    },
  });

  const removeWaitlistMutation = useMutation({
    mutationFn: (id: string) => removeFromWaitlist(id),
    onSuccess: invalidateAll,
  });

  function handleStatusChange(enrollmentId: string, currentStatus: EnrollmentStatus, newStatus: EnrollmentStatus, balance: string) {
    if (newStatus === "confirmada" && currentStatus !== "confirmada") {
      setSenaAmount(balance);
      setConfirming({ enrollmentId, suggested: balance });
      return;
    }
    statusMutation.mutate({ id: enrollmentId, status: newStatus });
  }

  function handleConfirmSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirming) return;
    confirmWithSenaMutation.mutate({ enrollmentId: confirming.enrollmentId, amount: senaAmount });
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Alumnas inscriptas</h2>
        {!full && <Button onClick={() => setEnrolling(true)}>+ Agregar alumna</Button>}
      </div>

      {full && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-700 font-medium">CURSO COMPLETO</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAddingToWaitlist(true)}>
              + Lista de espera
            </Button>
            {isAdmin && (
              <Button variant="danger" onClick={() => setOverriding(true)}>
                Inscribir de todos modos
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left py-2 font-medium">Alumna</th>
              <th className="text-left py-2 font-medium">Estado</th>
              <th className="text-right py-2 font-medium">Precio final</th>
              <th className="text-right py-2 font-medium">Pagado</th>
              <th className="text-right py-2 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">
                  Todavía no hay alumnas inscriptas.
                </td>
              </tr>
            )}
            {enrollments?.map((e) => {
              const bal = balances?.[e.id];
              const balanceAmount = bal?.balance ?? e.final_price;
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td
                    className="py-2 font-medium text-gray-900 cursor-pointer"
                    onClick={() => goToInscripcion(e.id)}
                    title="Ver inscripción y pagos"
                  >
                    {e.students?.last_name}, {e.students?.first_name}
                  </td>
                  <td className="py-2">
                    <Select
                      value={e.status}
                      onChange={(ev) =>
                        handleStatusChange(e.id, e.status, ev.target.value as EnrollmentStatus, balanceAmount)
                      }
                      className="!py-1 text-xs"
                    >
                      {Object.entries(ENROLLMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-2 text-right">{formatMoney(e.final_price)}</td>
                  <td className="py-2 text-right text-emerald-600">{formatMoney(bal?.paid_amount ?? 0)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => goToInscripcion(e.id)} className="inline-block" title="Ver pagos">
                      {parseFloat(balanceAmount) > 0 ? (
                        <Badge color="amber">{formatMoney(balanceAmount)}</Badge>
                      ) : (
                        <Badge color="green">Saldado</Badge>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(waitlist?.length ?? 0) > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lista de espera</h3>
          <div className="space-y-2">
            {waitlist?.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span>
                  {w.students?.last_name}, {w.students?.first_name}{" "}
                  <span className="text-gray-400">{w.phone ? `· ${w.phone}` : ""}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!w.students) return;
                      if (full && !isAdmin) {
                        window.alert(
                          "El curso sigue completo — pedile a un admin que autorice superar el cupo para pasarla a inscripción."
                        );
                        return;
                      }
                      setPromoteStudent(w.students as Student);
                    }}
                  >
                    Pasar a inscripción
                  </Button>
                  <Button variant="ghost" onClick={() => removeWaitlistMutation.mutate(w.id)}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <EnrollmentForm
        key="normal"
        open={enrolling}
        onClose={() => setEnrolling(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        courseEditionId={editionId}
        defaultPrice={listPrice}
        saving={createMutation.isPending}
      />

      <EnrollmentForm
        key="override"
        open={overriding}
        onClose={() => setOverriding(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        courseEditionId={editionId}
        defaultPrice={listPrice}
        saving={createMutation.isPending}
        overrideCapacity
      />

      {promoteStudent && (
        <EnrollmentForm
          key={`promote-${promoteStudent.id}`}
          open={Boolean(promoteStudent)}
          onClose={() => setPromoteStudent(null)}
          onSubmit={(values) => createMutation.mutate(values)}
          courseEditionId={editionId}
          defaultPrice={listPrice}
          saving={createMutation.isPending}
          presetStudent={promoteStudent}
          overrideCapacity={full}
        />
      )}

      <Dialog open={addingToWaitlist} onClose={() => setAddingToWaitlist(false)} title="Agregar a lista de espera">
        <StudentPicker onSelect={(s) => waitlistMutation.mutate(s)} />
      </Dialog>

      <Dialog open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Confirmar inscripción">
        <form onSubmit={handleConfirmSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">¿De cuánto fue la seña para confirmar esta inscripción?</p>
          <Field label="Monto de la seña *">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              required
              autoFocus
              value={senaAmount}
              onChange={(e) => setSenaAmount(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={confirmWithSenaMutation.isPending}>
              {confirmWithSenaMutation.isPending ? "Guardando..." : "Confirmar y registrar seña"}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
