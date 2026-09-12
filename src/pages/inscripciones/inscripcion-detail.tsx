import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getEnrollmentFull, getBalance } from "../../lib/api/enrollments";
import { createPayment, listPaymentsByEnrollment, voidPayment } from "../../lib/api/payments";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PaymentForm } from "../pagos/payment-form";
import { formatMoney } from "../../lib/money";
import { ENROLLMENT_STATUS_COLORS, ENROLLMENT_STATUS_LABELS } from "../../types/enrollment";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, type PaymentInput } from "../../types/payment";
import { useAuth } from "../../lib/auth-context";

export default function InscripcionDetail() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["enrollment-full", enrollmentId],
    queryFn: () => getEnrollmentFull(enrollmentId!),
    enabled: Boolean(enrollmentId),
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", enrollmentId],
    queryFn: () => listPaymentsByEnrollment(enrollmentId!),
    enabled: Boolean(enrollmentId),
  });

  const { data: balance } = useQuery({
    queryKey: ["balance", enrollmentId],
    queryFn: () => getBalance(enrollmentId!),
    enabled: Boolean(enrollmentId),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["payments", enrollmentId] });
    queryClient.invalidateQueries({ queryKey: ["balance", enrollmentId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: PaymentInput) => createPayment(input),
    onSuccess: () => {
      invalidateAll();
      setRegistering(false);
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      voidPayment(id, reason, profile?.id ?? null),
    onSuccess: () => {
      invalidateAll();
      setVoidingId(null);
      setVoidReason("");
    },
  });

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>;
  if (!enrollment) return <div className="p-8 text-gray-400 text-sm">No se encontró la inscripción.</div>;

  const balanceAmount = parseFloat(balance?.balance ?? enrollment.final_price);

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() =>
          enrollment.course_editions &&
          navigate(`/cursos/${enrollment.course_editions.course_type_id}/${enrollment.course_editions.id}`)
        }
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← {enrollment.course_editions?.name || "Edición"}
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {enrollment.students?.last_name}, {enrollment.students?.first_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {enrollment.course_editions?.name ||
              (enrollment.course_editions && new Date(enrollment.course_editions.start_date).toLocaleDateString("es-AR"))}
          </p>
        </div>
        <Badge color={ENROLLMENT_STATUS_COLORS[enrollment.status]}>
          {ENROLLMENT_STATUS_LABELS[enrollment.status]}
        </Badge>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Precio</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Precio lista</span>
            <span>{formatMoney(enrollment.original_price)}</span>
          </div>
          {enrollment.discount_type && (
            <div className="flex justify-between text-gray-500">
              <span>
                Descuento
                {enrollment.discount_type === "porcentaje" ? ` (${enrollment.discount_value}%)` : ""}
                {enrollment.discount_reason ? ` — ${enrollment.discount_reason}` : ""}
              </span>
              <span>
                -
                {enrollment.discount_type === "porcentaje"
                  ? formatMoney(
                      (parseFloat(enrollment.original_price) * parseFloat(enrollment.discount_value ?? "0")) / 100
                    )
                  : formatMoney(enrollment.discount_value ?? 0)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-medium text-gray-900 pt-1 border-t border-gray-100">
            <span>Precio final</span>
            <span>{formatMoney(enrollment.final_price)}</span>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Pagos</h2>
          <Button onClick={() => setRegistering(true)}>+ Registrar pago</Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Total pagado</div>
            <div className="font-semibold text-emerald-600">{formatMoney(balance?.paid_amount ?? 0)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Saldo</div>
            <div className={`font-semibold ${balanceAmount > 0 ? "text-amber-600" : "text-gray-900"}`}>
              {formatMoney(balanceAmount)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Estado</div>
            <div className="font-semibold text-gray-900">{balanceAmount <= 0 ? "Saldado" : "Pendiente"}</div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {payments?.length === 0 && <p className="text-sm text-gray-400 py-4">Sin pagos registrados.</p>}
          {payments?.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className={p.status === "anulado" ? "line-through text-gray-400" : "text-gray-900"}>
                  {new Date(p.payment_date).toLocaleDateString("es-AR")} ·{" "}
                  {formatMoney(p.amount)} · {PAYMENT_TYPE_LABELS[p.payment_type]} ·{" "}
                  {PAYMENT_METHOD_LABELS[p.payment_method]}
                </div>
                {p.status === "anulado" && (
                  <div className="text-xs text-red-500">Anulado: {p.void_reason}</div>
                )}
              </div>
              {p.status === "valido" && (
                <Button variant="ghost" onClick={() => setVoidingId(p.id)}>
                  Anular
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <PaymentForm
        open={registering}
        onClose={() => setRegistering(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        enrollmentId={enrollmentId!}
        suggestedAmount={balanceAmount > 0 ? String(balanceAmount) : undefined}
        saving={createMutation.isPending}
      />

      {voidingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Anular pago</h3>
            <p className="text-sm text-gray-500 mb-3">
              El pago no se borra, queda anulado con un motivo para mantener trazabilidad.
            </p>
            <textarea
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
              rows={3}
              placeholder="Motivo de la anulación *"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setVoidingId(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={!voidReason.trim() || voidMutation.isPending}
                onClick={() => voidMutation.mutate({ id: voidingId, reason: voidReason })}
              >
                Anular pago
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
