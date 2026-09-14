import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const mainNav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/agenda", label: "Agenda" },
  { to: "/cursos", label: "Cursos" },
  { to: "/alumnas", label: "Alumnas" },
  { to: "/crm", label: "CRM" },
  { to: "/comisiones", label: "Comisiones" },
  { to: "/reportes", label: "Reportes" },
];

const adminNav = [
  { to: "/gestion", label: "Gestión" },
  { to: "/gastos", label: "Gastos" },
  { to: "/configuracion", label: "Configuración" },
];

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="font-semibold text-gray-900">Academia Datri</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Privado
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 mb-2 text-xs text-gray-500 truncate">
            {profile?.full_name ?? "Usuario"} · {isAdmin ? "Admin" : "Empleada"}
          </div>
          <button
            onClick={() => signOut()}
            className="w-full text-left rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
