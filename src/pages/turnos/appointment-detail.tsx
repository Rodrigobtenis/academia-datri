import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field, Select, TextInput, TextArea } from "../../components/ui/field";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { getAppointment, getAppointmentBalance, updateAppointment } from "../../lib/api/appointments";
import {
  listAppointmentPayments,
  submitAppointmentPayment,
  updateAppointmentPaymentAmount,
  voidAppointmentPayment,
} from "../../lib/api/appointment-payments";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentPaymentFormValues,
  type AppointmentStatus,
} from "../../types/appointment";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, type PaymentMethod, type PaymentType } from "../../types/payment";
import { useAuth } from "../../lib/auth-context";

const today = () => new Date().toISOString().slice(0, 10);

export function AppointmentDetail({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState("");

  const [payDate, setPayDate] = useState(today());
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<PaymentType>("parcial");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("efectivo");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");

  const { data: appointment } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => getAppointment(appointmentId),
  });

  const { data: balance } = useQuery({
    queryKey: ["appointment-balance", appointmentId],
    queryFn: () => getAppointmentBalance(appointmentId),
  });

  const { data: payments } = useQuery({
    queryKey: ["appointment-payments", appointmentId],
    queryFn: () => listAppointmentPayments(appointmentId),
  });

  const balanceAmount = parseFloat(balance?.balance ?? appointment?.price ?? "0");

  // Sugiere pagar lo que queda después de la seña — se recalcula cada vez que cambia el
  // saldo real (por ejemplo, al abrir el diálogo de nuevo después de un pago anterior).
  useEffect(() => {
    if (registering && balanceAmount > 0) setPayAmount(String(balanceAmount));
  }, [registering, balanceAmount]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["appointment-balance", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["appointment-payments", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["appointments-month"] });
    queryClient.invalidateQueries({ queryKey: ["appointment-balances"] });
  }

  const statusMutation = useMutation({
    mutationFn: (status: AppointmentStatus) => updateAppointment(appointmentId, { status }),
    onSuccess: invalidateAll,
  });

  const priceMutation = useMutation({
    mutationFn: (price: string) => updateAppointment(appointmentId, { price }),
    onSuccess: () => {
      invalidateAll();
      setEditingPrice(false);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (values: AppointmentPaymentFormValues) => submitAppointmentPayment(values),
    onSuccess: () => {
      invalidateAll();
      setRegistering(false);
      setApplyDiscount(false);
      setDiscountPercent("");
    },
  });

  const editAmountMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) => updateAppointmentPaymentAmount(id, amount),
    onSuccess: () => {
      invalidateAll();
      setEditingPaymentId(null);
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      voidAppointmentPayment(id, reason, profile?.id ?? null),
    onSuccess: () => {
      invalidateAll();
      setVoidingId(null);
      setVoidReason("");
    },
  });

  const showDiscountOption = payMethod === "efectivo" && payType !== "reintegro";
  const discountPct = showDiscountOption && applyDiscount ? parseFloat(discountPercent) || 0 : 0;
  const nominalAmount = parseFloat(payAmount) || 0;
  const actualToCollect = discountPct > 0 ? nominalAmount - (nominalAmount * discountPct) / 100 : nominalAmount;

  function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    paymentMutation.mutate({
      appointment_id: appointmentId,
      payment_date: payDate,
      amount: payType === "reintegro" ? String(-Math.abs(parseFloat(payAmount) || 0)) : payAmount,
      payment_type: payType,
      payment_method: payMethod,
      reference: null,
      notes: null,
      cash_discount_percent: discountPct > 0 ? discountPct : null,
    });
  }

  if (!appointment) return null;

  return (
    <Dialog open onClose={onClose} title="Turno" wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-gray-900">
              {appointment.students?.last_name}, {appointment.students?.first_name}
            </p>
            <p className="text-sm text-gray-500">
              {appointment.services?.name} con {appointment.professionals?.first_name}{" "}
              {appointment.professionals?.last_name}
            </p>
            <p className="text-sm text-gray-500">
              {formatDateAR(appointment.appointment_date)} · {appointment.start_time.slice(0, 5)}–
              {appointment.end_time.slice(0, 5)}
            </p>
          </div>
          <Select
            value={appointment.status}
            onChange={(e) => statusMutation.mutate(e.target.value as AppointmentStatus)}
            className="!py-1 text-xs w-36"
          >
            {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {appointment.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{appointment.notes}</p>}

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">Precio</div>
              {!editingPrice && (
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:text-brand-700"
                  onClick={() => {
                    setPriceDraft(appointment.price);
                    setEditingPrice(true);
                  }}
                >
                  Editar
                </button>
              )}
            </div>
            {editingPrice ? (
              <div className="flex items-center gap-1 mt-1">
                <TextInput
                  type="number"
                  step="0.01"
                  min={0}
                  autoFocus
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  className="!py-1 text-sm"
                />
                <button
                  type="button"
                  className="text-emerald-600 text-xs shrink-0"
                  onClick={() => priceMutation.mutate(priceDraft)}
                  disabled={priceMutation.isPending}
                >
                  ✓
                </button>
                <button type="button" className="text-gray-400 text-xs shrink-0" onClick={() => setEditingPrice(false)}>
                  ✕
                </button>
              </div>
            ) : (
              <div className="font-semibold text-gray-900">{formatMoney(appointment.price)}</div>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Pagado</div>
            <div className="font-semibold text-emerald-600">{formatMoney(balance?.paid_amount ?? 0)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Saldo</div>
            <div className={`font-semibold ${balanceAmount > 0 ? "text-amber-600" : "text-gray-900"}`}>
              {formatMoney(balanceAmount)}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Pagos</h3>
            <Button onClick={() => setRegistering(true)}>+ Registrar pago</Button>
          </div>
          <div className="divide-y divide-gray-100">
            {payments?.length === 0 && <p className="text-sm text-gray-400 py-3">Sin pagos registrados.</p>}
            {payments?.map((p) => (
              <div key={p.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  {editingPaymentId === p.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <TextInput
                        type="number"
                        step="0.01"
                        min={0}
                        autoFocus
                        value={amountDraft}
                        onChange={(e) => setAmountDraft(e.target.value)}
                        className="!py-1 text-sm max-w-[140px]"
                      />
                      <button
                        type="button"
                        className="text-emerald-600 text-xs shrink-0"
                        onClick={() => editAmountMutation.mutate({ id: p.id, amount: amountDraft })}
                        disabled={editAmountMutation.isPending}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="text-gray-400 text-xs shrink-0"
                        onClick={() => setEditingPaymentId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className={p.status === "anulado" ? "line-through text-gray-400" : "text-gray-900"}>
                      {formatDateAR(p.payment_date)} · {formatMoney(p.amount)} · {PAYMENT_TYPE_LABELS[p.payment_type]} ·{" "}
                      {PAYMENT_METHOD_LABELS[p.payment_method]}
                    </div>
                  )}
                  {p.status === "valido" && editingPaymentId !== p.id && (
                    <div className="flex gap-1 shrink-0">
                      {!p.cash_discount_percent && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingPaymentId(p.id);
                            setAmountDraft(p.amount);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setVoidingId(p.id)}>
                        Anular
                      </Button>
                    </div>
                  )}
                  {p.status === "anulado" && <span className="text-xs text-red-500 shrink-0">Anulado</span>}
                </div>
                {p.cash_discount_percent && (
                  <div className="text-xs text-emerald-600 mt-0.5">
                    {p.cash_discount_percent}% desc. efectivo — se acreditaron{" "}
                    {formatMoney(parseFloat(p.amount) + parseFloat(p.cash_discount_amount ?? "0"))} contra el saldo
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      <Dialog open={registering} onClose={() => setRegistering(false)} title="Registrar pago">
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha *">
              <TextInput type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="Monto *">
              <TextInput
                type="number"
                step="0.01"
                min={0}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={payType} onChange={(e) => setPayType(e.target.value as PaymentType)}>
                {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Método">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {showDiscountOption && (
            <div className="rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} />
                Descuento por pago en efectivo
              </label>
              {applyDiscount && (
                <div className="mt-3 space-y-2">
                  <Field label="% de descuento">
                    <TextInput
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                    />
                  </Field>
                  {discountPct > 0 && nominalAmount > 0 && (
                    <p className="text-xs text-gray-500">
                      El monto de arriba (<strong>{formatMoney(nominalAmount)}</strong>) es lo que se acredita
                      contra el saldo. Con {discountPct}% de descuento, en efectivo se cobra{" "}
                      <strong className="text-emerald-600">{formatMoney(actualToCollect)}</strong>.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRegistering(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </Dialog>

      {voidingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Anular pago</h3>
            <TextArea
              rows={3}
              placeholder="Motivo de la anulación *"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mb-4"
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
    </Dialog>
  );
}
