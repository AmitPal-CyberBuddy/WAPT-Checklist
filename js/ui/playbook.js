// Surface playbooks: the tester-facing working layer.
// A playbook is the applicable checks for a page type with authored overlays first and
// the catalog-only remainder behind them. Authored checks show named attack hypotheses
// (tickable coverage, never findings) with a one-line Why; catalog-only checks show a
// maturity chip and a methodology link — never a fabricated request.
import { suggestedPlaybook, playbookChecks, checkItemIds, classifyPlaybook, expandPlaybook, expandedMaturityCounts } from '../engine/playbooks.js?v=1.0.0-r20';
import { checkMaturity, MATURITY, resolveVariant } from '../engine/maturity.js?v=1.0.0-r20';
import { variantKey } from '../engine/families.js?v=1.0.0-r20';
import { setVariantCovered } from '../engine/state.js?v=1.0.0-r20';
import { itemStatus } from './filters.js?v=1.0.0-r20';
import { copyButton, element, SEVERITY_GLYPHS, STATUS_GLYPHS, statusControls } from './dom.js?v=1.0.0-r20';

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

const VARIANT_CLASS_LABEL = Object.freeze({
  baseline: 'Baseline',
  mutation: 'Input variation',
  encoding: 'Encoding / normalization',
  'parser-differential': 'Parser / routing',
  'header-variant': 'Proxy trust',
  'parameter-variant': 'Parameter handling',
  'authentication-context': 'Authentication context',
  'authorization-context': 'Authorization context',
  'browser-context': 'Browser context',
  'technology-specific': 'Technology specific',
  'protocol-variant': 'Protocol handling',
  'tool-assisted': 'Tool assisted',
  'out-of-band': 'Out-of-band',
  'race-concurrency': 'Concurrency'
});

const VARIANT_KIND_LABEL = Object.freeze({
  request: 'Repeater request',
  command: 'CLI command',
  html: 'Browser proof',
  note: 'Operator step'
});

const WORKFLOW_BY_TOOL = Object.freeze({
  'Burp Repeater': 'repeater',
  'Burp Intruder': 'intruder',
  'Burp Proxy': 'proxy',
  'Param Miner': 'param-miner',
  'Turbo Intruder': 'turbo-intruder',
  'Burp Collaborator': 'collaborator',
  'Burp Content Discovery': 'proxy'
});

function toolNames(check) {
  const names = [];
  const add = (name) => { if (name && !names.includes(name)) names.push(name); };
  for (const tool of String(check.tool || '').split(/\s*[·,]\s*/)) add(tool);
  for (const tool of check.tools || []) add(tool);
  const variants = check.variants || [];
  if (variants.some(({ kind }) => kind === 'request')) add('Burp Repeater');
  if (variants.some(({ kind }) => kind === 'html')) add('Browser');
  const payloads = variants.map(({ payload }) => String(payload || '')).join('\n').toLowerCase();
  for (const [needle, label] of [
    ['ffuf ', 'ffuf'], ['gobuster ', 'Gobuster'], ['testssl', 'testssl.sh'],
    ['openssl ', 'OpenSSL'], ['nmap ', 'Nmap'], ['curl ', 'curl'], ['dig ', 'dig']
  ]) if (payloads.includes(needle)) add(label);
  return names.slice(0, 6);
}

function relatedReason(source, target) {
  const title = `${target?.title || ''} ${target?.category || ''}`.toLowerCase();
  const sourceTitle = String(source?.title || '').toLowerCase();
  if (title.includes('cache poison') || title.includes('cache key')) return 'The same input may influence a cache key or cached response.';
  if (title.includes('password reset') || title.includes('recovery')) return 'Generated recovery links can inherit this trust decision.';
  if (title.includes('absolute url') || title.includes('redirect')) return 'The same value may control a generated link or navigation target.';
  if (title.includes('email') || title.includes('activation')) return 'Registration, reset, and verification mail may reuse this URL builder.';
  if (title.includes('cors')) return 'Cross-origin behavior can change the impact of this response.';
  if (title.includes('smuggl') || title.includes('desync')) return 'A parser difference here may continue across intermediary hops.';
  if (sourceTitle.includes('host') && title.includes('virtual host')) return 'Authority handling and virtual-host routing share the same boundary.';
  return 'Shares a trust boundary; check it while this request and context are available.';
}

function relatedDestination(itemId, context) {
  const hits = context.playbookIndex?.byItem?.get(itemId) || [];
  const current = hits.find(({ playbook, check }) => playbook.id === context.currentPlaybookId && check.item === itemId);
  const primary = current || hits.find(({ check }) => check.item === itemId);
  if (primary) return `#playbook/${primary.playbook.id}/${primary.check.id}`;
  const family = context.familyIndex?.byItem?.get(itemId);
  return family ? `#family/${family.id}` : `#checklist/${context.recordsById?.get(itemId)?.item?.category || ''}`;
}

function renderRelatedChecks(check, context) {
  const rows = [];
  for (const id of check.related || []) {
    if (id === check.item) continue;
    const target = context.recordsById?.get(id)?.item;
    if (!target) continue;
    const link = element('a', 'probe-related-row');
    link.href = relatedDestination(id, context);
    const copy = element('span');
    copy.append(element('strong', '', target.title));
    copy.append(element('small', '', relatedReason(check, target)));
    link.append(copy, element('span', 'probe-related-arrow', '→'));
    rows.push(link);
    if (rows.length >= 5) break;
  }
  if (!rows.length) return null;
  const section = element('section', 'probe-related');
  section.append(element('p', 'micro-label', 'BECAUSE OF THIS TEST, ALSO CHECK'));
  section.append(...rows);
  return section;
}

function playbookCard(playbook, kind, isPrimary, items, onSelect) {
  const card = element('a', `playbook-card${isPrimary ? ' is-primary' : ''}`);
  card.href = `#playbook/${playbook.id}`;
  if (onSelect) card.addEventListener('click', (event) => {
    event.preventDefault();
    onSelect(playbook.id);
  });
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
      ? `${applicable} available tests · ${authored} step-by-step · ${methodology} reference-only`
      : meta.textContent;
  } else {
    meta.textContent = `${checkCount(playbook)} step-by-step tests · ${variantCount(playbook)} variants & payloads`;
  }
  card.append(meta);
  return card;
}

function appendBoardSection(root, title, playbooks, primary, items, onSelect) {
  if (!playbooks.length) return;
  const section = element('section', 'playbook-board-section');
  section.append(element('h2', 'playbook-board-heading', title));
  const grid = element('div', 'playbook-grid');
  for (const { playbook, kind } of playbooks) grid.append(playbookCard(playbook, kind, primary?.id === playbook.id, items, onSelect));
  section.append(grid);
  root.append(section);
}

export function renderPlaybookBoard(root, context) {
  const { index, matched, primary, contextLabel, derived, items = [], onSelect } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Testing plans could not be loaded. Refresh the page and try again.'));
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
    intro.textContent = `This scope matches ${matches.length} page or function type${matches.length === 1 ? '' : 's'}. Pick what is in front of you; practical tests open inline with variants, tools, and validation.`;
  } else if (contextLabel) {
    intro.textContent = `${contextLabel} does not pin a single page or function. Choose what you are looking at, or refine the scope.`;
  } else {
    intro.textContent = 'Focus the working set on the page or function in front of you. The assessment context stays the source of truth for what applies.';
  }
  root.append(intro);

  appendBoardSection(root, 'Matches this scope', matches, primary, items, onSelect);
  appendBoardSection(root, 'Also relevant', relevant, primary, items, onSelect);
  appendBoardSection(root, matches.length || relevant.length ? 'Other pages & functions' : 'All pages & functions', browse, primary, items, onSelect);
  if (!matches.length && !relevant.length && !browse.length) {
    const grid = element('div', 'playbook-grid');
    for (const playbook of index.playbooks) grid.append(playbookCard(playbook, 'browse', primary?.id === playbook.id, items, onSelect));
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

  if (variantWithMeta.category) head.append(element('span', 'chip variant-class-chip', VARIANT_CLASS_LABEL[variantWithMeta.category] || 'Test variation'));
  if (variantWithMeta.kind) head.append(element('span', 'chip variant-kind-chip', VARIANT_KIND_LABEL[variantWithMeta.kind] || 'Operator step'));
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

export function renderOperatorCheck(check, context) {
  const { recordsById, getState, commit, familyIndex } = context;
  const record = recordFor(check, recordsById);
  const item = record?.item;
  const variants = check.variants || [];
  const maturity = checkMaturity(check);
  const tools = toolNames(check);
  const status = record && getState ? itemStatus(record.item, getState()) : 'not_tested';
  const article = element('details', `probe-check severity-${check.severity || 'medium'} maturity-${maturity}`);
  article.dataset.playbookCheck = check.id;
  article.dataset.itemId = check.item || '';
  article.dataset.operatorStatus = status;
  article.dataset.operatorSeverity = check.severity || 'medium';
  article.dataset.operatorGuide = maturity === MATURITY.CATALOG_ONLY ? 'reference' : 'practical';
  article.dataset.operatorSearch = [
    check.title, check.why, check.item, ...(check.tags || []), ...tools,
    ...variants.map(({ name }) => name)
  ].filter(Boolean).join(' ').toLocaleLowerCase('en-US');

  const summary = element('summary', 'probe-check-summary');
  summary.append(element('span', `probe-check-status status-${status}`, STATUS_GLYPHS[status] || '□'));
  const summaryCopy = element('span', 'probe-check-summary-copy');
  summaryCopy.append(element('strong', '', check.title));
  if (check.why) summaryCopy.append(element('small', '', check.why));
  const facts = element('span', 'probe-check-facts');
  facts.append(element('span', `chip severity-chip ${check.severity || 'medium'}`, `${SEVERITY_GLYPHS[check.severity] || ''} ${check.severity || 'medium'}`));
  facts.append(element('span', `chip maturity-chip maturity-${maturity}`, maturity === MATURITY.CATALOG_ONLY ? 'Reference' : 'Step-by-step'));
  if (variants.length) facts.append(element('span', 'chip', `${variants.length} variant${variants.length === 1 ? '' : 's'}`));
  const payloadCount = variants.filter(({ payload }) => payload).length;
  if (payloadCount) facts.append(element('span', 'chip', `${payloadCount} payload${payloadCount === 1 ? '' : 's'}`));
  for (const tool of tools.slice(0, 2)) facts.append(element('span', 'chip tool-chip', tool));
  summaryCopy.append(facts);
  if (variants.length) summaryCopy.append(element('span', 'probe-check-dont-miss', `Don't miss: ${variants.slice(0, 4).map(({ name }) => name).join(' · ')}`));
  summary.append(summaryCopy, element('span', 'probe-check-chevron', '⌄'));
  article.append(summary);

  // Build the heavy payload, tool, and reporting DOM only when the tester opens a row.
  // On a 183-test plan this avoids hundreds of hidden controls and pre blocks at startup.
  const buildBody = () => {
    const body = element('div', 'probe-check-body');
    const head = element('header', 'probe-check-head');
    const identity = element('div', 'probe-check-identity');
    const chips = element('div', 'chip-row');
    for (const id of checkItemIds(check)) {
      const family = familyIndex?.byItem?.get(id);
      const link = element('a', 'chip id-chip', id);
      link.href = family ? `#family/${family.id}` : '#checklist';
      chips.append(link);
    }
    identity.append(chips);
    head.append(identity);
    if (record && getState && commit) {
      head.append(statusControls(record.item, itemStatus(record.item, getState()), { getState, commit }));
    }
    body.append(head);

    if (tools.length) {
      const toolBand = element('section', 'probe-tools');
      toolBand.append(element('p', 'micro-label', 'TOOLS & WORKFLOWS'));
      const toolLinks = element('div', 'tool-band-links');
      for (const tool of tools) {
        const workflow = WORKFLOW_BY_TOOL[tool];
        if (workflow) {
          const link = element('a', 'chip tool-chip', tool);
          link.href = `workflow.html?tool=${workflow}`;
          link.target = '_blank';
          link.rel = 'noreferrer noopener';
          toolLinks.append(link);
        } else toolLinks.append(element('span', 'chip tool-chip', tool));
      }
      toolBand.append(toolLinks);
      body.append(toolBand);
    }

    if (variants.length) {
      const quick = element('section', 'probe-quick');
      quick.append(element('p', 'micro-label', 'QUICK TEST'));
      quick.append(renderVariantWithCoverage(variants[0], check.id, context));
      body.append(quick);
      const rest = variants.slice(1);
      if (rest.length) {
        const list = element('div', 'probe-variant-list');
        list.append(element('p', 'micro-label', 'VARIANTS'));
        for (const variant of rest) list.append(renderVariantWithCoverage(variant, check.id, context));
        body.append(list);
      }
    } else {
      const pending = element('div', 'probe-catalog-only');
      pending.append(element('p', 'probe-catalog-only-note', 'This check is covered by the full methodology reference rather than a quick step-by-step. Open the reference to run it.'));
      const family = item && familyIndex?.byItem?.get(item.id);
      const method = element('a', 'button button-quiet', 'Open testing reference');
      method.href = family ? `#family/${family.id}` : `#checklist/${item?.category || ''}`;
      pending.append(method);
      body.append(pending);
    }

    if (check.validate) {
      const validate = element('p', 'test-validate');
      validate.append(element('span', 'micro-label', 'VALIDATE'));
      validate.append(document.createTextNode(` ${check.validate}`));
      body.append(validate);
    }

    const boundary = item?.do_not_report?.length ? item.do_not_report : item?.false_positives;
    if (boundary?.length) {
      const block = element('section', 'probe-boundary');
      block.append(element('p', 'micro-label', 'DO NOT REPORT IF'));
      const list = element('ul');
      for (const line of boundary) list.append(element('li', '', line));
      block.append(list);
      body.append(block);
    }

    const related = renderRelatedChecks(check, context);
    if (related) body.append(related);

    if (item) {
      const more = element('details', 'probe-more');
      more.append(element('summary', '', 'Impact, remediation & testing reference'));
      const moreBody = element('div', 'probe-more-body');
      if (item.objective) moreBody.append(element('p', '', item.objective));
      if (item.impact) {
        moreBody.append(element('p', 'micro-label', 'IMPACT'));
        moreBody.append(element('p', '', item.impact));
      }
      if (item.remediation) {
        moreBody.append(element('p', 'micro-label', 'REMEDIATION'));
        moreBody.append(element('p', '', item.remediation));
      }
      const family = familyIndex?.byItem?.get(item.id);
      const method = element('a', '', 'Open complete testing reference');
      method.href = family ? `#family/${family.id}` : `#checklist/${item.category}`;
      moreBody.append(method);
      more.append(moreBody);
      body.append(more);
    }
    return body;
  };

  let mounted = false;
  const mountBody = () => {
    if (mounted) return;
    mounted = true;
    article.append(buildBody());
  };
  summary.addEventListener('click', mountBody, { once: true });
  article.addEventListener('toggle', () => { if (article.open) mountBody(); });
  article.ensureOperatorBody = mountBody;
  return article;
}

// Backwards-local alias: the full Testing Plan and inline assessment use the same compact
// object so behavior never drifts between parallel subsystems.
const renderCheck = renderOperatorCheck;

export function renderPlaybookWorkspace(root, context) {
  const { playbookId, index, records = [], getState, commit, familyIndex, categoryNames = {} } = context;
  const raw = index?.byId?.get(playbookId);
  root.replaceChildren();
  if (!raw) {
    root.append(element('p', 'empty-copy', 'Unknown testing plan. Pick a page or function to focus on.'));
    return;
  }

  const items = records.map((record) => record.item);
  const playbook = items.length ? expandPlaybook(raw, items, familyIndex) : raw;
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const shell = element('div', 'playbook-shell');
  shell.dataset.playbook = playbook.id;

  const hero = element('header', 'playbook-hero');
  const crumbs = element('p', 'family-crumbs');
  const all = element('a', '', 'Page & function plans');
  all.href = '#playbooks';
  crumbs.append(all);
  hero.append(crumbs);
  hero.append(element('h2', '', playbook.title));
  hero.append(element('p', 'family-summary', playbook.summary));
  const meta = element('p', 'playbook-hero-meta');
  const { applicable, authored, methodology } = items.length
    ? expandedMaturityCounts(raw, items)
    : { applicable: checkCount(playbook), authored: checkCount(playbook), methodology: 0 };
  meta.textContent = `${applicable} available tests · ${authored} step-by-step · ${methodology} reference-only · open one row at a time`;
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
      const node = renderCheck(check, {
        recordsById, getState, commit, familyIndex, categoryNames,
        payloads: playbook.payloads,
        playbookIndex: index,
        currentPlaybookId: playbook.id
      });
      node.id = `probe-${check.id}`;
      section.append(node);
    }
    shell.append(section);
  }
  root.append(shell);

  const hashCheck = location.hash.split('/')[2];
  if (hashCheck && /^[a-z0-9-]+$/.test(hashCheck)) {
    const target = root.querySelector(`#probe-${hashCheck}`);
    if (target?.tagName === 'DETAILS') {
      target.ensureOperatorBody?.();
      target.open = true;
    }
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
  copy.append(element('p', 'micro-label', 'CURRENT TESTING PLAN'));
  copy.append(element('strong', '', primary.title));
  copy.append(element('p', '', 'Work the page in front of you: core tests first, then practical variants, tools, payloads, and specialist coverage.'));
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
