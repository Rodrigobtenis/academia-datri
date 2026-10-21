import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Field, Select, TextInput } from "../../components/ui/field";
import { getOccupancy, listCourseTypes } from "../../lib/api/courses";
import {
  findExistingEnrollment,
  findStudentCandidates,
  importSale,
  listImportedOrderNumbers,
  listEditionsForImport,
  type ImportModality,
} from "../../lib/api/tiendup-import";
import { useAuth } from "../../lib/auth-context";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import { PAYMENT_METHOD_LABELS } from "../../types/payment";
import type { CourseType } from "../../types/course";
import { decodeCsvBuffer, parseTiendupCsv, type TiendupSale } from "../../lib/tiendup/parse";
import { bestCourseMatch, mapPaymentMethod, normalizeText } from "../../lib/tiendup/match";

const MAP_KEY = "tiendup-course-map";

interface SavedCourse {
  courseTypeId: string;
  modality: ImportModality;
}

function loadSavedCourse(productName: string): SavedCourse | null {
  try {
    const map = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as Record<string, string | SavedCourse>;
    const saved = map[normalizeText(productName)];
    if (!saved) return null;
    return typeof saved === "string" ? { courseTypeId: saved, modality: "online" } : saved;
  } catch {
    return null;
  }
}

function saveCourse(productName: string, saved: SavedCourse) {
  try {
    const map = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as Record<string, string | SavedCourse>;
    map[normalizeText(productName)] = saved;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // sin almacenamiento disponible: simplemente no se recuerda la elección
  }
}

export interface DuplicateSale {
  sale: TiendupSale;
  of: TiendupSale;
}

// Una persona puede comprar varios cursos: cada venta se identifica por su número. Solo se
// considera duplicada una venta de la MISMA persona y el MISMO producto que sobra: el mismo
// número repetido, o un intento sin pagar (Pendiente) cuando ya hay una Pagada. Si la misma
// persona tiene dos ventas pagadas del mismo producto no se descarta ninguna (se avisa en la
// revisión para que decida).
function personKey(s: TiendupSale) {
  return s.email.trim().toLowerCase() || normalizeText(`${s.firstName} ${s.lastName}`);
}

function splitDuplicates(all: TiendupSale[]): { unique: TiendupSale[]; duplicates: DuplicateSale[] } {
  const groups = new Map<string, TiendupSale[]>();
  for (const s of all) {
    const k = `${personKey(s)}|${normalizeText(s.productName)}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const duplicates: DuplicateSale[] = [];
  const dropped = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const byNumber = [...group].sort((a, b) => Number(a.orderNumber) - Number(b.orderNumber));
    const paid = byNumber.filter((s) => s.isPaid);
    const primary = paid[0] ?? byNumber[0];
    const seenNumbers = new Set<string>();
    for (const s of byNumber) {
      const repeatedNumber = seenNumbers.has(s.orderNumber);
      seenNumbers.add(s.orderNumber);
      const unpaidWhilePaidExists = !s.isPaid && paid.length > 0;
      const extraUnpaid = !s.isPaid && paid.length === 0 && s.key !== primary.key;
      if (s.key !== primary.key && (repeatedNumber || unpaidWhilePaidExists || extraUnpaid)) {
        dropped.add(s.key);
        duplicates.push({ sale: s, of: primary });
      }
    }
  }
  return { unique: all.filter((s) => !dropped.has(s.key)), duplicates };
}

type Outcome = { sale: TiendupSale; status: "cargada" | "saltada"; detail: string };

export function TiendupImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"upload" | "review" | "done">("upload");
  const [sales, setSales] = useState<TiendupSale[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<TiendupSale[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateSale[]>([]);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const { data: courseTypes } = useQuery({ queryKey: ["course-types"], queryFn: listCourseTypes, enabled: open });

  function resetAll() {
    setPhase("upload");
    setSales([]);
    setAlreadyImported([]);
    setDuplicates([]);
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
      const { unique, duplicates: dups } = splitDuplicates(parsed.sales.filter((s) => !imported.has(s.orderNumber)));
      setDuplicates(dups);
      setSales(unique);
      if (unique.length === 0) setLoadError("No quedan ventas para cargar: todas ya se importaron o están duplicadas.");
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
            confirmes los datos antes de cargarla. Se cargan cursos <strong>online</strong> y <strong>presenciales</strong>.
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
          <DuplicateNotice duplicates={duplicates} />
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
          <DuplicateNotice duplicates={duplicates} />
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

function DuplicateNotice({ duplicates }: { duplicates: DuplicateSale[] }) {
  if (duplicates.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
      <div className="font-medium">
        {duplicates.length === 1 ? "Venta duplicada, no se carga:" : "Ventas duplicadas, no se cargan:"}
      </div>
      {duplicates.map((d) => (
        <div key={d.sale.key}>
          Venta #{d.sale.orderNumber} ({d.sale.paymentStatus || "sin estado"}) es duplicada de la #{d.of.orderNumber} (
          {d.of.paymentStatus || "sin estado"}) — {d.sale.firstName} {d.sale.lastName}, {d.sale.productName}.
        </div>
      ))}
    </div>
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
    const saved = loadSavedCourse(sale.productName);
    const savedType = saved ? courseTypes.find((c) => c.id === saved.courseTypeId) : null;
    if (saved && savedType) {
      return { courseType: savedType, modality: saved.modality, how: "Elegido en una importación anterior" };
    }
    const match = bestCourseMatch(sale.productName, courseTypes);
    const guessed: ImportModality = normalizeText(sale.productName).includes("presencial") ? "presencial" : "online";
    return match ? { courseType: match.courseType, modality: guessed, how: "Coincidencia automática por nombre" } : null;
  }, [sale.productName, courseTypes]);
  const [courseChoice, setCourseChoice] = useState<string | null>(null);
  const courseTypeId = courseChoice ?? auto?.courseType.id ?? "";
  const [modalityChoice, setModalityChoice] = useState<ImportModality | null>(null);
  const modality: ImportModality =
    modalityChoice ?? auto?.modality ?? (normalizeText(sale.productName).includes("presencial") ? "presencial" : "online");

  const { data: editions } = useQuery({
    queryKey: ["tiendup-editions", courseTypeId, modality],
    queryFn: () => listEditionsForImport(courseTypeId, modality),
    enabled: Boolean(courseTypeId),
  });
  // Online: la edición del mismo mes de la venta (si no hay, la más reciente). Presencial: la
  // próxima edición desde la fecha de la venta (o la última si ya pasaron todas). Siempre
  // tiene que ser una edición que ya exista: no se crean desde la importación.
  const defaultEdition =
    modality === "online"
      ? (editions?.find((e) => e.start_date.slice(0, 7) === sale.paymentDate.slice(0, 7)) ?? editions?.[0])
      : (editions?.find((e) => e.start_date >= sale.paymentDate) ?? editions?.[editions.length - 1]);
  const [editionChoice, setEditionChoice] = useState<string | null>(null);
  const editionSelection = editionChoice ?? defaultEdition?.id ?? "";
  const selectedEdition = editions?.find((e) => e.id === editionSelection) ?? null;

  const { data: occupancy } = useQuery({
    queryKey: ["tiendup-occupancy", selectedEdition?.id],
    queryFn: () => getOccupancy(selectedEdition!.id),
    enabled: modality === "presencial" && Boolean(selectedEdition),
  });

  const { data: alreadyEnrolled } = useQuery({
    queryKey: ["tiendup-enrolled", studentSelection, editionSelection],
    queryFn: () => findExistingEnrollment(studentSelection, editionSelection),
    enabled: Boolean(existing && selectedEdition),
  });

  const otherPurchases = allSales.filter((s) => s.key !== sale.key && personKey(s) === personKey(sale));

  const importMutation = useMutation({
    mutationFn: () =>
      importSale({
        sale,
        existingStudentId: existing ? existing.student.id : null,
        newStudent: existing ? null : form,
        courseTypeId,
        modality,
        editionId: selectedEdition!.id,
        salesResponsible: profile?.id ?? null,
      }),
    onSuccess: (result) => {
      saveCourse(sale.productName, { courseTypeId, modality });
      const parts = [
        result.createdStudent ? "alumna nueva" : "alumna existente",
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
  if (courseTypeId && editions && !selectedEdition) {
    blockers.push(
      `Este curso no tiene ninguna edición ${modality === "online" ? "online" : "presencial abierta"}: tiene que existir antes de importar la venta (creala en Cursos).`
    );
  }
  if (occupancy && occupancy.available <= 0) {
    blockers.push("La edición presencial está completa (sin cupos): cargala desde la edición con la opción de superar el cupo.");
  }
  if (alreadyEnrolled) blockers.push(`Venta #${sale.orderNumber} duplicada: esta alumna ya está inscripta en esa edición, no se carga.`);
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
        {otherPurchases.length > 0 && (
          <div className="text-xs text-gray-500 pt-1">
            Otras compras de esta persona en el archivo:
            <ul className="list-disc pl-5">
              {otherPurchases.map((o) => (
                <li key={o.key} className={normalizeText(o.productName) === normalizeText(sale.productName) ? "text-amber-600" : ""}>
                  Venta #{o.orderNumber} · {o.productName} · {o.paymentStatus || "sin estado"}
                  {normalizeText(o.productName) === normalizeText(sale.productName) ? " — mismo producto, revisá que no sea una repetida" : ""}
                </li>
              ))}
            </ul>
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
        {courseTypeId && (
          <Select
            value={modality}
            onChange={(e) => {
              setModalityChoice(e.target.value as ImportModality);
              setEditionChoice(null);
            }}
          >
            <option value="online">Modalidad: Online</option>
            <option value="presencial">Modalidad: Presencial</option>
          </Select>
        )}
        {courseTypeId && editions && (
          <Select value={editionSelection} onChange={(e) => setEditionChoice(e.target.value)}>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {modality === "online"
                  ? `Edición online: ${e.name || formatDateAR(e.start_date)}`
                  : `${e.name || "Edición"} · ${formatDateAR(e.start_date)}${e.location ? ` · ${e.location}` : ""}`}
              </option>
            ))}
          </Select>
        )}
        {occupancy && modality === "presencial" && (
          <p className="text-xs text-gray-500">
            Cupos: {occupancy.enrolled_count}/{occupancy.max_students} ocupados.
          </p>
        )}
      </section>

      <section className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
        <div className="font-medium mb-1">Se va a cargar</div>
        <div>
          Inscripción de {existing ? `${existing.student.first_name} ${existing.student.last_name}` : `${form.first_name} ${form.last_name}`.trim() || "la alumna"} en{" "}
          {courseName ?? "—"} ({modality === "online" ? "online" : "presencial"}), precio final {formatMoney(sale.totalAmount)}
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
