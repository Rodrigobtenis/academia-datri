import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { RequireAuth, RequireAdmin } from "./components/require-auth";
import AppLayout from "./components/app-layout";
import PagePlaceholder from "./components/page-placeholder";
import LoginPage from "./pages/auth/login";
import DashboardPage from "./pages/dashboard/dashboard-page";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/agenda" element={<PagePlaceholder title="Agenda" />} />
              <Route path="/cursos" element={<PagePlaceholder title="Cursos" />} />
              <Route path="/alumnas" element={<PagePlaceholder title="Alumnas" />} />
              <Route path="/inscripciones" element={<PagePlaceholder title="Inscripciones" />} />
              <Route path="/pagos" element={<PagePlaceholder title="Pagos" />} />
              <Route path="/crm" element={<PagePlaceholder title="CRM" />} />
              <Route path="/comisiones" element={<PagePlaceholder title="Comisiones" />} />
              <Route path="/reportes" element={<PagePlaceholder title="Reportes" />} />

              <Route
                path="/gestion"
                element={
                  <RequireAdmin>
                    <PagePlaceholder title="Gestión" note="Panel privado — solo Admin." />
                  </RequireAdmin>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <RequireAdmin>
                    <PagePlaceholder title="Configuración" note="Panel privado — solo Admin." />
                  </RequireAdmin>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
