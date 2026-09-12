import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { listCourseTypes } from "../../lib/api/courses";
import { supabase } from "../../lib/supabase";
import { EXPENSE_CATEGORY_LABELS, type ExpenseInput } from "../../types/expense";

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseForm({
  open,
  onClose,
  onSubmit,
  defaultEditionId,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseInput) => void;
  defaultEditionId?: string;
  saving?: boolean;
}) {
  const [editionId, setEditionId] = useState(defaultEditionId ?? "");
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState<ExpenseInput["category"]>("materiales");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const { data: courseTypes } = useQuery({ queryKey: ["course-types"], queryFn: listCourseTypes });
  const { data: editionsByType } = useQuery({
    queryKey: ["all-editions-for-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_editions")
        .select("id, name, start_date, course_type_id")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string | null; start_date: string; course_type_id: string }[];
    },
    enabled: !defaultEditionId,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      course_edition_id: editionId || null,
      expense_date: expenseDate,
      category,
      amount,
      description: description || null,
      notes: notes || null,
    });
    setAmount("");
    setDescription("");
    setNotes("");
  }

  return (
    <Dialog open={open} onClose={onClose} title="Registrar gasto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!defaultEditionId && (
          <Field label="Edición (opcional — dejalo vacío para un gasto general)">
            <Select value={editionId} onChange={(e) => setEditionId(e.target.value)}>
              <option value="">— Gasto general —</option>
              {editionsByType?.map((ed) => {
                const typeName = courseTypes?.find((t) => t.id === ed.course_type_id)?.name;
                return (
                  <option key={ed.id} value={ed.id}>
                    {typeName ? `${typeName} — ` : ""}
                    {ed.name || new Date(ed.start_date).toLocaleDateString("es-AR")}
                  </option>
                );
              })}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha *">
            <TextInput type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseInput["category"])}>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

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

        <Field label="Descripción">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Notas">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

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
