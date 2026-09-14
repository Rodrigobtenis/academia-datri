import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";
import { getOficialRate } from "../../lib/dolar";
import {
  EDITION_STATUS_LABELS,
  type CourseEdition,
  type CourseEditionInput,
  type Currency,
} from "../../types/course";

function emptyForm(courseTypeId: string): CourseEditionInput {
  return {
    course_type_id: courseTypeId,
    name: "",
    start_date: "",
    end_date: null,
    start_time: null,
    end_time: null,
    location: "",
    teacher: "",
    max_students: 10,
    list_price: "0",
    promo_price: null,
    status: "borrador",
    description: null,
    includes: null,
    materials: "",
    requirements: null,
    internal_notes: null,
    currency: "ars",
    list_price_usd: null,
    fx_rate: null,
  };
}

export function EditionForm({
  open,
  onClose,
  onSubmit,
  courseTypeId,
  initial,
  title,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CourseEditionInput) => void;
  courseTypeId: string;
  initial?: Partial<CourseEdition> | null;
  title: string;
  saving?: boolean;
}) {
  const [form, setForm] = useState<CourseEditionInput>(() => ({
    ...emptyForm(courseTypeId),
    ...initial,
  }));
  const [priceUsd, setPriceUsd] = useState(initial?.list_price_usd ?? "");
  const [rate, setRate] = useState<number | null>(initial?.fx_rate ? Number(initial.fx_rate) : null);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    if (form.currency !== "usd" || rate !== null) return;
    getOficialRate()
      .then((r) => setRate(r.venta))
      .catch((err: Error) => setRateError(err.message));
  }, [form.currency, rate]);

  const computedArsPrice = useMemo(() => {
    if (form.currency === "ars") return form.list_price;
    return String((parseFloat(priceUsd) || 0) * (rate ?? 0));
  }, [form.currency, form.list_price, priceUsd, rate]);

  function update<K extends keyof CourseEditionInput>(key: K, value: CourseEditionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const isUsd = form.currency === "usd" && rate;
    onSubmit({
      ...form,
      location: form.location || null,
      teacher: form.teacher || null,
      materials: form.materials || null,
      name: form.name || null,
      list_price: computedArsPrice,
      currency: isUsd ? "usd" : "ars",
      list_price_usd: isUsd ? priceUsd : null,
      fx_rate: isUsd ? String(rate) : null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre (opcional)">
          <TextInput
            placeholder="Ej: Edición Septiembre 2026"
            value={form.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha *">
            <TextInput
              type="date"
              required
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
            />
          </Field>
          <Field label="Dirección / sede">
            <TextInput value={form.location ?? ""} onChange={(e) => update("location", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Docente">
            <TextInput value={form.teacher ?? ""} onChange={(e) => update("teacher", e.target.value)} />
          </Field>
          <Field label="Cupos máximos *">
            <TextInput
              type="number"
              min={1}
              required
              value={form.max_students}
              onChange={(e) => update("max_students", Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Moneda del precio">
            <Select value={form.currency} onChange={(e) => update("currency", e.target.value as Currency)}>
              <option value="ars">Pesos (ARS)</option>
              <option value="usd">Dólares (USD)</option>
            </Select>
          </Field>
          <Field label={form.currency === "ars" ? "Precio *" : "Precio (USD) *"}>
            {form.currency === "ars" ? (
              <TextInput
                type="number"
                step="0.01"
                min={0}
                required
                value={form.list_price}
                onChange={(e) => update("list_price", e.target.value)}
              />
            ) : (
              <TextInput
                type="number"
                step="0.01"
                min={0}
                required
                value={priceUsd ?? ""}
                onChange={(e) => setPriceUsd(e.target.value)}
              />
            )}
          </Field>
        </div>

        {form.currency === "usd" && (
          <p className="text-xs text-gray-500 -mt-2">
            {rate
              ? `Dólar oficial (venta): $${rate} → equivale a ${formatMoney(computedArsPrice)}`
              : rateError
                ? `No se pudo obtener la cotización: ${rateError}`
                : "Buscando cotización del dólar oficial..."}
          </p>
        )}

        <Field label="Estado">
          <Select value={form.status} onChange={(e) => update("status", e.target.value as never)}>
            {Object.entries(EDITION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Materiales incluidos">
          <TextArea rows={2} value={form.materials ?? ""} onChange={(e) => update("materials", e.target.value)} />
        </Field>

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
