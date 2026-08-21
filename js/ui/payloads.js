import { asset } from './paths.js?v=1.0.0-r14';

const WORKFLOWS = [
  ['proxy', 'Proxy'], ['repeater', 'Repeater'], ['intruder', 'Intruder'], ['scanner', 'Scanner'],
  ['comparer', 'Comparer'], ['decoder', 'Decoder'], ['sequencer', 'Sequencer'], ['logger', 'Logger'],
  ['param-miner', 'Param Miner'], ['autorize', 'Autorize'], ['turbo-intruder', 'Turbo Intruder'], ['collaborator', 'Collaborator']
];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createPayloadStore() {
  let manifest;
  let pending;
  let payloads = [];

  async function loadAll() {
    if (payloads.length) return payloads;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetch(asset('payloads/manifest.json'), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Payload manifest: HTTP ${response.status}`);
      manifest = await response.json();
      const documents = await Promise.all(manifest.categories.map(async (entry) => {
        const result = await fetch(asset(`payloads/${entry.file}`), { headers: { Accept: 'application/json' } });
        if (!result.ok) throw new Error(`${entry.file}: HTTP ${result.status}`);
        return result.json();
      }));
      payloads = documents.flatMap(({ items }) => items);
      return payloads;
    })();
    return pending;
  }

  function renderWorkflows(root) {
    const section = node('section', 'panel workflow-panel');
    section.append(node('p', 'eyebrow', 'BURP WORKFLOWS'), node('h2', '', 'Tool-guided methodology'));
    const grid = node('div', 'workflow-grid');
    for (const [slug, name] of WORKFLOWS) {
      const link = node('a', 'workflow-link', name);
      link.href = `workflow.html?tool=${slug}`;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      grid.append(link);
    }
    section.append(node('p', 'workflow-intro', 'When and why to use each tool, a safe workflow, evidence requirements, boundaries, and what tool output does not prove.'), grid);
    root.append(section);
  }

  function payloadCard(payload) {
    const card = node('article', `payload-card${payload.review_only ? ' review-only' : ''}`);
    const head = node('div', 'payload-head');
    const labels = node('div', 'chip-row');
    labels.append(node('span', 'chip id-chip', payload.id), node('span', 'chip', payload.category));
    if (payload.review_only) labels.append(node('span', 'chip blocked-chip', 'REVIEW ONLY'));
    head.append(labels, node('h3', '', payload.title), node('p', '', payload.context));
    card.append(head);
    const details = document.createElement('details');
    details.className = 'payload-details';
    details.append(node('summary', '', payload.review_only ? 'Review safety context' : 'Open reference'));
    const body = node('div', 'payload-body');
    body.append(node('h4', '', 'Intended use'), node('p', '', payload.intended_use));
    body.append(node('h4', '', 'Reference value'));
    body.append(node('pre', '', payload.payload));
    const copy = node('button', 'copy-button', 'Copy');
    copy.type = 'button';
    copy.setAttribute('aria-label', `Copy ${payload.id} reference value`);
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(String(payload.payload || ''));
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
      } catch {
        copy.textContent = 'Unavailable';
      }
    });
    body.append(copy);
    body.append(node('h4', '', 'Caveats'));
    const caveats = node('ul'); payload.caveats.forEach((value) => caveats.append(node('li', '', value))); body.append(caveats);
    body.append(node('p', 'payload-safety', `Safety: ${payload.safety}`));
    const related = node('div', 'payload-related');
    related.append(node('strong', '', 'Related tests: '));
    payload.related.forEach((id, index) => {
      if (index) related.append(document.createTextNode(' · '));
      related.append(node('span', '', id));
    });
    body.append(related);
    details.append(body);
    card.append(details);
    return card;
  }

  async function render(root) {
    await loadAll();
    root.replaceChildren();
    const filters = node('div', 'panel payload-filters');
    const searchLabel = node('label'); searchLabel.append(node('span', '', 'Search payload references'));
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'context, caveat, tag, test ID…'; searchLabel.append(search);
    const categoryLabel = node('label'); categoryLabel.append(node('span', '', 'Category'));
    const category = document.createElement('select'); category.append(new Option('All categories', ''));
    manifest.categories.forEach((entry) => category.append(new Option(entry.name, entry.slug))); categoryLabel.append(category);
    const safetyLabel = node('label'); safetyLabel.append(node('span', '', 'Safety'));
    const safety = document.createElement('select'); safety.append(new Option('All references', ''), new Option('Safe controls', 'safe'), new Option('REVIEW ONLY', 'review')); safetyLabel.append(safety);
    filters.append(searchLabel, categoryLabel, safetyLabel);
    const summary = node('p', 'result-summary');
    summary.setAttribute('role', 'status');
    const grid = node('div', 'payload-grid');
    const apply = () => {
      const query = search.value.toLocaleLowerCase('en-US').trim();
      const filtered = payloads.filter((item) => {
        const text = [item.id, item.title, item.context, item.intended_use, item.payload, ...item.caveats, ...item.tags, ...item.related].join(' ').toLocaleLowerCase('en-US');
        return (!query || query.split(/\s+/).every((word) => text.includes(word)))
          && (!category.value || item.category === category.value)
          && (!safety.value || (safety.value === 'review' ? item.review_only : !item.review_only));
      });
      summary.textContent = `${filtered.length} of ${payloads.length} references shown`;
      if (!filtered.length) {
        const empty = node('p', 'empty-copy', 'No payload references match these filters. Clear the search or category filter to browse the library again.');
        grid.replaceChildren(empty);
      } else {
        grid.replaceChildren(...filtered.map(payloadCard));
      }
    };
    search.addEventListener('input', apply); category.addEventListener('change', apply); safety.addEventListener('change', apply);
    root.append(filters, summary, grid);
    renderWorkflows(root);
    apply();
  }

  return Object.freeze({
    cached: () => payloads, loadAll, render, getPayloads: () => [...payloads] });
}
