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
import PrototipoHQ from "./pages/PrototipoHQ";
import AdminUsuarios from "./pages/AdminUsuarios";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        {/* Inicio: accesible para todos los roles */}
        <Route path="/" component={Home} />

        {/* Franquicias: requiere manager o superior */}
        <Route path="/sucursales">
          <ProtectedRoute component={Sucursales} minRole="manager" />
        </Route>
        <Route path="/sucursales/:id">
          <ProtectedRoute component={SucursalDetalle} minRole="manager" />
        </Route>

        {/* Módulo SECOF: requiere leader o superior */}
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

        {/* Administración: requiere admin o superior */}
        <Route path="/admin/preguntas">
          <ProtectedRoute component={AdminPreguntas} minRole="admin" />
        </Route>
        <Route path="/admin/usuarios">
          <ProtectedRoute component={AdminUsuarios} minRole="admin" />
        </Route>

        {/* Sistema: solo admin/superadmin */}
        <Route path="/prototipo-hq">
          <ProtectedRoute component={PrototipoHQ} minRole="admin" />
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
