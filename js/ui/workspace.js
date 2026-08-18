import { deriveContext } from '../engine/context.js?v=1.0.0-r6';
import { APPLICABILITY, evaluateApplicability } from '../engine/applicability.js?v=1.0.0-r6';
import { suggestedNext } from '../engine/priorities.js?v=1.0.0-r6';
import { categoryRationale } from '../engine/rationale.js?v=1.0.0-r6';
import { clearOverride, importState, setItemNote, setItemStatus, setOverride, setRetestFlag, addFinding, removeFinding, setRetestVerdict, RETEST_VERDICTS, EXPLOITABILITY_LEVELS, FINDING_SEVERITIES } from '../engine/state.js?v=1.0.0-r6';
import { computeCoverage, retestQueue } from '../engine/coverage.js?v=1.0.0-r6';
import { classifyReportability, STAGE_LABELS, RETEST_GUIDANCE, suggestedRetestTargets } from '../engine/reportability.js?v=1.0.0-r6';
import { EMPTY_FILTERS, filterItems, itemStatus } from './filters.js?v=1.0.0-r6';
import { STATUS_LABELS, composeChecklistMarkdown, composeReportMarkdown, composeStateJson, downloadText, findingItems } from './export.js?v=1.0.0-r6';
import { createChainStore } from './chains.js?v=1.0.0-r6';
import { createPayloadStore } from './payloads.js?v=1.0.0-r6';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const APP_LABELS = { active: 'Active', confirm: 'Confirm applicability', na_context: 'N/A (context)' };
const SEVERITY_GLYPHS = Object.freeze({ critical: '▲', high: '◆', medium: '●', low: '■', informational: '○' });
const STATUS_GLYPHS = Object.freeze({ not_tested: '○', in_progress: '◐', passed: '✓', potential_finding: '△', confirmed_finding: '▲', na: '—' });

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
  if (options.fixedCategory && filters.category) {
    const chip = element('span', 'filter-chip fixed', `category: ${filters.category} (view)`);
    chips.append(chip);
  }
  root.append(chips);
  root.append(grid);
}

let familyByItem = new Map();
let familyByCategory = new Map();
let familiesLoaded = false;
let manifestForFamilyLookup = { categories: [] };

async function loadFamilies() {
  if (familiesLoaded) return;
  try {
    const response = await fetch('checklist/families.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (Array.isArray(data.families)) {
      const byItem = new Map();
      const byCategory = new Map();
      for (const family of data.families) {
        for (const id of family.items) byItem.set(id, family);
        const list = byCategory.get(family.category) || [];
        list.push(family);
        byCategory.set(family.category, list);
      }
      familyByItem = byItem;
      familyByCategory = byCategory;
    }
    familiesLoaded = true;
  } catch (error) {
    console.error('Test families could not be loaded; family navigation is unavailable.', error);
    familiesLoaded = true;
  }
}

function categoryOfItem(id) {
  const prefix = id.split('-').slice(0, 2).join('-');
  return manifestForFamilyLookup.categories.find(({ prefix: candidate }) => candidate === prefix)?.slug || '';
}

function renderCard(record, getState, categoryNames, onState) {
  const state = getState();
  const { item, applicability } = record;
  const card = element('article', `test-card severity-${item.severity}`);
  card.dataset.itemId = item.id;
  const header = element('header', 'test-card-header');
  const identity = element('div', 'test-identity');
  const chips = element('div', 'chip-row');
  chips.append(element('span', 'chip id-chip', item.id));
  const severityChip = element('span', `chip severity-chip ${item.severity}`, item.severity);
  const severityGlyph = element('span', 'chip-glyph', SEVERITY_GLYPHS[item.severity] || '');
  severityGlyph.setAttribute('aria-hidden', 'true');
  severityChip.prepend(severityGlyph);
  chips.append(severityChip);
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
  status.addEventListener('change', () => onState(setItemStatus(getState(), item.id, status.value)));
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

  // Level 1 — quick check: always visible, no expansion needed.
  const quick = element('div', 'quick-check');
  const quickTest = element('div', 'quick-part');
  quickTest.append(element('strong', 'quick-label', 'QUICK TEST'));
  const quickSteps = element('ol', 'quick-steps');
  for (const step of item.steps.slice(0, 4)) quickSteps.append(element('li', '', step));
  quickTest.append(quickSteps);
  quickTest.append(element('p', 'quick-change', `One condition at a time — ${item.manipulate}`));
  const quickValidate = element('div', 'quick-part');
  quickValidate.append(element('strong', 'quick-label', 'VALIDATE'));
  quickValidate.append(element('p', 'quick-validate', item.validation));
  quick.append(quickTest, quickValidate);
  card.append(quick);

  // Level 2 — don't miss & related.
  const level2 = element('details', 'method-details level-details');
  level2.append(element('summary', '', "Don't miss & related"));
  const l2 = element('div', 'method-body');
  const family = familyByItem.get(item.id);
  if (family?.dont_miss?.length) {
    const miss = element('section', 'method-section');
    miss.append(element('h4', '', `Don't miss — ${family.title}`));
    const missList = element('ul', 'dont-miss-list');
    for (const entry of family.dont_miss) missList.append(element('li', '', entry));
    miss.append(missList);
    l2.append(miss);
  }
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
    l2.append(variants);
  }
  if (item.related?.length) {
    const related = element('section', 'method-section');
    related.append(element('h4', '', 'Related tests'));
    const relatedRow = element('div', 'related-row');
    for (const id of item.related) {
      const link = element('a', 'chip id-chip related-chip', id);
      link.href = `#checklist/${categoryOfItem(id)}`;
      relatedRow.append(link);
    }
    related.append(relatedRow);
    l2.append(related);
  }
  if (family) {
    const siblings = family.items || [];
    const index = siblings.indexOf(item.id);
    const nextId = siblings.slice(index + 1).concat(siblings.slice(0, index))
      .find((id) => (getState().statuses?.[id] || 'not_tested') === 'not_tested');
    if (nextId && nextId !== item.id) {
      const next = element('p', 'next-in-family');
      const nextLink = element('a', '', `Next in family → ${nextId}`);
      nextLink.href = `#checklist/${categoryOfItem(nextId)}`;
      next.append(element('strong', '', 'Next test: '), nextLink);
      l2.append(next);
    }
  }
  level2.append(l2);
  card.append(level2);

  // Level 3 — detailed methodology (existing knowledge base, unchanged).
  const details = element('details', 'method-details');
  details.append(element('summary', '', 'Detailed methodology'));
  const body = element('div', 'method-body');
  body.append(section('Prerequisites', item.prerequisites));
  body.append(section('Steps', item.steps, true));
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
  details.append(body);
  card.append(details);

  // Level 4 — references, mappings, and attack chains.
  const level4 = element('details', 'method-details level-details');
  level4.append(element('summary', '', 'References & mappings'));
  const l4 = element('div', 'method-body');
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
  l4.append(refs);
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
    l4.append(chains);
  }
  level4.append(l4);
  card.append(level4);

  // Tester records — notes, retest flag, evidence pack, override.
  const recordsDetails = element('details', 'method-details level-details');
  recordsDetails.append(element('summary', '', 'Tester notes & evidence'));
  const body2 = element('div', 'method-body');
  const notes = element('section', 'method-section notes-section');
  const noteLabel = element('label');
  noteLabel.append(element('span', '', 'Tester notes (stored locally)'));
  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.maxLength = 20000;
  textarea.value = state.notes?.[item.id] || '';
  textarea.placeholder = 'Observations, controls, evidence references, and validation still required…';
  textarea.addEventListener('change', () => onState(setItemNote(getState(), item.id, textarea.value)));
  noteLabel.append(textarea);
  notes.append(noteLabel);
  if (itemStatus(item, state) === 'confirmed_finding') {
    const retest = element('label', 'retest-control');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(state.retests?.[item.id]);
    box.addEventListener('change', () => onState(setRetestFlag(getState(), item.id, box.checked)));
    retest.append(box, document.createTextNode(' Include in retest matrix'));
    notes.append(retest);
    notes.append(renderEvidenceForm(item, getState, onState));
  }
  if (record.rawApplicability.state === APPLICABILITY.NA_CONTEXT) {
    const override = element('button', 'button button-quiet', applicability.overridden ? 'Clear applicability override' : 'Override context N/A');
    override.type = 'button';
    override.addEventListener('click', () => {
      if (applicability.overridden) onState(clearOverride(getState(), item.id));
      else {
        const reason = window.prompt('Why is this test applicable despite the current context?');
        if (reason?.trim()) onState(setOverride(getState(), item.id, reason));
      }
    });
    notes.append(override);
  }
  body2.append(notes);
  recordsDetails.append(body2);
  card.append(recordsDetails);
  return card;
  return card;
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
  big.append(element('strong', '', value), element('span', '', 'coverage confidence'));
  const detail = element('p', 'coverage-detail', `${overall.tested} of ${overall.executable} executable tests recorded · ${overall.blocked} credential-blocked · ${overall.na} scoped out (N/A) · ${queue.pending.length} evidence packs awaiting retest`);
  root.append(big, detail);
}

function renderEvidencePacks(root, itemList, getState, onState) {
  const state = getState();
  const packs = state.findings || [];
  root.replaceChildren();
  if (!packs.length) {
    root.append(element('p', 'empty-copy', 'No structured evidence packs recorded. Confirm a finding and use “Record evidence pack” on its methodology card.'));
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
    root.append(element('p', 'empty-copy', 'No evidence packs are waiting on a retest. Confirm findings and record evidence to build the queue.'));
    return;
  }
  const byId = new Map(itemList.map((item) => [item.id, item]));
  const list = element('ul', 'retest-queue-list');
  for (const pack of queue.pending.slice(0, 5)) {
    const link = element('a', '');
    link.href = `#checklist/${byId.get(pack.item_id)?.category || ''}`;
    link.append(element('span', `chip verdict-chip verdict-${pack.retest_verdict}`, 'retest pending'));
    link.append(element('span', 'id-chip chip', pack.item_id));
    const copy = element('span', 'queue-meta', pack.title || 'Untitled evidence pack');
    link.append(copy);
    list.append(element('li', '', link));
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
    list.append(element('li', '', link));
  }
  root.append(list);
}

export function createWorkspace({ catalog, getState, replaceState, onStateChange }) {
  let manifest = { categories: [] };
  let records = [];
  let activeView = '';
  let activeCategory = '';
  let checklistFilters = { ...EMPTY_FILTERS };
  let checklistMode = 'testing';
  let recentTouched = [];
  let searchFilters = { ...EMPTY_FILTERS };
  const chainStore = createChainStore();
  const payloadStore = createPayloadStore();


  const names = () => categoryMap(manifest);
  const context = () => deriveContext(getState().answers, getState().engagement.targetUrl);
  const makeRecords = (items) => items.map((item) => effectiveRecord(item, getState(), context()));

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
    if (activeView === 'dashboard') renderDashboard();
    else renderDashboardMetrics();
  }

  function familyHeader(family, familyRecords, visibleTotal) {
    const state = getState();
    const tested = familyRecords.filter(({ item }) => itemStatus(item, state) !== 'not_tested').length;
    const headerBlock = element('section', 'family-group');
    const head = element('header', 'family-header');
    const copy = element('div');
    copy.append(element('h3', '', family.title), element('p', '', family.summary));
    copy.append(element('span', 'family-count', `${tested}/${familyRecords.length} tested`));
    head.append(copy);
    const miss = element('details', 'family-miss');
    miss.append(element('summary', '', `Don't miss (${family.dont_miss.length} overlooked variants)`));
    const list = element('ul', 'dont-miss-list');
    for (const entry of family.dont_miss) list.append(element('li', '', entry));
    miss.append(list);
    head.append(miss);
    headerBlock.append(head);
    headerBlock.append(...familyRecords.map((record) => renderCard(record, getState, names(), commit)));
    return headerBlock;
  }

  function renderResults(root, summary, sourceRecords, filters, options = {}) {
    const filtered = filterItems(sourceRecords, filters, getState());
    const visible = filters.applicability ? filtered : filtered.filter(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT);
    summary.textContent = `${visible.length} of ${sourceRecords.length} tests shown`;
    if (!visible.length) {
      root.replaceChildren(element('div', 'panel empty-panel', 'No tests match the current context and filters.'));
      return;
    }
    const families = options.groupByFamily || [];
    if (families.length) {
      const byFamily = new Map();
      const ungrouped = [];
      for (const record of visible) {
        const family = familyByItem.get(record.item.id);
        if (family) {
          const bucket = byFamily.get(family.id) || [];
          bucket.push(record);
          byFamily.set(family.id, bucket);
        } else {
          ungrouped.push(record);
        }
      }
      const groups = [];
      for (const family of families) {
        const members = byFamily.get(family.id) || [];
        if (members.length) groups.push(familyHeader(family, members));
      }
      if (ungrouped.length) groups.push(...ungrouped.map((record) => renderCard(record, getState, names(), commit)));
      root.replaceChildren(...groups);
      return;
    }
    root.replaceChildren(...visible.map((record) => renderCard(record, getState, names(), commit)));
  }

  function restoreFilterFocus(root, key) {
    if (!key) return;
    setTimeout(() => {
      const input = root.querySelector(`[name="${key}"]`);
      input?.focus();
      if (input?.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  function coverageRow(item, state) {
    const status = itemStatus(item, state);
    const row = element('div', `coverage-row status-${status}`);
    const link = element('a', '', `${STATUS_GLYPHS[status] || '○'} ${item.id}`);
    link.href = '#checklist';
    link.dataset.coverageItem = item.id;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      checklistMode = 'testing';
      renderChecklist();
      setTimeout(() => {
        document.querySelector(`[data-item-id="${item.id}"]`)?.scrollIntoView({ block: 'start' });
        document.querySelector(`[data-item-id="${item.id}"] .status-select`)?.focus();
      }, 0);
    });
    const copy = element('span', 'coverage-title', item.title);
    const label = element('span', 'coverage-status', STATUS_LABELS[status]);
    row.append(link, copy, label);
    return row;
  }

  function renderCoverageCategory(root, recordsList, category) {
    const state = getState();
    const families = familyByCategory.get(category) || [];
    const byFamily = new Map();
    const ungrouped = [];
    for (const record of recordsList) {
      const family = familyByItem.get(record.item.id);
      if (family) {
        const bucket = byFamily.get(family.id) || [];
        bucket.push(record);
        byFamily.set(family.id, bucket);
      } else {
        ungrouped.push(record);
      }
    }
    const allRecords = recordsList;
    const executable = allRecords.filter(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT);
    const tested = executable.filter(({ item }) => itemStatus(item, state) !== 'not_tested').length;
    const scopedOut = allRecords.length - executable.length;
    const percent = executable.length ? Math.round((tested / executable.length) * 100) : 100;
    const overview = element('div', 'coverage-overview');
    overview.append(element('strong', '', `${tested}/${executable.length}`), document.createTextNode(` executable tests recorded · ${percent}% coverage · ${scopedOut} scoped out (context-N/A)`));
    root.replaceChildren(overview);

    const blocks = [];
    for (const family of families) {
      const members = byFamily.get(family.id) || [];
      const block = element('section', 'coverage-family');
      const familyTested = members.filter(({ item }) => itemStatus(item, state) !== 'not_tested').length;
      const head = element('header', 'coverage-family-head');
      head.append(element('h3', '', family.title));
      head.append(element('span', 'family-count', `${familyTested}/${members.length}`));
      const bar = document.createElement('progress');
      bar.max = Math.max(1, members.length);
      bar.value = familyTested;
      head.append(bar);
      block.append(head);
      const list = element('div', 'coverage-list');
      for (const record of members) list.append(coverageRow(record.item, state));
      block.append(list);
      blocks.push(block);
    }
    if (ungrouped.length) {
      const block = element('section', 'coverage-family');
      block.append(element('h3', '', 'Ungrouped tests'));
      const list = element('div', 'coverage-list');
      for (const record of ungrouped) list.append(coverageRow(record.item, state));
      block.append(list);
      blocks.push(block);
    }
    root.append(...blocks);
  }

  function renderChecklist() {
    const filterRoot = document.querySelector('[data-checklist-filters]');
    const resultRoot = document.querySelector('[data-checklist-results]');
    const summary = document.querySelector('[data-checklist-summary]');
    const category = activeCategory;
    const fixed = category && manifest.categories.some(({ slug }) => slug === category) ? category : '';
    checklistFilters = { ...checklistFilters, category: fixed };
    document.querySelectorAll('[data-checklist-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.checklistMode === checklistMode));
    });
    if (checklistMode === 'coverage' && fixed) {
      document.querySelector('[data-checklist-filters]').hidden = true;
      summary.textContent = '';
      renderCoverageCategory(resultRoot, records, fixed);
    } else {
      document.querySelector('[data-checklist-filters]').hidden = false;
      renderFilters(filterRoot, manifest, checklistFilters, (next, key) => { checklistFilters = next; renderChecklist(); restoreFilterFocus(filterRoot, key); }, { fixedCategory: fixed });
      renderResults(resultRoot, summary, records, checklistFilters, { groupByFamily: fixed ? (familyByCategory.get(fixed) || []) : [] });
    }
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
    if (records.length) {
      const coverage = computeCoverage(records.map(({ item }) => item), context(), state.statuses);
      document.querySelector('[data-dashboard-blocked]').textContent = coverage.overall.blocked.toLocaleString();
      document.querySelector('[data-dashboard-na]').textContent = coverage.overall.na.toLocaleString();
    }
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
      if (entry.na) row.title = `${entry.na} tests scoped out as context-N/A`;
      return row;
    }));
    renderCoverageSummary(document.querySelector('[data-coverage-summary]'), coverage, queue);
    renderRetestQueue(document.querySelector('[data-retest-queue]'), queue, itemList);
    renderChainOverview(document.querySelector('[data-chain-overview]'), itemList, state.statuses, chainStore);

    const suggestedRoot = document.querySelector('[data-suggested-next]');
    const familiesMap = new Map();
    for (const list of familyByCategory.values()) for (const family of list) familiesMap.set(family.id, family.items);
    const relatedByItem = new Map();
    for (const item of itemList) if (item.related?.length) relatedByItem.set(item.id, item.related);
    const suggestions = suggestedNext(itemList, context(), { statuses: state.statuses, chains: chainStore.priorityEdges(), limit: 8, recent: recentTouched, families: familiesMap, relatedByItem });
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
        const severityCell = element('td', '', `${SEVERITY_GLYPHS[item.severity] || ''} ${item.severity}`);
        const statusCell = element('td', '', `${STATUS_GLYPHS[itemStatus(item, state)] || ''} ${STATUS_LABELS[itemStatus(item, state)]}`);
        row.append(idCell, element('td', '', item.title), severityCell, statusCell, element('td', '', state.retests?.[item.id] ? 'Required' : '—'));
        body.append(row);
      }
      table.append(head, body);
      findingsRoot.replaceChildren(table);
    }

    renderEvidencePacks(document.querySelector('[data-evidence-packs]'), itemList, getState, commit);
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
      renderDashboardMetrics();
      await Promise.all([ensureAll(), loadFamilies()]);
      await renderDashboard();
    } else if (view === 'search') {
      await ensureAll();
      renderSearch();
      restoreFilterFocus(document.querySelector('[data-search-filters]'), 'query');
    } else if (view === 'checklist') {
      const valid = manifest.categories.some((category) => category.slug === slug && category.count > 0);
      const [items] = await Promise.all([valid ? catalog.loadCategory(slug) : catalog.loadAll(), loadFamilies()]);
      records = makeRecords(items);
      renderChecklist();
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
    document.querySelectorAll('[data-checklist-mode]').forEach((button) => button.addEventListener('click', () => {
      checklistMode = button.dataset.checklistMode;
      if (activeView === 'checklist') renderChecklist();
    }));
    document.querySelector('[data-print]').addEventListener('click', () => window.print());
  }

  return Object.freeze({
    setManifest(next) { manifest = next; manifestForFamilyLookup = next; catalog.setManifest(next); renderDashboardMetrics(); },
    show,
    bindActions,
    refresh() { if (activeView) return show(activeView, activeCategory); },
    renderDashboardMetrics
  });
}
