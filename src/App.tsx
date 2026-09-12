import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { RequireAuth, RequireAdmin } from "./components/require-auth";
import AppLayout from "./components/app-layout";
import PagePlaceholder from "./components/page-placeholder";
import LoginPage from "./pages/auth/login";
import DashboardPage from "./pages/dashboard/dashboard-page";
import AlumnasList from "./pages/alumnas/alumnas-list";
import AlumnaDetail from "./pages/alumnas/alumna-detail";
import CursosList from "./pages/cursos/cursos-list";
import ModalidadDetail from "./pages/cursos/modalidad-detail";
import EditionDetail from "./pages/cursos/edition-detail";
import InscripcionDetail from "./pages/inscripciones/inscripcion-detail";
import ComisionesPage from "./pages/comisiones/comisiones-page";
import GestionPage from "./pages/gestion/gestion-page";
import ConfiguracionPage from "./pages/configuracion/configuracion-page";
import CrmPage from "./pages/crm/crm-page";
import GastosPage from "./pages/gastos/gastos-page";
import AgendaPage from "./pages/agenda/agenda-page";
import ReportesPage from "./pages/reportes/reportes-page";

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
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/cursos" element={<CursosList />} />
              <Route path="/cursos/:courseTypeId" element={<ModalidadDetail />} />
              <Route path="/cursos/:courseTypeId/:editionId" element={<EditionDetail />} />
              <Route
                path="/cursos/:courseTypeId/:editionId/inscripciones/:enrollmentId"
                element={<InscripcionDetail />}
              />
              <Route path="/alumnas" element={<AlumnasList />} />
              <Route path="/alumnas/:id" element={<AlumnaDetail />} />
              <Route
                path="/inscripciones"
                element={
                  <PagePlaceholder
                    title="Inscripciones"
                    note="Las inscripciones se gestionan desde cada edición (Cursos → modalidad → edición)."
                  />
                }
              />
              <Route path="/inscripciones/:enrollmentId" element={<InscripcionDetail />} />
              <Route
                path="/pagos"
                element={
                  <PagePlaceholder
                    title="Pagos"
                    note="Los pagos se registran desde cada inscripción (Alumna → curso, o Curso → edición → alumna)."
                  />
                }
              />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/comisiones" element={<ComisionesPage />} />
              <Route path="/reportes" element={<ReportesPage />} />

              <Route
                path="/gestion"
                element={
                  <RequireAdmin>
                    <GestionPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/gastos"
                element={
                  <RequireAdmin>
                    <GastosPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <RequireAdmin>
                    <ConfiguracionPage />
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
