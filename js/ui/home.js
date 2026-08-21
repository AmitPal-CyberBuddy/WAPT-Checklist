import { initializeTheme } from './theme.js?v=1.0.0-r17';
import { asset } from './paths.js?v=1.0.0-r17';

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

// Quiet count-up once the metric band is on screen; instant under reduced motion.
function animateCountUp(node, target) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || target <= 0) { node.textContent = target.toLocaleString(); return; }
  const duration = 900;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = Math.round(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function observeCountUps(apply) {
  const band = document.querySelector('.product-proof');
  if (!band || !('IntersectionObserver' in window)) { apply(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some(({ isIntersecting }) => isIntersecting)) return;
    observer.disconnect();
    apply();
  }, { rootMargin: '120px' });
  observer.observe(band);
}

async function renderProductProof() {
  try {
    const response = await fetch(asset('release.json'), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json();
    observeCountUps(() => {
      for (const key of ['production_items', 'categories', 'attack_chains', 'payload_references', 'burp_workflows']) {
        const value = Number(release[key]);
        const node = document.querySelector(`[data-project-metric="${key}"]`);
        if (node && Number.isFinite(value)) animateCountUp(node, value);
      }
      document.querySelectorAll('[data-count-up]').forEach((node) => {
        const value = Number.parseInt(node.textContent.replace(/[^\d]/g, ''), 10);
        if (Number.isFinite(value) && value > 0 && !node.dataset.projectMetric) animateCountUp(node, value);
      });
    });
  } catch (error) {
    console.error('Could not load product summary.', error);
  }
}

async function renderChainPreview() {
  const root = document.querySelector('[data-chain-preview]');
  if (!root) return;
  try {
    const manifestResponse = await fetch(asset('attack-chains/manifest.json'), { headers: { Accept: 'application/json' } });
    if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const chains = await Promise.all(manifest.chains.map(async (entry) => {
      const result = await fetch(asset(`attack-chains/${entry.file}`), { headers: { Accept: 'application/json' } });
      if (!result.ok) throw new Error(`${entry.file}: HTTP ${result.status}`);
      return result.json();
    }));
    root.replaceChildren(...chains.map((chain, index) => {
      const link = document.createElement('a');
      link.className = 'chain-preview-card';
      link.href = 'app.html#chains';
      link.style.setProperty('--reveal-delay', `${index * 0.06}s`);
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

// Sections rise in as they enter the viewport; without observer support (or under
// reduced motion) everything is simply visible.
function initializeReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((node) => node.classList.add('is-revealed'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  targets.forEach((node) => observer.observe(node));
}

initializeTheme();
renderStats();
renderProductProof();
initializeReveals();

const chainRoot = document.querySelector('[data-chain-preview]');
if (chainRoot && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some(({ isIntersecting }) => isIntersecting)) return;
    observer.disconnect();
    renderChainPreview();
  }, { rootMargin: '240px' });
  observer.observe(chainRoot);
} else renderChainPreview();
