import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/RoleGuard";
import Home from "./pages/Home";
import Sucursales from "./pages/Sucursales";
import SucursalDetalle from "./pages/SucursalDetalle";
import NuevaEvaluacion from "./pages/NuevaEvaluacion";
import EvaluacionDetalle from "./pages/EvaluacionDetalle";
import Historial from "./pages/Historial";
import PlanAccion from "./pages/PlanAccion";
import Comparativa from "./pages/Comparativa";
import AdminPreguntas from "./pages/AdminPreguntas";
import AdminUsuarios from "./pages/AdminUsuarios";
import ReporteDiario from "./pages/ReporteDiario";
import Ventas from "./pages/Ventas";
import MetasVentas from "./pages/MetasVentas";
import Empleados from "./pages/Empleados";
import Asistencia from "./pages/Asistencia";
import AsistenciaQR from "./pages/AsistenciaQR";
import KpiAnfitriones from "./pages/KpiAnfitriones";
import KpiLider from "./pages/KpiLider";
import KpiAdmin from "./pages/KpiAdmin";
import Horarios from "./pages/Horarios";
import MiTurno from "./pages/MiTurno";
import DashboardSecof from "./pages/DashboardSecof";
import DashboardLayout from "./components/DashboardLayout";
import VentasHistoricas from "./pages/VentasHistoricas";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        {/* Dashboard: todos los roles */}
        <Route path="/" component={Home} />

        {/* Franquicias: manager, owner, superadmin */}
        <Route path="/sucursales">
          <ProtectedRoute component={Sucursales} minRole="manager" />
        </Route>
        <Route path="/sucursales/:id">
          <ProtectedRoute component={SucursalDetalle} minRole="manager" />
        </Route>

        {/* Dashboard SECOF: leader y superior */}
        <Route path="/secof-dashboard">
          <ProtectedRoute component={DashboardSecof} minRole="leader" />
        </Route>

        {/* SECOF: leader y superior */}
        <Route path="/evaluacion/nueva">
          <ProtectedRoute component={NuevaEvaluacion} minRole="leader" />
        </Route>
        <Route path="/evaluacion/:id">
          <ProtectedRoute component={EvaluacionDetalle} minRole="leader" />
        </Route>
        <Route path="/historial">
          <ProtectedRoute component={Historial} minRole="leader" />
        </Route>
        <Route path="/comparativa">
          <ProtectedRoute component={Comparativa} minRole="manager" />
        </Route>
        <Route path="/plan-accion">
          <ProtectedRoute component={PlanAccion} minRole="leader" />
        </Route>

        {/* Reporte Diario: leader y superior */}
        <Route path="/reporte-diario">
          <ProtectedRoute component={ReporteDiario} minRole="leader" />
        </Route>

        {/* Ventas - Histórico: manager y superior */}
        <Route path="/ventas">
          <ProtectedRoute component={Ventas} minRole="manager" />
        </Route>

        {/* Metas de Ventas: owner, manager, superadmin */}
        <Route path="/metas-ventas">
          <ProtectedRoute component={MetasVentas} minRole="owner" />
        </Route>

        {/* Empleados: leader y superior */}
        <Route path="/empleados">
          <ProtectedRoute component={Empleados} minRole="leader" />
        </Route>

        {/* Asistencia: host y superior */}
        <Route path="/asistencia">
          <ProtectedRoute component={Asistencia} minRole="host" />
        </Route>

        {/* Página pública de registro QR (sin login) */}
        <Route path="/asistencia-qr" component={AsistenciaQR} />

        {/* KPIs Anfitriones: leader y superior */}
        <Route path="/kpi-anfitriones">
          <ProtectedRoute component={KpiAnfitriones} minRole="leader" />
        </Route>

        {/* KPIs Líder Nivel 2: leader y superior */}
        <Route path="/kpi-lider">
          <ProtectedRoute component={KpiLider} minRole="leader" />
        </Route>

        {/* KPIs Admin Nivel 3: manager, owner, superadmin */}
        <Route path="/kpi-admin">
          <ProtectedRoute component={KpiAdmin} minRole="manager" />
        </Route>

        {/* Horarios Semanales: leader y superior */}
        <Route path="/horarios">
          <ProtectedRoute component={Horarios} minRole="leader" />
        </Route>

        {/* Mi Turno: anfitrón y superior */}
        <Route path="/mi-turno">
          <ProtectedRoute component={MiTurno} minRole="host" />
        </Route>

        {/* Colaboradores: owner, manager, superadmin */}
        <Route path="/admin/usuarios">
          <ProtectedRoute component={AdminUsuarios} minRole="owner" />
        </Route>

        {/* Ventas Históricas: owner, manager, superadmin */}
        <Route path="/ventas-historicas">
          <ProtectedRoute component={VentasHistoricas} minRole="manager" />
        </Route>

        {/* Configuración: solo superadmin */}
        <Route path="/admin/preguntas">
          <ProtectedRoute component={AdminPreguntas} minRole="superadmin" />
        </Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
