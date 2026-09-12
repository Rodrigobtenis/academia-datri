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
              <Route path="/cursos" element={<CursosList />} />
              <Route path="/cursos/:courseTypeId" element={<ModalidadDetail />} />
              <Route path="/cursos/:courseTypeId/:editionId" element={<EditionDetail />} />
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
