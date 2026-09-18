import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  type PaymentFormValues,
  type PaymentType,
} from "../../types/payment";

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentForm({
  open,
  onClose,
  onSubmit,
  enrollmentId,
  suggestedAmount,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentFormValues) => void;
  enrollmentId: string;
  suggestedAmount?: string;
  saving?: boolean;
}) {
  const [paymentDate, setPaymentDate] = useState(today());
  const [amount, setAmount] = useState(suggestedAmount ?? "");
  const [paymentType, setPaymentType] = useState<PaymentType>("parcial");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");

  const showDiscountOption = paymentMethod === "efectivo" && paymentType !== "reintegro";
  const discountPct = showDiscountOption && applyDiscount ? parseFloat(discountPercent) || 0 : 0;
  const nominalAmount = parseFloat(amount) || 0;
  const discountAmountPreview = discountPct > 0 ? (nominalAmount * discountPct) / 100 : 0;
  const actualToCollect = nominalAmount - discountAmountPreview;

  function reset() {
    setAmount("");
    setReference("");
    setNotes("");
    setApplyDiscount(false);
    setDiscountPercent("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      enrollment_id: enrollmentId,
      payment_date: paymentDate,
      amount: paymentType === "reintegro" ? String(-Math.abs(parseFloat(amount) || 0)) : amount,
      payment_type: paymentType,
      payment_method: paymentMethod as PaymentFormValues["payment_method"],
      reference: reference || null,
      notes: notes || null,
      cash_discount_percent: discountPct > 0 ? discountPct : null,
    });
    reset();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Registrar pago">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha del pago *">
            <TextInput
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </Field>
          <Field label="Monto *">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de pago">
            <Select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Método">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Referencia">
          <TextInput value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Observaciones">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {showDiscountOption && (
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => setApplyDiscount(e.target.checked)}
              />
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
                    El monto de arriba (<strong>{formatMoney(nominalAmount)}</strong>) es lo que se
                    acredita contra el saldo. Con {discountPct}% de descuento, en efectivo se cobra{" "}
                    <strong className="text-emerald-600">{formatMoney(actualToCollect)}</strong>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {paymentType === "reintegro" && (
          <p className="text-xs text-amber-600">
            Se va a registrar como monto negativo — resta de la cobranza del mes en que se hace este
            reintegro.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
