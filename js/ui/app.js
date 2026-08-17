import { initializeTheme } from './theme.js?v=0.2.0';
import { createWizard, QUESTIONS } from './wizard.js?v=0.2.0';

const STORAGE_KEY = 'wapt.state.v1';
const VIEWS = new Set(['dashboard', 'wizard', 'checklist', 'search', 'chains', 'payloads']);

function initialAnswers() {
  return Object.fromEntries(QUESTIONS.map((question) => [question.key, question.multi ? ['unknown'] : 'unknown']));
}

function defaultState() {
  return {
    schema_version: 1,
    engagement: { name: '', targetUrl: '', started_at: null },
    answers: initialAnswers(),
    statuses: {},
    notes: {},
    overrides: {},
    retests: {},
    updated_at: null
  };
}

function normalizeState(candidate) {
  const base = defaultState();
  if (!candidate || typeof candidate !== 'object' || candidate.schema_version !== 1) return base;
  return {
    ...base,
    engagement: { ...base.engagement, ...(candidate.engagement && typeof candidate.engagement === 'object' ? candidate.engagement : {}) },
    answers: { ...base.answers, ...(candidate.answers && typeof candidate.answers === 'object' ? candidate.answers : {}) },
    statuses: candidate.statuses && typeof candidate.statuses === 'object' ? candidate.statuses : {},
    notes: candidate.notes && typeof candidate.notes === 'object' ? candidate.notes : {},
    overrides: candidate.overrides && typeof candidate.overrides === 'object' ? candidate.overrides : {},
    retests: candidate.retests && typeof candidate.retests === 'object' ? candidate.retests : {},
    updated_at: typeof candidate.updated_at === 'string' ? candidate.updated_at : null
  };
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return defaultState(); }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn('WAPT state could not be persisted locally.', error); }
}

let state = loadState();
let manifest = { categories: [] };
let wizard;

function updateIdentity() {
  document.querySelector('[data-engagement-name]').textContent = state.engagement.name.trim() || 'Unsaved engagement';
  document.querySelector('[data-engagement-target]').textContent = state.engagement.targetUrl.trim() || 'No target URL set';
}

function statusCounts() {
  const statuses = Object.values(state.statuses);
  return {
    tested: statuses.filter((status) => status && status !== 'not_tested').length,
    potential: statuses.filter((status) => status === 'potential_finding').length,
    confirmed: statuses.filter((status) => status === 'confirmed_finding').length
  };
}

function renderDashboard() {
  const counts = statusCounts();
  const itemCount = manifest.categories.reduce((sum, category) => sum + category.count, 0);
  document.querySelector('[data-dashboard-items]').textContent = itemCount.toLocaleString();
  document.querySelector('[data-dashboard-tested]').textContent = counts.tested.toLocaleString();
  document.querySelector('[data-dashboard-potential]').textContent = counts.potential.toLocaleString();
  document.querySelector('[data-dashboard-confirmed]').textContent = counts.confirmed.toLocaleString();
}

function renderManifest() {
  document.querySelector('[data-category-total]').textContent = manifest.categories.length;
  const navigation = document.querySelector('[data-category-nav]');
  const grid = document.querySelector('[data-catalog-grid]');
  navigation.replaceChildren(...manifest.categories.map((category) => {
    const link = document.createElement('a');
    link.href = `#checklist/${category.slug}`;
    link.innerHTML = `<span>${String(category.order).padStart(2, '0')}</span><strong></strong><em>${category.count}</em>`;
    link.querySelector('strong').textContent = category.name;
    return link;
  }));
  grid.replaceChildren(...manifest.categories.map((category) => {
    const card = document.createElement('a');
    card.className = 'category-card';
    card.href = `#checklist/${category.slug}`;
    card.innerHTML = `<span>${category.prefix}</span><h2></h2><p></p><footer><span>${category.count} production</span><span>floor ${category.floor}</span></footer>`;
    card.querySelector('h2').textContent = category.name;
    card.querySelector('p').textContent = category.summary;
    return card;
  }));
  renderDashboard();
}

async function loadManifest() {
  try {
    const response = await fetch('checklist/manifest.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.categories)) throw new Error('Invalid category manifest');
    manifest = data;
    renderManifest();
  } catch (error) {
    document.querySelector('[data-category-nav]').textContent = 'Catalog unavailable';
    document.querySelector('[data-catalog-grid]').textContent = 'The checklist manifest could not be loaded. Serve the repository over HTTP rather than opening this file directly.';
    console.error(error);
  }
}

function currentView() {
  const candidate = location.hash.slice(1).split('/')[0];
  return VIEWS.has(candidate) ? candidate : 'wizard';
}

function route() {
  const view = currentView();
  document.querySelectorAll('[data-view]').forEach((section) => { section.hidden = section.dataset.view !== view; });
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    if (link.dataset.viewLink === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('[data-sidebar-close]')?.click();
  const heading = document.querySelector(`[data-view="${view}"] h1`);
  if (heading && location.hash) heading.setAttribute('tabindex', '-1');
  if (view === 'search') setTimeout(() => document.querySelector('#shell-search')?.focus(), 0);
}

function resetWizard() {
  const reset = defaultState();
  state = {
    ...state,
    engagement: reset.engagement,
    answers: reset.answers,
    updated_at: new Date().toISOString()
  };
  saveState(state);
  updateIdentity();
  wizard.reset(state);
}

function initializeShell() {
  initializeTheme();
  updateIdentity();

  wizard = createWizard(document.querySelector('#wizard-root'), state, {
    onChange(nextState) {
      state = nextState;
      saveState(state);
      updateIdentity();
    },
    onComplete(nextState) {
      state = nextState;
      saveState(state);
      updateIdentity();
      location.hash = 'dashboard';
    }
  });

  document.querySelector('[data-wizard-reset]').addEventListener('click', () => {
    if (window.confirm('Start scope over? Existing item statuses and notes will be retained.')) resetWizard();
  });
  document.querySelector('[data-sidebar-open]').addEventListener('click', () => {
    document.querySelector('#sidebar').dataset.open = 'true';
    document.querySelector('.sidebar-scrim').hidden = false;
  });
  document.querySelectorAll('[data-sidebar-close]').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('#sidebar').removeAttribute('data-open');
    document.querySelector('.sidebar-scrim').hidden = true;
  }));
  document.querySelector('[data-go-search]').addEventListener('click', () => { location.hash = 'search'; });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      location.hash = 'search';
    }
    if (event.key === 'Escape' && document.querySelector('#sidebar').dataset.open === 'true') {
      document.querySelector('[data-sidebar-close]').click();
    }
  });
  window.addEventListener('hashchange', route);
  route();
  loadManifest();
}

initializeShell();
