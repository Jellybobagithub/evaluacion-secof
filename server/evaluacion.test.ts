import { describe, expect, it } from "vitest";
import { calcularPuntuacion, getCalificacion, SECCIONES, TODOS_LOS_PUNTOS } from "../shared/evaluacionData";

describe("evaluacionData - getCalificacion", () => {
  it("retorna Excelente para 100%", () => {
    const result = getCalificacion(100);
    expect(result.label).toBe("Excelente");
    expect(result.color).toBe("#16a34a");
  });

  it("retorna Muy Bien para 97%", () => {
    const result = getCalificacion(97);
    expect(result.label).toBe("Muy Bien");
  });

  it("retorna Bien para 92%", () => {
    const result = getCalificacion(92);
    expect(result.label).toBe("Bien");
  });

  it("retorna Regular para 87%", () => {
    const result = getCalificacion(87);
    expect(result.label).toBe("Regular");
  });

  it("retorna Mal para 82%", () => {
    const result = getCalificacion(82);
    expect(result.label).toBe("Mal");
  });

  it("retorna Área de Oportunidad para 75%", () => {
    const result = getCalificacion(75);
    expect(result.label).toBe("Área de Oportunidad");
  });

  it("retorna Acción Inmediata para 50%", () => {
    const result = getCalificacion(50);
    expect(result.label).toBe("Acción Inmediata");
  });

  it("retorna Acción Inmediata para 0%", () => {
    const result = getCalificacion(0);
    expect(result.label).toBe("Acción Inmediata");
  });
});

describe("evaluacionData - estructura de secciones", () => {
  it("tiene exactamente 10 secciones", () => {
    expect(SECCIONES.length).toBe(10);
  });

  it("todos los puntos tienen id, descripcion, categoria y valor", () => {
    for (const punto of TODOS_LOS_PUNTOS) {
      expect(punto.id).toBeTruthy();
      expect(punto.descripcion).toBeTruthy();
      expect(punto.categoria).toBeTruthy();
      expect(punto.valor).toBeGreaterThan(0);
    }
  });

  it("TODOS_LOS_PUNTOS tiene al menos 100 puntos", () => {
    expect(TODOS_LOS_PUNTOS.length).toBeGreaterThanOrEqual(100);
  });

  it("no hay IDs duplicados en los puntos", () => {
    const ids = TODOS_LOS_PUNTOS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("los números de sección son únicos y van del 1 al 10", () => {
    const numeros = SECCIONES.map(s => s.numero);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("evaluacionData - calcularPuntuacion", () => {
  it("retorna 0% cuando no hay respuestas", () => {
    const result = calcularPuntuacion({});
    expect(result.porcentajeGeneral).toBe(0);
    expect(result.puntosObtenidos).toBe(0);
  });

  it("retorna 100% cuando todos son 'si'", () => {
    const respuestasMap: Record<string, "si" | "no" | "na"> = {};
    for (const p of TODOS_LOS_PUNTOS) {
      respuestasMap[p.id] = "si";
    }
    const result = calcularPuntuacion(respuestasMap);
    expect(result.porcentajeGeneral).toBe(100);
    expect(result.puntosObtenidos).toBe(result.puntosMaximos);
  });

  it("los puntos N/A no afectan el total máximo", () => {
    const respuestasMap: Record<string, "si" | "no" | "na"> = {};
    // Mark first punto as NA, rest as si
    for (let i = 0; i < TODOS_LOS_PUNTOS.length; i++) {
      respuestasMap[TODOS_LOS_PUNTOS[i].id] = i === 0 ? "na" : "si";
    }
    const result = calcularPuntuacion(respuestasMap);
    expect(result.porcentajeGeneral).toBe(100);
    // Max should be total minus the NA punto's value
    const naValor = TODOS_LOS_PUNTOS[0].valor;
    const totalValor = TODOS_LOS_PUNTOS.reduce((sum, p) => sum + p.valor, 0);
    expect(result.puntosMaximos).toBe(totalValor - naValor);
  });

  it("calcula correctamente por categoría", () => {
    const respuestasMap: Record<string, "si" | "no" | "na"> = {};
    for (const p of TODOS_LOS_PUNTOS) {
      respuestasMap[p.id] = p.categoria === "Higiene" ? "no" : "si";
    }
    const result = calcularPuntuacion(respuestasMap);
    expect(result.porCategoria["Higiene"]?.obtenidos).toBe(0);
    expect(result.porCategoria["Higiene"]?.maximos).toBeGreaterThan(0);
    // Other categories should have obtenidos === maximos
    for (const [cat, v] of Object.entries(result.porCategoria)) {
      if (cat !== "Higiene") {
        expect(v.obtenidos).toBe(v.maximos);
      }
    }
  });

  it("calificacion coincide con getCalificacion del porcentaje", () => {
    const respuestasMap: Record<string, "si" | "no" | "na"> = {};
    for (const p of TODOS_LOS_PUNTOS) {
      respuestasMap[p.id] = "si";
    }
    const result = calcularPuntuacion(respuestasMap);
    expect(result.calificacion.label).toBe(getCalificacion(result.porcentajeGeneral).label);
  });
});
