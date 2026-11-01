import {
  TODOS,
  validarVentas,
  construirDashboard,
  mesesDisponibles,
  regionesDisponibles,
  nombreMes,
  ordenarFilas,
  paginar,
  formatearSoles,
} from './ventas.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...hijos) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...hijos);
  return n;
};
const fmtNum = new Intl.NumberFormat('es-PE');
const POR_PAGINA = 15;

const estado = { ventas: [], filtros: { mes: TODOS, region: TODOS }, orden: { campo: 'fecha', dir: 'desc' }, pagina: 1 };
const charts = {};

/* ---------------------------------------------------------------- Tema */
function colores() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    texto: v('--muted'),
    borde: v('--border'),
    primario: v('--primary'),
    paleta: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'],
  };
}

$('#btn-tema').addEventListener('click', () => {
  const actual = document.documentElement.dataset.theme
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nuevo = actual === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('dashboard-ventas:tema', nuevo); } catch { /* sin almacenamiento */ }
  renderGraficos(construirDashboard(estado.ventas, estado.filtros), true);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  renderGraficos(construirDashboard(estado.ventas, estado.filtros), true);
});

/* -------------------------------------------------------------- Gráficos */
function grafico(id, config, recrear) {
  if (charts[id] && !recrear) {
    charts[id].data = config.data;
    charts[id].update();
    return;
  }
  charts[id]?.destroy();
  charts[id] = new window.Chart(document.getElementById(id), config);
}

function renderGraficos(d, recrear = false) {
  if (!window.Chart) return;
  const c = colores();
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.Chart.defaults.color = c.texto;
  window.Chart.defaults.borderColor = c.borde;
  window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducido ? false : { duration: 400 },
    plugins: { tooltip: { callbacks: { label: (ctx) => ` ${formatearSoles(ctx.parsed.y ?? ctx.parsed)}` } } },
  };
  const ejeSoles = { ticks: { callback: (v) => formatearSoles(v, { compacto: true }) } };

  grafico('chart-mes', {
    type: 'line',
    data: {
      labels: d.serie.map((s) => s.etiqueta),
      datasets: [{
        label: 'Ingresos',
        data: d.serie.map((s) => s.total),
        borderColor: c.primario,
        backgroundColor: `${c.paleta[0]}33`,
        fill: true,
        tension: 0.3,
        pointRadius: d.serie.map((s) => (s.mes === estado.filtros.mes ? 6 : 3)),
      }],
    },
    options: { ...base, plugins: { ...base.plugins, legend: { display: false } }, scales: { y: ejeSoles } },
  }, recrear);

  grafico('chart-region', {
    type: 'bar',
    data: {
      labels: d.porRegion.map((g) => g.clave),
      datasets: [{ label: 'Ingresos', data: d.porRegion.map((g) => g.total), backgroundColor: c.paleta[1], borderRadius: 6 }],
    },
    options: { ...base, plugins: { ...base.plugins, legend: { display: false } }, scales: { y: ejeSoles } },
  }, recrear);

  grafico('chart-categoria', {
    type: 'doughnut',
    data: {
      labels: d.porCategoria.map((g) => `${g.clave} (${g.participacion}%)`),
      datasets: [{ data: d.porCategoria.map((g) => g.total), backgroundColor: c.paleta, borderWidth: 0 }],
    },
    options: { ...base, cutout: '62%', plugins: { ...base.plugins, legend: { position: 'bottom' } } },
  }, recrear);
}

/* ------------------------------------------------------------------ KPIs */
function renderKpis({ kpis, comparacion }) {
  const textos = {
    ingresos: formatearSoles(kpis.ingresos),
    pedidos: fmtNum.format(kpis.pedidos),
    unidades: fmtNum.format(kpis.unidades),
    ticketPromedio: formatearSoles(kpis.ticketPromedio),
  };
  for (const [k, texto] of Object.entries(textos)) {
    $(`[data-kpi="${k}"]`).textContent = texto;
    const delta = $(`[data-delta="${k}"]`);
    const v = comparacion?.[k];
    delta.className = 'delta';
    if (v === null || v === undefined) {
      delta.textContent = comparacion ? 'Sin datos del mes anterior' : 'Selecciona un mes para comparar';
    } else {
      delta.classList.add(v >= 0 ? 'up' : 'down');
      delta.textContent = `${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}% vs. mes anterior`;
    }
  }
}

function renderTop({ topProductos }) {
  const max = topProductos[0]?.total || 1;
  $('#top-productos').replaceChildren(
    ...topProductos.map((p) =>
      el('li', {},
        el('span', { textContent: p.clave }),
        el('strong', { textContent: formatearSoles(p.total, { compacto: true }) }),
        el('div', { className: 'barra', ariaHidden: 'true' }, el('span', { style: `width:${(p.total / max) * 100}%` })),
      )),
  );
  if (!topProductos.length) $('#top-productos').append(el('li', { textContent: 'Sin ventas para el filtro seleccionado.' }));
}

/* ----------------------------------------------------------------- Tabla */
function renderTabla(filtradas) {
  const ordenadas = ordenarFilas(filtradas, estado.orden.campo, estado.orden.dir);
  const p = paginar(ordenadas, estado.pagina, POR_PAGINA);
  estado.pagina = p.pagina;

  $('#tabla-cuerpo').replaceChildren(
    ...p.filas.map((v) =>
      el('tr', {},
        el('td', { textContent: v.id }),
        el('td', { textContent: v.fecha }),
        el('td', { textContent: v.region }),
        el('td', { textContent: v.vendedor }),
        el('td', { textContent: v.producto }),
        el('td', { className: 'num', textContent: fmtNum.format(v.cantidad) }),
        el('td', { className: 'num', textContent: formatearSoles(v.total) }),
      )),
  );
  $('#resumen-tabla').textContent = `${fmtNum.format(p.total)} registros`;
  $('#pag-info').textContent = `Página ${p.pagina} de ${p.paginas}`;
  $('#pag-anterior').disabled = p.pagina <= 1;
  $('#pag-siguiente').disabled = p.pagina >= p.paginas;

  document.querySelectorAll('.tabla th').forEach((th) => {
    const campo = th.querySelector('button').dataset.campo;
    th.setAttribute('aria-sort', campo === estado.orden.campo ? (estado.orden.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

document.querySelectorAll('.tabla th button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const { campo } = btn.dataset;
    estado.orden = { campo, dir: estado.orden.campo === campo && estado.orden.dir === 'asc' ? 'desc' : 'asc' };
    estado.pagina = 1;
    renderTabla(construirDashboard(estado.ventas, estado.filtros).filtradas);
  });
});
$('#pag-anterior').addEventListener('click', () => { estado.pagina--; render(false); });
$('#pag-siguiente').addEventListener('click', () => { estado.pagina++; render(false); });

/* --------------------------------------------------------------- Filtros */
const form = $('#filtros');
form.addEventListener('change', () => {
  estado.filtros = { mes: $('#filtro-mes').value, region: $('#filtro-region').value };
  estado.pagina = 1;
  sincronizarUrl();
  render();
});
form.addEventListener('reset', () => setTimeout(() => form.dispatchEvent(new Event('change'))));
form.addEventListener('submit', (e) => e.preventDefault());

/** Mantiene los filtros en la URL (?mes=2026-03&region=Lima) para compartir la vista. */
function sincronizarUrl() {
  const params = new URLSearchParams();
  if (estado.filtros.mes !== TODOS) params.set('mes', estado.filtros.mes);
  if (estado.filtros.region !== TODOS) params.set('region', estado.filtros.region);
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
}

function poblarFiltros(ventas) {
  $('#filtro-mes').append(...mesesDisponibles(ventas).map((m) => el('option', { value: m, textContent: nombreMes(m) })));
  $('#filtro-region').append(...regionesDisponibles(ventas).map((r) => el('option', { value: r, textContent: r })));
  const params = new URLSearchParams(location.search);
  for (const [clave, select] of [['mes', $('#filtro-mes')], ['region', $('#filtro-region')]]) {
    const valor = params.get(clave);
    if (valor && [...select.options].some((o) => o.value === valor)) select.value = valor;
  }
  estado.filtros = { mes: $('#filtro-mes').value, region: $('#filtro-region').value };
}

/* ---------------------------------------------------------------- Render */
function render(conGraficos = true) {
  const d = construirDashboard(estado.ventas, estado.filtros);
  renderKpis(d);
  renderTop(d);
  renderTabla(d.filtradas);
  if (conGraficos) renderGraficos(d);
}

function mostrarMensaje(texto) {
  const m = $('#mensaje');
  m.textContent = texto;
  m.hidden = false;
}

try {
  const res = await fetch('data/ventas.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  estado.ventas = validarVentas(await res.json());
  poblarFiltros(estado.ventas);
  if (!window.Chart) mostrarMensaje('No se pudo cargar Chart.js desde el CDN; se muestran KPIs y tabla sin gráficos.');
  render();
} catch (err) {
  mostrarMensaje(`No se pudieron cargar los datos (${err.message}). Abre el proyecto con un servidor estático: npx serve .`);
}
