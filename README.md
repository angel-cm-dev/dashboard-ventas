# dashboard-ventas

Dashboard de ventas estático (HTML/CSS/JS vanilla + Chart.js) con KPIs, filtros por mes y región, gráficos y tabla ordenable a partir de un JSON.

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-4.4.1-FF6384?logo=chartdotjs&logoColor=white)
![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)
[![CI](https://github.com/angel-cm-dev/dashboard-ventas/actions/workflows/ci.yml/badge.svg)](https://github.com/angel-cm-dev/dashboard-ventas/actions/workflows/ci.yml)

## Características

- **KPIs**: ingresos, pedidos, unidades y ticket promedio, con **variación vs. mes anterior** al filtrar por mes.
- **Filtros** por mes y región, sincronizados con la URL (`?mes=2026-07&region=Lima`) para compartir vistas.
- **Gráficos** con Chart.js 4.4.1 (CDN, versión fija): tendencia mensual, ingresos por región y participación por categoría.
- **Top 5 productos** con barras de proporción.
- **Tabla ordenable** por cualquier columna (`aria-sort`, accesible por teclado) y paginada.
- **Modo oscuro** automático o manual; los gráficos se adaptan al tema y respetan `prefers-reduced-motion`.
- Si el CDN falla, KPIs y tabla siguen funcionando.
- **Lógica de agregación** en un módulo ES puro (`js/ventas.js`) probado con `node:test`.
- `data/ventas.json` con **720 ventas ficticias** generadas de forma reproducible (semilla fija y estacionalidad: campaña escolar, Fiestas Patrias y Navidad).

## Requisitos

- Navegador moderno con conexión a internet (para cargar Chart.js desde jsDelivr).
- Node.js 20+ para pruebas y para regenerar los datos (o Python 3 para servir la página).

## Instalación y uso

```bash
git clone https://github.com/angel-cm-dev/dashboard-ventas.git
cd dashboard-ventas

npx serve .
# o
python -m http.server 5174
```

Abre `http://localhost:3000` (serve) o `http://localhost:5174` (Python). Es necesario un servidor porque la página usa `fetch` para leer `data/ventas.json`.

Regenerar los datos ficticios (cantidad y semilla opcionales):

```bash
npm run datos
node scripts/generar-datos.js 1500 42
```

## Ejemplo de uso

Formato de cada registro en `data/ventas.json`:

```json
{ "id": "V-00001", "fecha": "2026-01-01", "region": "Arequipa", "vendedor": "Diego Chávez",
  "producto": "Monitor 27\"", "categoria": "Periféricos", "cantidad": 1, "precioUnitario": 1149, "total": 1149 }
```

Uso de la lógica de agregación desde otro módulo:

```js
import { construirDashboard, formatearSoles } from './js/ventas.js';

const ventas = await (await fetch('data/ventas.json')).json();
const d = construirDashboard(ventas, { mes: '2026-07', region: 'Lima' });

formatearSoles(d.kpis.ingresos); // 'S/ 67,679.75'
d.comparacion.ingresos;          // 120.8 (% de variación vs. junio)
d.porCategoria;                  // [{ clave, total, unidades, pedidos, participacion }, ...]
```

Para usar datos reales basta con exportarlos (desde Excel, una API o un flujo de n8n) con los mismos campos.

## Estructura del proyecto

```
dashboard-ventas/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js               # Interfaz: filtros, KPIs, gráficos y tabla
│   └── ventas.js            # Lógica pura de filtros y agregaciones
├── data/ventas.json         # Datos ficticios
├── scripts/generar-datos.js # Generador reproducible de datos
├── test/ventas.test.js      # Pruebas con node:test
└── .github/workflows/ci.yml
```

## Pruebas

```bash
npm test
```

21 pruebas: filtros, KPIs, redondeo, variaciones, agrupaciones con participación %, serie mensual con meses vacíos y cambio de año, ordenamiento estable, paginación y consistencia de `data/ventas.json`.

## Roadmap

- [ ] Exportar la vista filtrada a CSV.
- [ ] Filtro por rango de fechas y por vendedor.
- [ ] Conectar a una API (.NET 8 / FastAPI) en lugar del JSON estático.

## Licencia y autor

Distribuido bajo licencia [MIT](LICENSE).

Desarrollado por **Angel Castañeda Meza** — Ingeniero de Sistemas, Lima, Perú.
GitHub: [@angel-cm-dev](https://github.com/angel-cm-dev)
