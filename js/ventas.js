/**
 * Lógica pura de agregación del dashboard (sin DOM) — probada con node:test.
 * @typedef {{id:string, fecha:string, region:string, vendedor:string, producto:string,
 *            categoria:string, cantidad:number, precioUnitario:number, total:number}} Venta
 */

export const TODOS = 'todos';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Clave de mes "AAAA-MM" de una fecha ISO "AAAA-MM-DD". */
export const claveMes = (fecha) => fecha.slice(0, 7);

/** "2026-03" → "Mar 2026". */
export function nombreMes(clave) {
  const [anio, mes] = clave.split('-');
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

/** Valida la forma mínima de cada registro y descarta los inválidos. */
export function validarVentas(datos) {
  if (!Array.isArray(datos)) throw new TypeError('ventas.json debe contener un arreglo');
  return datos.filter(
    (v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.fecha) && typeof v.region === 'string'
      && Number.isFinite(v.total) && Number.isFinite(v.cantidad),
  );
}

/** Filtra por mes ("AAAA-MM" o "todos") y región. */
export function filtrarVentas(ventas, { mes = TODOS, region = TODOS } = {}) {
  return ventas.filter(
    (v) => (mes === TODOS || claveMes(v.fecha) === mes) && (region === TODOS || v.region === region),
  );
}

/** KPIs principales. */
export function calcularKpis(ventas) {
  const ingresos = redondear(ventas.reduce((a, v) => a + v.total, 0));
  const unidades = ventas.reduce((a, v) => a + v.cantidad, 0);
  const pedidos = ventas.length;
  return {
    ingresos,
    pedidos,
    unidades,
    ticketPromedio: pedidos ? redondear(ingresos / pedidos) : 0,
  };
}

/** Variación porcentual (null si no hay base de comparación). */
export function variacion(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/** Mes anterior a "AAAA-MM". */
export function mesAnterior(clave) {
  const [a, m] = clave.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Agrupa y suma por un campo (o función). Ordena por total descendente.
 * @returns {Array<{clave:string,total:number,unidades:number,pedidos:number,participacion:number}>}
 */
export function agruparPor(ventas, campo) {
  const getClave = typeof campo === 'function' ? campo : (v) => v[campo];
  const mapa = new Map();
  for (const v of ventas) {
    const k = getClave(v);
    const g = mapa.get(k) ?? { clave: k, total: 0, unidades: 0, pedidos: 0 };
    g.total += v.total;
    g.unidades += v.cantidad;
    g.pedidos += 1;
    mapa.set(k, g);
  }
  const totalGeneral = ventas.reduce((a, v) => a + v.total, 0);
  return [...mapa.values()]
    .map((g) => ({ ...g, total: redondear(g.total), participacion: totalGeneral ? Math.round((g.total / totalGeneral) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total || String(a.clave).localeCompare(String(b.clave)));
}

/** Serie mensual ordenada cronológicamente (incluye meses sin ventas entre el primero y el último). */
export function serieMensual(ventas) {
  const grupos = new Map(agruparPor(ventas, (v) => claveMes(v.fecha)).map((g) => [g.clave, g]));
  const claves = [...grupos.keys()].sort();
  if (claves.length === 0) return [];
  const serie = [];
  for (let k = claves[0]; k <= claves.at(-1); ) {
    serie.push({ mes: k, etiqueta: nombreMes(k), total: grupos.get(k)?.total ?? 0, pedidos: grupos.get(k)?.pedidos ?? 0 });
    const [a, m] = k.split('-').map(Number);
    k = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  }
  return serie;
}

/** Valores únicos ordenados (para poblar filtros). */
export const mesesDisponibles = (ventas) => [...new Set(ventas.map((v) => claveMes(v.fecha)))].sort();
export const regionesDisponibles = (ventas) => [...new Set(ventas.map((v) => v.region))].sort((a, b) => a.localeCompare(b, 'es'));

/** Ordena filas por campo y dirección sin mutar el arreglo. Orden estable. */
export function ordenarFilas(filas, campo, direccion = 'asc') {
  const factor = direccion === 'desc' ? -1 : 1;
  return filas
    .map((f, i) => [f, i])
    .sort(([a, ia], [b, ib]) => {
      const va = a[campo];
      const vb = b[campo];
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true });
      return cmp * factor || ia - ib;
    })
    .map(([f]) => f);
}

/** Pagina un arreglo (página base 1). */
export function paginar(filas, pagina, porPagina = 20) {
  const paginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);
  return { filas: filas.slice((actual - 1) * porPagina, actual * porPagina), pagina: actual, paginas, total: filas.length };
}

/** Formatea soles: "S/ 12,345.60". */
export function formatearSoles(monto, { compacto = false } = {}) {
  if (compacto && Math.abs(monto) >= 1000) {
    const unidades = [[1e6, 'M'], [1e3, 'K']];
    const [div, suf] = unidades.find(([d]) => Math.abs(monto) >= d);
    return `S/ ${(monto / div).toFixed(1).replace(/\.0$/, '')}${suf}`;
  }
  return `S/ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto)}`;
}

/** Calcula todo lo que necesita la vista en una sola llamada. */
export function construirDashboard(ventas, filtros) {
  const filtradas = filtrarVentas(ventas, filtros);
  const kpis = calcularKpis(filtradas);
  let comparacion = null;
  if (filtros?.mes && filtros.mes !== TODOS) {
    const previas = calcularKpis(filtrarVentas(ventas, { ...filtros, mes: mesAnterior(filtros.mes) }));
    comparacion = {
      ingresos: variacion(kpis.ingresos, previas.ingresos),
      pedidos: variacion(kpis.pedidos, previas.pedidos),
      unidades: variacion(kpis.unidades, previas.unidades),
      ticketPromedio: variacion(kpis.ticketPromedio, previas.ticketPromedio),
    };
  }
  return {
    filtradas,
    kpis,
    comparacion,
    // La tendencia mensual ignora el filtro de mes para dar contexto.
    serie: serieMensual(filtrarVentas(ventas, { region: filtros?.region ?? TODOS })),
    porRegion: agruparPor(filtradas, 'region'),
    porCategoria: agruparPor(filtradas, 'categoria'),
    topProductos: agruparPor(filtradas, 'producto').slice(0, 5),
  };
}
