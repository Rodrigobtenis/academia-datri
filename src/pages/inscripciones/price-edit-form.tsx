import { useMemo, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";
import type { DiscountType, Enrollment, EnrollmentInput } from "../../types/enrollment";

// Editar el descuento acá (sobre el precio TOTAL del curso) es lo que hay que usar cuando el
// descuento en efectivo aplica a toda la venta — por ejemplo cuando ya se cobró una seña sin
// descuento y después se define pagar el resto en efectivo. Aplicar el % en el pago mismo
// (PaymentForm) da otra cuenta: ese descuento se calcula sobre el saldo restante, no sobre el
// precio de lista, así que si ya se cobró algo sin descuento el total termina siendo más alto
// que "precio de lista con el % off". El descuento por pago sigue teniendo sentido para el
// caso distinto de dar un descuento puntual solo sobre una cuota específica.
export function PriceEditForm({
  open,
  onClose,
  onSubmit,
  enrollment,
  paidAmount,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Partial<EnrollmentInput>) => void;
  enrollment: Enrollment;
  paidAmount: number;
  saving?: boolean;
}) {
  const [originalPrice, setOriginalPrice] = useState(enrollment.original_price);
  const [discountType, setDiscountType] = useState<DiscountType | "">(enrollment.discount_type ?? "");
  const [discountValue, setDiscountValue] = useState(enrollment.discount_value ?? "");
  const [discountReason, setDiscountReason] = useState(enrollment.discount_reason ?? "");
  const [error, setError] = useState<string | null>(null);

  const finalPrice = useMemo(() => {
    const orig = parseFloat(originalPrice) || 0;
    const disc = parseFloat(discountValue) || 0;
    if (!discountType || !disc) return orig;
    if (discountType === "monto") return Math.max(0, orig - disc);
    return Math.max(0, orig * (1 - disc / 100));
  }, [originalPrice, discountType, discountValue]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (finalPrice < paidAmount) {
      setError(
        `El precio final no puede quedar por debajo de lo ya cobrado (${formatMoney(paidAmount)}).`
      );
      return;
    }
    onSubmit({
      original_price: originalPrice,
      discount_type: discountType || null,
      discount_value: discountType ? discountValue || "0" : null,
      discount_reason: discountType ? discountReason || null : null,
      final_price: String(finalPrice),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Editar precio">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Precio lista del curso *">
          <TextInput
            type="number"
            step="0.01"
            min={0}
            required
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Descuento">
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | "")}>
              <option value="">Sin descuento</option>
              <option value="monto">Monto fijo</option>
              <option value="porcentaje">Porcentaje</option>
            </Select>
          </Field>
          <Field label={discountType === "porcentaje" ? "Porcentaje %" : "Monto"}>
            <TextInput
              type="number"
              step="0.01"
              min={0}
              disabled={!discountType}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </Field>
          <Field label="Motivo">
            <TextInput
              disabled={!discountType}
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-lg bg-brand-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-brand-700">Precio final</span>
          <span className="text-lg font-semibold text-brand-800">{formatMoney(finalPrice)}</span>
        </div>

        <p className="text-xs text-gray-400">
          Ya se cobró {formatMoney(paidAmount)} — con este precio final quedaría un saldo de{" "}
          {formatMoney(Math.max(0, finalPrice - paidAmount))}.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
