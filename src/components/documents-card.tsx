import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDocument,
  getSignedUrl,
  listDocumentsByEnrollment,
  listDocumentsByStudent,
  uploadDocument,
} from "../lib/api/documents";
import { Select } from "./ui/field";
import { DOCUMENT_TYPE_LABELS, type DocumentRow, type DocumentType } from "../types/document";
import { useAuth } from "../lib/auth-context";

export function DocumentsCard({ studentId, enrollmentId }: { studentId?: string; enrollmentId?: string }) {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>("comprobante");
  const [error, setError] = useState<string | null>(null);

  const queryKey = studentId ? ["documents-student", studentId] : ["documents-enrollment", enrollmentId];

  const { data: documents } = useQuery({
    queryKey,
    queryFn: () => (studentId ? listDocumentsByStudent(studentId) : listDocumentsByEnrollment(enrollmentId!)),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument({ file, type, studentId, enrollmentId, uploadedBy: profile?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (doc: DocumentRow) => deleteDocument(doc),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function handleView(doc: DocumentRow) {
    const url = await getSignedUrl(doc.file_url);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Documentación</h2>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className="!py-1.5 text-xs w-44">
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => e.target.files?.[0] && uploadMutation.mutate(e.target.files[0])}
          className="text-xs"
        />
        {uploadMutation.isPending && <span className="text-xs text-gray-400">Subiendo...</span>}
      </div>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {(!documents || documents.length === 0) ? (
        <p className="text-sm text-gray-400">Sin documentos adjuntos.</p>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between text-sm py-1">
              <button onClick={() => handleView(doc)} className="text-brand-600 hover:text-brand-700 text-left">
                {DOCUMENT_TYPE_LABELS[doc.type]}
              </button>
              {isAdmin && (
                <button
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(doc)}
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
