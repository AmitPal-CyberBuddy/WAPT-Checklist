import { initializeTheme } from './theme.js?v=0.3.0';

const STORAGE_KEY = 'wapt.state.v1';

function localProgress() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const statuses = state && typeof state.statuses === 'object' ? Object.values(state.statuses) : [];
    return {
      tested: statuses.filter((status) => status && status !== 'not_tested').length,
      findings: statuses.filter((status) => status === 'potential_finding' || status === 'confirmed_finding').length
    };
  } catch {
    return { tested: 0, findings: 0 };
  }
}

async function renderStats() {
  const local = localProgress();
  let categories = 0;
  let items = 0;
  try {
    const response = await fetch('checklist/manifest.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    categories = manifest.categories.length;
    items = manifest.categories.reduce((sum, category) => sum + category.count, 0);
  } catch (error) {
    console.error('Could not load checklist statistics.', error);
  }

  const values = { categories, items, tested: local.tested, findings: local.findings };
  for (const [name, value] of Object.entries(values)) {
    document.querySelector(`[data-stat="${name}"]`).textContent = value.toLocaleString();
  }
}

initializeTheme();
renderStats();
