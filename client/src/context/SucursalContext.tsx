import { createContext, useContext, useState, ReactNode } from "react";

interface SucursalContextType {
  sucursalId: number | null;
  setSucursalId: (id: number) => void;
}

const SucursalContext = createContext<SucursalContextType>({
  sucursalId: null,
  setSucursalId: () => {},
});

export function SucursalProvider({ children }: { children: ReactNode }) {
  const [sucursalId, setSucursalIdState] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem("secof_sucursal_id");
      return s ? Number(s) : null;
    } catch { return null; }
  });

  function setSucursalId(id: number) {
    setSucursalIdState(id);
    try { localStorage.setItem("secof_sucursal_id", String(id)); } catch {}
  }

  return (
    <SucursalContext.Provider value={{ sucursalId, setSucursalId }}>
      {children}
    </SucursalContext.Provider>
  );
}

export function useSucursal() {
  return useContext(SucursalContext);
}
