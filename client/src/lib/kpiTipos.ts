export const KPI_TIPOS: Record<string, { label: string; emoji: string; criterios: Record<string, string> }> = {
  servicio: {
    label: "Servicio al cliente",
    emoji: "🛎️",
    criterios: {
      saludo:    "Saludo al cliente",
      sonrisa:   "Sonrisa y actitud",
      uniforme:  "Uniforme correcto",
      despedida: "Despedida cordial",
      venta_sug: "Venta sugerida",
    },
  },
  preparacion: {
    label: "Preparaciones",
    emoji: "🧋",
    criterios: {
      receta:       "Siguió la receta",
      tiempo:       "Tiempo de preparación",
      temperatura:  "Entrega la bebida en su punto (No muy espesa, No Aguada)",
      presentacion: "Presentación del producto",
    },
  },
  caja: {
    label: "Caja",
    emoji: "💰",
    criterios: {
      cambio:        "Cambio correcto",
      ticket:        "Entregó ticket",
      descuadre:     "Sin descuadre",
      cobro_correcto: "Cobro correcto",
    },
  },
};
