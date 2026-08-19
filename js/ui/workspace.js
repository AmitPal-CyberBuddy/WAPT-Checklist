import { deriveContext } from '../engine/context.js?v=1.0.0-r6';
import { APPLICABILITY, evaluateApplicability } from '../engine/applicability.js?v=1.0.0-r6';
import { suggestedNext } from '../engine/priorities.js?v=1.0.0-r6';
import { categoryRationale } from '../engine/rationale.js?v=1.0.0-r6';
import { clearOverride, importState, setPosition, setRetestVerdict, setVariantCovered, addFinding, removeFinding, RETEST_VERDICTS, EXPLOITABILITY_LEVELS, FINDING_SEVERITIES } from '../engine/state.js?v=1.0.0-r6';
import { computeCoverage, retestQueue } from '../engine/coverage.js?v=1.0.0-r6';
import { familyCoverage, familyVariants, indexFamilies, nextInFamily, relatedFamilies } from '../engine/families.js?v=1.0.0-r6';
import { classifyReportability, STAGE_LABELS, RETEST_GUIDANCE, suggestedRetestTargets } from '../engine/reportability.js?v=1.0.0-r6';
import { EMPTY_FILTERS, filterItems, itemStatus } from './filters.js?v=1.0.0-r6';
import { STATUS_LABELS, composeChecklistMarkdown, composeCoverageCsv, composeFamilyCoverageBlock, composeReportMarkdown, composeStateJson, downloadText, findingItems } from './export.js?v=1.0.0-r6';
import { createChainStore } from './chains.js?v=1.0.0-r6';
import { createPayloadStore } from './payloads.js?v=1.0.0-r6';
import { SEVERITY_GLYPHS, STATUS_GLYPHS, element, statRow } from './dom.js?v=1.0.0-r6';
import { renderCard, renderCheckRow } from './card.js?v=1.0.0-r6';
import { buildFamilyRecords, renderCategoryCoverage, renderFamilyBoard, renderFamilyGaps, renderFamilyWorkspace } from './family-view.js?v=1.0.0-r6';
import { indexPlaybooks, matchPlaybooks, suggestedPlaybook } from '../engine/playbooks.js?v=1.0.0-r6';
import { renderPlaybookBanner, renderPlaybookBoard, renderPlaybookWorkspace } from './playbook.js?v=1.0.0-r6';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const EMPTY_INDEX = indexFamilies({ families: [] });

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

  const chips = element('div', 'filter-chips');
  const activeEntries = Object.entries(filters).filter(([key, value]) => value && value.length && !(options.fixedCategory && key === 'category'));
  for (const [key, value] of activeEntries) {
    const chip = element('span', 'filter-chip');
    chip.append(document.createTextNode(`${key}: ${value}`));
    const clear = element('button', '', '×');
    clear.type = 'button';
    clear.setAttribute('aria-label', `Clear ${key} filter`);
    clear.addEventListener('click', () => onChange({ ...filters, [key]: '' }));
    chip.append(clear);
    chips.append(chip);
  }
  if (options.fixedCategory && filters.category) chips.append(element('span', 'filter-chip fixed', `category: ${filters.category} (view)`));
  root.append(chips);
  root.append(grid);
}

function renderEvidenceForm(item, getState, onState) {
  const state = getState();
  const recorded = (state.findings || []).filter(({ item_id: id }) => id === item.id);
  const details = element('details', 'evidence-form');
  details.append(element('summary', '', recorded.length ? `Evidence packs (${recorded.length})` : 'Record evidence pack'));
  const body = element('div', 'evidence-form-body');
  body.append(element('p', 'evidence-redaction', 'Redact credentials, tokens, personal data, and tenant identifiers before recording evidence.'));

  const grid = element('div', 'evidence-grid');
  const fields = [
    ['title', 'Title', 'text', item.title, 120],
    ['severity', 'Severity', 'select', item.severity, null],
    ['endpoint', 'Endpoint', 'text', '', 300],
    ['method', 'HTTP method', 'text', '', 20],
    ['parameter', 'Parameter', 'text', '', 200],
    ['auth_context', 'Authentication context', 'text', '', 200]
  ];
  const controls = {};
  for (const [key, label, type, value, max] of fields) {
    const group = element('label', 'evidence-field');
    group.append(element('span', '', label));
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      for (const severity of FINDING_SEVERITIES) input.append(new Option(severity, severity));
    } else {
      input = document.createElement('input');
      input.type = type;
      if (max) input.maxLength = max;
    }
    input.name = key;
    input.value = value;
    group.append(input);
    grid.append(group);
    controls[key] = input;
  }
  const areas = [
    ['precondition', 'Precondition', 2000], ['baseline_request', 'Baseline request', 8000],
    ['test_request', 'Test request', 8000], ['observed_behavior', 'Observed behavior', 2000],
    ['cleanup_performed', 'Cleanup performed', 2000], ['root_cause', 'Root cause', 2000]
  ];
  for (const [key, label, max] of areas) {
    const group = element('label', 'evidence-field evidence-wide');
    group.append(element('span', '', label));
    const input = document.createElement('textarea');
    input.rows = 3;
    input.maxLength = max;
    input.name = key;
    group.append(input);
    grid.append(group);
    controls[key] = input;
  }
  const exploitLabel = element('label', 'evidence-field');
  exploitLabel.append(element('span', '', 'Exploitability'));
  const exploit = document.createElement('select');
  exploit.name = 'exploitability';
  for (const level of EXPLOITABILITY_LEVELS) exploit.append(new Option(level, level));
  exploitLabel.append(exploit);
  const reportableLabel = element('label', 'evidence-field evidence-check');
  const reportable = document.createElement('input');
  reportable.type = 'checkbox';
  reportable.name = 'reportable';
  reportableLabel.append(reportable, document.createTextNode(' Reportable finding'));
  grid.append(exploitLabel, reportableLabel);
  body.append(grid);

  const stage = element('p', 'evidence-stage');
  const stageDetail = element('small', '', '');
  stage.append(element('strong', '', 'Decision: observation → weakness → demonstrated → reportable'), stageDetail);
  body.append(stage);

  function collect() {
    return {
      item_id: item.id,
      title: controls.title.value,
      severity: controls.severity.value,
      endpoint: controls.endpoint.value,
      method: controls.method.value,
      parameter: controls.parameter.value,
      auth_context: controls.auth_context.value,
      precondition: controls.precondition.value,
      baseline_request: controls.baseline_request.value,
      test_request: controls.test_request.value,
      observed_behavior: controls.observed_behavior.value,
      exploitability: exploit.value,
      reportable: reportable.checked,
      cleanup_performed: controls.cleanup_performed.value,
      root_cause: controls.root_cause.value
    };
  }
  function refreshStage() {
    const classification = classifyReportability(collect(), { item });
    stageDetail.textContent = `${STAGE_LABELS[classification.stage]} · ${classification.reasons.join(' · ')}`;
  }
  grid.addEventListener('input', refreshStage);
  grid.addEventListener('change', refreshStage);
  refreshStage();

  const actions = element('div', 'evidence-actions');
  const save = element('button', 'button button-primary', 'Save evidence pack');
  save.type = 'button';
  save.addEventListener('click', () => {
    onState(addFinding(getState(), collect()));
    details.open = false;
  });
  actions.append(save);
  body.append(actions);
  details.append(body);
  return details;
}

function renderCoverageSummary(root, coverage, queue) {
  root.replaceChildren();
  const overall = coverage.overall;
  const value = overall.coverage === null ? '—' : `${overall.coverage}%`;
  const big = element('div', 'coverage-big');
  big.append(element('strong', '', value), element('span', '', 'of executable checks tested'));
  root.append(big, statRow(overall));
  root.append(element('p', 'coverage-detail', `${overall.tested} tested · ${overall.active} in progress · ${overall.not_tested} not started · ${overall.blocked} blocked · ${overall.na} N/A (${overall.na_context} by scope, ${overall.na_user} by tester) · ${queue.pending.length} evidence packs awaiting retest`));
}

function renderEvidencePacks(root, itemList, getState, onState) {
  const state = getState();
  const packs = state.findings || [];
  root.replaceChildren();
  if (!packs.length) {
    root.append(element('p', 'empty-copy', 'No structured evidence packs recorded. Confirm a finding and use “Record evidence pack” on its check.'));
    return;
  }
  const byId = new Map(itemList.map((item) => [item.id, item]));
  for (const pack of packs) {
    const item = byId.get(pack.item_id);
    const card = element('article', 'evidence-pack');
    const head = element('div', 'evidence-pack-head');
    const chips = element('div', 'chip-row');
    chips.append(element('span', 'chip id-chip', pack.id));
    chips.append(element('span', `chip severity-chip ${pack.severity}`, pack.severity));
    chips.append(element('span', 'chip', pack.exploitability.replaceAll('_', ' ')));
    chips.append(element('span', `chip ${pack.reportable ? '' : 'blocked-chip'}`, pack.reportable ? 'Reportable' : 'Not reportable'));
    chips.append(element('span', `chip verdict-chip verdict-${pack.retest_verdict}`, `retest ${pack.retest_verdict}`));
    head.append(chips);
    const title = element('div', 'evidence-pack-title');
    const link = element('a', '', pack.item_id);
    link.href = `#checklist/${item?.category || ''}`;
    title.append(link, element('strong', '', pack.title || 'Untitled evidence pack'));
    head.append(title);
    card.append(head);

    const classification = classifyReportability(pack, { item });
    const stageLine = element('p', 'evidence-stage');
    stageLine.append(element('strong', '', STAGE_LABELS[classification.stage]), document.createTextNode(` — ${classification.reasons.join(' · ')}`));
    card.append(stageLine);

    const details = document.createElement('details');
    details.className = 'evidence-pack-details';
    details.append(element('summary', '', 'Evidence details'));
    const body = element('div', 'evidence-pack-body');
    for (const [label, value] of [
      ['Endpoint', pack.endpoint], ['Method', pack.method], ['Parameter', pack.parameter],
      ['Authentication context', pack.auth_context], ['Precondition', pack.precondition],
      ['Baseline request', pack.baseline_request], ['Test request', pack.test_request],
      ['Observed behavior', pack.observed_behavior], ['Cleanup performed', pack.cleanup_performed],
      ['Root cause', pack.root_cause]
    ]) {
      if (value) {
        body.append(element('strong', 'evidence-label', label));
        body.append(element('pre', 'evidence-value', value));
      }
    }
    const targets = element('ul', 'evidence-targets');
    for (const target of suggestedRetestTargets(item || {})) targets.append(element('li', '', target));
    body.append(element('strong', 'evidence-label', 'Retest variant suggestions'), targets);
    body.append(element('p', 'evidence-redaction', 'Redact credentials, tokens, personal data, and tenant identifiers before exporting.'));
    details.append(body);
    card.append(details);

    const controls = element('div', 'evidence-controls');
    const verdictLabel = element('label', 'evidence-field');
    verdictLabel.append(element('span', '', 'Retest verdict'));
    const verdict = document.createElement('select');
    for (const option of RETEST_VERDICTS) verdict.append(new Option(option, option));
    verdict.value = pack.retest_verdict;
    verdict.setAttribute('aria-label', `Retest verdict for ${pack.id}`);
    verdict.addEventListener('change', () => onState(setRetestVerdict(getState(), pack.id, verdict.value, pack.retest_note)));
    verdictLabel.append(verdict);
    controls.append(verdictLabel);
    if (pack.retest_verdict !== 'pending') controls.append(element('p', 'evidence-verdict-guide', RETEST_GUIDANCE[pack.retest_verdict]));
    const noteLabel = element('label', 'evidence-field evidence-wide');
    noteLabel.append(element('span', '', 'Retest note'));
    const note = document.createElement('textarea');
    note.rows = 2;
    note.maxLength = 2000;
    note.value = pack.retest_note;
    note.addEventListener('change', () => onState(setRetestVerdict(getState(), pack.id, pack.retest_verdict, note.value)));
    noteLabel.append(note);
    controls.append(noteLabel);
    const remove = element('button', 'button button-quiet evidence-remove', 'Delete evidence pack');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (window.confirm(`Delete evidence pack ${pack.id}? This cannot be undone.`)) onState(removeFinding(getState(), pack.id));
    });
    controls.append(remove);
    card.append(controls);
    root.append(card);
  }
}

function renderRetestQueue(root, queue, itemList) {
  root.replaceChildren();
  if (!queue.pending.length) {
    root.append(element('p', 'empty-copy', 'No evidence packs are waiting on a retest.'));
    return;
  }
  const byId = new Map(itemList.map((item) => [item.id, item]));
  const list = element('ul', 'retest-queue-list');
  for (const pack of queue.pending.slice(0, 5)) {
    const link = element('a', '');
    link.href = `#checklist/${byId.get(pack.item_id)?.category || ''}`;
    link.append(element('span', `chip verdict-chip verdict-${pack.retest_verdict}`, 'retest pending'));
    link.append(element('span', 'id-chip chip', pack.item_id));
    link.append(element('span', 'queue-meta', pack.title || 'Untitled evidence pack'));
    const row = document.createElement('li');
    row.append(link);
    list.append(row);
  }
  if (queue.pending.length > 5) list.append(element('li', 'queue-meta', `+ ${queue.pending.length - 5} more awaiting retest`));
  root.append(list);
}

function renderChainOverview(root, itemList, statuses, chainsStore) {
  root.replaceChildren();
  const chains = chainsStore.getChains();
  if (!chains.length) {
    root.append(element('p', 'empty-copy', 'Attack chains are still loading. Open the Attack chains view for the full graph.'));
    return;
  }
  const list = element('ul', 'chain-overview-list');
  for (const chain of chains) {
    const ids = (chain.nodes || []).map(({ item_id: id }) => id);
    const done = ids.filter((id) => ['passed', 'confirmed_finding'].includes(statuses[id] || '')).length;
    const link = element('a', '');
    link.href = '#chains';
    link.append(element('span', 'chip id-chip', chain.id));
    link.append(element('strong', '', chain.title));
    link.append(element('span', 'chain-progress', `${done}/${ids.length} complete`));
    const row = document.createElement('li');
    row.append(link);
    list.append(row);
  }
  root.append(list);
}

function renderBlockedList(root, records, state) {
  root.replaceChildren();
  const blocked = records.filter(({ item, applicability }) => {
    const status = itemStatus(item, state);
    if (status === 'blocked') return true;
    return applicability.blocked && status === 'not_tested';
  });
  if (!blocked.length) {
    root.append(element('p', 'empty-copy', 'Nothing is blocked. Every executable check is available to test.'));
    return;
  }
  const list = element('ul', 'blocked-list');
  for (const { item } of blocked.slice(0, 6)) {
    const li = document.createElement('li');
    const link = element('a', '');
    link.href = `#checklist/${item.category}`;
    link.append(element('span', 'chip id-chip', item.id), element('span', '', item.title));
    li.append(link);
    list.append(li);
  }
  if (blocked.length > 6) list.append(element('li', 'queue-meta', `+ ${blocked.length - 6} more blocked or credential-gated`));
  root.append(list);
}

export function createWorkspace({ catalog, getState, replaceState, onStateChange }) {
  let manifest = { categories: [] };
  let records = [];
  let activeView = '';
  let activeCategory = '';
  let activeFamily = '';
  let checklistFilters = { ...EMPTY_FILTERS };
  let checklistMode = 'testing';
  let boardFilters = { query: '', category: '', unfinished: true };
  let recentTouched = [];
  let searchFilters = { ...EMPTY_FILTERS };
  let familyIndex = EMPTY_INDEX;
  let familiesLoaded = false;
  let visitedFamilies = [];
  let playbookIndex = indexPlaybooks({ playbooks: [] });
  let playbooksLoaded = false;
  let activePlaybook = '';
  const chainStore = createChainStore();
  const payloadStore = createPayloadStore();

  const names = () => categoryMap(manifest);
  const context = () => deriveContext(getState().answers, getState().engagement.targetUrl);
  const makeRecords = (items) => items.map((item) => effectiveRecord(item, getState(), context()));
  const itemsById = () => new Map(records.map(({ item }) => [item.id, item]));

  function categoryOf(id) {
    const prefix = id.split('-').slice(0, 2).join('-');
    return (manifest.categories || []).find(({ prefix: candidate }) => candidate === prefix)?.slug || '';
  }

  async function loadFamilies() {
    if (familiesLoaded) return familyIndex;
    try {
      const response = await fetch('checklist/families.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      familyIndex = indexFamilies(await response.json());
    } catch (error) {
      console.error('Test families could not be loaded; family navigation is unavailable.', error);
    }
    familiesLoaded = true;
    return familyIndex;
  }

  async function loadPlaybooks() {
    if (playbooksLoaded) return playbookIndex;
    try {
      const response = await fetch('playbooks/manifest.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const documents = await Promise.all((manifest.playbooks || []).map(async (entry) => {
        const result = await fetch(`playbooks/${entry.file}`, { headers: { Accept: 'application/json' } });
        if (!result.ok) throw new Error(`${entry.file}: HTTP ${result.status}`);
        return result.json();
      }));
      playbookIndex = indexPlaybooks(manifest, documents);
    } catch (error) {
      console.error('Playbooks could not be loaded.', error);
    }
    playbooksLoaded = true;
    return playbookIndex;
  }

  function suggestions(limit = 8, options = {}) {
    const state = getState();
    const familyMap = new Map(familyIndex.families.map((family) => [family.id, family]));
    const relatedByItem = new Map();
    for (const { item } of records) if (item.related?.length) relatedByItem.set(item.id, item.related);
    return suggestedNext(records.map(({ item }) => item), context(), {
      statuses: state.statuses,
      chains: chainStore.priorityEdges(),
      limit,
      recent: options.recent || recentTouched,
      // Inside a family workspace the family in view is the focus, even on a cold start,
      // and its related families outrank unrelated workflow-early work.
      focusFamily: options.familyId || '',
      nearFamilies: options.nearFamilies || [],
      families: familyMap,
      relatedByItem
    });
  }

  function rememberPosition(patch) {
    const state = getState();
    const current = state.position || {};
    if (current.view === patch.view && current.family === (patch.family || '') && current.category === (patch.category || '')) return;
    onStateChange(setPosition(state, { view: patch.view, family: patch.family || '', category: patch.category || '', item: patch.item || '' }));
  }

  function commit(nextState) {
    const before = getState().statuses;
    onStateChange(nextState);
    const changed = Object.keys(nextState.statuses || {}).filter((id) => before[id] !== nextState.statuses[id]);
    if (changed.length) {
      recentTouched = [...changed, ...recentTouched].filter((id, index, all) => all.indexOf(id) === index).slice(0, 8);
    }
    records = makeRecords(records.map(({ item }) => item));
    if (activeView === 'checklist') renderChecklist();
    if (activeView === 'search') renderSearch();
    if (activeView === 'families') renderBoard();
    if (activeView === 'family') renderFamily();
    if (activeView === 'dashboard') renderDashboard();
    else if (activeView === 'playbooks') renderPlaybooks();
    else if (activeView === 'playbook') renderPlaybook();
    else renderDashboardMetrics();
  }

  const cardContext = () => ({ getState, commit, familyIndex, categoryOf, renderEvidenceForm, playbookIndex });

  function familyGroupHeader(family, familyRecords) {
    const state = getState();
    const tested = familyRecords.filter(({ item }) => ['passed', 'potential_finding', 'confirmed_finding'].includes(itemStatus(item, state))).length;
    const block = element('section', 'family-group');
    block.dataset.familyBlock = family.id;
    const head = element('header', 'family-header');
    const copy = element('div');
    const title = element('a', 'family-group-title', family.title);
    title.href = `#family/${family.id}`;
    copy.append(title, element('p', '', family.summary));
    head.append(copy);
    head.append(element('span', 'family-count', `${tested}/${familyRecords.length} tested`));
    block.append(head);
    const quick = element('div', 'family-quick-inline');
    quick.append(element('span', 'micro-label', 'QUICK TEST'));
    const list = element('ol', 'quick-steps');
    for (const line of family.quick_test || []) list.append(element('li', '', line));
    quick.append(list);
    block.append(quick);

    // Don't Miss stays one click away wherever the family appears, and ticks here are the
    // same coverage record as in the family workspace.
    const variants = familyVariants(family, state.variants);
    const miss = element('details', 'family-miss');
    miss.dataset.dontMiss = family.id;
    miss.append(element('summary', '', `Don't miss — ${variants.covered}/${variants.total} variants covered`));
    const missList = element('ul', 'dont-miss-list');
    for (const variant of variants.entries) {
      const row = element('li', variant.covered ? 'variant-row covered' : 'variant-row');
      const label = element('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = variant.covered;
      box.dataset.variantKey = variant.key;
      box.addEventListener('change', () => commit(setVariantCovered(getState(), variant.key, box.checked)));
      label.append(box, element('span', '', variant.text));
      row.append(label);
      missList.append(row);
    }
    miss.append(missList);
    block.append(miss);
    block.append(...familyRecords.map((record) => renderCard(record, cardContext())));
    return block;
  }

  // Compact family-grouped rows for the wide views (All tests, Search). One line per check,
  // expanding into the full card in place — 623 cards is a wall, 623 rows is a list you scan.
  function renderCompactGroups(visible) {
    const byFamily = new Map();
    const ungrouped = [];
    for (const record of visible) {
      const family = familyIndex.byItem.get(record.item.id);
      if (!family) { ungrouped.push(record); continue; }
      const bucket = byFamily.get(family.id) || [];
      bucket.push(record);
      byFamily.set(family.id, bucket);
    }
    const state = getState();
    const groups = [];
    const buildRow = (record) => {
      const { row, open } = renderCheckRow(record, { getState, commit });
      const holder = element('div', 'check-holder');
      const detail = element('div', 'check-detail');
      detail.hidden = true;
      holder.append(row, detail);
      open.addEventListener('click', () => {
        const expanded = open.getAttribute('aria-expanded') === 'true';
        open.setAttribute('aria-expanded', String(!expanded));
        detail.hidden = expanded;
        if (!expanded && !detail.childElementCount) detail.append(renderCard(record, { ...cardContext(), embedded: true }));
      });
      return holder;
    };
    for (const family of familyIndex.families) {
      const members = byFamily.get(family.id);
      if (!members?.length) continue;
      const block = element('section', 'family-group compact-group');
      block.dataset.familyBlock = family.id;
      const head = element('header', 'family-header');
      const title = element('a', 'family-group-title', family.title);
      title.href = `#family/${family.id}`;
      const tested = members.filter(({ item }) => ['passed', 'potential_finding', 'confirmed_finding'].includes(itemStatus(item, state))).length;
      head.append(title, element('span', 'family-count', `${tested}/${members.length} tested`));
      const surface = element('span', 'family-surface', names()[family.category] || family.category);
      head.append(surface);
      block.append(head);
      const list = element('div', 'check-list');
      for (const record of members) list.append(buildRow(record));
      block.append(list);
      groups.push(block);
    }
    if (ungrouped.length) {
      const block = element('section', 'family-group compact-group');
      const list = element('div', 'check-list');
      for (const record of ungrouped) list.append(buildRow(record));
      block.append(list);
      groups.push(block);
    }
    return groups;
  }

  function renderResults(root, summary, sourceRecords, filters, options = {}) {
    const filtered = filterItems(sourceRecords, filters, getState());
    const visible = filters.applicability ? filtered : filtered.filter(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT);
    summary.textContent = `${visible.length} of ${sourceRecords.length} tests shown`;
    if (!visible.length) {
      root.replaceChildren(element('div', 'panel empty-panel', 'No tests match the current context and filters.'));
      return;
    }
    if (options.compact) {
      root.replaceChildren(...renderCompactGroups(visible));
      return;
    }
    if (options.groupByFamily) {
      const byFamily = new Map();
      const ungrouped = [];
      for (const record of visible) {
        const family = familyIndex.byItem.get(record.item.id);
        if (!family) { ungrouped.push(record); continue; }
        const bucket = byFamily.get(family.id) || [];
        bucket.push(record);
        byFamily.set(family.id, bucket);
      }
      const groups = [];
      for (const family of familyIndex.families) {
        const members = byFamily.get(family.id);
        if (members?.length) groups.push(familyGroupHeader(family, members));
      }
      if (ungrouped.length) groups.push(...ungrouped.map((record) => renderCard(record, cardContext())));
      root.replaceChildren(...groups);
      return;
    }
    root.replaceChildren(...visible.map((record) => renderCard(record, cardContext())));
  }

  function restoreFilterFocus(root, key) {
    if (!key) return;
    setTimeout(() => {
      const input = root.querySelector(`[name="${key}"]`);
      input?.focus();
      if (input?.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  function openItemInTesting(itemId, familyId) {
    if (familyId) { location.hash = `family/${familyId}`; setTimeout(() => {
      document.querySelector(`[data-family-check-row="${itemId}"] .check-open`)?.click();
      document.querySelector(`[data-family-check-row="${itemId}"]`)?.scrollIntoView({ block: 'center' });
    }, 250); return; }
    checklistMode = 'testing';
    renderChecklist();
    setTimeout(() => {
      document.querySelector(`[data-item-id="${itemId}"]`)?.scrollIntoView({ block: 'start' });
      document.querySelector(`[data-item-id="${itemId}"] .status-select`)?.focus();
    }, 0);
  }

  function renderChecklist() {
    const filterRoot = document.querySelector('[data-checklist-filters]');
    const resultRoot = document.querySelector('[data-checklist-results]');
    const summary = document.querySelector('[data-checklist-summary]');
    const fixed = activeCategory && manifest.categories.some(({ slug }) => slug === activeCategory) ? activeCategory : '';
    checklistFilters = { ...checklistFilters, category: fixed };
    document.querySelectorAll('[data-checklist-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.checklistMode === checklistMode));
    });
    if (checklistMode === 'coverage' && fixed) {
      filterRoot.hidden = true;
      summary.textContent = '';
      renderCategoryCoverage(resultRoot, {
        category: fixed, familyIndex, records, getState, onOpenItem: openItemInTesting
      });
    } else {
      filterRoot.hidden = false;
      renderFilters(filterRoot, manifest, checklistFilters, (next, key) => { checklistFilters = next; renderChecklist(); restoreFilterFocus(filterRoot, key); }, { fixedCategory: fixed });
      // A single surface stays card-first for deep work; the whole catalog is a scan list.
      renderResults(resultRoot, summary, records, checklistFilters, fixed
        ? { groupByFamily: familyIndex.families.length > 0 }
        : { compact: true });
    }
    document.querySelector('#checklist-title').textContent = fixed ? names()[fixed] : 'All tests';
    const rationale = document.querySelector('[data-category-rationale]');
    if (rationale) {
      const reasons = fixed ? categoryRationale(fixed, context()) : [];
      rationale.textContent = reasons.join(' · ');
      rationale.hidden = !reasons.length;
    }
  }

  function renderSearch() {
    const filterRoot = document.querySelector('[data-search-filters]');
    renderFilters(filterRoot, manifest, searchFilters, (next, key) => { searchFilters = next; renderSearch(); restoreFilterFocus(filterRoot, key); });
    renderResults(document.querySelector('[data-search-results]'), document.querySelector('[data-search-summary]'), records, searchFilters, { compact: true });
  }

  // Families touched most recently, newest first — the jump list for iterative testing.
  function recentFamilyIds() {
    const ids = [];
    for (const itemId of recentTouched) {
      const family = familyIndex.byItem.get(itemId);
      if (family && !ids.includes(family.id)) ids.push(family.id);
    }
    for (const id of visitedFamilies) if (!ids.includes(id)) ids.push(id);
    return ids;
  }

  function resumeTarget() {
    const state = getState();
    const stored = familyIndex.byId.get(state.position?.family || '');
    if (stored) return stored;
    const recent = recentTouched.map((id) => familyIndex.byItem.get(id)).find(Boolean);
    return recent || null;
  }

  function playbookContextLabel() {
    const answers = getState().answers || {};
    if (answers.app_type && answers.app_type !== 'unknown') return `Scope: ${String(answers.app_type).replaceAll('_', ' ')}`;
    return '';
  }

  function renderPlaybooks() {
    const root = document.querySelector('[data-playbook-board]');
    if (!root) return;
    const derived = context();
    renderPlaybookBoard(root, {
      index: playbookIndex,
      matched: matchPlaybooks(playbookIndex, derived),
      primary: suggestedPlaybook(playbookIndex, derived),
      contextLabel: playbookContextLabel(),
      derived,
      items: records.map(({ item }) => item)
    });
  }

  function renderPlaybook() {
    const root = document.querySelector('[data-playbook-root]');
    if (!root) return;
    renderPlaybookWorkspace(root, {
      playbookId: activePlaybook,
      index: playbookIndex,
      records,
      getState,
      commit,
      familyIndex,
      categoryNames: names()
    });
    const playbook = playbookIndex.byId.get(activePlaybook);
    const heading = document.querySelector('#playbook-title');
    if (heading) heading.textContent = playbook ? playbook.title : 'Playbook';
    const eyebrow = document.querySelector('[data-playbook-eyebrow]');
    if (eyebrow) eyebrow.textContent = playbook ? 'PAGE PLAYBOOK' : 'PAGE PLAYBOOK';
  }

  function renderBoard() {
    const root = document.querySelector('[data-family-board]');
    if (!root) return;
    renderFamilyBoard(root, {
      familyIndex,
      records,
      getState,
      categoryNames: names(),
      boardFilters,
      itemList: records.map(({ item }) => item),
      recentFamilies: recentFamilyIds(),
      resumeTarget: resumeTarget(),
      onFilterChange: (next, key) => {
        boardFilters = next;
        renderBoard();
        restoreFilterFocus(root, key);
      }
    });
  }

  function renderFamily() {
    const root = document.querySelector('[data-family-root]');
    if (!root) return;
    const neighbourIds = relatedFamilies(activeFamily, {
      index: familyIndex, itemsById: itemsById(), chains: chainStore.getChains(), limit: 6
    }).map(({ id }) => id);
    renderFamilyWorkspace(root, {
      familyId: activeFamily,
      familyIndex,
      records,
      getState,
      commit,
      categoryNames: names(),
      itemsById: itemsById(),
      chains: chainStore.getChains(),
      renderEvidenceForm,
      categoryOf,
      itemList: records.map(({ item }) => item),
      payloads: payloadStore.cached(),
      playbookIndex,
      async onCopyCoverage(family, coverage) {
        try {
          await navigator.clipboard.writeText(composeFamilyCoverageBlock(family, coverage, getState(), names()));
          return true;
        } catch {
          return false;
        }
      },
      // The next check inside the family is the Continue button; this panel answers
      // "and after this family?" so the two are not the same list twice.
      suggestions: suggestions(24, { familyId: activeFamily, nearFamilies: neighbourIds })
        .filter(({ item }) => !(familyIndex.byId.get(activeFamily)?.items || []).includes(item.id))
        .slice(0, 5)
    });
    const family = familyIndex.byId.get(activeFamily);
    const heading = document.querySelector('#family-title');
    if (heading) heading.textContent = family ? family.title : 'Test family';
    const eyebrow = document.querySelector('[data-family-eyebrow]');
    if (eyebrow) eyebrow.textContent = family ? `${(names()[family.category] || family.category).toLocaleUpperCase('en-US')} · TEST FAMILY` : 'TEST FAMILY';
  }

  function renderDashboardMetrics() {
    const state = getState();
    const statuses = Object.values(state.statuses || {});
    const tested = statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
    document.querySelector('[data-dashboard-items]').textContent = manifest.categories.reduce((sum, category) => sum + category.count, 0).toLocaleString();
    document.querySelector('[data-dashboard-tested]').textContent = tested.toLocaleString();
    document.querySelector('[data-dashboard-potential]').textContent = statuses.filter((status) => status === 'potential_finding').length.toLocaleString();
    document.querySelector('[data-dashboard-confirmed]').textContent = statuses.filter((status) => status === 'confirmed_finding').length.toLocaleString();
    if (records.length) {
      const coverage = computeCoverage(records.map(({ item }) => item), context(), state.statuses);
      document.querySelector('[data-dashboard-blocked]').textContent = (coverage.overall.blocked).toLocaleString();
      document.querySelector('[data-dashboard-na]').textContent = coverage.overall.na.toLocaleString();
    }
    for (const category of manifest.categories) {
      const count = document.querySelector(`[data-category-slug="${category.slug}"] em`);
      if (!count) continue;
      const done = Object.entries(state.statuses || {}).filter(([id, status]) => id.startsWith(`${category.prefix}-`) && ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
      count.textContent = done ? `${done}/${category.count}` : String(category.count);
    }
  }

  async function renderDashboard() {
    renderDashboardMetrics();
    await chainStore.loadAll();
    const state = getState();
    const itemList = records.map(({ item }) => item);
    const coverage = computeCoverage(itemList, context(), state.statuses);
    const queue = retestQueue(state);
    const coverageByCategory = new Map(coverage.perCategory.map((entry) => [entry.slug, entry]));

    const progress = document.querySelector('[data-category-progress]');
    progress.replaceChildren(...manifest.categories.filter(({ count }) => count > 0).map((category) => {
      const entry = coverageByCategory.get(category.slug) || { executable: category.count, tested: 0, na: 0 };
      const row = element('a', 'progress-row');
      row.href = `#checklist/${category.slug}`;
      const label = element('div', 'progress-label');
      label.append(element('strong', '', category.name), element('span', '', `${entry.tested}/${entry.executable}`));
      const bar = document.createElement('progress');
      bar.max = Math.max(1, entry.executable);
      bar.value = entry.tested;
      row.append(label, bar);
      if (entry.na) row.title = `${entry.na} tests scoped out as N/A`;
      return row;
    }));

    const banner = document.querySelector('[data-playbook-banner]');
    if (banner) {
      renderPlaybookBanner(banner, {
        index: playbookIndex,
        answers: state.answers,
        deriveContext: (answers) => deriveContext(answers, state.engagement?.targetUrl)
      });
    }
    renderCoverageSummary(document.querySelector('[data-coverage-summary]'), coverage, queue);
    renderFamilyGaps(document.querySelector('[data-family-gaps]'), { familyIndex, records, getState, categoryNames: names(), limit: 6 });
    renderBlockedList(document.querySelector('[data-blocked-list]'), records, state);
    renderRetestQueue(document.querySelector('[data-retest-queue]'), queue, itemList);
    renderChainOverview(document.querySelector('[data-chain-overview]'), itemList, state.statuses, chainStore);

    const resume = document.querySelector('[data-resume]');
    if (resume) {
      const target = resumeTarget();
      const nextCheck = target ? nextInFamily(target, state.statuses, '') : '';
      resume.hidden = !target;
      if (target) {
        resume.href = `#family/${target.id}`;
        resume.textContent = nextCheck ? `Continue ${target.title} → ${nextCheck}` : `Review ${target.title}`;
      }
    }

    const suggestedRoot = document.querySelector('[data-suggested-next]');
    const rows = suggestions(8);
    if (!rows.length) suggestedRoot.replaceChildren(element('p', 'empty-copy', 'No executable Not Tested items match this context. Review Confirm/N/A filters or update scope.'));
    else suggestedRoot.replaceChildren(...rows.map(({ item, reasons }) => {
      const family = familyIndex.byItem.get(item.id);
      const link = element('a', 'suggested-row');
      link.href = family ? `#family/${family.id}` : `#checklist/${item.category}`;
      link.append(element('span', 'chip id-chip', item.id));
      const copy = element('div');
      copy.append(element('strong', '', item.title));
      copy.append(element('small', '', reasons.join(' · ')));
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
        const family = familyIndex.byItem.get(item.id);
        const link = element('a', '', item.id);
        link.href = family ? `#family/${family.id}` : `#checklist/${item.category}`;
        idCell.append(link);
        const status = itemStatus(item, state);
        row.append(
          idCell,
          element('td', '', item.title),
          element('td', '', `${SEVERITY_GLYPHS[item.severity] || ''} ${item.severity}`),
          element('td', '', `${STATUS_GLYPHS[status] || ''} ${STATUS_LABELS[status]}`),
          element('td', '', state.retests?.[item.id] ? 'Required' : '—')
        );
        body.append(row);
      }
      table.append(head, body);
      findingsRoot.replaceChildren(table);
    }

    renderEvidencePacks(document.querySelector('[data-evidence-packs]'), itemList, getState, commit);
  }

  async function ensureAll() {
    records = makeRecords(await catalog.loadAll());
    return records;
  }

  async function show(view, slug = '') {
    activeView = view;
    if (view === 'dashboard') {
      renderDashboardMetrics();
      await Promise.all([ensureAll(), loadFamilies(), loadPlaybooks(), chainStore.loadAll()]);
      await renderDashboard();
      rememberPosition({ view: 'dashboard' });
    } else if (view === 'playbooks') {
      await Promise.all([ensureAll(), loadFamilies(), loadPlaybooks()]);
      renderPlaybooks();
      rememberPosition({ view: 'playbooks' });
    } else if (view === 'playbook') {
      activePlaybook = slug;
      await Promise.all([ensureAll(), loadFamilies(), loadPlaybooks()]);
      renderPlaybook();
      rememberPosition({ view: 'playbook', family: slug });
    } else if (view === 'families') {
      await Promise.all([ensureAll(), loadFamilies()]);
      renderBoard();
      rememberPosition({ view: 'families' });
    } else if (view === 'family') {
      activeFamily = slug;
      visitedFamilies = [slug, ...visitedFamilies.filter((id) => id !== slug)].slice(0, 6);
      await Promise.all([ensureAll(), loadFamilies(), chainStore.loadAll(), payloadStore.loadAll().catch(() => [])]);
      renderFamily();
      const family = familyIndex.byId.get(slug);
      rememberPosition({ view: 'family', family: slug, category: family?.category || '' });
    } else if (view === 'search') {
      await Promise.all([ensureAll(), loadFamilies(), loadPlaybooks()]);
      renderSearch();
      restoreFilterFocus(document.querySelector('[data-search-filters]'), 'query');
    } else if (view === 'checklist') {
      activeCategory = slug;
      const valid = manifest.categories.some((category) => category.slug === slug && category.count > 0);
      const [items] = await Promise.all([valid ? catalog.loadCategory(slug) : catalog.loadAll(), loadFamilies(), loadPlaybooks()]);
      records = makeRecords(items);
      renderChecklist();
      rememberPosition({ view: 'checklist', category: valid ? slug : '' });
    } else if (view === 'chains') {
      const items = await catalog.loadAll();
      await chainStore.render(document.querySelector('[data-chain-browser]'), new Map(items.map((item) => [item.id, item])), { statuses: getState().statuses });
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
    if (kind === 'coverage-csv') {
      await loadFamilies();
      downloadText(safeFilename(state.engagement.name, 'coverage.csv'), composeCoverageCsv(all, state, familyIndex, categoryNames), 'text/csv;charset=utf-8');
    }
    if (kind === 'report') downloadText(safeFilename(state.engagement.name, 'report.md'), composeReportMarkdown(all, state, categoryNames), 'text/markdown;charset=utf-8');
  }

  function bindActions() {
    document.querySelector('[data-export-json]').addEventListener('click', () => exportAll('json'));
    document.querySelector('[data-export-checklist]').addEventListener('click', () => exportAll('checklist'));
    document.querySelector('[data-export-csv]')?.addEventListener('click', () => exportAll('coverage-csv'));
    document.querySelector('[data-export-report]').addEventListener('click', () => exportAll('report'));
    document.querySelector('[data-import-trigger]').addEventListener('click', () => document.querySelector('[data-import-file]').click());
    document.querySelector('[data-import-file]').addEventListener('change', async (event) => {
      const message = document.querySelector('[data-import-message]');
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        replaceState(importState(await file.text()));
        records = makeRecords(records.map(({ item }) => item));
        message.textContent = 'State imported successfully. Existing local state was replaced after validation.';
        renderDashboard();
      } catch (error) {
        message.textContent = `Import rejected: ${error.message}`;
      } finally {
        event.target.value = '';
      }
    });
    document.querySelectorAll('[data-checklist-mode]').forEach((button) => button.addEventListener('click', () => {
      checklistMode = button.dataset.checklistMode;
      if (activeView === 'checklist') renderChecklist();
    }));
    document.querySelectorAll('[data-print]').forEach((button) => button.addEventListener('click', () => window.print()));
  }

  return Object.freeze({
    setManifest(next) { manifest = next; catalog.setManifest(next); renderDashboardMetrics(); },
    show,
    bindActions,
    refresh() {
      if (!activeView) return;
      if (activeView === 'playbook') return show('playbook', activePlaybook);
      if (activeView === 'family') return show('family', activeFamily);
      return show(activeView, activeCategory);
    },
    renderDashboardMetrics
  });
}
