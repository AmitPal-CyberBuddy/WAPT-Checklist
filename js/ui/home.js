import { initializeTheme } from './theme.js?v=1.0.0-r6';
import { deriveContext } from '../engine/context.js?v=1.0.0-r6';
import { APPLICABILITY, evaluateApplicability } from '../engine/applicability.js?v=1.0.0-r6';

const STORAGE_KEY = 'wapt.state.v1';

function localState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return {};
    if (stored.kind === 'wapt-engagement-portfolio' && Array.isArray(stored.engagements)) {
      return stored.engagements.find(({ id }) => id === stored.active_id)?.state || stored.engagements[0]?.state || {};
    }
    return stored;
  } catch {
    return {};
  }
}

function hasScopedContext(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.engagement?.targetUrl) return true;
  const answers = state.answers;
  if (!answers || typeof answers !== 'object') return false;
  return Object.entries(answers).some(([, value]) => {
    const entries = Array.isArray(value) ? value : [value];
    return entries.some((entry) => entry !== 'unknown' && entry !== undefined);
  });
}

async function renderStats() {
  const state = localState();
  const statuses = state.statuses && typeof state.statuses === 'object' ? Object.values(state.statuses) : [];
  let categories = 0;
  let active = 0;
  try {
    const response = await fetch('checklist/manifest.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    categories = manifest.categories.length;
    // Applicability counts need the full catalog; only fetch it when a scoped
    // engagement exists so the homepage stays light for first-time visitors.
    if (hasScopedContext(state)) {
      const published = manifest.categories.filter(({ count }) => count > 0);
      const documents = await Promise.all(published.map(async ({ file }) => {
        const categoryResponse = await fetch(`checklist/${file}`, { headers: { Accept: 'application/json' } });
        if (!categoryResponse.ok) throw new Error(`${file}: HTTP ${categoryResponse.status}`);
        return categoryResponse.json();
      }));
      const context = deriveContext(state.answers, state.engagement?.targetUrl || '');
      active = documents.flatMap(({ items }) => items).filter((item) => evaluateApplicability(item, context).state !== APPLICABILITY.NA_CONTEXT).length;
    }
  } catch (error) {
    console.error('Could not load checklist statistics.', error);
  }

  const values = {
    categories,
    active: hasScopedContext(state) ? active : 0,
    tested: statuses.filter((status) => status && status !== 'not_tested').length,
    findings: statuses.filter((status) => status === 'potential_finding' || status === 'confirmed_finding').length
  };
  const showActive = hasScopedContext(state);
  for (const [name, value] of Object.entries(values)) {
    document.querySelector(`[data-stat="${name}"]`).textContent = name === 'active' && !showActive ? '—' : value.toLocaleString();
  }
}

async function renderProjectMetrics() {
  try {
    const response = await fetch('release.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json();
    for (const key of ['production_items', 'categories', 'attack_chains', 'payload_references', 'burp_workflows']) {
      const value = release[key];
      const node = document.querySelector(`[data-project-metric="${key}"]`);
      if (node && Number.isFinite(Number(value))) node.textContent = Number(value).toLocaleString();
    }
  } catch (error) {
    console.error('Could not load project metrics.', error);
  }
}

async function renderChainPreview() {
  const root = document.querySelector('[data-chain-preview]');
  if (!root) return;
  try {
    const manifestResponse = await fetch('attack-chains/manifest.json', { headers: { Accept: 'application/json' } });
    if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const chains = await Promise.all(manifest.chains.map(async (entry) => {
      const result = await fetch(`attack-chains/${entry.file}`, { headers: { Accept: 'application/json' } });
      if (!result.ok) throw new Error(`${entry.file}: HTTP ${result.status}`);
      return result.json();
    }));
    root.replaceChildren(...chains.map((chain) => {
      const link = document.createElement('a');
      link.className = 'chain-preview-card';
      link.href = 'app.html#chains';
      const id = document.createElement('span');
      id.className = 'chip id-chip';
      id.textContent = chain.id;
      const title = document.createElement('strong');
      title.textContent = chain.title;
      const summary = document.createElement('p');
      summary.textContent = chain.summary;
      const meta = document.createElement('small');
      meta.textContent = `${(chain.nodes || []).length} nodes · ${chain.safety}`;
      link.append(id, title, summary, meta);
      return link;
    }));
  } catch (error) {
    console.error('Could not load attack-chain preview.', error);
    root.replaceChildren();
  }
}

initializeTheme();
renderStats();
renderProjectMetrics();
renderChainPreview();
