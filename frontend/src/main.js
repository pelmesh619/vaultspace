import './styles.css';
import {
  API_BASE,
  fetchInventory,
  fetchMonitoring,
  fetchVault,
} from './api.js';

const POLL_INTERVAL_MS = 5000;
const MAX_LOG_ENTRIES = 8;
const SECURITY_SEGMENTS = 5;

const METRICS = [
  { key: 'power', label: 'POWER RESERVE', unit: '%', bar: true, note: 'SHARE OF CAPACITY' },
  { key: 'water', label: 'WATER RESERVE', unit: '%', bar: true, note: 'SHARE OF CAPACITY' },
  { key: 'food', label: 'FOOD RESERVE', unit: '%', bar: true, note: 'SHARE OF CAPACITY' },
  { key: 'temperature', label: 'TEMPERATURE', unit: '°C', bar: false, note: 'ENVIRONMENT' },
  { key: 'humidity', label: 'HUMIDITY', unit: '%', bar: true, note: 'ENVIRONMENT' },
  { key: 'radiation', label: 'RADIATION', unit: 'IDX', bar: false, note: 'RELATIVE INDEX' },
];

const INVENTORY_ITEMS = [
  { key: 'water', label: 'WATER' },
  { key: 'food', label: 'FOOD' },
  { key: 'medicine', label: 'MEDICINE' },
  { key: 'fuel', label: 'FUEL' },
];

const SECTIONS = [
  { id: 'status', label: 'STATUS' },
  { id: 'monitoring', label: 'MONITORING' },
  { id: 'inventory', label: 'INVENTORY' },
  {
    id: 'map',
    label: 'MAP',
    planned: 'Floor plan and shelter schematic.',
  },
  {
    id: 'radio',
    label: 'RADIO',
    planned: 'System messages and event feed.',
  },
  {
    id: 'system',
    label: 'SYSTEM',
    planned: 'Service status and technical parameters.',
  },
];

const state = {
  vault: null,
  monitoring: null,
  inventory: null,
  lastSyncAt: null,
  link: 'connecting',
  log: [],
};

const els = {
  clock: document.getElementById('clock'),
  link: document.getElementById('link'),
  tabs: document.getElementById('tabs'),
  views: document.getElementById('views'),
  log: document.getElementById('log'),
  logCount: document.getElementById('log-count'),
  endpoint: document.getElementById('endpoint'),
};

let pollTimer = null;
let polling = false;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
}

function formatClock(date = new Date()) {
  return date.toISOString().slice(11, 19);
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(Math.max(number, 0), 100);
}

function describeError(error) {
  if (error?.name === 'AbortError') {
    return 'request timed out';
  }
  return error?.message ?? 'unknown error';
}

/* ------------------------------------------------------------------ */
/* Event log                                                           */
/* ------------------------------------------------------------------ */

function addLog(message, level = 'info') {
  state.log.unshift({ at: new Date(), message, level });
  state.log = state.log.slice(0, MAX_LOG_ENTRIES);
  renderLog();
}

function renderLog() {
  els.logCount.textContent = String(state.log.length).padStart(2, '0');

  if (state.log.length === 0) {
    els.log.innerHTML = '<li class="log-empty">NO EVENTS</li>';
    return;
  }

  els.log.innerHTML = state.log
    .map(
      (entry) => `
        <li class="log-item log-${escapeHtml(entry.level)}">
          <time datetime="${entry.at.toISOString()}">${formatClock(entry.at)}</time>
          <span>${escapeHtml(entry.message)}</span>
        </li>
      `,
    )
    .join('');
}

/* ------------------------------------------------------------------ */
/* Link indicator                                                      */
/* ------------------------------------------------------------------ */

function updateLink() {
  const labels = {
    connecting: 'CONNECTING',
    online: 'LINK ACTIVE',
    offline: 'LINK LOST',
  };

  els.link.textContent = labels[state.link];
  els.link.dataset.state = state.link;
}

function markOnline() {
  const previous = state.link;
  state.link = 'online';
  updateLink();

  if (previous !== 'online') {
    addLog(
      previous === 'connecting'
        ? 'TELEMETRY LINK ESTABLISHED'
        : 'TELEMETRY LINK RESTORED',
    );
  }
}

function markOffline(error) {
  const previous = state.link;
  state.link = 'offline';
  updateLink();

  if (previous !== 'offline') {
    addLog(`TELEMETRY LINK LOST — ${describeError(error)}`, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function emptyCard(title, text) {
  return `
    <article class="card span-full empty">
      <h2 class="card-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function metricCard(metric, data) {
  const raw = data?.[metric.key];
  const percent = metric.bar ? clampPercent(raw) : null;

  return `
    <article class="card stat">
      <p class="card-title">${metric.label}</p>
      <p class="stat-value">
        ${formatNumber(raw)}<span class="stat-unit">${metric.unit}</span>
      </p>
      ${
        metric.bar
          ? `<div class="bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>`
          : ''
      }
      <p class="card-note">${metric.note}</p>
    </article>
  `;
}

function renderStatus() {
  if (!state.vault) {
    return `<div class="view-grid">${emptyCard(
      'VAULT STATUS',
      'Awaiting telemetry from the API.',
    )}</div>`;
  }

  const vault = state.vault;
  const securityLevel = Number(vault.security_level);
  const filledSegments = Number.isFinite(securityLevel)
    ? Math.min(Math.max(Math.round(securityLevel), 0), SECURITY_SEGMENTS)
    : 0;

  const segments = Array.from(
    { length: SECURITY_SEGMENTS },
    (_, index) => `<span class="seg${index < filledSegments ? ' is-on' : ''}"></span>`,
  ).join('');

  const summary = ['power', 'water', 'food']
    .map((key) => {
      const metric = METRICS.find((item) => item.key === key);
      return metricCard(metric, state.monitoring);
    })
    .join('');

  return `
    <div class="view-grid">
      <article class="card span-full hero">
        <div class="card-head">
          <h2 class="card-title">VAULT STATUS</h2>
          <span class="chip">
            <span class="chip-dot" aria-hidden="true"></span>
            ${escapeHtml(vault.status)}
          </span>
        </div>

        <p class="hero-name">${escapeHtml(vault.name)}</p>

        <dl class="meta-grid">
          <div class="meta">
            <dt>OCCUPANTS</dt>
            <dd>${formatNumber(vault.occupants)}</dd>
          </div>
          <div class="meta">
            <dt>SECURITY LEVEL</dt>
            <dd>
              ${filledSegments}<span class="meta-sub"> / ${SECURITY_SEGMENTS}</span>
              <span class="segments" aria-hidden="true">${segments}</span>
            </dd>
          </div>
          <div class="meta">
            <dt>LAST SYNC</dt>
            <dd>${state.lastSyncAt ? formatClock(state.lastSyncAt) : '—'}</dd>
          </div>
        </dl>
      </article>

      ${summary}
    </div>
  `;
}

function renderMonitoring() {
  if (!state.monitoring) {
    return `<div class="view-grid">${emptyCard(
      'MONITORING',
      'Sensor data is unavailable. Check the API uplink.',
    )}</div>`;
  }

  return `
    <div class="view-grid">
      <header class="view-head span-full">
        <h2>ENVIRONMENT &amp; INFRASTRUCTURE</h2>
        <p>Telemetry snapshot &middot; refresh every ${POLL_INTERVAL_MS / 1000} s</p>
      </header>
      ${METRICS.map((metric) => metricCard(metric, state.monitoring)).join('')}
    </div>
  `;
}

function renderInventory() {
  if (!state.inventory) {
    return `<div class="view-grid">${emptyCard(
      'INVENTORY',
      'Stock records are unavailable. Check the API uplink.',
    )}</div>`;
  }

  const cards = INVENTORY_ITEMS.map(
    (item) => `
      <article class="card stat">
        <p class="card-title">${item.label}</p>
        <p class="stat-value">
          ${formatNumber(state.inventory[item.key])}<span class="stat-unit">UNITS</span>
        </p>
        <p class="card-note">RECORDED STOCK</p>
      </article>
    `,
  ).join('');

  return `
    <div class="view-grid">
      <header class="view-head span-full">
        <h2>RESOURCE INVENTORY</h2>
        <p>Reserves registered in the shelter ledger</p>
      </header>
      ${cards}
    </div>
  `;
}

function renderPlanned(section) {
  return `
    <div class="view-grid">
      <article class="card span-full planned">
        <p class="planned-code">MODULE ${section.label}</p>
        <h2 class="planned-title">NOT INSTALLED</h2>
        <p>${escapeHtml(section.planned)}</p>
        <p class="planned-note">Reserved for a future iteration.</p>
      </article>
    </div>
  `;
}

function renderSection(panel, sectionId) {
  const section = SECTIONS.find((item) => item.id === sectionId);
  if (!section) {
    return;
  }

  if (section.planned) {
    panel.innerHTML = renderPlanned(section);
    return;
  }

  const renderers = {
    status: renderStatus,
    monitoring: renderMonitoring,
    inventory: renderInventory,
  };

  panel.innerHTML = renderers[sectionId]();
}

function renderActiveSection() {
  const panel = els.views.querySelector('.view:not([hidden])');
  if (panel) {
    renderSection(panel, panel.dataset.section);
  }
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function activateSection(sectionId, { updateHash = true, focus = false } = {}) {
  const section = SECTIONS.find((item) => item.id === sectionId);
  if (!section) {
    return;
  }

  els.tabs.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.section === sectionId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  els.views.querySelectorAll('.view').forEach((panel) => {
    const active = panel.dataset.section === sectionId;
    panel.hidden = !active;
    if (active) {
      renderSection(panel, sectionId);
    }
  });

  if (focus) {
    document.getElementById(`tab-${sectionId}`)?.focus();
  }

  if (updateHash) {
    history.replaceState(null, '', `#${sectionId}`);
  }
}

function handleTabKeys(event) {
  const currentIndex = SECTIONS.findIndex(
    (section) => section.id === event.target.dataset.section,
  );

  if (currentIndex === -1) {
    return;
  }

  let nextIndex = null;

  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % SECTIONS.length;
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = SECTIONS.length - 1;
  }

  if (nextIndex === null) {
    return;
  }

  event.preventDefault();
  activateSection(SECTIONS[nextIndex].id, { focus: true });
}

function buildShell() {
  els.endpoint.textContent = API_BASE;

  SECTIONS.forEach((section) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.id = `tab-${section.id}`;
    tab.dataset.section = section.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `panel-${section.id}`);
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    tab.innerHTML = `
      <span>${section.label}</span>
      ${section.planned ? '<span class="tab-tag">SOON</span>' : ''}
    `;
    tab.addEventListener('click', () => activateSection(section.id));
    els.tabs.append(tab);

    const panel = document.createElement('section');
    panel.className = 'view';
    panel.id = `panel-${section.id}`;
    panel.dataset.section = section.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.hidden = true;
    els.views.append(panel);
  });

  els.tabs.addEventListener('keydown', handleTabKeys);

  const requested = window.location.hash.replace('#', '');
  const initial = SECTIONS.some((section) => section.id === requested)
    ? requested
    : 'status';

  activateSection(initial, { updateHash: false });
}

/* ------------------------------------------------------------------ */
/* Data polling                                                        */
/* ------------------------------------------------------------------ */

async function sync() {
  if (polling) {
    return;
  }

  polling = true;

  try {
    const [vault, monitoring, inventory] = await Promise.all([
      fetchVault(),
      fetchMonitoring(),
      fetchInventory(),
    ]);

    state.vault = vault;
    state.monitoring = monitoring;
    state.inventory = inventory;
    state.lastSyncAt = new Date();

    markOnline();
    renderActiveSection();
  } catch (error) {
    markOffline(error);
  } finally {
    polling = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(sync, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function updateClock() {
  els.clock.textContent = formatClock();
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

buildShell();
renderLog();
addLog('TERMINAL INITIALIZED');
updateClock();
window.setInterval(updateClock, 1000);

sync();
startPolling();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
    return;
  }

  sync();
  startPolling();
});
