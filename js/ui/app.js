import { initializeTheme } from './theme.js?v=0.5.0';
import { createWizard } from './wizard.js?v=0.5.0';
import { STATE_KEY, createState, normalizeState } from '../engine/state.js?v=0.5.0';
import { createCatalog } from './catalog.js?v=0.5.0';
import { createWorkspace } from './workspace.js?v=0.5.0';

const VIEWS = new Set(['dashboard', 'wizard', 'checklist', 'search', 'chains', 'payloads']);

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STATE_KEY))); }
  catch { return createState(); }
}

function saveState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn('WAPT state could not be persisted locally.', error); }
}

let state = loadState();
let manifest = { categories: [] };
let wizard;
const catalog = createCatalog();
let workspace;

function updateIdentity() {
  document.querySelector('[data-engagement-name]').textContent = state.engagement.name.trim() || 'Unsaved engagement';
  document.querySelector('[data-engagement-target]').textContent = state.engagement.targetUrl.trim() || 'No target URL set';
}


function renderManifest() {
  document.querySelector('[data-category-total]').textContent = manifest.categories.length;
  const navigation = document.querySelector('[data-category-nav]');
  const grid = document.querySelector('[data-catalog-grid]');
  navigation.replaceChildren(...manifest.categories.map((category) => {
    const link = document.createElement('a');
    link.href = `#checklist/${category.slug}`;
    link.dataset.categorySlug = category.slug;
    link.innerHTML = `<span>${String(category.order).padStart(2, '0')}</span><strong></strong><em>${category.count}</em>`;
    link.querySelector('strong').textContent = category.name;
    return link;
  }));
  if (grid) {
    grid.replaceChildren(...manifest.categories.map((category) => {
      const card = document.createElement('a');
      card.className = 'category-card';
      card.href = `#checklist/${category.slug}`;
      card.innerHTML = `<span>${category.prefix}</span><h2></h2><p></p><footer><span>${category.count} production</span><span>floor ${category.floor}</span></footer>`;
      card.querySelector('h2').textContent = category.name;
      card.querySelector('p').textContent = category.summary;
      return card;
    }));
  }
  workspace?.setManifest(manifest);
  route();
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
    const output = document.querySelector('[data-checklist-results]');
    if (output) output.textContent = 'The checklist manifest could not be loaded. Serve the repository over HTTP rather than opening this file directly.';
    console.error(error);
  }
}

function currentView() {
  const candidate = location.hash.slice(1).split('/')[0];
  return VIEWS.has(candidate) ? candidate : 'wizard';
}

function route() {
  const [viewPart, slug = ''] = location.hash.slice(1).split('/');
  const view = VIEWS.has(viewPart) ? viewPart : 'wizard';
  document.querySelectorAll('[data-view]').forEach((section) => { section.hidden = section.dataset.view !== view; });
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    if (link.dataset.viewLink === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('[data-sidebar-close]')?.click();
  const heading = document.querySelector(`[data-view="${view}"] h1`);
  if (heading && location.hash) heading.setAttribute('tabindex', '-1');
  if (manifest.categories.length && ['dashboard', 'checklist', 'search'].includes(view)) {
    workspace.show(view, slug).catch((error) => {
      const target = document.querySelector(`[data-${view}-results], [data-suggested-next]`);
      if (target) target.textContent = `Methodology could not be loaded: ${error.message}`;
      console.error(error);
    });
  }
}

function resetWizard() {
  const reset = createState();
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

  workspace = createWorkspace({
    catalog,
    getState: () => state,
    onStateChange(nextState) {
      state = nextState;
      saveState(state);
      updateIdentity();
    },
    replaceState(nextState) {
      state = nextState;
      saveState(state);
      updateIdentity();
      wizard?.reset(state);
    }
  });
  workspace.bindActions();

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
