import { useEffect, useMemo, useRef, useState } from "react";
import { TextInput } from "../../components/ui/field";
import type { Service } from "../../types/service";

// Buscador de servicio con resultados agrupados por categoría — reemplaza un <select> plano
// porque con ~190 servicios cargados, escribir y filtrar es mucho más usable que scrollear
// un desplegable gigante. Se usa tanto al crear un turno como al reprogramarlo.
export function ServicePicker({
  services,
  selectedId,
  onSelect,
}: {
  services: Service[];
  selectedId: string;
  onSelect: (service: Service) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = services.find((s) => s.id === selectedId);

  useEffect(() => {
    if (!open) setQuery(selected ? selected.name : "");
  }, [selected, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
    const groups = new Map<string, Service[]>();
    for (const s of filtered) {
      const key = s.category || "Sin categoría";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services, query]);

  function pick(s: Service) {
    onSelect(s);
    setQuery(s.name);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <TextInput
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar servicio..."
        required
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {matching.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin resultados.</div>}
          {matching.map(([category, group]) => (
            <div key={category}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
                {category}
              </div>
              {group.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start justify-between gap-2"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{s.duration_minutes} min</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
