import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Jerarquía de roles:
 * superadmin > admin > owner > manager > leader > host > user
 *
 * Cada nivel tiene acceso a todo lo que tiene el nivel inferior.
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 7,
  admin: 6,
  owner: 5,
  manager: 4,
  leader: 3,
  host: 2,
  user: 1,
};

/**
 * Verifica si un rol tiene acceso a un nivel mínimo requerido.
 */
export function hasRoleAccess(userRole: string, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= minLevel;
}

/**
 * Definición de permisos de acceso por ruta.
 * Cada ruta tiene un rol mínimo requerido.
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  "/admin/usuarios": "admin",
  "/admin/preguntas": "admin",
  "/prototipo-hq": "admin",
  "/sucursales": "manager",
  "/comparativa": "manager",
  "/plan-accion": "leader",
  "/historial": "leader",
  "/evaluacion/nueva": "leader",
};

/**
 * Retorna el rol mínimo requerido para una ruta.
 * Verifica prefijos también (ej. /evaluacion/:id → /evaluacion/nueva).
 */
export function getRequiredRole(path: string): string | null {
  // Exact match first
  if (ROUTE_PERMISSIONS[path]) return ROUTE_PERMISSIONS[path];
  // Prefix match
  for (const [route, role] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(route)) return role;
  }
  return null; // No restriction
}

interface RoleGuardProps {
  children: React.ReactNode;
  minRole?: string;
  fallback?: React.ReactNode;
}

/**
 * Componente que protege su contenido según el rol del usuario.
 * Si el usuario no tiene el rol mínimo requerido, muestra un mensaje de acceso denegado.
 */
export function RoleGuard({ children, minRole = "user", fallback }: RoleGuardProps) {
  const { user, loading } = useAuth();

  if (loading) return null;

  const userRole = (user as any)?.role ?? "user";

  if (!user) {
    return null; // DashboardLayout ya maneja el login
  }

  if (!hasRoleAccess(userRole, minRole)) {
    if (fallback) return <>{fallback}</>;
    return <AccessDenied userRole={userRole} requiredRole={minRole} />;
  }

  return <>{children}</>;
}

/**
 * Componente de ruta protegida que redirige o muestra acceso denegado.
 */
interface ProtectedRouteProps {
  component: React.ComponentType;
  minRole?: string;
}

export function ProtectedRoute({ component: Component, minRole = "user" }: ProtectedRouteProps) {
  return (
    <RoleGuard minRole={minRole}>
      <Component />
    </RoleGuard>
  );
}

/**
 * Pantalla de acceso denegado con información del rol requerido.
 */
function AccessDenied({ userRole, requiredRole }: { userRole: string; requiredRole: string }) {
  const [, setLocation] = useLocation();

  const ROLE_LABELS: Record<string, string> = {
    superadmin: "Super Admin",
    admin: "Administrador",
    owner: "Dueño de Franquicia",
    manager: "Administrador de Tienda",
    leader: "Líder de Tienda",
    host: "Anfitrión",
    user: "Usuario",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
        <ShieldX className="w-8 h-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">Acceso restringido</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Esta sección requiere el rol de{" "}
          <span className="font-semibold text-foreground">
            {ROLE_LABELS[requiredRole] ?? requiredRole}
          </span>{" "}
          o superior. Tu rol actual es{" "}
          <span className="font-semibold text-foreground">
            {ROLE_LABELS[userRole] ?? userRole}
          </span>.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => setLocation("/")}
        className="mt-2"
      >
        Volver al inicio
      </Button>
    </div>
  );
}
