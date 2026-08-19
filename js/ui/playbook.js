// Surface playbooks: the tester-facing working layer.
// A playbook is every applicable check for a page type, with named variants
// and copyable payloads sitting in the open — not behind methodology prose.
import { suggestedPlaybook, playbookChecks, checkItemIds } from '../engine/playbooks.js?v=1.0.0-r6';
import { itemStatus } from './filters.js?v=1.0.0-r6';
import { copyButton, element, SEVERITY_GLYPHS, statusControls } from './dom.js?v=1.0.0-r6';

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

export function renderPlaybookBoard(root, context) {
  const { index, matched, primary, contextLabel } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Playbooks could not be loaded. Serve the repository over HTTP.'));
    return;
  }

  const intro = element('p', 'playbook-board-intro');
  if (primary) {
    intro.append(document.createTextNode('This scope matches '));
    const link = element('a', '', primary.title);
    link.href = `#playbook/${primary.id}`;
    intro.append(link);
    intro.append(document.createTextNode(` — ${primary.summary}`));
  } else if (contextLabel) {
    intro.textContent = `${contextLabel} does not pin a single page type. Open any pack, or finish the scope wizard.`;
  } else {
    intro.textContent = 'Pick the surface you are looking at. Each pack lists the checks that apply, with the payloads to send.';
  }
  root.append(intro);

  const grid = element('div', 'playbook-grid');
  for (const playbook of index.playbooks) {
    const card = element('a', `playbook-card${primary?.id === playbook.id ? ' is-primary' : ''}`);
    card.href = `#playbook/${playbook.id}`;
    card.dataset.playbookCard = playbook.id;
    if (primary?.id === playbook.id) card.append(element('em', 'playbook-kicker', 'MATCHES THIS SCOPE'));
    else if (matched.some(({ id }) => id === playbook.id)) card.append(element('em', 'playbook-kicker muted', 'ALSO RELEVANT'));
    else card.append(element('em', 'playbook-kicker muted', 'BROWSE'));
    card.append(element('h2', '', playbook.title));
    card.append(element('p', '', playbook.summary));
    const meta = element('p', 'playbook-card-meta');
    meta.textContent = `${checkCount(playbook)} checks · ${variantCount(playbook)} variants & payloads`;
    card.append(meta);
    grid.append(card);
  }
  root.append(grid);
}

function renderVariant(variant) {
  const box = element('article', 'probe-variant');
  const head = element('header', 'probe-variant-head');
  head.append(element('strong', '', variant.name));
  if (variant.kind) head.append(element('span', 'chip', variant.kind));
  head.append(copyButton(variant.payload, variant.name));
  box.append(head);
  box.append(element('pre', 'probe-payload', variant.payload));
  if (variant.expect) {
    const expect = element('p', 'probe-expect');
    expect.append(element('span', 'micro-label', 'LOOK FOR'));
    expect.append(document.createTextNode(` ${variant.expect}`));
    box.append(expect);
  }
  return box;
}

function renderCheck(check, context) {
  const { recordsById, getState, commit, familyIndex } = context;
  const record = recordFor(check, recordsById);
  const article = element('article', `probe-check severity-${check.severity || 'medium'}`);
  article.dataset.playbookCheck = check.id;

  const head = element('header', 'probe-check-head');
  const identity = element('div', 'probe-check-identity');
  const chips = element('div', 'chip-row');
  chips.append(element('span', `chip severity-chip ${check.severity || 'medium'}`, `${SEVERITY_GLYPHS[check.severity] || ''} ${check.severity || 'medium'}`));
  if (check.tool) chips.append(element('span', 'chip tool-chip', check.tool));
  for (const id of checkItemIds(check)) {
    const family = familyIndex?.byItem?.get(id);
    const link = element('a', 'chip id-chip', id);
    link.href = family ? `#family/${family.id}` : `#checklist`;
    chips.append(link);
  }
  identity.append(chips, element('h3', '', check.title));
  if (check.why) identity.append(element('p', 'probe-why', check.why));
  head.append(identity);
  if (record && getState && commit) {
    const status = itemStatus(record.item, getState());
    head.append(statusControls(record.item, status, { getState, commit }));
  }
  article.append(head);

  if (check.validate) {
    const validate = element('p', 'test-validate');
    validate.append(element('span', 'micro-label', 'VALIDATE'));
    validate.append(document.createTextNode(` ${check.validate}`));
    article.append(validate);
  }

  const list = element('div', 'probe-variant-list');
  for (const variant of check.variants || []) list.append(renderVariant(variant));
  article.append(list);
  return article;
}

export function renderPlaybookWorkspace(root, context) {
  const { playbookId, index, records = [], getState, commit, familyIndex, categoryNames = {} } = context;
  const playbook = index?.byId?.get(playbookId);
  root.replaceChildren();
  if (!playbook) {
    root.append(element('p', 'empty-copy', 'Unknown playbook. Open the playbook list to pick one.'));
    return;
  }

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
  meta.textContent = `${checkCount(playbook)} checks · ${variantCount(playbook)} variants & payloads · copy any block into Repeater`;
  hero.append(meta);

  const toc = element('nav', 'playbook-toc');
  toc.setAttribute('aria-label', 'Checks in this playbook');
  for (const group of playbook.groups || []) {
    const heading = element('span', 'playbook-toc-group', group.title);
    toc.append(heading);
    for (const check of group.checks || []) {
      const link = element('a', '', check.title);
      link.href = `#playbook/${playbook.id}/${check.id}`;
      toc.append(link);
    }
  }
  hero.append(toc);
  shell.append(hero);

  for (const group of playbook.groups || []) {
    const section = element('section', 'playbook-group');
    section.dataset.playbookGroup = group.id;
    const head = element('header', 'playbook-group-head');
    head.append(element('h3', '', group.title));
    if (group.summary) head.append(element('p', '', group.summary));
    section.append(head);
    for (const check of group.checks || []) {
      const node = renderCheck(check, { recordsById, getState, commit, familyIndex, categoryNames });
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
  copy.append(element('p', 'micro-label', 'PAGE-TYPE PLAYBOOK'));
  copy.append(element('strong', '', primary.title));
  copy.append(element('p', '', `${checkCount(primary)} checks with ${variantCount(primary)} copyable variants — the payloads, not the story.`));
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
