import { deriveContext } from '../engine/context.js?v=1.0.0-r5';
import { APPLICABILITY, evaluateApplicability } from '../engine/applicability.js?v=1.0.0-r5';
import { suggestedNext } from '../engine/priorities.js?v=1.0.0-r5';
import { categoryRationale } from '../engine/rationale.js?v=1.0.0-r5';
import { clearOverride, importState, setItemNote, setItemStatus, setOverride, setRetestFlag } from '../engine/state.js?v=1.0.0-r5';
import { EMPTY_FILTERS, filterItems, itemStatus } from './filters.js?v=1.0.0-r5';
import { STATUS_LABELS, composeChecklistMarkdown, composeReportMarkdown, composeStateJson, downloadText, findingItems } from './export.js?v=1.0.0-r5';
import { createChainStore } from './chains.js?v=1.0.0-r5';
import { createPayloadStore } from './payloads.js?v=1.0.0-r5';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const APP_LABELS = { active: 'Active', confirm: 'Confirm applicability', na_context: 'N/A (context)' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function categoryMap(manifest) {
  return Object.fromEntries((manifest.categories || []).map((category) => [category.slug, category.name]));
}

function safeFilename(name, suffix) {
  const base = String(name || 'wapt-engagement').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'wapt-engagement';
  return `${base}-${suffix}`;
}

function effectiveRecord(item, state, context) {
  const raw = evaluateApplicability(item, context);
  const override = state.overrides?.[item.id];
  if (raw.state === APPLICABILITY.NA_CONTEXT && override?.active) {
    return { item, rawApplicability: raw, applicability: { state: APPLICABILITY.ACTIVE, blocked: false, reasons: raw.reasons, overridden: true, overrideReason: override.reason } };
  }
  return { item, rawApplicability: raw, applicability: raw };
}

function copyButton(text, label) {
  const button = element('button', 'copy-button', 'Copy');
  button.type = 'button';
  button.setAttribute('aria-label', `Copy ${label}`);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1200);
    } catch {
      button.textContent = 'Unavailable';
    }
  });
  return button;
}

function section(title, values, ordered = false) {
  const wrapper = element('section', 'method-section');
  const heading = element('div', 'method-section-heading');
  heading.append(element('h4', '', title), copyButton(Array.isArray(values) ? values.join('\n') : values, title));
  wrapper.append(heading);
  if (!Array.isArray(values)) {
    wrapper.append(element('p', '', values || 'Not specified'));
    return wrapper;
  }
  const list = element(ordered ? 'ol' : 'ul');
  for (const value of values) list.append(element('li', '', value));
  wrapper.append(list);
  return wrapper;
}

function renderExample(example) {
  const wrapper = element('div', 'example-block');
  for (const key of ['request', 'response', 'note']) {
    if (!example[key]) continue;
    wrapper.append(element('strong', 'example-label', key.toUpperCase()));
    const output = element(key === 'note' ? 'p' : 'pre', '', example[key]);
    wrapper.append(output);
  }
  return wrapper;
}

function renderFilters(root, manifest, filters, onChange, options = {}) {
  root.replaceChildren();
  const grid = element('div', 'filter-grid');
  const fields = [
    ['query', 'Search', 'search', 'CORS, JWT, BOLA, objective…'],
    ['category', 'Category', 'select', ''], ['severity', 'Severity', 'select', ''],
    ['difficulty', 'Difficulty', 'select', ''], ['status', 'Status', 'select', ''],
    ['mode', 'Mode', 'select', ''], ['applicability', 'Applicability', 'select', ''],
    ['technology', 'Technology', 'text', 'java, graphql, cookie…'],
    ['tool', 'Tool', 'text', 'Burp Repeater…'], ['tag', 'Tag', 'text', 'idor…'],
    ['testId', 'Test ID', 'text', 'WAPT-AUTHZ-003']
  ];
  const choices = {
    category: (manifest.categories || []).filter(({ count }) => count > 0).map(({ slug, name }) => [slug, name]),
    severity: ['critical', 'high', 'medium', 'low', 'informational'].map((value) => [value, value]),
    difficulty: ['low', 'medium', 'high'].map((value) => [value, value]),
    status: STATUS_OPTIONS,
    mode: [['manual', 'manual'], ['automated', 'automated']],
    applicability: [[APPLICABILITY.ACTIVE, 'Active'], [APPLICABILITY.CONFIRM, 'Confirm'], [APPLICABILITY.NA_CONTEXT, 'N/A (context)']]
  };
  for (const [key, label, type, placeholder] of fields) {
    if (options.fixedCategory && key === 'category') continue;
    const group = element('label', key === 'query' ? 'filter-field filter-search' : 'filter-field');
    group.append(element('span', '', label));
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      input.append(new Option(`All ${label.toLocaleLowerCase('en-US')}`, ''));
      for (const [value, text] of choices[key]) input.append(new Option(text, value));
    } else {
      input = document.createElement('input');
      input.type = type;
      input.placeholder = placeholder;
    }
    input.name = key;
    input.value = filters[key] || '';
    input.addEventListener(type === 'search' || type === 'text' ? 'input' : 'change', () => onChange({ ...filters, [key]: input.value }, key));
    group.append(input);
    grid.append(group);
  }
  const reset = element('button', 'button button-quiet filter-reset', 'Reset filters');
  reset.type = 'button';
  reset.addEventListener('click', () => onChange({ ...EMPTY_FILTERS, category: options.fixedCategory || '' }));
  grid.append(reset);
  root.append(grid);
}

function renderCard(record, state, categoryNames, onState) {
  const { item, applicability } = record;
  const card = element('article', `test-card severity-${item.severity}`);
  card.dataset.itemId = item.id;
  const header = element('header', 'test-card-header');
  const identity = element('div', 'test-identity');
  const chips = element('div', 'chip-row');
  chips.append(element('span', 'chip id-chip', item.id));
  chips.append(element('span', `chip severity-chip ${item.severity}`, item.severity));
  chips.append(element('span', 'chip', item.difficulty));
  chips.append(element('span', 'chip', item.mode));
  const appChip = element('span', `chip applicability-chip ${applicability.state}`, applicability.overridden ? 'Active (override)' : APP_LABELS[applicability.state]);
  chips.append(appChip);
  if (applicability.blocked) chips.append(element('span', 'chip blocked-chip', 'Needs credentials'));
  identity.append(chips, element('h3', '', item.title), element('p', 'test-objective', item.objective));
  const controls = element('div', 'test-controls');
  const status = document.createElement('select');
  status.className = 'status-select';
  status.setAttribute('aria-label', `Status for ${item.id}`);
  for (const [value, label] of STATUS_OPTIONS) status.append(new Option(label, value));
  status.value = itemStatus(item, state);
  status.addEventListener('change', () => onState(setItemStatus(state, item.id, status.value)));
  controls.append(status);
  header.append(identity, controls);
  card.append(header);

  if (applicability.reasons?.length || applicability.overridden) {
    const reason = element('div', 'applicability-reason');
    const descriptions = applicability.reasons.map(({ code, key }) => `${code.replaceAll('_', ' ')}${key ? `: ${key}` : ''}`);
    if (applicability.overrideReason) descriptions.unshift(`override: ${applicability.overrideReason}`);
    reason.textContent = descriptions.join(' · ');
    card.append(reason);
  }

  const details = document.createElement('details');
  details.className = 'method-details';
  details.append(element('summary', '', 'Open methodology'));
  const body = element('div', 'method-body');
  body.append(section('Objective', item.objective));
  body.append(section('Prerequisites', item.prerequisites));
  body.append(section('Steps', item.steps, true));
  if (item.variants?.length) {
    const variants = element('section', 'method-section');
    variants.append(element('h4', '', 'Context variants'));
    for (const variant of item.variants) {
      const variantBox = element('div', 'variant-box');
      variantBox.append(element('strong', '', Object.entries(variant.when).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' · ')));
      variantBox.append(section('Variant steps', variant.steps, true));
      if (variant.notes) variantBox.append(element('p', 'method-note', variant.notes));
      variants.append(variantBox);
    }
    body.append(variants);
  }
  if (item.examples?.length) {
    const examples = element('section', 'method-section');
    examples.append(element('h4', '', 'Examples'));
    item.examples.forEach((example) => examples.append(renderExample(example)));
    body.append(examples);
  }
  body.append(section('Manipulate', item.manipulate));
  const behavior = element('div', 'behavior-grid');
  behavior.append(section('Secure behavior', item.secure_behavior), section('Vulnerable behavior', item.vulnerable_behavior));
  body.append(behavior);
  body.append(section('Validation', item.validation));
  body.append(section('False positives', item.false_positives));
  if (item.do_not_report?.length) body.append(section('Reporting boundary', item.do_not_report));
  body.append(section('Impact', item.impact));
  if (item.remediation) body.append(section('Root-cause remediation', item.remediation));
  if (item.retest_guidance) body.append(section('Retest guidance', item.retest_guidance));
  if (item.safety) body.append(section('Safety boundary', item.safety));
  body.append(section('Evidence', item.evidence));
  body.append(section('Tools', item.tools));

  const refs = element('section', 'method-section');
  refs.append(element('h4', '', 'References and mappings'));
  const refList = element('ul');
  for (const reference of item.references) {
    const li = document.createElement('li');
    const link = element('a', '', `${reference.source}: ${reference.title}`);
    link.href = reference.url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    li.append(link);
    refList.append(li);
  }
  refs.append(refList);
  const mappingText = Object.entries(item.mappings).filter(([, values]) => values.length).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' · ');
  refs.append(element('p', 'mapping-line', mappingText));
  body.append(refs);
  if (item.attack_chains?.length) {
    const chains = element('section', 'method-section');
    chains.append(element('h4', '', 'Attack chains'));
    const links = element('div', 'chain-link-row');
    for (const id of item.attack_chains) {
      const link = element('a', 'chip id-chip', id);
      link.href = '#chains';
      links.append(link);
    }
    chains.append(links);
    body.append(chains);
  }

  const notes = element('section', 'method-section notes-section');
  const noteLabel = element('label');
  noteLabel.append(element('span', '', 'Tester notes (stored locally)'));
  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.maxLength = 20000;
  textarea.value = state.notes?.[item.id] || '';
  textarea.placeholder = 'Observations, controls, evidence references, and validation still required…';
  textarea.addEventListener('change', () => onState(setItemNote(state, item.id, textarea.value)));
  noteLabel.append(textarea);
  notes.append(noteLabel);
  if (itemStatus(item, state) === 'confirmed_finding') {
    const retest = element('label', 'retest-control');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(state.retests?.[item.id]);
    box.addEventListener('change', () => onState(setRetestFlag(state, item.id, box.checked)));
    retest.append(box, document.createTextNode(' Include in retest matrix'));
    notes.append(retest);
  }
  if (record.rawApplicability.state === APPLICABILITY.NA_CONTEXT) {
    const override = element('button', 'button button-quiet', applicability.overridden ? 'Clear applicability override' : 'Override context N/A');
    override.type = 'button';
    override.addEventListener('click', () => {
      if (applicability.overridden) onState(clearOverride(state, item.id));
      else {
        const reason = window.prompt('Why is this test applicable despite the current context?');
        if (reason?.trim()) onState(setOverride(state, item.id, reason));
      }
    });
    notes.append(override);
  }
  body.append(notes);
  details.append(body);
  card.append(details);
  return card;
}

export function createWorkspace({ catalog, getState, replaceState, onStateChange }) {
  let manifest = { categories: [] };
  let records = [];
  let activeView = '';
  let activeCategory = '';
  let checklistFilters = { ...EMPTY_FILTERS };
  let searchFilters = { ...EMPTY_FILTERS };
  const chainStore = createChainStore();
  const payloadStore = createPayloadStore();

  const names = () => categoryMap(manifest);
  const context = () => deriveContext(getState().answers, getState().engagement.targetUrl);
  const makeRecords = (items) => items.map((item) => effectiveRecord(item, getState(), context()));

  function commit(nextState) {
    onStateChange(nextState);
    records = makeRecords(records.map(({ item }) => item));
    if (activeView === 'checklist') renderChecklist();
    if (activeView === 'search') renderSearch();
    renderDashboardMetrics();
  }

  function renderResults(root, summary, sourceRecords, filters) {
    const filtered = filterItems(sourceRecords, filters, getState());
    const visible = filters.applicability ? filtered : filtered.filter(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT);
    summary.textContent = `${visible.length} of ${sourceRecords.length} tests shown`;
    if (!visible.length) {
      root.replaceChildren(element('div', 'panel empty-panel', 'No tests match the current context and filters.'));
      return;
    }
    root.replaceChildren(...visible.map((record) => renderCard(record, getState(), names(), commit)));
  }

  function restoreFilterFocus(root, key) {
    if (!key) return;
    setTimeout(() => {
      const input = root.querySelector(`[name="${key}"]`);
      input?.focus();
      if (input?.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  function renderChecklist() {
    const filterRoot = document.querySelector('[data-checklist-filters]');
    const resultRoot = document.querySelector('[data-checklist-results]');
    const summary = document.querySelector('[data-checklist-summary]');
    const category = activeCategory;
    const fixed = category && manifest.categories.some(({ slug }) => slug === category) ? category : '';
    checklistFilters = { ...checklistFilters, category: fixed };
    renderFilters(filterRoot, manifest, checklistFilters, (next, key) => { checklistFilters = next; renderChecklist(); restoreFilterFocus(filterRoot, key); }, { fixedCategory: fixed });
    renderResults(resultRoot, summary, records, checklistFilters);
    const title = document.querySelector('#checklist-title');
    title.textContent = fixed ? names()[fixed] : 'All tests';
    const rationale = document.querySelector('[data-category-rationale]');
    if (rationale) {
      const reasons = fixed ? categoryRationale(fixed, context()) : [];
      rationale.textContent = reasons.join(' · ');
      rationale.hidden = !reasons.length;
    }
  }

  function renderSearch() {
    const filterRoot = document.querySelector('[data-search-filters]');
    const resultRoot = document.querySelector('[data-search-results]');
    const summary = document.querySelector('[data-search-summary]');
    renderFilters(filterRoot, manifest, searchFilters, (next, key) => { searchFilters = next; renderSearch(); restoreFilterFocus(filterRoot, key); });
    renderResults(resultRoot, summary, records, searchFilters);
  }

  function renderDashboardMetrics() {
    const state = getState();
    const statuses = Object.values(state.statuses || {});
    document.querySelector('[data-dashboard-items]').textContent = manifest.categories.reduce((sum, category) => sum + category.count, 0).toLocaleString();
    document.querySelector('[data-dashboard-tested]').textContent = statuses.filter((status) => status !== 'not_tested').length.toLocaleString();
    document.querySelector('[data-dashboard-potential]').textContent = statuses.filter((status) => status === 'potential_finding').length.toLocaleString();
    document.querySelector('[data-dashboard-confirmed]').textContent = statuses.filter((status) => status === 'confirmed_finding').length.toLocaleString();
    for (const category of manifest.categories) {
      const tested = Object.entries(state.statuses || {}).filter(([id, status]) => id.startsWith(`${category.prefix}-`) && status !== 'not_tested').length;
      const count = document.querySelector(`[data-category-slug="${category.slug}"] em`);
      if (count) count.textContent = tested ? `${tested}/${category.count}` : String(category.count);
    }
  }

  async function renderDashboard() {
    renderDashboardMetrics();
    await chainStore.loadAll();
    const state = getState();
    const itemList = records.map(({ item }) => item);
    const progress = document.querySelector('[data-category-progress]');
    progress.replaceChildren(...manifest.categories.filter(({ count }) => count > 0).map((category) => {
      const categoryItems = itemList.filter((item) => item.category === category.slug);
      const tested = categoryItems.filter((item) => itemStatus(item, state) !== 'not_tested').length;
      const row = element('a', 'progress-row');
      row.href = `#checklist/${category.slug}`;
      const label = element('div', 'progress-label');
      label.append(element('strong', '', category.name), element('span', '', `${tested}/${categoryItems.length}`));
      const bar = document.createElement('progress');
      bar.max = Math.max(1, categoryItems.length);
      bar.value = tested;
      row.append(label, bar);
      return row;
    }));

    const suggestedRoot = document.querySelector('[data-suggested-next]');
    const suggestions = suggestedNext(itemList, context(), { statuses: state.statuses, chains: chainStore.priorityEdges(), limit: 8 });
    if (!suggestions.length) suggestedRoot.replaceChildren(element('p', 'empty-copy', 'No executable Not Tested items match this context. Review Confirm/N/A filters or update scope.'));
    else suggestedRoot.replaceChildren(...suggestions.map(({ item, applicability, contextReasons, unlockedBy }) => {
      const link = element('a', 'suggested-row');
      link.href = `#checklist/${item.category}`;
      link.append(element('span', 'chip id-chip', item.id));
      const explanation = [
        APP_LABELS[applicability.state],
        names()[item.category] || item.category,
        `severity ${item.severity}`,
        ...contextReasons,
        ...(unlockedBy || []).map((chainId) => `unlocked by ${chainId}`)
      ].filter(Boolean).join(' · ');
      const copy = element('div');
      copy.append(element('strong', '', item.title), element('small', '', explanation));
      link.append(copy);
      return link;
    }));

    const findingsRoot = document.querySelector('[data-findings-table]');
    const findings = findingItems(itemList, state);
    if (!findings.length) findingsRoot.replaceChildren(element('p', 'empty-copy', 'No potential or confirmed findings recorded. Scanner leads should remain notes until manually validated.'));
    else {
      const table = element('table', 'findings-table');
      const head = document.createElement('thead');
      const hr = document.createElement('tr');
      ['ID', 'Finding', 'Severity', 'Status', 'Retest'].forEach((name) => hr.append(element('th', '', name)));
      head.append(hr);
      const body = document.createElement('tbody');
      for (const item of findings) {
        const row = document.createElement('tr');
        const idCell = document.createElement('td');
        const link = element('a', '', item.id);
        link.href = `#checklist/${item.category}`;
        idCell.append(link);
        row.append(idCell, element('td', '', item.title), element('td', '', item.severity), element('td', '', STATUS_LABELS[itemStatus(item, state)]), element('td', '', state.retests?.[item.id] ? 'Required' : '—'));
        body.append(row);
      }
      table.append(head, body);
      findingsRoot.replaceChildren(table);
    }
  }

  async function ensureAll() {
    const items = await catalog.loadAll();
    records = makeRecords(items);
    return records;
  }

  async function show(view, slug = '') {
    activeView = view;
    activeCategory = slug;
    if (view === 'dashboard') {
      await ensureAll();
      await renderDashboard();
    } else if (view === 'search') {
      await ensureAll();
      renderSearch();
      restoreFilterFocus(document.querySelector('[data-search-filters]'), 'query');
    } else if (view === 'checklist') {
      const valid = manifest.categories.some((category) => category.slug === slug && category.count > 0);
      const items = valid ? await catalog.loadCategory(slug) : await catalog.loadAll();
      records = makeRecords(items);
      renderChecklist();
    } else if (view === 'chains') {
      const items = await catalog.loadAll();
      await chainStore.render(document.querySelector('[data-chain-browser]'), new Map(items.map((item) => [item.id, item])));
    } else if (view === 'payloads') {
      await payloadStore.render(document.querySelector('[data-payload-browser]'));
    }
  }

  async function exportAll(kind) {
    const all = await catalog.loadAll();
    const state = getState();
    const categoryNames = names();
    if (kind === 'json') downloadText(safeFilename(state.engagement.name, 'state.json'), composeStateJson(state), 'application/json;charset=utf-8');
    if (kind === 'checklist') downloadText(safeFilename(state.engagement.name, 'checklist.md'), composeChecklistMarkdown(all, state, categoryNames), 'text/markdown;charset=utf-8');
    if (kind === 'report') downloadText(safeFilename(state.engagement.name, 'report.md'), composeReportMarkdown(all, state, categoryNames), 'text/markdown;charset=utf-8');
  }

  function bindActions() {
    document.querySelector('[data-export-json]').addEventListener('click', () => exportAll('json'));
    document.querySelector('[data-export-checklist]').addEventListener('click', () => exportAll('checklist'));
    document.querySelector('[data-export-report]').addEventListener('click', () => exportAll('report'));
    document.querySelector('[data-import-trigger]').addEventListener('click', () => document.querySelector('[data-import-file]').click());
    document.querySelector('[data-import-file]').addEventListener('change', async (event) => {
      const message = document.querySelector('[data-import-message]');
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        const imported = importState(await file.text());
        replaceState(imported);
        records = makeRecords(records.map(({ item }) => item));
        message.textContent = 'State imported successfully. Existing local state was replaced after validation.';
        renderDashboard();
      } catch (error) {
        message.textContent = `Import rejected: ${error.message}`;
      } finally {
        event.target.value = '';
      }
    });
    document.querySelector('[data-print]').addEventListener('click', () => window.print());
  }

  return Object.freeze({
    setManifest(next) { manifest = next; catalog.setManifest(next); renderDashboardMetrics(); },
    show,
    bindActions,
    refresh() { if (activeView) return show(activeView, activeCategory); },
    renderDashboardMetrics
  });
}
