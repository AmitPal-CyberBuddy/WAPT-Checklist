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
      const response = await fetch('attack-chains/manifest.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Attack-chain manifest: HTTP ${response.status}`);
      manifest = await response.json();
      chains = await Promise.all(manifest.chains.map(async (entry) => {
        const result = await fetch(`attack-chains/${entry.file}`, { headers: { Accept: 'application/json' } });
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

  async function render(root, itemsById) {
    const data = await loadAll();
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
        const li = node('li', 'chain-node');
        const number = node('span', 'chain-node-number', String(index + 1).padStart(2, '0'));
        const body = node('div');
        const link = node('a', '', entry.item_id);
        link.href = item ? `#checklist/${item.category}` : '#checklist';
        body.append(link, node('strong', '', entry.label));
        const edge = chain.edges.find((candidate) => candidate.from === entry.item_id);
        if (edge) body.append(node('small', '', `Unlock: ${edge.condition}`));
        li.append(number, body);
        graph.append(li);
      });
      card.append(graph, node('p', 'chain-safety', `Safety: ${chain.safety}`));
      return card;
    }));
  }

  return Object.freeze({ loadAll, priorityEdges, render, getChains: () => [...chains] });
}
