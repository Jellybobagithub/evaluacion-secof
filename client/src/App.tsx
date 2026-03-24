import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Sucursales from "./pages/Sucursales";
import SucursalDetalle from "./pages/SucursalDetalle";
import NuevaEvaluacion from "./pages/NuevaEvaluacion";
import EvaluacionDetalle from "./pages/EvaluacionDetalle";
import Historial from "./pages/Historial";
import PlanAccion from "./pages/PlanAccion";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sucursales" component={Sucursales} />
        <Route path="/sucursales/:id" component={SucursalDetalle} />
        <Route path="/evaluacion/nueva" component={NuevaEvaluacion} />
        <Route path="/evaluacion/:id" component={EvaluacionDetalle} />
        <Route path="/historial" component={Historial} />
        <Route path="/plan-accion" component={PlanAccion} />
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
