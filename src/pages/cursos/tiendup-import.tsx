import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Field, Select, TextInput } from "../../components/ui/field";
import { listCourseTypes } from "../../lib/api/courses";
import {
  findExistingEnrollment,
  findStudentCandidates,
  importSale,
  listImportedOrderNumbers,
  listOnlineEditions,
} from "../../lib/api/tiendup-import";
import { useAuth } from "../../lib/auth-context";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { MONTHS } from "../../lib/months";
import { PAYMENT_METHOD_LABELS } from "../../types/payment";
import type { CourseType } from "../../types/course";
import { decodeCsvBuffer, parseTiendupCsv, type TiendupSale } from "../../lib/tiendup/parse";
import { bestCourseMatch, mapPaymentMethod, normalizeText } from "../../lib/tiendup/match";

const MAP_KEY = "tiendup-course-map";

function loadSavedCourse(productName: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as Record<string, string>;
    return map[normalizeText(productName)] ?? null;
  } catch {
    return null;
  }
}

function saveCourse(productName: string, courseTypeId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as Record<string, string>;
    map[normalizeText(productName)] = courseTypeId;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // sin almacenamiento disponible: simplemente no se recuerda la elección
  }
}

type Outcome = { sale: TiendupSale; status: "cargada" | "saltada"; detail: string };

export function TiendupImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"upload" | "review" | "done">("upload");
  const [sales, setSales] = useState<TiendupSale[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<TiendupSale[]>([]);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const { data: courseTypes } = useQuery({ queryKey: ["course-types"], queryFn: listCourseTypes, enabled: open });

  function resetAll() {
    setPhase("upload");
    setSales([]);
    setAlreadyImported([]);
    setIndex(0);
    setOutcomes([]);
    setLoadError(null);
  }

  function handleClose() {
    if (outcomes.some((o) => o.status === "cargada")) {
      queryClient.invalidateQueries();
    }
    resetAll();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoadError(null);
    setReading(true);
    try {
      const parsed = parseTiendupCsv(decodeCsvBuffer(await file.arrayBuffer()));
      if (parsed.error) {
        setLoadError(parsed.error);
        return;
      }
      const imported = await listImportedOrderNumbers();
      setAlreadyImported(parsed.sales.filter((s) => imported.has(s.orderNumber)));
      const pending = parsed.sales.filter((s) => !imported.has(s.orderNumber));
      setSales(pending);
      if (pending.length === 0) setLoadError("Todas las ventas de este archivo ya fueron importadas antes.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function record(outcome: Outcome) {
    const next = [...outcomes, outcome];
    setOutcomes(next);
    if (index + 1 >= sales.length) setPhase("done");
    else setIndex(index + 1);
  }

  const loaded = outcomes.filter((o) => o.status === "cargada").length;

  return (
    <Dialog open={open} onClose={handleClose} title="Importar de Tiendup" wide>
      {phase === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Subí el CSV de ventas que exportás de Tiendup. Te voy mostrando una venta por vez para que
            confirmes los datos antes de cargarla. Solo se cargan cursos <strong>online</strong>.
          </p>
          <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1">
            <li>Si la persona ya está registrada, se deja como está (no se modifica nada de su ficha).</li>
            <li>Si es nueva, se crea como alumna.</li>
            <li>El curso se compara con las modalidades que ya existen; si no coincide, lo elegís vos.</li>
          </ul>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block text-sm"
          />
          {reading && <p className="text-sm text-gray-400">Leyendo archivo...</p>}
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {alreadyImported.length > 0 && (
            <p className="text-xs text-amber-600">
              {alreadyImported.length} venta{alreadyImported.length === 1 ? "" : "s"} del archivo ya se
              importaron antes (#{alreadyImported.map((s) => s.orderNumber).join(", #")}) y se omiten.
            </p>
          )}
          {sales.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Encontré <strong>{sales.length}</strong> venta{sales.length === 1 ? "" : "s"} para revisar.
              <div className="flex justify-end mt-3">
                <Button onClick={() => setPhase("review")}>Empezar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "review" && courseTypes && sales[index] && (
        <ReviewCard
          key={sales[index].key}
          sale={sales[index]}
          allSales={sales}
          position={index + 1}
          total={sales.length}
          courseTypes={courseTypes}
          onLoaded={(detail) => record({ sale: sales[index], status: "cargada", detail })}
          onSkip={() => record({ sale: sales[index], status: "saltada", detail: "Saltada" })}
          onCancel={() => setPhase("done")}
        />
      )}
      {phase === "review" && !courseTypes && <p className="text-sm text-gray-400">Cargando cursos...</p>}

      {phase === "done" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-800">
            Listo: <strong>{loaded}</strong> cargada{loaded === 1 ? "" : "s"},{" "}
            <strong>{outcomes.length - loaded}</strong> saltada{outcomes.length - loaded === 1 ? "" : "s"}
            {sales.length > outcomes.length ? `, ${sales.length - outcomes.length} sin revisar` : ""}.
          </p>
          <ul className="text-sm divide-y divide-gray-100">
            {outcomes.map((o) => (
              <li key={o.sale.key} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  #{o.sale.orderNumber} · {o.sale.firstName} {o.sale.lastName}
                </span>
                <span className={o.status === "cargada" ? "text-emerald-600" : "text-gray-400"}>{o.detail}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ReviewCard({
  sale,
  allSales,
  position,
  total,
  courseTypes,
  onLoaded,
  onSkip,
  onCancel,
}: {
  sale: TiendupSale;
  allSales: TiendupSale[];
  position: number;
  total: number;
  courseTypes: CourseType[];
  onLoaded: (detail: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const { profile } = useAuth();

  const { data: candidates, isLoading: loadingCandidates } = useQuery({
    queryKey: ["tiendup-candidates", sale.key],
    queryFn: () => findStudentCandidates(sale),
  });

  // --- Alumna ---
  const [studentChoice, setStudentChoice] = useState<string | null>(null);
  const studentSelection = studentChoice ?? candidates?.[0]?.student.id ?? "new";
  const [form, setForm] = useState({
    first_name: sale.firstName,
    last_name: sale.lastName,
    email: sale.email,
    phone: sale.phone,
  });
  const existing = candidates?.find((c) => c.student.id === studentSelection) ?? null;

  // --- Curso ---
  const auto = useMemo(() => {
    const savedId = loadSavedCourse(sale.productName);
    const saved = savedId ? courseTypes.find((c) => c.id === savedId) : null;
    if (saved) return { courseType: saved, how: "Elegido en una importación anterior" };
    const match = bestCourseMatch(sale.productName, courseTypes);
    return match ? { courseType: match.courseType, how: "Coincidencia automática por nombre" } : null;
  }, [sale.productName, courseTypes]);
  const [courseChoice, setCourseChoice] = useState<string | null>(null);
  const courseTypeId = courseChoice ?? auto?.courseType.id ?? "";

  const { data: editions } = useQuery({
    queryKey: ["tiendup-editions", courseTypeId],
    queryFn: () => listOnlineEditions(courseTypeId),
    enabled: Boolean(courseTypeId),
  });
  const month = Number(sale.paymentDate.slice(5, 7));
  const year = sale.paymentDate.slice(0, 4);
  const newEditionName = `${MONTHS[month - 1]} ${year}`;
  const sameMonthEdition = editions?.find((e) => e.start_date.slice(0, 7) === sale.paymentDate.slice(0, 7));
  const [editionChoice, setEditionChoice] = useState<string | null>(null);
  const editionSelection = editionChoice ?? sameMonthEdition?.id ?? "new";
  const selectedEdition = editions?.find((e) => e.id === editionSelection) ?? null;

  const { data: alreadyEnrolled } = useQuery({
    queryKey: ["tiendup-enrolled", studentSelection, editionSelection],
    queryFn: () => findExistingEnrollment(studentSelection, editionSelection),
    enabled: Boolean(existing && selectedEdition),
  });

  const duplicates = allSales.filter(
    (s) =>
      s.key !== sale.key &&
      s.email.trim().toLowerCase() === sale.email.trim().toLowerCase() &&
      normalizeText(s.productName) === normalizeText(sale.productName)
  );

  const importMutation = useMutation({
    mutationFn: () =>
      importSale({
        sale,
        existingStudentId: existing ? existing.student.id : null,
        newStudent: existing ? null : form,
        courseTypeId,
        editionId: selectedEdition ? selectedEdition.id : null,
        newEditionName,
        salesResponsible: profile?.id ?? null,
      }),
    onSuccess: (result) => {
      saveCourse(sale.productName, courseTypeId);
      const parts = [
        result.createdStudent ? "alumna nueva" : "alumna existente",
        result.createdEdition ? `edición ${newEditionName} creada` : null,
        result.paymentRegistered ? "pago registrado" : "sin pago",
      ].filter(Boolean);
      onLoaded(`Cargada (${parts.join(", ")})`);
    },
  });

  const method = sale.paymentMethod ? PAYMENT_METHOD_LABELS[mapPaymentMethod(sale.paymentMethod)] : "—";
  const courseName = courseTypes.find((c) => c.id === courseTypeId)?.name;
  const nameMissing = !existing && (!form.first_name.trim() || !form.last_name.trim());
  const blockers: string[] = [];
  if (sale.currency !== "ARS") blockers.push(`La venta es en ${sale.currency}: por ahora solo se importan ventas en pesos.`);
  if (!courseTypeId) blockers.push("Elegí a qué curso corresponde.");
  if (nameMissing) blockers.push("Faltan el nombre o el apellido de la alumna.");
  if (alreadyEnrolled) blockers.push("Esta alumna ya está inscripta en esa edición.");
  const busy = importMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Venta {position} de {total} · Tiendup #{sale.orderNumber}
        </h3>
        <Badge color={sale.isPaid ? "green" : "amber"}>{sale.paymentStatus || "Sin estado"}</Badge>
      </div>

      <section className="rounded-lg border border-gray-200 p-4 text-sm space-y-1">
        <div className="font-medium text-gray-900">{sale.productName}</div>
        <div className="text-gray-600">
          {formatDateAR(sale.paymentDate)} · {formatMoney(sale.totalAmount)} · {method}
          {sale.quantity > 1 ? ` · cantidad ${sale.quantity}` : ""}
        </div>
        {sale.quantity > 1 && (
          <div className="text-xs text-amber-600">
            Compró más de una unidad: se carga una sola inscripción por el monto total.
          </div>
        )}
        {!sale.isPaid && (
          <div className="text-xs text-amber-600">
            El pago figura como {sale.paymentStatus.toLowerCase() || "sin confirmar"}: se cargaría la inscripción
            como reservada y sin pago.
          </div>
        )}
        {sale.isPaid && sale.totalAmount === 0 && (
          <div className="text-xs text-amber-600">Venta en $0 (sin cobro): se carga la inscripción sin registrar pago.</div>
        )}
        {duplicates.length > 0 && (
          <div className="text-xs text-amber-600">
            En este archivo hay otra venta de la misma persona y producto:{" "}
            {duplicates.map((d) => `#${d.orderNumber} (${d.paymentStatus})`).join(", ")}.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-gray-500">Alumna</h4>
        {loadingCandidates && <p className="text-sm text-gray-400">Buscando en la base...</p>}
        {candidates?.map((c) => (
          <label key={c.student.id} className="flex items-start gap-2 text-sm rounded-lg border border-gray-200 p-3">
            <input
              type="radio"
              name="student"
              className="mt-1"
              checked={studentSelection === c.student.id}
              onChange={() => setStudentChoice(c.student.id)}
            />
            <span>
              <span className="font-medium text-gray-900">
                Ya registrada: {c.student.last_name}, {c.student.first_name}
              </span>
              <span className="block text-xs text-gray-500">
                {[c.student.email, c.student.phone].filter(Boolean).join(" · ") || "Sin contacto cargado"}
              </span>
              <span className={`block text-xs ${c.reasons.length === 1 && c.reasons[0] === "mismo nombre" ? "text-amber-600" : "text-emerald-600"}`}>
                {c.reasons.join(" + ")}
                {c.reasons.length === 1 && c.reasons[0] === "mismo nombre" ? " — solo coincide el nombre, revisá que sea la misma persona" : ""}
              </span>
            </span>
          </label>
        ))}
        {candidates && (
          <label className="flex items-start gap-2 text-sm rounded-lg border border-gray-200 p-3">
            <input
              type="radio"
              name="student"
              className="mt-1"
              checked={studentSelection === "new"}
              onChange={() => setStudentChoice("new")}
            />
            <span className="font-medium text-gray-900">
              {candidates.length === 0 ? "Alumna nueva (no está en la base)" : "Es otra persona: crear alumna nueva"}
            </span>
          </label>
        )}

        {existing ? (
          <p className="text-xs text-gray-500">Se deja como está: no se modifica nada de su ficha.</p>
        ) : (
          candidates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Field label="Nombre *">
                <TextInput value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </Field>
              <Field label="Apellido *">
                <TextInput value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Field>
              <Field label="Email">
                <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
          )
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-gray-500">Curso</h4>
        {auto && !courseChoice && <p className="text-xs text-emerald-600">{auto.how}.</p>}
        {!auto && !courseChoice && (
          <p className="text-xs text-amber-600">No encontré un curso parecido a este producto: elegí a cuál corresponde.</p>
        )}
        <Select value={courseTypeId} onChange={(e) => { setCourseChoice(e.target.value); setEditionChoice(null); }}>
          <option value="">— Elegir curso —</option>
          {courseTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {courseTypeId && editions && (
          <Select value={editionSelection} onChange={(e) => setEditionChoice(e.target.value)}>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                Edición online: {e.name || formatDateAR(e.start_date)}
              </option>
            ))}
            <option value="new">Crear edición online nueva: {newEditionName}</option>
          </Select>
        )}
        {courseTypeId && editionSelection === "new" && (
          <p className="text-xs text-gray-500">
            Se crea la edición online «{newEditionName}» de {courseName} (abierta, sin cupo límite) para que cuente en
            ese mes.
          </p>
        )}
      </section>

      <section className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
        <div className="font-medium mb-1">Se va a cargar</div>
        <div>
          Inscripción de {existing ? `${existing.student.first_name} ${existing.student.last_name}` : `${form.first_name} ${form.last_name}`.trim() || "la alumna"} en{" "}
          {courseName ?? "—"} (online), precio final {formatMoney(sale.totalAmount)}
          {sale.isPaid && sale.totalAmount > 0
            ? `, con un pago de ${formatMoney(sale.totalAmount)} del ${formatDateAR(sale.paymentDate)} (${method}).`
            : ", sin pago registrado."}
        </div>
      </section>

      {blockers.map((b) => (
        <p key={b} className="text-sm text-red-600">
          {b}
        </p>
      ))}
      {importMutation.isError && (
        <p className="text-sm text-red-600">
          {importMutation.error instanceof Error ? importMutation.error.message : "No se pudo cargar la venta."}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button type="button" className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={onCancel} disabled={busy}>
          Terminar acá
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onSkip} disabled={busy}>
            Saltar
          </Button>
          <Button onClick={() => importMutation.mutate()} disabled={busy || blockers.length > 0 || loadingCandidates}>
            {busy ? "Cargando..." : "Cargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
