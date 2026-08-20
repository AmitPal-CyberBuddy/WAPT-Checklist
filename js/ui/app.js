import { initializeTheme } from './theme.js?v=1.0.0-r7';
import { createWizard } from './wizard.js?v=1.0.0-r7';
import { STATE_KEY, createState, setAnswers, setEngagement, setPosition } from '../engine/state.js?v=1.0.0-r7';
import { activeEngagement, addEngagement, normalizePortfolio, removeEngagement, selectEngagement, updateActiveEngagement } from '../engine/portfolio.js?v=1.0.0-r7';
import { engagementIsBlank, parseShareHash } from '../engine/share.js?v=1.0.0-r7';
import { createCatalog } from './catalog.js?v=1.0.0-r7';
import { createWorkspace } from './workspace.js?v=1.0.0-r7';

const VIEWS = new Set(['dashboard', 'playbooks', 'playbook', 'families', 'family', 'wizard', 'checklist', 'search', 'chains', 'payloads']);

// Where should the tester land? A real engagement is resumed, not restarted: if this browser
// already holds progress, return to the last position instead of the scope wizard.
function initialHash(current) {
  const position = current.position || {};
  if (position.view === 'family' && position.family) return `family/${position.family}`;
  if (position.view === 'playbook' && position.family) return `playbook/${position.family}`;
  if (position.view === 'checklist' && position.category) return `checklist/${position.category}`;
  if (position.view) return position.view;
  return 'dashboard';
}

function loadPortfolio() {
  try { return normalizePortfolio(JSON.parse(localStorage.getItem(STATE_KEY))); }
  catch { return normalizePortfolio(null); }
}

function savePortfolio() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATE_KEY));
    const preferences = stored && typeof stored === 'object' ? stored.preferences : portfolio.preferences;
    portfolio = { ...portfolio, preferences: { ...portfolio.preferences, ...preferences } };
    localStorage.setItem(STATE_KEY, JSON.stringify(portfolio));
  } catch (error) { console.warn('WAPT engagements could not be persisted locally.', error); }
}

let portfolio = loadPortfolio();
let state = activeEngagement(portfolio);
let manifest = { categories: [] };
let wizard;
const catalog = createCatalog();
let workspace;

function updateIdentity() {
  document.querySelector('[data-engagement-name]').textContent = state.engagement.name.trim() || 'Untitled engagement';
  document.querySelector('[data-engagement-target]').textContent = state.engagement.targetUrl.trim() || 'No target URL set';
  const selector = document.querySelector('[data-engagement-select]');
  selector.replaceChildren(...portfolio.engagements.map(({ id, state: candidate }, index) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = candidate.engagement.name.trim() || `Untitled engagement ${index + 1}`;
    option.selected = id === portfolio.active_id;
    return option;
  }));
  document.querySelector('[data-engagement-delete]').disabled = portfolio.engagements.length === 1;
}

function setActiveState(nextState) {
  state = nextState;
  portfolio = updateActiveEngagement(portfolio, state);
  savePortfolio();
  updateIdentity();
}

function activatePortfolio(nextPortfolio, destination = 'dashboard') {
  portfolio = nextPortfolio;
  state = activeEngagement(portfolio);
  savePortfolio();
  updateIdentity();
  wizard?.reset(state);
  location.hash = destination;
  route();
}

function applyShare(payload) {
  const nextPortfolio = engagementIsBlank(state) ? portfolio : addEngagement(portfolio);
  let nextState = activeEngagement(nextPortfolio);
  nextState = setEngagement(nextState, {
    name: payload.name,
    targetUrl: payload.targetUrl,
    started_at: nextState.engagement.started_at || new Date().toISOString()
  });
  nextState = setAnswers(nextState, payload.answers);
  nextState = setPosition(nextState, { view: 'dashboard' });
  activatePortfolio(updateActiveEngagement(nextPortfolio, nextState), 'dashboard');
}

function consumeShare() {
  const raw = location.hash.slice(1);
  if (!raw.startsWith('share/')) return false;
  const payload = parseShareHash(location.hash);
  if (!payload) {
    location.hash = 'wizard';
    return false;
  }
  applyShare(payload);
  return true;
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

const sidebarMedia = window.matchMedia('(max-width: 960px)');

function setSidebar(open, restoreFocus = false) {
  const sidebar = document.querySelector('#sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (open) {
    sidebar.removeAttribute('inert');
    sidebar.removeAttribute('aria-hidden');
    sidebar.dataset.open = 'true';
    scrim.hidden = false;
    sidebar.querySelector('[data-sidebar-close]')?.focus();
  } else {
    sidebar.removeAttribute('data-open');
    scrim.hidden = true;
    if (sidebarMedia.matches) {
      sidebar.setAttribute('inert', '');
      sidebar.setAttribute('aria-hidden', 'true');
    } else {
      sidebar.removeAttribute('inert');
      sidebar.removeAttribute('aria-hidden');
    }
    if (restoreFocus) document.querySelector('[data-sidebar-open]')?.focus();
  }
}

function route() {
  if (consumeShare()) return;
  const [viewPart, slug = ''] = location.hash.slice(1).split('/');
  const view = VIEWS.has(viewPart) ? viewPart : 'wizard';
  document.querySelectorAll('[data-view]').forEach((section) => { section.hidden = section.dataset.view !== view; });
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    if (link.dataset.viewLink === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setSidebar(false);
  const heading = document.querySelector(`[data-view="${view}"] h1`);
  if (heading && location.hash) heading.setAttribute('tabindex', '-1');
  if (['playbooks', 'playbook'].includes(view)) {
    workspace.show(view, slug).catch((error) => {
      const target = document.querySelector('[data-playbook-board], [data-playbook-root]');
      if (target) target.textContent = `Playbooks could not be loaded: ${error.message}`;
      console.error(error);
    });
  } else if (manifest.categories.length && ['dashboard', 'families', 'family', 'checklist', 'search', 'chains', 'payloads'].includes(view)) {
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
  setActiveState(state);
  wizard.reset(state);
}

function initializeShell() {
  initializeTheme();
  updateIdentity();

  workspace = createWorkspace({
    catalog,
    getState: () => state,
    onStateChange(nextState) {
      setActiveState(nextState);
    },
    replaceState(nextState) {
      setActiveState(nextState);
      wizard?.reset(state);
    }
  });
  workspace.bindActions();

  wizard = createWizard(document.querySelector('#wizard-root'), state, {
    onChange(nextState) {
      setActiveState(nextState);
    },
    onComplete(nextState) {
      setActiveState(nextState);
      location.hash = 'dashboard';
    }
  });

  document.querySelector('[data-engagement-select]').addEventListener('change', (event) => {
    activatePortfolio(selectEngagement(portfolio, event.target.value));
  });
  document.querySelector('[data-engagement-new]').addEventListener('click', () => {
    activatePortfolio(addEngagement(portfolio), 'wizard');
  });
  document.querySelector('[data-engagement-delete]').addEventListener('click', () => {
    const label = state.engagement.name.trim() || 'this untitled engagement';
    if (window.confirm(`Delete ${label} and all of its locally saved progress? This cannot be undone.`)) {
      activatePortfolio(removeEngagement(portfolio, portfolio.active_id));
    }
  });
  document.querySelector('[data-wizard-reset]').addEventListener('click', () => {
    if (window.confirm('Reset scope answers? Existing item statuses, findings, and notes in this engagement will be retained.')) resetWizard();
  });
  document.querySelector('[data-sidebar-open]').addEventListener('click', () => setSidebar(true));
  document.querySelectorAll('[data-sidebar-close]').forEach((button) => button.addEventListener('click', () => setSidebar(false, true)));
  sidebarMedia.addEventListener('change', () => setSidebar(false));
  setSidebar(false);
  document.querySelector('[data-go-search]').addEventListener('click', () => { location.hash = 'search'; });
  const shortcutsDialog = document.querySelector('#shortcuts-dialog');
  function openShortcuts() {
    if (shortcutsDialog && !shortcutsDialog.open) shortcutsDialog.showModal();
  }
  document.querySelectorAll('[data-shortcuts-open]').forEach((button) => button.addEventListener('click', openShortcuts));
  document.querySelectorAll('[data-shortcuts-close]').forEach((button) => button.addEventListener('click', () => shortcutsDialog?.close()));
  let pendingShortcut = null;
  document.addEventListener('keydown', (event) => {
    const target = document.activeElement;
    const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
    if (editable || event.altKey || event.ctrlKey || event.metaKey) {
      pendingShortcut = null;
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      location.hash = 'search';
      pendingShortcut = null;
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      openShortcuts();
      pendingShortcut = null;
      return;
    }
    if (event.key === 'Escape' && document.querySelector('#sidebar').dataset.open === 'true') {
      setSidebar(false, true);
    }
    if (event.key === 'e') {
      const holder = document.activeElement?.closest('.check-holder');
      const toggle = holder?.querySelector('.check-open') || document.activeElement?.closest('.test-card')?.querySelector('details.level-details > summary');
      if (toggle) {
        event.preventDefault();
        toggle.click();
        return;
      }
    }
    if ((event.key === 'n' || event.key === 'p') && !pendingShortcut) {
      const view = currentView();
      if (!['checklist', 'search', 'family'].includes(view)) return;
      const cards = [...document.querySelectorAll('[data-family-root] .check-holder, [data-checklist-results] .check-holder, [data-search-results] .check-holder, [data-checklist-results] > .test-card, [data-checklist-results] .family-group > .test-card, [data-search-results] .test-card')]
        .filter((card) => !card.closest('[data-view][hidden]'));
      if (!cards.length) return;
      const active = document.activeElement;
      const index = cards.findIndex((card) => card.contains(active));
      const nextIndex = event.key === 'n'
        ? (index + 1) % cards.length
        : (index <= 0 ? cards.length - 1 : index - 1);
      event.preventDefault();
      cards[nextIndex].scrollIntoView({ block: 'nearest' });
      cards[nextIndex].querySelector('.status-select')?.focus();
      return;
    }
    if (event.key === 'g') {
      pendingShortcut = { at: Date.now() };
      return;
    }
    if (pendingShortcut && Date.now() - pendingShortcut.at < 900) {
      pendingShortcut = null;
      if (event.key === 'd') location.hash = 'dashboard';
      else if (event.key === 'p') location.hash = 'playbooks';
      else if (event.key === 't') location.hash = 'families';
      else if (event.key === 'c') location.hash = 'checklist';
      else if (event.key === 'f') {
        location.hash = 'dashboard';
        setTimeout(() => document.querySelector('#findings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      }
    } else {
      pendingShortcut = null;
    }
  });
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = initialHash(state);
  route();
  loadManifest();
}

initializeShell();
