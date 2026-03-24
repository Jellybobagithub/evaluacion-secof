export type Categoria = "Control" | "Higiene" | "Hospitalidad" | "Imagen" | "Mantenimiento" | "Operación";

export type PuntoEvaluacion = {
  id: string;
  categoria: Categoria;
  descripcion: string;
  criterio: string;
  valor: number;
  seccion: number;
};

export type SeccionEvaluacion = {
  numero: number;
  nombre: string;
  puntos: PuntoEvaluacion[];
};

export const SECCIONES: SeccionEvaluacion[] = [
  {
    numero: 1,
    nombre: "Puntos Generales",
    puntos: [
      { id: "PG1", categoria: "Higiene", descripcion: "El establecimiento está limpio y sin evidencia visual de plaga o insectos", criterio: "No cumple si existe alguna evidencia de plaga, tales como cucarachas o ratones, así como sus desechos.", valor: 5, seccion: 1 },
      { id: "PG2", categoria: "Imagen", descripcion: "La primera impresión en el establecimiento es de orden y una atmósfera agradable", criterio: "El personal porta el uniforme completo y limpio. Los equipos, accesorios y sabores están ordenados. El área de auto servicio bien rellenada y limpia. La música es agradable en género y volumen.", valor: 5, seccion: 1 },
      { id: "PG3", categoria: "Control", descripcion: "En todas las ventas se entrega el ticket de venta al cliente", criterio: "Sin excepción, se registra en el sistema todas las ventas y se entrega el ticket al cliente que ordena.", valor: 5, seccion: 1 },
      { id: "PG4", categoria: "Hospitalidad", descripcion: "El personal fue amable, sonriente y sugiere algún sabor en especial", criterio: "Siempre, los M.E. están sonrientes, con actitud de servicio, promoviendo una venta sugestiva y ofreciendo degustación al inicio o en la entrega del Snowtea.", valor: 5, seccion: 1 },
      { id: "PG5", categoria: "Mantenimiento", descripcion: "Todos los focos y equipos están funcionando correctamente", criterio: "A simple vista, no debe haber focos fundidos, cajas de luz en mal funcionamiento y todos los equipos operando (Droper, selladora, licuadoras, redwash y computadora).", valor: 5, seccion: 1 },
      { id: "PG6", categoria: "Operación", descripcion: "Se encuentran correctamente surtidas todas las materias primas", criterio: "Cuentan con el 100% de las materias primas que son necesarias para la preparación de las bebidas, que están ofertadas en el menú.", valor: 5, seccion: 1 },
    ],
  },
  {
    numero: 2,
    nombre: "Entrada al Local o Llegada a la Isla",
    puntos: [
      { id: "EL1", categoria: "Mantenimiento", descripcion: "La fachada se encuentra en buenas condiciones y sin cuarteaduras", criterio: "Visualmente el local se observa en buen estado, limpio, sin calcomanías, sin grafiti. La pintura debe estar en el tono original y sin deslave.", valor: 3, seccion: 2 },
      { id: "EL2", categoria: "Imagen", descripcion: "Cuenta con los colores permitidos por Snowtea", criterio: "La fachada debe estar previamente revisada y autorizada por Snowtea, y cualquier cambio debe ser avisado previamente.", valor: 3, seccion: 2 },
      { id: "EL3", categoria: "Imagen", descripcion: "El logotipo del anuncio de la fachada es claro", criterio: "Se encuentra completo, y en el caso de ser luminoso prende en todas sus partes.", valor: 3, seccion: 2 },
      { id: "EL4", categoria: "Imagen", descripcion: "Únicamente se encuentra el logotipo institucional en la fachada", criterio: "Solo se puede tener el logotipo Snowtea autorizado. No puede haber ninguna otra marca.", valor: 3, seccion: 2 },
      { id: "EL5", categoria: "Operación", descripcion: "Cumple con los horarios establecidos de apertura y cierre", criterio: "Tiene que ser visible al cliente y siempre respetar los horarios.", valor: 5, seccion: 2 },
      { id: "EL6", categoria: "Higiene", descripcion: "La terraza se encuentra limpia", criterio: "Barrida al menos 2 veces al día, libre de chicles en el piso. En el caso de tener sombrillas, estas deben ser lavadas con profundidad, al menos 1 vez a la semana.", valor: 5, seccion: 2 },
      { id: "EL7", categoria: "Higiene", descripcion: "Las mesas de la terraza se encuentran limpias", criterio: "Sin polvo y que no estén percudidas.", valor: 5, seccion: 2 },
      { id: "EL8", categoria: "Higiene", descripcion: "Los sillones o sillas de la terraza están limpias y en buenas condiciones", criterio: "Sin polvo y que no estén percudidas. Al menos se tienen que lavar profundo una vez a la semana.", valor: 5, seccion: 2 },
      { id: "EL9", categoria: "Higiene", descripcion: "El piso de la entrada se encuentra limpio y sin manchas", criterio: "Diariamente se tiene que empezar el turno con el piso limpio y trapeado. Sin chicles pegados en el piso.", valor: 5, seccion: 2 },
      { id: "EL10", categoria: "Higiene", descripcion: "Los cristales y acrílicos se encuentran sin manchas y limpios", criterio: "Se encuentran sin dedos o manchas marcadas y al momento de ser limpiados, se utiliza un trapo específico para no mezclar olores ni sabores.", valor: 5, seccion: 2 },
      { id: "EL11", categoria: "Higiene", descripcion: "Los botes de basura están limpios y sin excedente de basura", criterio: "El bote debe estar limpio en todas sus partes, con bolsa de basura y sin exceso.", valor: 3, seccion: 2 },
      { id: "EL12", categoria: "Higiene", descripcion: "Se percibe un olor agradable al llegar al establecimiento", criterio: "Se debe percibir un aroma agradable. El aromatizante que se debe utilizar es Manzana-Canela.", valor: 5, seccion: 2 },
      { id: "EL13", categoria: "Operación", descripcion: "La música está en un volumen y género adecuado", criterio: "Volumen adecuado y de agrado de los clientes. Está permitido: música pop, chill-out, ambiental.", valor: 3, seccion: 2 },
      { id: "EL14", categoria: "Mantenimiento", descripcion: "El menú se encuentra en buen estado y limpio", criterio: "No debe tener enmendaduras, ni precios encimados y perfectamente limpios y a la vista del cliente.", valor: 3, seccion: 2 },
      { id: "EL15", categoria: "Mantenimiento", descripcion: "La caja de luz prende y están en buenas condiciones", criterio: "No existen focos fundidos en su interior ni cuarteaduras en la parte del acrílico.", valor: 3, seccion: 2 },
      { id: "EL16", categoria: "Imagen", descripcion: "Los viniles de puertas y paredes están completos y en buenas condiciones", criterio: "No existen rasgaduras o viniles descolorados.", valor: 1, seccion: 2 },
      { id: "EL17", categoria: "Imagen", descripcion: "El anuncio luminoso está prendido", criterio: "Se encuentra a todas horas prendido.", valor: 3, seccion: 2 },
      { id: "EL18", categoria: "Imagen", descripcion: "Los horarios de apertura y cierre están visibles al cliente", criterio: "Los horarios deben encontrarse cerca de la caja o en la entrada y ser respetado.", valor: 1, seccion: 2 },
    ],
  },
  {
    numero: 3,
    nombre: "Producción",
    puntos: [
      { id: "P1", categoria: "Operación", descripcion: "La elaboración de la tapioca se hace conforme al M.O.", criterio: "El procedimiento se tiene que seguir a detalle y cumplir al 100% con el mismo.", valor: 5, seccion: 3 },
      { id: "P2", categoria: "Operación", descripcion: "Se encuentran los accesorios necesarios para hacer tapioca", criterio: "Olla, pala de madera, jarra medidora de agua, reloj cronómetro, estufa, olla de acero, colador para enjuagar.", valor: 1, seccion: 3 },
      { id: "P3", categoria: "Operación", descripcion: "Siempre se tiene tapioca suficiente para atender a los clientes antes del cierre", criterio: "De acuerdo con el día y el pronóstico de venta del mismo es la cantidad de tapioca que se elabora.", valor: 5, seccion: 3 },
      { id: "P4", categoria: "Operación", descripcion: "El té base se elabora usando el cronómetro y siguiendo el M.O.", criterio: "El pouch de té, al momento de infusionarse, no debe pasar más de 3 min. en contacto con el agua.", valor: 5, seccion: 3 },
      { id: "P5", categoria: "Operación", descripcion: "El té base se elabora en el recipiente correcto y con la cantidad correcta de agua", criterio: "Recipiente de acero inoxidable con la cantidad de agua indicada en el M.O.", valor: 5, seccion: 3 },
      { id: "P6", categoria: "Operación", descripcion: "Los tés base se encuentran almacenados correctamente", criterio: "En el refrigerador, bien tapados y etiquetados con el nombre y la fecha de elaboración.", valor: 5, seccion: 3 },
      { id: "P7", categoria: "Operación", descripcion: "La tapioca se almacena correctamente", criterio: "En el recipiente indicado, con el almíbar correcto y a temperatura ambiente.", valor: 5, seccion: 3 },
      { id: "P8", categoria: "Operación", descripcion: "Los sabores están correctamente almacenados", criterio: "En el refrigerador o a temperatura ambiente según corresponda, bien tapados y etiquetados.", valor: 5, seccion: 3 },
      { id: "P9", categoria: "Control", descripcion: "Se cuenta con el registro de producción de tapioca actualizado", criterio: "El registro debe estar al día con fecha, hora, cantidad y responsable.", valor: 3, seccion: 3 },
      { id: "P10", categoria: "Higiene", descripcion: "El área de producción se encuentra limpia y ordenada", criterio: "Sin residuos de alimentos, utensilios limpios y en su lugar.", valor: 5, seccion: 3 },
      { id: "P11", categoria: "Higiene", descripcion: "Los utensilios de producción están limpios y desinfectados", criterio: "Ollas, palas, coladores y demás utensilios limpios y desinfectados.", valor: 5, seccion: 3 },
      { id: "P12", categoria: "Operación", descripcion: "Se tiene el inventario de materias primas actualizado", criterio: "El inventario debe estar al día y ser congruente con lo que hay físicamente.", valor: 3, seccion: 3 },
    ],
  },
  {
    numero: 4,
    nombre: "Máquina de Hielo / Hielera",
    puntos: [
      { id: "MH1", categoria: "Higiene", descripcion: "La máquina de hielo o hielera está limpia por dentro y por fuera", criterio: "Sin residuos, sin manchas y sin malos olores.", valor: 3, seccion: 4 },
      { id: "MH2", categoria: "Operación", descripcion: "La máquina de hielo funciona correctamente", criterio: "Produce hielo suficiente para la operación del día.", valor: 5, seccion: 4 },
      { id: "MH3", categoria: "Higiene", descripcion: "El hielo se maneja con utensilios limpios (pala o cuchara)", criterio: "Nunca se toca el hielo con las manos. Se usa pala o cuchara específica para hielo.", valor: 3, seccion: 4 },
      { id: "MH4", categoria: "Higiene", descripcion: "La pala o cuchara del hielo está limpia y en su lugar", criterio: "Limpia, desinfectada y guardada en un lugar específico.", valor: 3, seccion: 4 },
      { id: "MH5", categoria: "Operación", descripcion: "Se cuenta con suficiente hielo para la operación del día", criterio: "Siempre debe haber hielo suficiente para atender a todos los clientes.", valor: 3, seccion: 4 },
      { id: "MH6", categoria: "Mantenimiento", descripcion: "La máquina de hielo tiene mantenimiento preventivo al corriente", criterio: "Registro de limpieza profunda al menos una vez al mes.", valor: 3, seccion: 4 },
    ],
  },
  {
    numero: 5,
    nombre: "Equipo",
    puntos: [
      { id: "EQ1", categoria: "Operación", descripcion: "Las licuadoras están limpias y funcionando correctamente", criterio: "Vasos limpios, cuchillas en buen estado y motor funcionando.", valor: 5, seccion: 5 },
      { id: "EQ2", categoria: "Operación", descripcion: "La selladora está limpia y funcionando correctamente", criterio: "La selladora sella correctamente sin dejar burbujas o sellos incompletos.", valor: 5, seccion: 5 },
      { id: "EQ3", categoria: "Operación", descripcion: "El Droper está limpio y funcionando correctamente", criterio: "Limpio, desinfectado y dosificando correctamente.", valor: 5, seccion: 5 },
      { id: "EQ4", categoria: "Operación", descripcion: "El sistema de cómputo (POS) está funcionando correctamente", criterio: "El sistema registra ventas, imprime tickets y funciona sin errores.", valor: 5, seccion: 5 },
      { id: "EQ5", categoria: "Mantenimiento", descripcion: "Todos los equipos tienen mantenimiento preventivo al corriente", criterio: "Registro de mantenimiento preventivo de todos los equipos.", valor: 5, seccion: 5 },
      { id: "EQ6", categoria: "Higiene", descripcion: "Los vasos de las licuadoras se lavan correctamente después de cada uso", criterio: "Con jabón, esponja y agua caliente. Sin residuos de bebidas anteriores.", valor: 5, seccion: 5 },
      { id: "EQ7", categoria: "Operación", descripcion: "La impresora de tickets tiene papel y funciona correctamente", criterio: "Siempre debe tener papel y estar lista para imprimir.", valor: 3, seccion: 5 },
      { id: "EQ8", categoria: "Mantenimiento", descripcion: "El refrigerador está limpio y a la temperatura correcta", criterio: "Temperatura entre 2°C y 4°C. Limpio por dentro y por fuera.", valor: 5, seccion: 5 },
      { id: "EQ9", categoria: "Operación", descripcion: "El refrigerador está organizado y con los productos bien identificados", criterio: "Productos etiquetados con nombre y fecha. Organizados por tipo.", valor: 3, seccion: 5 },
      { id: "EQ10", categoria: "Mantenimiento", descripcion: "El Redwash está limpio y funcionando correctamente", criterio: "Limpio, con el producto correcto y funcionando.", valor: 5, seccion: 5 },
      { id: "EQ11", categoria: "Operación", descripcion: "La báscula está calibrada y funcionando correctamente", criterio: "Calibrada y con batería.", valor: 3, seccion: 5 },
      { id: "EQ12", categoria: "Higiene", descripcion: "El área de equipos está limpia y ordenada", criterio: "Sin residuos, equipos en su lugar y superficies limpias.", valor: 5, seccion: 5 },
      { id: "EQ13", categoria: "Mantenimiento", descripcion: "Los cables y conexiones eléctricas están en buen estado", criterio: "Sin cables pelados, bien organizados y sin riesgo eléctrico.", valor: 3, seccion: 5 },
      { id: "EQ14", categoria: "Operación", descripcion: "Se cuenta con los accesorios necesarios para la operación (popotes, servilletas, vasos)", criterio: "Siempre debe haber suficiente inventario de accesorios para la operación del día.", valor: 5, seccion: 5 },
      { id: "EQ15", categoria: "Operación", descripcion: "Los accesorios están organizados y en su lugar", criterio: "Popotes, servilletas, vasos y tapas organizados y accesibles.", valor: 3, seccion: 5 },
    ],
  },
  {
    numero: 6,
    nombre: "Operación del Negocio",
    puntos: [
      { id: "ON1", categoria: "Control", descripcion: "Se registran todas las ventas en el sistema POS", criterio: "Sin excepción, todas las ventas se registran en el sistema.", valor: 5, seccion: 6 },
      { id: "ON2", categoria: "Control", descripcion: "El corte de caja se realiza correctamente al final del turno", criterio: "El corte de caja coincide con el sistema POS.", valor: 5, seccion: 6 },
      { id: "ON3", categoria: "Operación", descripcion: "El personal conoce el menú completo y los ingredientes de cada bebida", criterio: "Puede describir cualquier bebida del menú sin dudar.", valor: 5, seccion: 6 },
      { id: "ON4", categoria: "Operación", descripcion: "Las bebidas se elaboran siguiendo las recetas del M.O.", criterio: "Cantidades exactas de ingredientes según el M.O.", valor: 5, seccion: 6 },
      { id: "ON5", categoria: "Operación", descripcion: "Los precios del menú están actualizados y son correctos", criterio: "Los precios en el menú coinciden con los del sistema POS.", valor: 3, seccion: 6 },
      { id: "ON6", categoria: "Control", descripcion: "Se lleva el control de inventario diariamente", criterio: "Registro diario de entradas y salidas de inventario.", valor: 5, seccion: 6 },
      { id: "ON7", categoria: "Operación", descripcion: "El personal porta el uniforme completo y limpio", criterio: "Uniforme completo según estándar Snowtea: playera, delantal, gorra.", valor: 5, seccion: 6 },
      { id: "ON8", categoria: "Higiene", descripcion: "El personal mantiene higiene personal adecuada", criterio: "Manos limpias, uñas cortas y sin esmalte, cabello recogido.", valor: 5, seccion: 6 },
      { id: "ON9", categoria: "Operación", descripcion: "Se respetan los tiempos de elaboración de bebidas", criterio: "Las bebidas se elaboran en el tiempo indicado en el M.O.", valor: 5, seccion: 6 },
      { id: "ON10", categoria: "Control", descripcion: "Se lleva el registro de temperaturas del refrigerador", criterio: "Registro diario de temperatura del refrigerador.", valor: 3, seccion: 6 },
      { id: "ON11", categoria: "Operación", descripcion: "El área de trabajo está organizada para una operación eficiente", criterio: "Todo en su lugar y accesible para una operación rápida.", valor: 5, seccion: 6 },
      { id: "ON12", categoria: "Higiene", descripcion: "Se utilizan guantes para el manejo de alimentos cuando es necesario", criterio: "Guantes limpios para manejo de tapioca y otros ingredientes.", valor: 3, seccion: 6 },
      { id: "ON13", categoria: "Operación", descripcion: "Las bebidas se presentan correctamente (vaso, tapa, popote)", criterio: "Presentación correcta según estándar Snowtea.", valor: 3, seccion: 6 },
      { id: "ON14", categoria: "Control", descripcion: "Se cuenta con el manual de operaciones actualizado y accesible", criterio: "El M.O. debe estar en el local y accesible para el personal.", valor: 5, seccion: 6 },
      { id: "ON15", categoria: "Operación", descripcion: "El personal conoce los procedimientos de emergencia", criterio: "Sabe qué hacer en caso de emergencia (incendio, accidente, etc.).", valor: 3, seccion: 6 },
      { id: "ON16", categoria: "Operación", descripcion: "Se realizan pedidos de materias primas con anticipación suficiente", criterio: "Nunca se queda sin materias primas por falta de planeación.", valor: 5, seccion: 6 },
      { id: "ON17", categoria: "Control", descripcion: "Se reportan incidencias y problemas al franquiciante", criterio: "Comunicación oportuna de cualquier problema o incidencia.", valor: 3, seccion: 6 },
    ],
  },
  {
    numero: 7,
    nombre: "Instalaciones y Mobiliario",
    puntos: [
      { id: "IM1", categoria: "Mantenimiento", descripcion: "Las paredes y techo están en buen estado (sin grietas, manchas o humedad)", criterio: "Visualmente en buen estado, pintura en buen estado y sin humedad.", valor: 3, seccion: 7 },
      { id: "IM2", categoria: "Mantenimiento", descripcion: "El piso está en buen estado y limpio", criterio: "Sin grietas, manchas o baldosas rotas. Limpio y sin chicles.", valor: 3, seccion: 7 },
      { id: "IM3", categoria: "Higiene", descripcion: "El baño (si aplica) está limpio y bien equipado", criterio: "Limpio, con jabón, papel higiénico y toallas o secador.", valor: 5, seccion: 7 },
      { id: "IM4", categoria: "Mantenimiento", descripcion: "El mobiliario (mesas, sillas, barra) está en buen estado", criterio: "Sin roturas, manchas permanentes o deterioro visible.", valor: 3, seccion: 7 },
      { id: "IM5", categoria: "Imagen", descripcion: "La decoración y señalización interior está completa y en buen estado", criterio: "Todos los elementos decorativos y señalización según estándar Snowtea.", valor: 3, seccion: 7 },
      { id: "IM6", categoria: "Mantenimiento", descripcion: "La iluminación interior es adecuada y todos los focos funcionan", criterio: "Iluminación suficiente y todos los focos en funcionamiento.", valor: 5, seccion: 7 },
      { id: "IM7", categoria: "Higiene", descripcion: "Las superficies de trabajo están limpias y desinfectadas", criterio: "Barra de atención, área de producción y todas las superficies de trabajo.", valor: 5, seccion: 7 },
      { id: "IM8", categoria: "Mantenimiento", descripcion: "No existen viniles sobrepuestos o en mal estado en el interior", criterio: "Todos los viniles en buen estado y sin superposiciones.", valor: 2, seccion: 7 },
      { id: "IM9", categoria: "Mantenimiento", descripcion: "Las salidas de agua cuentan con filtro de purificación y funciona correctamente", criterio: "Filtro instalado y en funcionamiento.", valor: 3, seccion: 7 },
      { id: "IM10", categoria: "Operación", descripcion: "Se cuenta con un 'no break' para el equipo de cómputo", criterio: "No break instalado y funcionando.", valor: 3, seccion: 7 },
      { id: "IM11", categoria: "Mantenimiento", descripcion: "Todos los focos del techo y exteriores se encuentran funcionando debidamente", criterio: "Sin focos fundidos en interior ni exterior.", valor: 5, seccion: 7 },
      { id: "IM12", categoria: "Imagen", descripcion: "Se encuentran los posters de la medida y los autorizados por Snowtea", criterio: "Solo posters autorizados por Snowtea en las medidas correctas.", valor: 3, seccion: 7 },
    ],
  },
  {
    numero: 8,
    nombre: "Higiene Operativa",
    puntos: [
      { id: "HO1", categoria: "Operación", descripcion: "Se da seguimiento a los procedimientos de limpieza del M.O.", criterio: "Los procedimientos de limpieza del M.O. se siguen al 100%.", valor: 5, seccion: 8 },
      { id: "HO2", categoria: "Higiene", descripcion: "Se cuenta con los productos de limpieza necesarios", criterio: "Jabón, cloro, desinfectante, trapos por área, escoba, trapeador.", valor: 3, seccion: 8 },
      { id: "HO3", categoria: "Higiene", descripcion: "Los trapos están identificados por área y se usan correctamente", criterio: "Trapos de diferentes colores por área (producción, barra, pisos).", valor: 3, seccion: 8 },
      { id: "HO4", categoria: "Higiene", descripcion: "La boquilla de la mamila del chamoy está limpia", criterio: "Limpia y sin residuos de chamoy.", valor: 5, seccion: 8 },
      { id: "HO5", categoria: "Higiene", descripcion: "No existen residuos de chicles pegados en el suelo y barras de servicio", criterio: "Piso y barras sin chicles pegados.", valor: 5, seccion: 8 },
      { id: "HO6", categoria: "Higiene", descripcion: "Existe solución de alcohol en gel para desinfección de manos en producción", criterio: "Alcohol en gel disponible y accesible en el área de producción.", valor: 5, seccion: 8 },
      { id: "HO7", categoria: "Operación", descripcion: "Los vasos de la licuadora son lavados con jabón y esponja según el M.O.", criterio: "Lavado correcto después de cada uso.", valor: 5, seccion: 8 },
    ],
  },
  {
    numero: 9,
    nombre: "Ciclo de Servicio",
    puntos: [
      { id: "SC1", categoria: "Hospitalidad", descripcion: "El personal está sonriente y en buena actitud con el cliente todo el tiempo", criterio: "Siempre sonrientes y con actitud de servicio.", valor: 5, seccion: 9 },
      { id: "SC2", categoria: "Hospitalidad", descripcion: "En su saludo inicial menciona la palabra Snowtea", criterio: "El saludo debe incluir el nombre de la marca.", valor: 5, seccion: 9 },
      { id: "SC3", categoria: "Hospitalidad", descripcion: "Hace recomendaciones de algún sabor", criterio: "Siempre ofrece una recomendación de sabor al cliente.", valor: 5, seccion: 9 },
      { id: "SC4", categoria: "Operación", descripcion: "Informa al cliente el tipo de bebida que desea (base yogurt, chamoy, original)", criterio: "Confirma el tipo de base con el cliente.", valor: 5, seccion: 9 },
      { id: "SC5", categoria: "Hospitalidad", descripcion: "Los M.E. explican qué es la tapioca a los invitados de manera entusiasta y amable", criterio: "Explicación clara y entusiasta de la tapioca.", valor: 5, seccion: 9 },
      { id: "SC6", categoria: "Hospitalidad", descripcion: "Ofrece constantemente degustación y las maneja de manera correcta", criterio: "Ofrece degustación al inicio y en la entrega.", valor: 5, seccion: 9 },
      { id: "SC7", categoria: "Operación", descripcion: "Las bebidas se elaboran en el tiempo indicado según el M.O.", criterio: "Tiempo de elaboración dentro del estándar.", valor: 5, seccion: 9 },
      { id: "SC8", categoria: "Hospitalidad", descripcion: "Al entregar la bebida, si tiene degustación de otro sabor, ¿la ofrece?", criterio: "Siempre ofrece degustación de otro sabor al entregar.", valor: 5, seccion: 9 },
      { id: "SC9", categoria: "Hospitalidad", descripcion: "Invita al cliente a regresar pronto al Snowtea", criterio: "Despedida cálida invitando al cliente a regresar.", valor: 5, seccion: 9 },
    ],
  },
  {
    numero: 10,
    nombre: "Documentación y Legales",
    puntos: [
      { id: "D1", categoria: "Control", descripcion: "Cuenta con licencia de funcionamiento al corriente", criterio: "Licencia vigente y visible.", valor: 5, seccion: 10 },
      { id: "D2", categoria: "Control", descripcion: "Cuenta con bitácora de fumigación o servicio actualizado de control de plagas", criterio: "Bitácora al día con el último servicio.", valor: 5, seccion: 10 },
      { id: "D3", categoria: "Control", descripcion: "Cuenta con el 'Visto Bueno' de protección civil", criterio: "Documento vigente y visible.", valor: 5, seccion: 10 },
      { id: "D4", categoria: "Control", descripcion: "Cuenta con extintor de CO2 (no de polvo)", criterio: "Extintor de CO2 vigente y en su lugar.", valor: 5, seccion: 10 },
      { id: "D5", categoria: "Control", descripcion: "Cuenta con Botiquín de Primeros Auxilios", criterio: "Botiquín completo y accesible.", valor: 5, seccion: 10 },
      { id: "D6", categoria: "Control", descripcion: "Cuenta con las señalizaciones solicitadas por protección civil", criterio: "Señalización completa según protección civil.", valor: 5, seccion: 10 },
      { id: "D7", categoria: "Control", descripcion: "Se tiene al corriente la 'BUOS' Bitácora Única de Operaciones Snowtea", criterio: "BUOS al día con todas las operaciones registradas.", valor: 5, seccion: 10 },
      { id: "D8", categoria: "Control", descripcion: "La 'BUOS' se encuentra almacenada por lo menos con 6 meses de antigüedad", criterio: "Historial de al menos 6 meses en la BUOS.", valor: 3, seccion: 10 },
      { id: "D9", categoria: "Control", descripcion: "Se tiene al corriente los formatos de limpieza", criterio: "Formatos de limpieza al día y firmados.", valor: 5, seccion: 10 },
    ],
  },
];

export const TODOS_LOS_PUNTOS: PuntoEvaluacion[] = SECCIONES.flatMap(s => s.puntos);

export const ESCALA_CALIFICACION = [
  { label: "Excelente", min: 100, max: 100, color: "#16a34a" },
  { label: "Muy Bien", min: 95, max: 99.99, color: "#22c55e" },
  { label: "Bien", min: 90, max: 94.99, color: "#84cc16" },
  { label: "Regular", min: 85, max: 89.99, color: "#eab308" },
  { label: "Mal", min: 80, max: 84.99, color: "#f97316" },
  { label: "Área de Oportunidad", min: 70, max: 79.99, color: "#ef4444" },
  { label: "Acción Inmediata", min: 0, max: 69.99, color: "#991b1b" },
];

export function getCalificacion(porcentaje: number): { label: string; color: string } {
  for (const escala of ESCALA_CALIFICACION) {
    if (porcentaje >= escala.min && porcentaje <= escala.max) {
      return { label: escala.label, color: escala.color };
    }
  }
  return { label: "Acción Inmediata", color: "#991b1b" };
}

export function calcularPuntuacion(respuestasMap: Record<string, "si" | "no" | "na">) {
  let puntosObtenidos = 0;
  let puntosMaximos = 0;
  const porCategoria: Record<string, { obtenidos: number; maximos: number }> = {};
  const porSeccion: Record<number, { obtenidos: number; maximos: number; nombre: string }> = {};

  for (const seccion of SECCIONES) {
    porSeccion[seccion.numero] = { obtenidos: 0, maximos: 0, nombre: seccion.nombre };
    for (const punto of seccion.puntos) {
      const resp = respuestasMap[punto.id];
      const cat = punto.categoria;
      if (!porCategoria[cat]) porCategoria[cat] = { obtenidos: 0, maximos: 0 };

      if (resp === "na") continue; // N/A no cuenta

      puntosMaximos += punto.valor;
      porCategoria[cat].maximos += punto.valor;
      porSeccion[seccion.numero].maximos += punto.valor;

      if (resp === "si") {
        puntosObtenidos += punto.valor;
        porCategoria[cat].obtenidos += punto.valor;
        porSeccion[seccion.numero].obtenidos += punto.valor;
      }
    }
  }

  const porcentajeGeneral = puntosMaximos > 0 ? (puntosObtenidos / puntosMaximos) * 100 : 0;

  return {
    puntosObtenidos,
    puntosMaximos,
    porcentajeGeneral,
    porCategoria,
    porSeccion,
    calificacion: getCalificacion(porcentajeGeneral),
  };
}
