import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { globalSearch, SEARCH_KIND_LABELS, type SearchResultKind } from "../lib/api/search";
import { IconSearch } from "./icons";

const KIND_DOT: Record<SearchResultKind, string> = {
  alumna: "bg-brand-500",
  modelo: "bg-violet-500",
  lead: "bg-amber-500",
  modalidad: "bg-sky-500",
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.trim().length >= 2,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showResults = open && debounced.trim().length >= 2;

  function go(href: string) {
    navigate(href);
    setTerm("");
    setDebounced("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar alumna, modelo, lead, modalidad..."
          className="w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
        />
      </div>

      {showResults && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {isFetching && (
            <div className="px-4 py-3 text-xs text-gray-400">Buscando...</div>
          )}
          {!isFetching && (results?.length ?? 0) === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400">Sin resultados para "{debounced}"</div>
          )}
          {!isFetching &&
            results?.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r.href)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[r.kind]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-800 truncate">{r.title}</span>
                  {r.subtitle && <span className="block text-xs text-gray-400 truncate">{r.subtitle}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">
                  {SEARCH_KIND_LABELS[r.kind]}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
