import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Building2,
  History,
  Target,
  PlusCircle,
  TrendingUp,
  ClipboardCheck,
  Users,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  BarChart3,
  FileText,
  Store,
  Settings,
  DollarSign,
  Calendar,
  Smartphone,
  FlaskConical,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { hasRoleAccess } from "./RoleGuard";

/**
 * Grupos de navegación con sub-ítems expandibles.
 * Cada grupo puede tener sub-ítems que se muestran al expandir.
 */
const ALL_NAV_GROUPS = [
  {
    id: "inicio",
    label: "Inicio",
    icon: LayoutDashboard,
    minRole: "user",
    path: "/",
    items: [],
  },
  {
    id: "tiendas",
    label: "Tiendas",
    icon: Store,
    minRole: "manager",
    path: "/sucursales",
    items: [
      { icon: Building2, label: "Lista de Sucursales", path: "/sucursales", minRole: "manager" },
    ],
  },
  {
    id: "secof",
    label: "SECOF",
    icon: ClipboardCheck,
    minRole: "leader",
    path: null,
    items: [
      { icon: LayoutDashboard, label: "Resumen SECOF", path: "/secof-dashboard", minRole: "leader" },
      { icon: PlusCircle, label: "Nueva Evaluación", path: "/evaluacion/nueva", minRole: "leader" },
      { icon: History, label: "Historial", path: "/historial", minRole: "leader" },
      { icon: BarChart3, label: "Comparativa", path: "/comparativa", minRole: "manager" },
      { icon: Target, label: "Plan de Acción", path: "/plan-accion", minRole: "leader" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: DollarSign,
    minRole: "leader",
    path: null,
    items: [
      { icon: FileText, label: "Reporte Diario", path: "/reporte-diario", minRole: "leader" },
      { icon: TrendingUp, label: "Evolución de Ventas", path: "/ventas", minRole: "manager" },
    ],
  },
  {
    id: "equipo",
    label: "Equipo",
    icon: Users,
    minRole: "host",
    path: null,
    items: [
      { icon: Smartphone, label: "Mi Turno", path: "/mi-turno", minRole: "host" },
      { icon: FlaskConical, label: "Preparaciones", path: "/preparaciones", minRole: "host" },
      { icon: Users, label: "Empleados", path: "/empleados", minRole: "leader" },
      { icon: Calendar, label: "Horarios", path: "/horarios", minRole: "leader" },
      { icon: ClipboardCheck, label: "Asistencia", path: "/asistencia", minRole: "host" },
      { icon: BarChart3, label: "KPIs Anfitriones", path: "/kpi-anfitriones", minRole: "leader" },
      { icon: TrendingUp, label: "KPIs Líder (Nivel 2)", path: "/kpi-lider", minRole: "leader" },
      { icon: DollarSign, label: "KPIs Admin (Nivel 3)", path: "/kpi-admin", minRole: "manager" },
    ],
  },
  {
    id: "colaboradores",
    label: "Colaboradores",
    icon: ShieldCheck,
    minRole: "owner",
    path: "/admin/usuarios",
    items: [
      { icon: Users, label: "Usuarios y Roles", path: "/admin/usuarios", minRole: "owner" },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: Settings,
    minRole: "manager",
    path: null,
    items: [
      { icon: History, label: "Ventas Históricas", path: "/ventas-historicas", minRole: "manager" },
      { icon: ClipboardList, label: "Admin Preguntas", path: "/admin/preguntas", minRole: "superadmin" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  owner: "Dueño",
  manager: "Admin Tienda",
  leader: "Líder",
  host: "Anfitrión",
  user: "Usuario",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  owner: "bg-amber-100 text-amber-700",
  manager: "bg-green-100 text-green-700",
  leader: "bg-teal-100 text-teal-700",
  host: "bg-gray-100 text-gray-700",
  user: "bg-gray-100 text-gray-600",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, logout } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (user && (user as any).role === 'user') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-green-800">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-xl">
            <ShieldCheck className="w-8 h-8 text-yellow-300" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Cuenta pendiente de activación</h1>
            <p className="text-green-300 text-sm mt-2">Tu cuenta fue registrada exitosamente.</p>
          </div>
          <div className="w-full bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 shadow-2xl text-center">
            <p className="text-green-100 text-sm leading-relaxed">
              El administrador del sistema debe asignarte un rol para que puedas acceder.
              Una vez que te activen, recarga esta página.
            </p>
            <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
              <p className="text-yellow-300 text-xs font-medium">Cuenta: {(user as any).email ?? (user as any).name}</p>
            </div>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="outline"
              className="mt-4 bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              Verificar activación
            </Button>
          </div>
          <button
            onClick={() => { logout(); }}
            className="text-green-400 text-xs hover:text-green-300 underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-green-800">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-xl">
              <ShieldCheck className="w-8 h-8 text-green-300" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">Snowtea HQ</h1>
              <p className="text-green-300 text-sm mt-1">Sistema de Gestión de Franquicia</p>
            </div>
          </div>
          <div className="w-full bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-white font-semibold text-center mb-2">Iniciar sesión</h2>
            <p className="text-green-200 text-sm text-center mb-6">
              Accede con tu cuenta para continuar al sistema.
            </p>
            <Button
              onClick={() => { window.location.href = getLoginUrl(); }}
              size="lg"
              variant="outline"
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold shadow-lg border-gray-200 gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </Button>
          </div>
          <p className="text-green-400 text-xs text-center">Snowtea HQ · Sistema Integral de Administración</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const role = (user as any)?.role ?? "user";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.user;

  // Determinar qué grupos están activos según la ruta actual
  const getGroupActive = (group: typeof ALL_NAV_GROUPS[0]) => {
    if (group.path === "/" && location === "/") return true;
    if (group.path && group.path !== "/" && location.startsWith(group.path)) return true;
    return group.items.some(item => item.path !== "/" && location.startsWith(item.path));
  };

  // Estado de expansión de grupos (auto-expande el grupo activo)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ALL_NAV_GROUPS.forEach(g => {
      initial[g.id] = getGroupActive(g);
    });
    return initial;
  });

  // Auto-expandir grupo activo cuando cambia la ruta
  useEffect(() => {
    ALL_NAV_GROUPS.forEach(g => {
      if (getGroupActive(g)) {
        setExpandedGroups(prev => ({ ...prev, [g.id]: true }));
      }
    });
  }, [location]);

  // Filtrar grupos según rol
  const navGroups = ALL_NAV_GROUPS
    .filter(group => hasRoleAccess(role, group.minRole))
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasRoleAccess(role, item.minRole)),
    }));

  const activeLabel = navGroups
    .flatMap(g => g.items)
    .find(i => i.path !== "/" && location.startsWith(i.path))?.label
    ?? (location === "/" ? "Dashboard HQ" : "Snowtea HQ");

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0">
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-green-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-green-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sidebar-foreground leading-none truncate">
                      Snowtea HQ
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5 truncate">
                      Sistema de Gestión
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 py-2">
            {navGroups.map(group => {
              const isGroupActive = getGroupActive(group);
              const isExpanded = expandedGroups[group.id] ?? false;
              const hasSubItems = group.items.length > 0;

              return (
                <div key={group.id} className="px-2 mb-0.5">
                  {/* Grupo principal (clickable) */}
                  <button
                    onClick={() => {
                      if (!hasSubItems && group.path) {
                        setLocation(group.path);
                      } else if (hasSubItems) {
                        if (!isCollapsed) toggleGroup(group.id);
                        // Si colapsado, navegar al primer ítem
                        if (isCollapsed && group.items[0]) setLocation(group.items[0].path);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-sm font-medium ${
                      isGroupActive
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                    title={isCollapsed ? group.label : undefined}
                  >
                    <group.icon className={`h-4 w-4 shrink-0 ${isGroupActive ? "text-green-400" : ""}`} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">{group.label}</span>
                        {hasSubItems && (
                          <span className="ml-auto">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40" />
                              : <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/40" />
                            }
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {/* Sub-ítems expandibles */}
                  {!isCollapsed && hasSubItems && isExpanded && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5">
                      {group.items.map(item => {
                        const isActive = item.path !== "/" && location.startsWith(item.path);
                        return (
                          <button
                            key={item.path}
                            onClick={() => setLocation(item.path)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-xs ${
                              isActive
                                ? "bg-green-500/15 text-green-400 font-medium"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                            }`}
                          >
                            <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-green-400" : ""}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                    <AvatarFallback className="text-xs font-semibold bg-green-800 text-green-200">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">
                        {user?.name || "Usuario"}
                      </p>
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium ${roleColor}`}>
                        {roleLabel}
                      </span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <Badge variant="secondary" className={`mt-1.5 text-[10px] ${roleColor}`}>
                    {roleLabel}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-green-400/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-green-600 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">{activeLabel}</span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
