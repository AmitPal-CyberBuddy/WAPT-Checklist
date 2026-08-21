import { asset } from './paths.js?v=1.0.0-r21';

const STATUS_SHORT = Object.freeze({
  not_tested: 'Pending', in_progress: 'Active', passed: 'Secure',
  potential_finding: 'Potential', confirmed_finding: 'Confirmed', na: 'N/A'
});
const STATUS_GLYPHS = Object.freeze({
  not_tested: '○', in_progress: '◐', passed: '✓',
  potential_finding: '△', confirmed_finding: '▲', na: '—'
});
const STATUS_CLASS = Object.freeze({
  not_tested: 'is-pending', in_progress: 'is-active', passed: 'is-passed',
  potential_finding: 'is-potential', confirmed_finding: 'is-confirmed', na: 'is-na'
});
const UNLOCK_STATUSES = new Set(['passed', 'confirmed_finding']);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createChainStore() {
  let manifest;
  let pending;
  let chains = [];

  async function loadAll() {
    if (chains.length) return chains;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetch(asset('attack-chains/manifest.json'), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Attack-chain manifest: HTTP ${response.status}`);
      manifest = await response.json();
      chains = await Promise.all(manifest.chains.map(async (entry) => {
        const result = await fetch(asset(`attack-chains/${entry.file}`), { headers: { Accept: 'application/json' } });
        if (!result.ok) throw new Error(`${entry.file}: HTTP ${result.status}`);
        return result.json();
      }));
      return chains;
    })();
    return pending;
  }

  function priorityEdges() {
    return chains.flatMap((chain) => chain.edges.map((edge) => ({ id: chain.id, prerequisites: [edge.from], next: edge.to })));
  }

  async function render(root, itemsById, options = {}) {
    const data = await loadAll();
    const statuses = options.statuses || {};
    const unlocked = new Set();
    for (const chain of data) {
      for (const edge of chain.edges || []) {
        if (UNLOCK_STATUSES.has(statuses[edge.from])) unlocked.add(edge.to);
      }
    }
    root.replaceChildren(...data.map((chain) => {
      const card = node('article', 'chain-card');
      const header = node('header', 'chain-header');
      const copy = node('div');
      copy.append(node('span', 'chip id-chip', chain.id), node('h2', '', chain.title), node('p', '', chain.summary));
      header.append(copy);
      card.append(header);
      const graph = node('ol', 'chain-graph');
      chain.nodes.forEach((entry, index) => {
        const item = itemsById.get(entry.item_id);
        const status = statuses[entry.item_id] || 'not_tested';
        const li = node('li', `chain-node ${unlocked.has(entry.item_id) ? 'unlocked' : ''}`);
        const number = node('span', 'chain-node-number', String(index + 1).padStart(2, '0'));
        const body = node('div');
        const link = node('a', '', entry.item_id);
        link.href = item ? `#checklist/${item.category}` : '#checklist';
        const statusChip = node('span', `chip status-chip ${STATUS_CLASS[status]}`, `${STATUS_GLYPHS[status] || ''} ${STATUS_SHORT[status]}`);
        body.append(link, statusChip, node('strong', '', entry.label));
        const edge = chain.edges.find((candidate) => candidate.from === entry.item_id);
        if (edge) body.append(node('small', '', `Unlock: ${edge.condition}`));
        if (unlocked.has(entry.item_id)) body.append(node('small', 'unlock-ready', 'Prerequisites met — ready to test'));
        li.append(number, body);
        graph.append(li);
      });
      card.append(graph, node('p', 'chain-safety', `Safety: ${chain.safety}`));
      return card;
    }));
  }

  return Object.freeze({ loadAll, priorityEdges, render, getChains: () => [...chains] });
}
