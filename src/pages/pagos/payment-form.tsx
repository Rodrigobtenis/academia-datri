import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";
import { getOficialRate } from "../../lib/dolar";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  type Currency,
  type PaymentInput,
  type PaymentType,
} from "../../types/payment";

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentForm({
  open,
  onClose,
  onSubmit,
  enrollmentId,
  suggestedAmount,
  suggestedAmountUsd,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentInput) => void;
  enrollmentId: string;
  suggestedAmount?: string;
  suggestedAmountUsd?: string;
  saving?: boolean;
}) {
  const [paymentDate, setPaymentDate] = useState(today());
  const [currency, setCurrency] = useState<Currency>("ars");
  const [amountArs, setAmountArs] = useState(suggestedAmount ?? "");
  const [amountUsd, setAmountUsd] = useState(suggestedAmountUsd ?? "");
  const [rate, setRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("parcial");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (currency !== "usd" || rate !== null) return;
    getOficialRate()
      .then((r) => setRate(r.venta))
      .catch((err: Error) => setRateError(err.message));
  }, [currency, rate]);

  const amountArsComputed = useMemo(() => {
    if (currency === "ars") return amountArs;
    return String((parseFloat(amountUsd) || 0) * (rate ?? 0));
  }, [currency, amountArs, amountUsd, rate]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const isUsd = currency === "usd" && rate;
    const rawAmount = parseFloat(amountArsComputed) || 0;
    const signedAmount = paymentType === "reintegro" ? -Math.abs(rawAmount) : rawAmount;
    const usdRaw = parseFloat(amountUsd) || 0;

    onSubmit({
      enrollment_id: enrollmentId,
      payment_date: paymentDate,
      amount: String(signedAmount),
      payment_type: paymentType,
      payment_method: paymentMethod as PaymentInput["payment_method"],
      reference: reference || null,
      notes: notes || null,
      currency: isUsd ? "usd" : "ars",
      original_amount_usd: isUsd ? String(paymentType === "reintegro" ? -Math.abs(usdRaw) : usdRaw) : null,
      fx_rate: isUsd ? String(rate) : null,
    });
    setAmountArs("");
    setAmountUsd("");
    setReference("");
    setNotes("");
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
          <Field label="Moneda">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="ars">Pesos (ARS)</option>
              <option value="usd">Dólares (USD)</option>
            </Select>
          </Field>
        </div>

        <Field label={currency === "ars" ? "Monto *" : "Monto (USD) *"}>
          {currency === "ars" ? (
            <TextInput
              type="number"
              step="0.01"
              min={0}
              required
              value={amountArs}
              onChange={(e) => setAmountArs(e.target.value)}
            />
          ) : (
            <TextInput
              type="number"
              step="0.01"
              min={0}
              required
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
            />
          )}
        </Field>

        {currency === "usd" && (
          <p className="text-xs text-gray-500 -mt-2">
            {rate
              ? `Dólar oficial (venta): $${rate} → equivale a ${formatMoney(amountArsComputed)}`
              : rateError
                ? `No se pudo obtener la cotización: ${rateError}`
                : "Buscando cotización del dólar oficial..."}
          </p>
        )}

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
