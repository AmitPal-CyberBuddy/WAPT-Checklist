// Surface playbooks: the tester-facing working layer.
// A playbook is the applicable checks for a page type with authored overlays first and
// the catalog-only remainder behind them. Authored checks show named attack hypotheses
// (tickable coverage, never findings) with a one-line Why; catalog-only checks show a
// maturity chip and a methodology link — never a fabricated request.
import { suggestedPlaybook, playbookChecks, checkItemIds, classifyPlaybook, expandPlaybook, expandedMaturityCounts } from '../engine/playbooks.js?v=1.0.0-r7';
import { checkMaturity, MATURITY, MATURITY_LABEL, MATURITY_NOTE, resolveVariant } from '../engine/maturity.js?v=1.0.0-r7';
import { variantKey } from '../engine/families.js?v=1.0.0-r7';
import { setVariantCovered } from '../engine/state.js?v=1.0.0-r7';
import { itemStatus } from './filters.js?v=1.0.0-r7';
import { copyButton, element, SEVERITY_GLYPHS, statusControls } from './dom.js?v=1.0.0-r7';

function checkCount(playbook) {
  return (playbook.groups || []).reduce((sum, group) => sum + (group.checks || []).length, 0);
}

function variantCount(playbook) {
  return playbookChecks(playbook).reduce((sum, check) => sum + (check.variants || []).length, 0);
}

function recordFor(check, recordsById) {
  for (const id of checkItemIds(check)) {
    if (recordsById.has(id)) return recordsById.get(id);
  }
  return null;
}

function playbookCard(playbook, kind, isPrimary, items) {
  const card = element('a', `playbook-card${isPrimary ? ' is-primary' : ''}`);
  card.href = `#playbook/${playbook.id}`;
  card.dataset.playbookCard = playbook.id;
  card.dataset.playbookKind = kind;
  if (isPrimary) card.append(element('em', 'playbook-kicker', 'START HERE'));
  else if (kind === 'match') card.append(element('em', 'playbook-kicker', 'MATCHES THIS SCOPE'));
  else if (kind === 'relevant') card.append(element('em', 'playbook-kicker muted', 'ALSO RELEVANT'));
  else card.append(element('em', 'playbook-kicker muted', 'BROWSE'));
  card.append(element('h2', '', playbook.title));
  card.append(element('p', '', playbook.summary));
  const meta = element('p', 'playbook-card-meta');
  if (items?.length) {
    const { applicable, authored, methodology } = expandedMaturityCounts(playbook, items);
    meta.textContent = items?.length
      ? `${applicable} applicable checks · ${authored} with full playbooks · ${methodology} methodology-only`
      : meta.textContent;
  } else {
    meta.textContent = `${checkCount(playbook)} authored checks · ${variantCount(playbook)} variants & payloads`;
  }
  card.append(meta);
  return card;
}

function appendBoardSection(root, title, playbooks, primary, items) {
  if (!playbooks.length) return;
  const section = element('section', 'playbook-board-section');
  section.append(element('h2', 'playbook-board-heading', title));
  const grid = element('div', 'playbook-grid');
  for (const { playbook, kind } of playbooks) grid.append(playbookCard(playbook, kind, primary?.id === playbook.id, items));
  section.append(grid);
  root.append(section);
}

export function renderPlaybookBoard(root, context) {
  const { index, matched, primary, contextLabel, derived, items = [] } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Playbooks could not be loaded. Serve the repository over HTTP.'));
    return;
  }

  const classified = index.playbooks.map((playbook) => ({
    playbook,
    kind: derived ? classifyPlaybook(playbook, derived) : 'browse'
  }));
  const matches = classified.filter(({ kind }) => kind === 'match');
  const relevant = classified.filter(({ kind }) => kind === 'relevant');
  const browse = classified.filter(({ kind }) => kind === 'browse' || kind === 'none');

  const intro = element('p', 'playbook-board-intro');
  if (matches.length) {
    intro.textContent = `This scope matches ${matches.length} surface${matches.length === 1 ? '' : 's'}. Open the one you are looking at — authored checks carry named variants and copyable payloads; the rest list the full methodology.`;
  } else if (contextLabel) {
    intro.textContent = `${contextLabel} does not pin a single page type. Open any pack, or finish the scope wizard.`;
  } else {
    intro.textContent = 'Pick the surface you are looking at. Each pack lists the checks that apply, with authored payloads where they exist.';
  }
  root.append(intro);

  appendBoardSection(root, 'Matches this scope', matches, primary, items);
  appendBoardSection(root, 'Also relevant', relevant, primary, items);
  appendBoardSection(root, matches.length || relevant.length ? 'Other surfaces' : 'All surfaces', browse, primary, items);
  if (!matches.length && !relevant.length && !browse.length) {
    const grid = element('div', 'playbook-grid');
    for (const playbook of index.playbooks) grid.append(playbookCard(playbook, 'browse', primary?.id === playbook.id, items));
    root.append(grid);
  }
  void matched;
}

function renderVariant(variant, options = {}) {
  const { covered = false, state, commit, payloads } = options;
  const resolved = resolveVariant(variant, payloads || {});
  const variantWithMeta = { ...resolved };
  const box = element('article', 'probe-variant');
  const head = element('header', 'probe-variant-head');

  const key = variantKey(variant.familyId || variant._checkId || 'wapt', variant.name);
  if (state && commit) {
    const label = element('label', 'probe-variant-toggle');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = covered;
    checkbox.dataset.variantKey = key;
    checkbox.addEventListener('change', () => {
      commit(setVariantCovered(state(), key, checkbox.checked));
    });
    label.append(checkbox);
    label.append(element('span', 'probe-variant-name', variant.name));
    head.append(label);
  } else {
    head.append(element('strong', 'probe-variant-name', variant.name));
  }

  if (variantWithMeta.kind) head.append(element('span', 'chip', variantWithMeta.kind));
  if (variantWithMeta.category) head.append(element('span', 'chip variant-class-chip', variantWithMeta.category));
  if (variantWithMeta.payloadObject?.safe) head.append(element('span', 'chip safe-chip', '✓ Safe payload'));
  if (variantWithMeta.payloadObject?.encoding && variantWithMeta.payloadObject.encoding !== 'none') {
    head.append(element('span', 'chip encoding-chip', `encoding: ${variantWithMeta.payloadObject.encoding}`));
  }
  head.append(copyButton(variantWithMeta.payload, variantWithMeta.name));
  box.append(head);

  if (variantWithMeta.why) {
    const why = element('p', 'probe-variant-why');
    why.append(element('span', 'micro-label', 'Why'));
    why.append(document.createTextNode(` ${variantWithMeta.why}`));
    box.append(why);
  }

  box.append(element('pre', 'probe-payload', variantWithMeta.payload));
  const observe = Array.isArray(variantWithMeta.observe) ? variantWithMeta.observe : [];
  if (observe.length) {
    const block = element('section', 'probe-observe');
    block.append(element('p', 'micro-label', 'CHECK FOR'));
    const list = element('ul');
    for (const line of observe) list.append(element('li', '', line));
    block.append(list);
    box.append(block);
  } else if (variantWithMeta.expect) {
    const expect = element('p', 'probe-expect');
    expect.append(element('span', 'micro-label', 'CHECK FOR'));
    expect.append(document.createTextNode(` ${variantWithMeta.expect}`));
    box.append(expect);
  }
  return box;
}

function renderVariantWithCoverage(variant, checkId, context) {
  const { getState, commit, payloads } = context;
  const key = variantKey(checkId, variant.name);
  const variants = getState ? (getState().variants || {}) : {};
  return renderVariant({ ...variant, _checkId: checkId }, {
    covered: variants[key] === true,
    state: getState,
    commit,
    payloads
  });
}

function renderCheck(check, context) {
  const { recordsById, getState, commit, familyIndex, payloads } = context;
  const record = recordFor(check, recordsById);
  const item = record?.item;
  const variants = check.variants || [];
  const maturity = checkMaturity(check);
  const article = element('article', `probe-check severity-${check.severity || 'medium'} maturity-${maturity}`);
  article.dataset.playbookCheck = check.id;

  const head = element('header', 'probe-check-head');
  const identity = element('div', 'probe-check-identity');
  const chips = element('div', 'chip-row');
  chips.append(element('span', `chip severity-chip ${check.severity || 'medium'}`, `${SEVERITY_GLYPHS[check.severity] || ''} ${check.severity || 'medium'}`));
  chips.append(element('span', `chip maturity-chip maturity-${maturity}`, MATURITY_LABEL[maturity] || maturity));
  if (check.tool) chips.append(element('span', 'chip tool-chip', check.tool));
  for (const id of checkItemIds(check)) {
    const family = familyIndex?.byItem?.get(id);
    const link = element('a', 'chip id-chip', id);
    link.href = family ? `#family/${family.id}` : `#checklist`;
    chips.append(link);
  }
  identity.append(chips, element('h3', '', check.title));
  head.append(identity);
  if (record && getState && commit) {
    const status = itemStatus(record.item, getState());
    head.append(statusControls(record.item, status, { getState, commit }));
  }
  article.append(head);

  if (variants.length) {
    const quick = element('section', 'probe-quick');
    quick.append(element('p', 'micro-label', 'QUICK TEST'));
    quick.append(renderVariantWithCoverage(variants[0], check.id, context));
    article.append(quick);

    const rest = variants.slice(1);
    if (rest.length) {
      const list = element('div', 'probe-variant-list');
      list.append(element('p', 'micro-label', 'VARIANTS'));
      for (const variant of rest) list.append(renderVariantWithCoverage(variant, check.id, context));
      article.append(list);
    }
  } else {
    const pending = element('div', 'probe-catalog-only');
    pending.append(element('p', 'probe-catalog-only-note', MATURITY_NOTE[MATURITY.CATALOG_ONLY]));
    const family = item && familyIndex?.byItem?.get(item.id);
    const method = element('a', 'button button-quiet', 'Open full methodology');
    method.href = family ? `#family/${family.id}` : `#checklist/${item?.category || ''}`;
    pending.append(method);
    article.append(pending);
  }

  if (check.validate) {
    const validate = element('p', 'test-validate');
    validate.append(element('span', 'micro-label', 'VALIDATE'));
    validate.append(document.createTextNode(` ${check.validate}`));
    article.append(validate);
  }

  const boundary = item?.do_not_report?.length ? item.do_not_report : item?.false_positives;
  if (boundary?.length) {
    const block = element('section', 'probe-boundary');
    block.append(element('p', 'micro-label', 'DO NOT REPORT IF'));
    const list = element('ul');
    for (const line of boundary) list.append(element('li', '', line));
    block.append(list);
    article.append(block);
  }

  if (item) {
    const more = element('details', 'probe-more');
    more.append(element('summary', '', 'Reporting and reference information'));
    const body = element('div', 'probe-more-body');
    if (item.objective) body.append(element('p', '', item.objective));
    if (item.impact) {
      body.append(element('p', 'micro-label', 'IMPACT'));
      body.append(element('p', '', item.impact));
    }
    if (item.remediation) {
      body.append(element('p', 'micro-label', 'REMEDIATION'));
      body.append(element('p', '', item.remediation));
    }
    const family = familyIndex?.byItem?.get(item.id);
    const method = element('a', '', 'Open full methodology');
    method.href = family ? `#family/${family.id}` : `#checklist/${item.category}`;
    body.append(method);
    more.append(body);
    article.append(more);
  }
  return article;
}

export function renderPlaybookWorkspace(root, context) {
  const { playbookId, index, records = [], getState, commit, familyIndex, categoryNames = {} } = context;
  const raw = index?.byId?.get(playbookId);
  root.replaceChildren();
  if (!raw) {
    root.append(element('p', 'empty-copy', 'Unknown playbook. Open the playbook list to pick one.'));
    return;
  }

  const items = records.map((record) => record.item);
  const playbook = items.length ? expandPlaybook(raw, items, familyIndex) : raw;
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const shell = element('div', 'playbook-shell');
  shell.dataset.playbook = playbook.id;

  const hero = element('header', 'playbook-hero');
  const crumbs = element('p', 'family-crumbs');
  const all = element('a', '', 'Playbooks');
  all.href = '#playbooks';
  crumbs.append(all);
  hero.append(crumbs);
  hero.append(element('h2', '', playbook.title));
  hero.append(element('p', 'family-summary', playbook.summary));
  const meta = element('p', 'playbook-hero-meta');
  const { applicable, authored, methodology } = items.length
    ? expandedMaturityCounts(raw, items)
    : { applicable: checkCount(playbook), authored: checkCount(playbook), methodology: 0 };
  meta.textContent = `${applicable} applicable checks · ${authored} with full playbooks · ${methodology} methodology-only · copy any authored block into Repeater`;
  hero.append(meta);

  const toc = element('nav', 'playbook-toc');
  toc.setAttribute('aria-label', 'Groups in this playbook');
  for (const group of playbook.groups || []) {
    const link = element('a', group.authored ? '' : 'is-muted', `${group.title} (${(group.checks || []).length})`);
    link.href = `#playbook/${playbook.id}/${group.id}`;
    toc.append(link);
  }
  hero.append(toc);
  shell.append(hero);

  for (const group of playbook.groups || []) {
    const section = element('section', 'playbook-group');
    section.dataset.playbookGroup = group.id;
    section.id = `probe-${group.id}`;
    const head = element('header', 'playbook-group-head');
    head.append(element('p', 'micro-label', group.authored ? 'START HERE' : 'ALL APPLICABLE'));
    head.append(element('h3', '', group.title));
    if (group.summary) head.append(element('p', '', group.summary));
    section.append(head);
    for (const check of group.checks || []) {
      const node = renderCheck(check, { recordsById, getState, commit, familyIndex, categoryNames, payloads: playbook.payloads });
      node.id = `probe-${check.id}`;
      section.append(node);
    }
    shell.append(section);
  }
  root.append(shell);

  const hashCheck = location.hash.split('/')[2];
  if (hashCheck && /^[a-z0-9-]+$/.test(hashCheck)) {
    const target = root.querySelector(`#probe-${hashCheck}`);
    target?.scrollIntoView({ block: 'start' });
  }
}

export function renderPlaybookBanner(root, context) {
  const { index, answers } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) return;
  const { deriveContext } = context;
  const derived = deriveContext ? deriveContext(answers || {}) : null;
  const primary = derived ? suggestedPlaybook(index, derived) : index.playbooks[0];
  if (!primary) return;
  const banner = element('aside', 'playbook-banner');
  banner.dataset.playbookBanner = primary.id;
  const copy = element('div');
  copy.append(element('p', 'micro-label', 'PAGE-TYPE PLAYBOOKS'));
  copy.append(element('strong', '', primary.title));
  copy.append(element('p', '', 'Every applicable check for the page in front of you — authored named variants and copyable payloads first, the full methodology behind the rest.'));
  const action = element('a', 'button button-primary', `Open ${primary.title} →`);
  action.href = `#playbook/${primary.id}`;
  banner.append(copy, action);
  root.append(banner);
}

export function renderItemProbes(container, index, itemId) {
  const hits = index?.byItem?.get(itemId) || [];
  if (!hits.length) return null;
  const section = element('section', 'method-section probe-inline');
  const heading = element('div', 'method-section-heading');
  heading.append(element('h4', '', 'Test variants & payloads'));
  section.append(heading);
  for (const { playbook, check } of hits.slice(0, 2)) {
    const kicker = element('p', 'probe-inline-kicker');
    const link = element('a', '', `${playbook.title} · ${check.title}`);
    link.href = `#playbook/${playbook.id}/${check.id}`;
    kicker.append(link);
    section.append(kicker);
    for (const variant of (check.variants || []).slice(0, 6)) section.append(renderVariant(variant));
  }
  container.append(section);
  return section;
}
