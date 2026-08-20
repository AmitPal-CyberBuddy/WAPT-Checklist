import { initializeTheme } from './theme.js?v=1.0.0-r8';

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

// One primary action: resume the engagement this browser already holds, otherwise start one.
// A returning tester should never have to re-navigate to their own work.
function renderPrimaryAction(state) {
  const action = document.querySelector('[data-primary-action]');
  if (!action) return;
  const tested = Object.values(state.statuses || {}).filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
  const position = state.position || {};
  const resumable = position.view === 'family' && position.family;
  if (!tested && !resumable) return;
  const name = (state.engagement?.name || '').trim();
  action.href = resumable ? `app.html#family/${position.family}` : 'app.html#dashboard';
  action.replaceChildren(document.createTextNode(name ? `Continue ${name}` : 'Continue engagement'));
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = ' →';
  action.append(arrow);
}

function renderStats() {
  const state = localState();
  renderPrimaryAction(state);
  const statuses = state.statuses && typeof state.statuses === 'object' ? Object.values(state.statuses) : [];
  const values = {
    tested: statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length,
    findings: statuses.filter((status) => status === 'potential_finding' || status === 'confirmed_finding').length
  };
  for (const [name, value] of Object.entries(values)) {
    const node = document.querySelector(`[data-stat="${name}"]`);
    if (node) node.textContent = value.toLocaleString();
  }
}

async function renderProductProof() {
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
    console.error('Could not load product summary.', error);
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
renderProductProof();

const chainRoot = document.querySelector('[data-chain-preview]');
if (chainRoot && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some(({ isIntersecting }) => isIntersecting)) return;
    observer.disconnect();
    renderChainPreview();
  }, { rootMargin: '240px' });
  observer.observe(chainRoot);
} else renderChainPreview();
