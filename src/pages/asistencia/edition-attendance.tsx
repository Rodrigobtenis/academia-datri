import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listEnrollmentsByEdition } from "../../lib/api/enrollments";
import {
  listAttendanceDates,
  listAttendanceForDate,
  listCertificates,
  setAttendance,
  setCertificateStatus,
} from "../../lib/api/attendance";
import { Select } from "../../components/ui/field";
import {
  ATTENDANCE_STATUS_LABELS,
  CERTIFICATE_STATUS_LABELS,
  type AttendanceStatus,
  type CertificateStatus,
} from "../../types/attendance";

const today = () => new Date().toISOString().slice(0, 10);

export function EditionAttendance({ editionId }: { editionId: string }) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(today());

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments", editionId],
    queryFn: () => listEnrollmentsByEdition(editionId),
  });

  const activeEnrollments = (enrollments ?? []).filter((e) => e.status !== "cancelada" && e.status !== "no_asistio");

  const { data: dates } = useQuery({
    queryKey: ["attendance-dates", editionId],
    queryFn: () => listAttendanceDates(editionId),
  });

  useEffect(() => {
    if (dates && dates.length > 0 && !dates.includes(selectedDate)) {
      setSelectedDate(dates[dates.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates]);

  const { data: attendanceForDate } = useQuery({
    queryKey: ["attendance", editionId, selectedDate],
    queryFn: () => listAttendanceForDate(editionId, selectedDate),
  });

  const { data: certificates } = useQuery({
    queryKey: ["certificates", editionId],
    queryFn: () => listCertificates(editionId),
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: AttendanceStatus }) =>
      setAttendance(studentId, editionId, selectedDate, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", editionId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["attendance-dates", editionId] });
    },
  });

  const certificateMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: CertificateStatus }) =>
      setCertificateStatus(studentId, editionId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["certificates", editionId] }),
  });

  function attendanceStatusFor(studentId: string): AttendanceStatus | "" {
    return attendanceForDate?.find((a) => a.student_id === studentId)?.status ?? "";
  }

  function certificateStatusFor(studentId: string): CertificateStatus {
    return certificates?.find((c) => c.student_id === studentId)?.status ?? "pendiente";
  }

  function addDate(date: string) {
    if (!date) return;
    setSelectedDate(date);
  }

  if (activeEnrollments.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Asistencia y certificados</h2>
        <p className="text-sm text-gray-400">Todavía no hay alumnas inscriptas.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Asistencia y certificados</h2>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {dates?.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`text-xs rounded-full px-3 py-1 ${
              d === selectedDate ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {new Date(d).toLocaleDateString("es-AR")}
          </button>
        ))}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => addDate(e.target.value)}
          className="text-xs border border-gray-300 rounded-full px-2 py-1"
        />
      </div>

      <div className="divide-y divide-gray-100">
        <div className="grid grid-cols-3 gap-4 pb-2 text-xs text-gray-400 uppercase">
          <span>Alumna</span>
          <span>Asistencia ({new Date(selectedDate).toLocaleDateString("es-AR")})</span>
          <span>Certificado</span>
        </div>
        {activeEnrollments.map((e) => (
          <div key={e.id} className="grid grid-cols-3 gap-4 py-2 items-center text-sm">
            <span className="font-medium text-gray-900">
              {e.students?.last_name}, {e.students?.first_name}
            </span>
            <Select
              value={attendanceStatusFor(e.student_id)}
              onChange={(ev) =>
                attendanceMutation.mutate({ studentId: e.student_id, status: ev.target.value as AttendanceStatus })
              }
              className="!py-1 text-xs"
            >
              <option value="">— Marcar —</option>
              {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={certificateStatusFor(e.student_id)}
              onChange={(ev) =>
                certificateMutation.mutate({ studentId: e.student_id, status: ev.target.value as CertificateStatus })
              }
              className="!py-1 text-xs"
            >
              {Object.entries(CERTIFICATE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </section>
  );
}
