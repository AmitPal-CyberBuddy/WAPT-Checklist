import { initializeTheme } from './theme.js?v=1.0.0-r3';
import { deriveContext } from '../engine/context.js?v=1.0.0-r3';
import { APPLICABILITY, evaluateApplicability } from '../engine/applicability.js?v=1.0.0-r3';

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
    const published = manifest.categories.filter(({ count }) => count > 0);
    const documents = await Promise.all(published.map(async ({ file }) => {
      const categoryResponse = await fetch(`checklist/${file}`, { headers: { Accept: 'application/json' } });
      if (!categoryResponse.ok) throw new Error(`${file}: HTTP ${categoryResponse.status}`);
      return categoryResponse.json();
    }));
    const context = deriveContext(state.answers, state.engagement?.targetUrl || '');
    active = documents.flatMap(({ items }) => items).filter((item) => evaluateApplicability(item, context).state !== APPLICABILITY.NA_CONTEXT).length;
  } catch (error) {
    console.error('Could not load checklist statistics.', error);
  }

  const values = {
    categories,
    active,
    tested: statuses.filter((status) => status && status !== 'not_tested').length,
    findings: statuses.filter((status) => status === 'potential_finding' || status === 'confirmed_finding').length
  };
  for (const [name, value] of Object.entries(values)) {
    document.querySelector(`[data-stat="${name}"]`).textContent = value.toLocaleString();
  }
}

initializeTheme();
renderStats();
