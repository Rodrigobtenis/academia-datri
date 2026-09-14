import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { GlobalSearch } from "./global-search";
import {
  IconHome,
  IconCalendar,
  IconCap,
  IconUsers,
  IconCamera,
  IconChat,
  IconPercent,
  IconChart,
  IconBriefcase,
  IconWallet,
  IconGear,
  IconMenu,
} from "./icons";

const mainNav = [
  { to: "/", label: "Dashboard", end: true, icon: IconHome },
  { to: "/agenda", label: "Agenda", icon: IconCalendar },
  { to: "/cursos", label: "Cursos", icon: IconCap },
  { to: "/alumnas", label: "Alumnas", icon: IconUsers },
  { to: "/modelos", label: "Modelos", icon: IconCamera },
  { to: "/crm", label: "CRM", icon: IconChat },
  { to: "/comisiones", label: "Comisiones", icon: IconPercent },
  { to: "/reportes", label: "Reportes", icon: IconChart },
];

const adminNav = [
  { to: "/gestion", label: "Gestión", icon: IconBriefcase },
  { to: "/gastos", label: "Gastos", icon: IconWallet },
  { to: "/configuracion", label: "Configuración", icon: IconGear },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, isAdmin, signOut } = useAuth();

  const linkClass = (isActive: boolean) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-white/15 text-white shadow-sm" : "text-brand-100/80 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-white font-serif text-lg italic shrink-0">
            D
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold leading-tight truncate">Academia Datri</p>
            <p className="text-[11px] text-brand-100/70 leading-tight">Gestión académica</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {mainNav.map(({ to, label, end, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-100/50">Gestión</p>
            </div>
            {adminNav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 pb-4 pt-3 border-t border-white/10 mx-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{profile?.full_name ?? "Sin nombre"}</p>
            <p className="text-[11px] text-brand-100/60 truncate">{isAdmin ? "Administradora" : "Empleada"}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-2 w-full text-left text-xs text-brand-100/70 hover:text-white px-1 py-1.5 rounded-md hover:bg-white/10 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden transition-opacity ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute inset-y-0 left-0 w-72 max-w-[80%] bg-gradient-to-b from-brand-800 to-brand-900 shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col bg-gradient-to-b from-brand-800 to-brand-900">
        <SidebarContent />
      </aside>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </MobileDrawer>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/80 backdrop-blur px-4 py-3 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex justify-center sm:justify-start">
            <GlobalSearch />
          </div>
        </header>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
