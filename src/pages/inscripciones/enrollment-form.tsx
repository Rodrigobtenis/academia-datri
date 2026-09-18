import { useMemo, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { StudentPicker } from "../../components/student-picker";
import { formatMoney } from "../../lib/money";
import { ENROLLMENT_STATUS_LABELS, type DiscountType, type EnrollmentInput } from "../../types/enrollment";
import { PAYMENT_METHOD_LABELS, type PaymentFormValues, type PaymentMethod } from "../../types/payment";
import type { Student } from "../../types/student";
import { useAuth } from "../../lib/auth-context";

const today = () => new Date().toISOString().slice(0, 10);

export function EnrollmentForm({
  open,
  onClose,
  onSubmit,
  courseEditionId,
  defaultPrice,
  saving,
  overrideCapacity,
  presetStudent,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: EnrollmentInput, sena: PaymentFormValues | null) => void;
  courseEditionId: string;
  defaultPrice: string;
  saving?: boolean;
  overrideCapacity?: boolean;
  presetStudent?: Student | null;
}) {
  const { profile } = useAuth();
  const [student, setStudent] = useState<Student | null>(presetStudent ?? null);
  const [originalPrice, setOriginalPrice] = useState(defaultPrice);
  const [discountType, setDiscountType] = useState<DiscountType | "">("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [status, setStatus] = useState<EnrollmentInput["status"]>("reservada");
  const [notes, setNotes] = useState("");

  const [addSena, setAddSena] = useState(false);
  const [senaAmount, setSenaAmount] = useState("");
  const [senaMethod, setSenaMethod] = useState<PaymentMethod>("efectivo");
  const [senaApplyDiscount, setSenaApplyDiscount] = useState(false);
  const [senaDiscountPercent, setSenaDiscountPercent] = useState("");

  const finalPrice = useMemo(() => {
    const orig = parseFloat(originalPrice) || 0;
    const disc = parseFloat(discountValue) || 0;
    if (!discountType || !disc) return orig;
    if (discountType === "monto") return Math.max(0, orig - disc);
    return Math.max(0, orig * (1 - disc / 100));
  }, [originalPrice, discountType, discountValue]);

  const senaShowDiscount = addSena && senaMethod === "efectivo";
  const senaDiscountPct = senaShowDiscount && senaApplyDiscount ? parseFloat(senaDiscountPercent) || 0 : 0;
  const senaNominal = parseFloat(senaAmount) || 0;
  const senaActualToCollect = senaDiscountPct > 0 ? senaNominal - (senaNominal * senaDiscountPct) / 100 : senaNominal;

  function reset() {
    setStudent(presetStudent ?? null);
    setOriginalPrice(defaultPrice);
    setDiscountType("");
    setDiscountValue("");
    setDiscountReason("");
    setStatus("reservada");
    setNotes("");
    setAddSena(false);
    setSenaAmount("");
    setSenaMethod("efectivo");
    setSenaApplyDiscount(false);
    setSenaDiscountPercent("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!student) return;

    const sena: PaymentFormValues | null =
      addSena && senaNominal > 0
        ? {
            enrollment_id: "",
            payment_date: today(),
            amount: senaAmount,
            payment_type: "sena",
            payment_method: senaMethod,
            reference: null,
            notes: null,
            cash_discount_percent: senaDiscountPct > 0 ? senaDiscountPct : null,
          }
        : null;

    onSubmit(
      {
        student_id: student.id,
        course_edition_id: courseEditionId,
        original_price: originalPrice,
        discount_type: discountType || null,
        discount_value: discountType ? discountValue || "0" : null,
        discount_reason: discountType ? discountReason || null : null,
        discount_authorized_by: discountType ? profile?.id ?? null : null,
        final_price: String(finalPrice),
        status,
        sales_responsible: profile?.id ?? null,
        override_capacity: Boolean(overrideCapacity),
        override_authorized_by: overrideCapacity ? profile?.id ?? null : null,
        access_sent: false,
        notes: notes || null,
      },
      sena
    );
    reset();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Agregar alumna a la edición" wide>
      {!student ? (
        <StudentPicker onSelect={setStudent} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-gray-800">
              {student.last_name}, {student.first_name}
            </span>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setStudent(null)}
            >
              cambiar
            </button>
          </div>

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
            <Field label="Motivo del descuento">
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

          <Field label="Estado">
            <Select value={status} onChange={(e) => setStatus(e.target.value as never)}>
              {Object.entries(ENROLLMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notas">
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={addSena} onChange={(e) => setAddSena(e.target.checked)} />
              Cobrar una seña ahora
            </label>
            {addSena && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Monto de la seña *">
                    <TextInput
                      type="number"
                      step="0.01"
                      min={0}
                      required={addSena}
                      value={senaAmount}
                      onChange={(e) => setSenaAmount(e.target.value)}
                    />
                  </Field>
                  <Field label="Método">
                    <Select value={senaMethod} onChange={(e) => setSenaMethod(e.target.value as PaymentMethod)}>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {senaShowDiscount && (
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={senaApplyDiscount}
                        onChange={(e) => setSenaApplyDiscount(e.target.checked)}
                      />
                      Descuento por pago en efectivo
                    </label>
                    {senaApplyDiscount && (
                      <div className="mt-2 space-y-2">
                        <Field label="% de descuento">
                          <TextInput
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={senaDiscountPercent}
                            onChange={(e) => setSenaDiscountPercent(e.target.value)}
                          />
                        </Field>
                        {senaDiscountPct > 0 && senaNominal > 0 && (
                          <p className="text-xs text-gray-500">
                            Se acreditan <strong>{formatMoney(senaNominal)}</strong> contra el saldo. Con{" "}
                            {senaDiscountPct}% de descuento, en efectivo se cobra{" "}
                            <strong className="text-emerald-600">{formatMoney(senaActualToCollect)}</strong>.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {overrideCapacity && (
            <p className="text-xs text-amber-600">
              El curso está completo — esta inscripción va a superar el cupo, autorizada por vos.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Inscribir"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
