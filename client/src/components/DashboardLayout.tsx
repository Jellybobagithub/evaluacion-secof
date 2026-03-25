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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { hasRoleAccess } from "./RoleGuard";

/**
 * Grupos de navegación con rol mínimo requerido por ítem.
 *
 * Jerarquía:
 *   superadmin (6) > owner = manager (5) > leader (3) > host (2) > user (1)
 *
 * - superadmin: todo
 * - owner / manager: Franquicias + SECOF + Colaboradores
 * - leader: SECOF operativo
 * - host / user: solo Dashboard
 */
const ALL_NAV_GROUPS = [
  {
    label: "Inicio",
    minRole: "user",
    items: [
      { icon: LayoutDashboard, label: "Dashboard HQ", path: "/", minRole: "user" },
    ],
  },
  {
    label: "Franquicias",
    minRole: "manager",
    items: [
      { icon: Building2, label: "Sucursales", path: "/sucursales", minRole: "manager" },
    ],
  },
  {
    label: "Módulo SECOF",
    minRole: "leader",
    items: [
      { icon: PlusCircle, label: "Nueva Evaluación", path: "/evaluacion/nueva", minRole: "leader" },
      { icon: History, label: "Historial", path: "/historial", minRole: "leader" },
      { icon: TrendingUp, label: "Comparativa", path: "/comparativa", minRole: "manager" },
      { icon: Target, label: "Plan de Acción", path: "/plan-accion", minRole: "leader" },
    ],
  },
  {
    label: "Colaboradores",
    minRole: "owner",
    items: [
      { icon: Users, label: "Usuarios y Roles", path: "/admin/usuarios", minRole: "owner" },
    ],
  },
  {
    label: "Configuración",
    minRole: "superadmin",
    items: [
      { icon: ClipboardCheck, label: "Admin Preguntas", path: "/admin/preguntas", minRole: "superadmin" },
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
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

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
              className="w-full bg-green-400 hover:bg-green-300 text-green-950 font-semibold shadow-lg"
            >
              Ingresar al sistema
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

  // Filtrar grupos e ítems según el rol del usuario
  const navGroups = ALL_NAV_GROUPS
    .filter(group => hasRoleAccess(role, group.minRole))
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasRoleAccess(role, item.minRole)),
    }))
    .filter(group => group.items.length > 0);

  const activeLabel = navGroups
    .flatMap(g => g.items)
    .find(i => i.path === location)?.label ?? "Snowtea HQ";

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
            {navGroups.map(group => (
              <SidebarGroup key={group.label} className="py-0">
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-4 py-2">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="px-2">
                  {group.items.map(item => {
                    const isActive = location === item.path ||
                      (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-9 transition-all font-normal text-sm ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-green-400" : ""}`} />
                          <span>{item.label}</span>
                          {isActive && !isCollapsed && (
                            <ChevronRight className="ml-auto h-3 w-3 text-green-400" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ))}
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
