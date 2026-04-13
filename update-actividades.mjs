import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Nueva lista completa de actividades
const actividades = [
  // Diarias
  { clave: 'D1',  descripcion: 'Limpieza de barras de cocina y tarja',                                                                 categoria: 'D', orden: 1,  areaCompatible: 'todas' },
  { clave: 'D2',  descripcion: 'Limpieza de área de calientes y caja',                                                                  categoria: 'D', orden: 2,  areaCompatible: 'todas' },
  { clave: 'D3',  descripcion: 'Limpieza de motores y pantalla de cocina',                                                              categoria: 'D', orden: 3,  areaCompatible: 'preparacion' },
  { clave: 'D4',  descripcion: 'Limpieza de jarabes y todo lo que hay dentro de la jardinera',                                         categoria: 'D', orden: 4,  areaCompatible: 'caja' },
  { clave: 'D5',  descripcion: 'Limpieza de selladora',                                                                                 categoria: 'D', orden: 5,  areaCompatible: 'caja' },
  { clave: 'D6',  descripcion: 'Limpieza de electrónicos de caja',                                                                      categoria: 'D', orden: 6,  areaCompatible: 'caja' },
  { clave: 'D7',  descripcion: 'Limpieza de acrílicos',                                                                                 categoria: 'D', orden: 7,  areaCompatible: 'todas' },
  { clave: 'D8',  descripcion: 'Limpieza de instant pot',                                                                               categoria: 'D', orden: 8,  areaCompatible: 'preparacion' },
  { clave: 'D9',  descripcion: 'Limpieza de trapos con jabón (mañanas) y cada vez que se requiera con jabón',                          categoria: 'D', orden: 9,  areaCompatible: 'todas' },
  { clave: 'D10', descripcion: 'Tirar la basura en los contenedores de la plaza',                                                       categoria: 'D', orden: 10, areaCompatible: 'todas' },
  { clave: 'D11', descripcion: 'Armar shoots limpios',                                                                                  categoria: 'D', orden: 11, areaCompatible: 'preparacion' },
  { clave: 'D12', descripcion: 'Hacer corte de caja y bitácora',                                                                        categoria: 'D', orden: 12, areaCompatible: 'caja' },
  { clave: 'D13', descripcion: 'Barrer y trapear',                                                                                      categoria: 'D', orden: 13, areaCompatible: 'todas' },
  { clave: 'D14', descripcion: 'Lavar y acomodar los trastes',                                                                          categoria: 'D', orden: 14, areaCompatible: 'preparacion' },
  { clave: 'D15', descripcion: 'Lavar, secar y rellenar contenedores de polvo, tés y jarabes',                                         categoria: 'D', orden: 15, areaCompatible: 'preparacion' },
  { clave: 'D16', descripcion: 'Lavar tapones de los shoots',                                                                           categoria: 'D', orden: 16, areaCompatible: 'preparacion' },
  { clave: 'D17', descripcion: 'Limpiar estructura de popotes, vasos, toppings, servilletero y cajas de área de cobro',                categoria: 'D', orden: 17, areaCompatible: 'caja' },
  { clave: 'D18', descripcion: 'Limpiar el carrito',                                                                                    categoria: 'D', orden: 18, areaCompatible: 'comodin' },
  // Semanales isla
  { clave: 'S1',  descripcion: 'Tallar el piso',                                                                                        categoria: 'S', orden: 1,  areaCompatible: 'todas' },
  { clave: 'S2',  descripcion: 'Limpiar paredes de la isla',                                                                            categoria: 'S', orden: 2,  areaCompatible: 'todas' },
  { clave: 'S3',  descripcion: 'Limpiar televisores',                                                                                   categoria: 'S', orden: 3,  areaCompatible: 'todas' },
  { clave: 'S4',  descripcion: 'Limpieza de barras por dentro (2 veces a la semana)',                                                   categoria: 'S', orden: 4,  areaCompatible: 'todas' },
  { clave: 'S5',  descripcion: 'Lavar cafetera con ácido cítrico',                                                                      categoria: 'S', orden: 5,  areaCompatible: 'preparacion' },
  { clave: 'S6',  descripcion: 'Lavar máquina de hielos y filtros',                                                                     categoria: 'S', orden: 6,  areaCompatible: 'preparacion' },
  { clave: 'S7',  descripcion: 'Lavar tapetes de secado de trastes',                                                                    categoria: 'S', orden: 7,  areaCompatible: 'preparacion' },
  { clave: 'S8',  descripcion: 'Lavar red wash',                                                                                        categoria: 'S', orden: 8,  areaCompatible: 'todas' },
  { clave: 'S9',  descripcion: 'Lavar trapeador y recogedor',                                                                           categoria: 'S', orden: 9,  areaCompatible: 'todas' },
  { clave: 'S10', descripcion: 'Lavar botes de basura (2 veces a la semana)',                                                           categoria: 'S', orden: 10, areaCompatible: 'todas' },
  { clave: 'S11', descripcion: 'Lavar llave de contenedor de la base (2 veces a la semana)',                                           categoria: 'S', orden: 11, areaCompatible: 'preparacion' },
  { clave: 'S12', descripcion: 'Limpiar sillas',                                                                                        categoria: 'S', orden: 12, areaCompatible: 'todas' },
  { clave: 'S13', descripcion: 'Lavar refrigerador',                                                                                    categoria: 'S', orden: 13, areaCompatible: 'preparacion' },
  { clave: 'S14', descripcion: 'Barrer y trapear bodega',                                                                               categoria: 'S', orden: 14, areaCompatible: 'todas' },
  { clave: 'S15', descripcion: 'Limpiar isla por fuera',                                                                                categoria: 'S', orden: 15, areaCompatible: 'todas' },
  // Mensuales
  { clave: 'M1',  descripcion: 'Limpiar parte superior de la estructura de la isla',                                                    categoria: 'M', orden: 1,  areaCompatible: 'todas' },
  { clave: 'M2',  descripcion: 'Limpiar selladora de vaso por dentro',                                                                  categoria: 'M', orden: 2,  areaCompatible: 'caja' },
  { clave: 'M3',  descripcion: 'Limpiar cajas de bodega',                                                                               categoria: 'M', orden: 3,  areaCompatible: 'todas' },
  { clave: 'M4',  descripcion: 'Lavar el contenedor de yunnan de bodega',                                                               categoria: 'M', orden: 4,  areaCompatible: 'preparacion' },
];

// Desactivar actividades viejas que ya no existen
const nuevasClaves = actividades.map(a => a.clave);
await conn.execute(
  `UPDATE actividades_catalogo SET activa = false WHERE clave NOT IN (${nuevasClaves.map(() => '?').join(',')})`,
  nuevasClaves
);

// Upsert de cada actividad
for (const act of actividades) {
  await conn.execute(
    `INSERT INTO actividades_catalogo (clave, descripcion, categoria, orden, area_compatible, activa)
     VALUES (?, ?, ?, ?, ?, true)
     ON DUPLICATE KEY UPDATE
       descripcion = VALUES(descripcion),
       categoria   = VALUES(categoria),
       orden       = VALUES(orden),
       area_compatible = VALUES(area_compatible),
       activa      = true`,
    [act.clave, act.descripcion, act.categoria, act.orden, act.areaCompatible]
  );
}

console.log(`✅ ${actividades.length} actividades actualizadas correctamente.`);

// Verificar resultado
const [rows] = await conn.execute('SELECT clave, descripcion, categoria, area_compatible, activa FROM actividades_catalogo ORDER BY categoria, orden');
console.table(rows);

await conn.end();
