import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, listStudents } from "../../lib/api/students";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { TextInput } from "../../components/ui/field";
import { StudentForm } from "./student-form";
import { STUDENT_STATUS_LABELS, type StudentInput, type StudentStatus } from "../../types/student";

const statusColor: Record<StudentStatus, "green" | "gray" | "brand"> = {
  activa: "green",
  inactiva: "gray",
  potencial: "brand",
};

export default function AlumnasList() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ["students", search],
    queryFn: () => listStudents(search),
  });

  const createMutation = useMutation({
    mutationFn: (input: StudentInput) => createStudent(input),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setCreating(false);
      navigate(`/alumnas/${student.id}`);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Alumnas</h1>
          <p className="text-sm text-gray-500">{students?.length ?? 0} en total</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Nueva alumna</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <TextInput
          placeholder="Buscar por nombre, DNI, email, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Contacto</th>
              <th className="text-left px-4 py-3 font-medium">Origen</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && students?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No hay alumnas todavía.
                </td>
              </tr>
            )}
            {students?.map((s) => (
              <tr
                key={s.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/alumnas/${s.id}`)}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {s.last_name}, {s.first_name}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.phone || s.email || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.source ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={statusColor[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StudentForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        saving={createMutation.isPending}
      />
    </div>
  );
}
