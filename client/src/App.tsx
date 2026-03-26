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
import DashboardLayout from "./components/DashboardLayout";

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

        {/* Colaboradores: owner, manager, superadmin */}
        <Route path="/admin/usuarios">
          <ProtectedRoute component={AdminUsuarios} minRole="owner" />
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
