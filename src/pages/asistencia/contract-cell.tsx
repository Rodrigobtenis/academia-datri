import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, getSignedUrl, uploadDocument } from "../../lib/api/documents";
import { useAuth } from "../../lib/auth-context";
import { emitError } from "../../lib/toast-bus";
import type { DocumentRow } from "../../types/document";

// Estado del contrato de una inscripción: "Contrato adjuntado" (con Ver / Reemplazar)
// o "Falta contrato" (con Adjuntar). Siempre PDF.
export function ContractCell({
  enrollmentId,
  contract,
  editionId,
}: {
  enrollmentId: string;
  contract: DocumentRow | undefined;
  editionId: string;
}) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      await uploadDocument({ file, type: "contrato", enrollmentId, uploadedBy: profile?.id ?? null });
      // Reemplazo: el contrato anterior se borra recién cuando el nuevo ya está subido.
      if (contract) await deleteDocument(contract);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts", editionId] }),
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      emitError("El contrato tiene que ser un archivo PDF.");
      return;
    }
    uploadMutation.mutate(file);
  }

  async function handleView() {
    if (!contract) return;
    // Se abre la pestaña de inmediato (dentro del click) para que el navegador no la bloquee.
    const win = window.open("", "_blank");
    try {
      const url = await getSignedUrl(contract.file_url);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      win?.close();
      emitError(err instanceof Error ? err.message : "No se pudo abrir el contrato.");
    }
  }

  const uploading = uploadMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          contract ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {contract ? "Contrato adjuntado" : "Falta contrato"}
      </span>
      {contract && (
        <button type="button" onClick={handleView} className="text-xs text-brand-600 hover:text-brand-700">
          Ver
        </button>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-60"
      >
        {uploading ? "Subiendo..." : contract ? "Reemplazar" : "Adjuntar PDF"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
