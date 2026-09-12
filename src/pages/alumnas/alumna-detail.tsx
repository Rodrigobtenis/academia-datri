import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getStudent, updateStudent } from "../../lib/api/students";
import { listEnrollmentsByStudent } from "../../lib/api/enrollments";
import { listPaymentsByStudent } from "../../lib/api/payments";
import { listAttendanceByStudent, listCertificatesByStudent } from "../../lib/api/attendance";
import { ATTENDANCE_STATUS_LABELS, CERTIFICATE_STATUS_LABELS } from "../../types/attendance";
import { sumMoney } from "../../lib/money";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { StudentForm } from "./student-form";
import { formatMoney } from "../../lib/money";
import { formatDateAR } from "../../lib/date-ar";
import {
  STUDENT_SOURCE_LABELS,
  STUDENT_STATUS_LABELS,
  type StudentInput,
  type StudentStatus,
} from "../../types/student";
import { ENROLLMENT_STATUS_COLORS, ENROLLMENT_STATUS_LABELS } from "../../types/enrollment";

const statusColor: Record<StudentStatus, "green" | "gray" | "brand"> = {
  activa: "green",
  inactiva: "gray",
  potencial: "brand",
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm text-gray-800">{value || "—"}</div>
    </div>
  );
}

export default function AlumnaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getStudent(id!),
    enabled: Boolean(id),
  });

  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", id],
    queryFn: () => listEnrollmentsByStudent(id!),
    enabled: Boolean(id),
  });

  const { data: payments } = useQuery({
    queryKey: ["student-payments", id],
    queryFn: () => listPaymentsByStudent(id!),
    enabled: Boolean(id),
  });

  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", id],
    queryFn: () => listAttendanceByStudent(id!),
    enabled: Boolean(id),
  });

  const { data: certificates } = useQuery({
    queryKey: ["student-certificates", id],
    queryFn: () => listCertificatesByStudent(id!),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (input: StudentInput) => updateStudent(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setEditing(false);
    },
  });

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>;
  if (!student) return <div className="p-8 text-gray-400 text-sm">No se encontró la alumna.</div>;

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate("/alumnas")}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← Alumnas
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {student.last_name}, {student.first_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge color={statusColor[student.status]}>{STUDENT_STATUS_LABELS[student.status]}</Badge>
            {student.source && (
              <span className="text-xs text-gray-400">
                vía {STUDENT_SOURCE_LABELS[student.source]}
              </span>
            )}
          </div>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Datos personales</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="DNI" value={student.dni} />
              <InfoRow label="Fecha de nacimiento" value={student.birth_date} />
              <InfoRow label="Teléfono" value={student.phone} />
              <InfoRow label="WhatsApp" value={student.whatsapp} />
              <InfoRow label="Email" value={student.email} />
              <InfoRow label="Instagram" value={student.instagram} />
              <InfoRow
                label="Ubicación"
                value={[student.city, student.province, student.country].filter(Boolean).join(", ")}
              />
              <InfoRow label="Profesión" value={student.profession} />
              <InfoRow label="Especialidad" value={student.specialty} />
            </div>
            {student.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-400 mb-1">Notas</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{student.notes}</div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Cursos e inscripciones</h2>
              {enrollments && (
                <Badge color={enrollments.length > 1 ? "brand" : "gray"}>
                  {enrollments.length === 0
                    ? "Sin cursos"
                    : enrollments.length === 1
                      ? "Primera vez"
                      : "Alumna recurrente"}
                </Badge>
              )}
            </div>
            {(!enrollments || enrollments.length === 0) && (
              <p className="text-sm text-gray-400">Todavía no tiene inscripciones.</p>
            )}
            <div className="space-y-2">
              {enrollments?.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate(`/inscripciones/${e.id}`)}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100"
                >
                  <span className="text-sm text-gray-800">
                    {e.course_editions?.name ||
                      (e.course_editions ? formatDateAR(e.course_editions.start_date) : "—")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{formatMoney(e.final_price)}</span>
                    <Badge color={ENROLLMENT_STATUS_COLORS[e.status]}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Pagos y deuda</h2>
            {(() => {
              const totalPaid = sumMoney(
                (payments ?? []).filter((p) => p.status === "valido").map((p) => p.amount)
              );
              const totalOwed = sumMoney(
                (enrollments ?? [])
                  .filter((e) => e.status !== "cancelada")
                  .map((e) => e.final_price)
              );
              const debt = Math.max(0, totalOwed - totalPaid);
              return (
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400">Total pagado histórico</div>
                    <div className="font-semibold text-emerald-600">{formatMoney(totalPaid)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400">Deuda actual</div>
                    <div className={`font-semibold ${debt > 0 ? "text-amber-600" : "text-gray-900"}`}>
                      {formatMoney(debt)}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="divide-y divide-gray-100">
              {(!payments || payments.length === 0) && (
                <p className="text-sm text-gray-400">Sin pagos registrados.</p>
              )}
              {payments?.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span className={p.status === "anulado" ? "line-through text-gray-400" : "text-gray-700"}>
                    {formatDateAR(p.payment_date)} · {formatMoney(p.amount)}
                  </span>
                  <button
                    className="text-xs text-brand-600 hover:text-brand-700"
                    onClick={() => navigate(`/inscripciones/${p.enrollment_id}`)}
                  >
                    ver inscripción
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Asistencia</h2>
            {(!attendance || attendance.length === 0) ? (
              <p className="text-sm text-gray-400">Sin registros de asistencia.</p>
            ) : (
              <div className="space-y-1">
                {attendance.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{formatDateAR(a.attendance_date)}</span>
                    <span className="text-gray-800">{ATTENDANCE_STATUS_LABELS[a.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Certificados</h2>
            {(!certificates || certificates.length === 0) ? (
              <p className="text-sm text-gray-400">Sin certificados.</p>
            ) : (
              <div className="space-y-1">
                {certificates.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {c.course_editions?.name || (c.course_editions ? formatDateAR(c.course_editions.start_date) : "—")}
                    </span>
                    <span className="text-gray-800">{CERTIFICATE_STATUS_LABELS[c.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Alta</h2>
            <InfoRow label="Fecha de alta" value={new Date(student.created_at).toLocaleDateString("es-AR")} />
          </section>
        </div>
      </div>

      <StudentForm
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={(values) => updateMutation.mutate(values)}
        initial={student}
        saving={updateMutation.isPending}
      />
    </div>
  );
}
