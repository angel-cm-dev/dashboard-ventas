import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TODOS,
  claveMes,
  nombreMes,
  validarVentas,
  filtrarVentas,
  calcularKpis,
  variacion,
  mesAnterior,
  agruparPor,
  serieMensual,
  mesesDisponibles,
  regionesDisponibles,
  ordenarFilas,
  paginar,
  formatearSoles,
  construirDashboard,
} from '../js/ventas.js';

const v = (id, fecha, region, categoria, producto, cantidad, total) => ({ id, fecha, region, categoria, producto, vendedor: 'X', cantidad, precioUnitario: total / cantidad, total });

const muestra = [
  v('V-1', '2026-01-05', 'Lima', 'Software', 'Antivirus', 2, 300),
  v('V-2', '2026-01-20', 'Cusco', 'Servicios', 'Soporte', 1, 120),
  v('V-3', '2026-02-02', 'Lima', 'Software', 'Antivirus', 1, 150),
  v('V-4', '2026-02-14', 'Lima', 'Computadoras', 'Laptop', 1, 3000),
  v('V-5', '2026-04-01', 'Arequipa', 'Servicios', 'Soporte', 3, 360),
];

describe('utilidades de fechas', () => {
  test('claveMes y nombreMes', () => {
    assert.equal(claveMes('2026-03-14'), '2026-03');
    assert.equal(nombreMes('2026-03'), 'Mar 2026');
    assert.equal(nombreMes('2026-12'), 'Dic 2026');
  });
  test('mesAnterior cruza el año', () => {
    assert.equal(mesAnterior('2026-03'), '2026-02');
    assert.equal(mesAnterior('2026-01'), '2025-12');
  });
});

describe('validación y filtros', () => {
  test('validarVentas descarta registros mal formados', () => {
    const datos = [...muestra, { fecha: 'ayer', region: 'Lima', total: 1, cantidad: 1 }, null, { fecha: '2026-01-01', region: 'Lima', total: 'x', cantidad: 1 }];
    assert.equal(validarVentas(datos).length, muestra.length);
    assert.throws(() => validarVentas({}), TypeError);
  });
  test('filtra por mes, región y ambos', () => {
    assert.equal(filtrarVentas(muestra).length, 5);
    assert.equal(filtrarVentas(muestra, { mes: '2026-01' }).length, 2);
    assert.equal(filtrarVentas(muestra, { region: 'Lima' }).length, 3);
    assert.equal(filtrarVentas(muestra, { mes: '2026-02', region: 'Lima' }).length, 2);
    assert.equal(filtrarVentas(muestra, { mes: '2026-02', region: 'Cusco' }).length, 0);
  });
  test('valores disponibles para filtros', () => {
    assert.deepEqual(mesesDisponibles(muestra), ['2026-01', '2026-02', '2026-04']);
    assert.deepEqual(regionesDisponibles(muestra), ['Arequipa', 'Cusco', 'Lima']);
  });
});

describe('agregaciones', () => {
  test('KPIs', () => {
    assert.deepEqual(calcularKpis(muestra), { ingresos: 3930, pedidos: 5, unidades: 8, ticketPromedio: 786 });
  });
  test('KPIs sin ventas', () => {
    assert.deepEqual(calcularKpis([]), { ingresos: 0, pedidos: 0, unidades: 0, ticketPromedio: 0 });
  });
  test('KPIs redondean a céntimos', () => {
    const k = calcularKpis([v('a', '2026-01-01', 'Lima', 'S', 'P', 1, 0.1), v('b', '2026-01-01', 'Lima', 'S', 'P', 1, 0.2)]);
    assert.equal(k.ingresos, 0.3);
    assert.equal(k.ticketPromedio, 0.15);
  });
  test('variación porcentual', () => {
    assert.equal(variacion(150, 100), 50);
    assert.equal(variacion(50, 100), -50);
    assert.equal(variacion(100, 0), null);
    assert.equal(variacion(1, 3), -66.7);
  });
  test('agruparPor región ordena por total y calcula participación', () => {
    const g = agruparPor(muestra, 'region');
    assert.deepEqual(g.map((x) => x.clave), ['Lima', 'Arequipa', 'Cusco']);
    assert.equal(g[0].total, 3450);
    assert.equal(g[0].pedidos, 3);
    assert.equal(g[0].unidades, 4);
    assert.equal(g[0].participacion, 87.8);
    assert.ok(Math.abs(g.reduce((a, x) => a + x.participacion, 0) - 100) < 0.2);
  });
  test('agruparPor acepta una función', () => {
    const g = agruparPor(muestra, (x) => (x.total > 1000 ? 'alto' : 'bajo'));
    assert.deepEqual(g.map((x) => [x.clave, x.pedidos]), [['alto', 1], ['bajo', 4]]);
  });
  test('serie mensual rellena meses sin ventas', () => {
    const s = serieMensual(muestra);
    assert.deepEqual(s.map((x) => x.mes), ['2026-01', '2026-02', '2026-03', '2026-04']);
    assert.deepEqual(s.map((x) => x.total), [420, 3150, 0, 360]);
    assert.equal(s[2].etiqueta, 'Mar 2026');
    assert.deepEqual(serieMensual([]), []);
  });
  test('serie mensual cruza de año', () => {
    const s = serieMensual([v('a', '2025-11-01', 'Lima', 'S', 'P', 1, 1), v('b', '2026-01-01', 'Lima', 'S', 'P', 1, 2)]);
    assert.deepEqual(s.map((x) => x.mes), ['2025-11', '2025-12', '2026-01']);
  });
});

describe('tabla', () => {
  test('ordena números y textos en ambas direcciones', () => {
    assert.deepEqual(ordenarFilas(muestra, 'total').map((x) => x.id), ['V-2', 'V-3', 'V-1', 'V-5', 'V-4']);
    assert.deepEqual(ordenarFilas(muestra, 'total', 'desc').map((x) => x.id), ['V-4', 'V-5', 'V-1', 'V-3', 'V-2']);
    assert.deepEqual(ordenarFilas(muestra, 'region').map((x) => x.region), ['Arequipa', 'Cusco', 'Lima', 'Lima', 'Lima']);
  });
  test('orden estable y sin mutar el original', () => {
    const copia = [...muestra];
    const r = ordenarFilas(muestra, 'region');
    assert.deepEqual(r.filter((x) => x.region === 'Lima').map((x) => x.id), ['V-1', 'V-3', 'V-4']);
    assert.deepEqual(muestra, copia);
  });
  test('orden numérico natural en IDs', () => {
    const filas = [{ id: 'V-10' }, { id: 'V-2' }, { id: 'V-1' }];
    assert.deepEqual(ordenarFilas(filas, 'id').map((x) => x.id), ['V-1', 'V-2', 'V-10']);
  });
  test('paginación', () => {
    const filas = Array.from({ length: 23 }, (_, i) => i);
    assert.deepEqual(paginar(filas, 1, 10).filas, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(paginar(filas, 3, 10), { filas: [20, 21, 22], pagina: 3, paginas: 3, total: 23 });
    assert.equal(paginar(filas, 99, 10).pagina, 3);
    assert.equal(paginar(filas, 0, 10).pagina, 1);
    assert.equal(paginar([], 1, 10).paginas, 1);
  });
});

describe('formato y dashboard', () => {
  test('formatearSoles', () => {
    assert.equal(formatearSoles(1234.5), 'S/ 1,234.50');
    assert.equal(formatearSoles(1500, { compacto: true }), 'S/ 1.5K');
    assert.equal(formatearSoles(2000000, { compacto: true }), 'S/ 2M');
    assert.equal(formatearSoles(999, { compacto: true }), 'S/ 999.00');
  });
  test('construirDashboard compara con el mes anterior', () => {
    const d = construirDashboard(muestra, { mes: '2026-02', region: TODOS });
    assert.equal(d.kpis.ingresos, 3150);
    assert.equal(d.comparacion.ingresos, 650);
    assert.equal(d.comparacion.pedidos, 0);
    assert.equal(d.serie.length, 4, 'la serie ignora el filtro de mes');
    assert.equal(d.topProductos[0].clave, 'Laptop');
  });
  test('construirDashboard sin mes no compara', () => {
    const d = construirDashboard(muestra, { mes: TODOS, region: 'Lima' });
    assert.equal(d.comparacion, null);
    assert.equal(d.kpis.pedidos, 3);
    assert.deepEqual(d.porRegion.map((g) => g.clave), ['Lima']);
  });
});

describe('data/ventas.json', () => {
  test('es válido y consistente', async () => {
    const datos = JSON.parse(await readFile(new URL('../data/ventas.json', import.meta.url), 'utf8'));
    assert.ok(datos.length >= 100);
    assert.equal(validarVentas(datos).length, datos.length);
    assert.equal(new Set(datos.map((x) => x.id)).size, datos.length, 'IDs únicos');
    for (const x of datos) {
      assert.ok(Math.abs(x.precioUnitario * x.cantidad - x.total) < 0.01, `total inconsistente en ${x.id}`);
    }
    assert.equal(mesesDisponibles(datos).length, 12);
  });
});
