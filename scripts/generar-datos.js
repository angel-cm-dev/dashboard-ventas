/**
 * Genera data/ventas.json con datos FICTICIOS y reproducibles (semilla fija).
 * Uso: node scripts/generar-datos.js [cantidad] [semilla]
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CANTIDAD = Number(process.argv[2] ?? 720);
const SEMILLA = Number(process.argv[3] ?? 2026);

// PRNG determinista (mulberry32).
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEMILLA);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickPeso = (pares) => {
  const total = pares.reduce((a, [, p]) => a + p, 0);
  let r = rnd() * total;
  for (const [v, p] of pares) { if ((r -= p) < 0) return v; }
  return pares.at(-1)[0];
};

const REGIONES = [['Lima', 40], ['Arequipa', 15], ['La Libertad', 14], ['Piura', 11], ['Cusco', 10], ['Junín', 10]];
const VENDEDORES = ['Lucía Ramos', 'Carlos Quispe', 'María Torres', 'Jorge Huamán', 'Ana Flores', 'Diego Chávez'];
const PRODUCTOS = [
  { producto: 'Laptop 14"', categoria: 'Computadoras', precio: 3299 },
  { producto: 'Monitor 27"', categoria: 'Periféricos', precio: 1149 },
  { producto: 'Teclado mecánico', categoria: 'Periféricos', precio: 289 },
  { producto: 'Mouse inalámbrico', categoria: 'Periféricos', precio: 89 },
  { producto: 'Licencia antivirus', categoria: 'Software', precio: 159 },
  { producto: 'Suite ofimática', categoria: 'Software', precio: 449 },
  { producto: 'Soporte técnico (h)', categoria: 'Servicios', precio: 120 },
  { producto: 'Instalación de red', categoria: 'Servicios', precio: 1800 },
  { producto: 'PC de escritorio', categoria: 'Computadoras', precio: 2599 },
];
// Estacionalidad: más ventas en marzo (campaña escolar), julio (fiestas patrias) y diciembre.
const PESO_MES = [8, 7, 11, 8, 8, 8, 11, 8, 8, 8, 9, 14];

const ventas = [];
for (let i = 0; i < CANTIDAD; i++) {
  const mes = pickPeso(PESO_MES.map((p, m) => [m, p]));
  const dia = 1 + Math.floor(rnd() * new Date(Date.UTC(2026, mes + 1, 0)).getUTCDate());
  const p = pick(PRODUCTOS);
  const cantidad = 1 + Math.floor(rnd() ** 2 * (p.precio > 1000 ? 4 : 12));
  const descuento = rnd() < 0.2 ? 0.05 : 0;
  const precioUnitario = Math.round(p.precio * (1 - descuento) * 100) / 100;
  ventas.push({
    fecha: `2026-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    region: pickPeso(REGIONES),
    vendedor: pick(VENDEDORES),
    producto: p.producto,
    categoria: p.categoria,
    cantidad,
    precioUnitario,
    total: Math.round(precioUnitario * cantidad * 100) / 100,
  });
}
ventas.sort((a, b) => a.fecha.localeCompare(b.fecha));
ventas.forEach((v, i) => { v.id = `V-${String(i + 1).padStart(5, '0')}`; });

const destino = fileURLToPath(new URL('../data/ventas.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
// Un registro por línea: legible y con diffs limpios.
const lineas = ventas.map(({ id, ...rest }) => JSON.stringify({ id, ...rest }));
await writeFile(destino, `[\n${lineas.join(',\n')}\n]\n`);
console.log(`Generadas ${ventas.length} ventas ficticias en ${destino}`);
