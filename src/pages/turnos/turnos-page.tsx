import { useState } from "react";
import { CalendarView } from "./calendar-view";
import { ProfessionalsList } from "./professionals-list";
import { ServicesList } from "./services-list";

type Tab = "calendario" | "profesionales" | "servicios";

const TABS: { id: Tab; label: string }[] = [
  { id: "calendario", label: "Calendario" },
  { id: "profesionales", label: "Profesionales" },
  { id: "servicios", label: "Servicios" },
];

export default function TurnosPage() {
  const [tab, setTab] = useState<Tab>("calendario");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Turnos</h1>
        <p className="text-sm text-gray-500">Agenda del estudio — clientas, profesionales y servicios.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calendario" && <CalendarView />}
      {tab === "profesionales" && <ProfessionalsList />}
      {tab === "servicios" && <ServicesList />}
    </div>
  );
}
