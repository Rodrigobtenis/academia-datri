import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { convertLeadToStudent, createLead, listLeads, updateLead } from "../../lib/api/leads";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Select } from "../../components/ui/field";
import { LeadForm } from "./lead-form";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, type Lead, type LeadInput, type LeadStatus } from "../../types/lead";

const today = new Date().toISOString().slice(0, 10);

export default function CrmPage() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "todas">("todas");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({ queryKey: ["leads"], queryFn: listLeads });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  const createMutation = useMutation({
    mutationFn: (input: LeadInput) => createLead(input),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<LeadInput> }) => updateLead(id, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const convertMutation = useMutation({
    mutationFn: (lead: Lead) => convertLeadToStudent(lead),
    onSuccess: ({ student }) => {
      invalidate();
      navigate(`/alumnas/${student.id}`);
    },
  });

  const filtered = useMemo(
    () => (filter === "todas" ? leads : leads?.filter((l) => l.status === filter)),
    [leads, filter]
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">CRM — Potenciales alumnas</h1>
          <p className="text-sm text-gray-500">{leads?.length ?? 0} consultas registradas</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Nueva consulta</Button>
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as LeadStatus | "todas")}>
          <option value="todas">Todos los estados</option>
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Contacto</th>
              <th className="text-left px-4 py-3 font-medium">Curso</th>
              <th className="text-left px-4 py-3 font-medium">Seguimiento</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && filtered?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay consultas con este filtro.
                </td>
              </tr>
            )}
            {filtered?.map((lead) => {
              const overdue = lead.next_followup && lead.next_followup <= today && lead.status !== "inscripta" && lead.status !== "perdida";
              return (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td
                    className="px-4 py-2 font-medium text-gray-900 cursor-pointer"
                    onClick={() => setEditing(lead)}
                  >
                    {lead.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{lead.phone || lead.whatsapp || lead.instagram || "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{lead.course_types?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {lead.next_followup ? (
                      <span className={overdue ? "text-red-600 font-medium" : "text-gray-600"}>
                        {new Date(lead.next_followup).toLocaleDateString("es-AR")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={LEAD_STATUS_COLORS[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {lead.status !== "inscripta" && !lead.converted_student_id && (
                      <Button
                        variant="secondary"
                        onClick={() => convertMutation.mutate(lead)}
                        disabled={convertMutation.isPending}
                      >
                        Convertir en alumna
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LeadForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        saving={createMutation.isPending}
      />

      {editing && (
        <LeadForm
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(values) => updateMutation.mutate({ id: editing.id, input: values })}
          initial={editing}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
