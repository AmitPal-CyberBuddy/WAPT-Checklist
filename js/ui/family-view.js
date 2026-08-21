// Test families as the primary working unit.
//
//   ENGAGEMENT → TEST FAMILY → COVERAGE → INDIVIDUAL CHECKS → DON'T MISS → VALIDATE → NEXT
//
// The board answers "where is work left?", the family workspace answers "what do I do now,
// what have I covered, what must I not forget, and what comes next?" — without losing context.
import { APPLICABILITY } from '../engine/applicability.js?v=1.0.0-r14';
import { familyBoundary, familyContract, familyCoverage, familyGaps, familyVariants, nextInFamily, relatedFamilies, surfaceSuites } from '../engine/families.js?v=1.0.0-r14';
import { setVariantCovered } from '../engine/state.js?v=1.0.0-r14';
import { itemStatus } from './filters.js?v=1.0.0-r14';
import { contractRow, element, statRow, coverageBar, STATUS_GLYPHS } from './dom.js?v=1.0.0-r14';
import { renderCard, renderCheckRow } from './card.js?v=1.0.0-r14';

function familyRecordMap(records, familyIndex) {
  const map = new Map();
  for (const record of records) {
    const family = familyIndex.byItem.get(record.item.id);
    if (!family) continue;
    const bucket = map.get(family.id) || [];
    bucket.push(record);
    map.set(family.id, bucket);
  }
  return map;
}

export function buildFamilyRecords(records, familyIndex) {
  return familyRecordMap(records, familyIndex);
}

function familyLink(family, coverage, contract) {
  const link = element('a', 'family-row');
  link.href = `#family/${family.id}`;
  link.dataset.familyRow = family.id;
  const head = element('div', 'family-row-head');
  head.append(element('strong', '', family.title));
  const counts = element('span', 'family-row-counts', `${coverage.checks.tested}/${coverage.checks.executable}`);
  head.append(counts);
  link.append(head);
  if (contract) {
    const badges = element('div', 'family-row-badges');
    badges.append(element('span', `chip severity-chip ${contract.severity}`, contract.severity));
    if (contract.assisted) badges.append(element('span', 'chip tool-chip', 'tool-assisted'));
    if (coverage.checks.executable === 0) badges.append(element('span', 'chip blocked-chip', 'out of scope'));
    else if (coverage.checks.blocked === coverage.checks.executable) badges.append(element('span', 'chip blocked-chip', 'blocked'));
    link.append(badges);
    link.append(contractRow(contract, { compact: true }));
  }
  link.append(coverageBar(coverage.checks.tested, coverage.checks.executable));
  const meta = element('div', 'family-row-meta');
  const bits = [];
  if (coverage.checks.blocked) bits.push(`${coverage.checks.blocked} blocked`);
  if (coverage.checks.na) bits.push(`${coverage.checks.na} N/A`);
  if (coverage.checks.confirmed) bits.push(`${coverage.checks.confirmed} confirmed`);
  bits.push(`don't miss ${coverage.variants.covered}/${coverage.variants.total}`);
  meta.append(element('span', '', bits.join(' · ')));
  link.append(meta);
  if (coverage.complete) link.classList.add('family-complete');
  return link;
}

// ---------------------------------------------------------------------------- family board
export function renderFamilyBoard(root, context) {
  const { familyIndex, records, getState, categoryNames, boardFilters, onFilterChange, resumeTarget, itemList = [], recentFamilies = [] } = context;
  const state = getState();
  const byFamily = familyRecordMap(records, familyIndex);
  const suites = new Map(surfaceSuites(familyIndex, byFamily, state, { categoryNames }).map((suite) => [suite.slug, suite]));
  root.replaceChildren();

  const toolbar = element('div', 'family-toolbar');
  const search = document.createElement('input');
  search.type = 'search';
  search.name = 'familyQuery';
  search.placeholder = 'Filter families — BOLA, upload, tenant…';
  search.value = boardFilters.query;
  search.setAttribute('aria-label', 'Filter test families');
  // The board rebuilds on change; typing commits after a short pause, not per keystroke.
  let queryTimer = 0;
  let queryFilters = boardFilters;
  search.addEventListener('input', () => {
    queryFilters = { ...queryFilters, query: search.value };
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => onFilterChange(queryFilters, 'familyQuery'), 160);
  });
  const categorySelect = document.createElement('select');
  categorySelect.name = 'familyCategory';
  categorySelect.setAttribute('aria-label', 'Filter by attack surface');
  categorySelect.append(new Option('All attack surfaces', ''));
  for (const [slug, name] of Object.entries(categoryNames)) {
    if (familyIndex.byCategory.has(slug)) categorySelect.append(new Option(name, slug));
  }
  categorySelect.value = boardFilters.category;
  categorySelect.addEventListener('change', () => onFilterChange({ ...boardFilters, category: categorySelect.value }, 'familyCategory'));
  const unfinished = element('label', 'family-toggle');
  const unfinishedBox = document.createElement('input');
  unfinishedBox.type = 'checkbox';
  unfinishedBox.name = 'familyUnfinished';
  unfinishedBox.checked = boardFilters.unfinished;
  unfinishedBox.addEventListener('change', () => onFilterChange({ ...boardFilters, unfinished: unfinishedBox.checked }, 'familyUnfinished'));
  unfinished.append(unfinishedBox, document.createTextNode(' Unfinished only'));
  toolbar.append(search, categorySelect, unfinished);
  if (resumeTarget) {
    const resume = element('a', 'button button-primary', `Continue: ${resumeTarget.title}`);
    resume.href = `#family/${resumeTarget.id}`;
    resume.dataset.resume = resumeTarget.id;
    toolbar.append(resume);
  }
  root.append(toolbar);

  // Recent families: an engagement moves back and forth between surfaces, so the last few
  // families worked stay one click away.
  const recent = recentFamilies.map((id) => familyIndex.byId.get(id)).filter(Boolean).slice(0, 5);
  if (recent.length > 1) {
    const strip = element('div', 'recent-families');
    strip.dataset.recentFamilies = String(recent.length);
    strip.append(element('span', 'contract-key', 'RECENT'));
    for (const family of recent) {
      const chip = element('a', 'chip recent-chip', family.title);
      chip.href = `#family/${family.id}`;
      strip.append(chip);
    }
    root.append(strip);
  }

  const query = boardFilters.query.trim().toLocaleLowerCase('en-US');
  let shown = 0;
  for (const [slug, families] of familyIndex.byCategory) {
    if (boardFilters.category && slug !== boardFilters.category) continue;
    const rows = [];
    let categoryTested = 0;
    let categoryExecutable = 0;
    for (const family of families) {
      const familyRecords = byFamily.get(family.id) || [];
      if (!familyRecords.length) continue;
      const coverage = familyCoverage(family, familyRecords, state);
      categoryTested += coverage.checks.tested;
      categoryExecutable += coverage.checks.executable;
      if (query) {
        const haystack = `${family.title} ${family.summary} ${family.dont_miss.join(' ')} ${family.quick_test.join(' ')}`.toLocaleLowerCase('en-US');
        if (!haystack.includes(query)) continue;
      }
      if (boardFilters.unfinished && coverage.complete) continue;
      rows.push(familyLink(family, coverage, familyContract(family, itemList)));
    }
    if (!rows.length) continue;
    shown += rows.length;
    const suite = suites.get(slug);
    const block = element('section', 'family-category');
    block.dataset.suite = slug;
    const head = element('header', 'family-category-head');
    const title = element('h3', '', categoryNames[slug] || slug);
    const link = element('a', 'family-category-link', 'open all checks →');
    link.href = `#checklist/${slug}`;
    head.append(title, element('span', 'family-category-count', `${categoryTested}/${categoryExecutable}`), link);
    block.append(head);
    // Suite line: an engagement is planned per attack surface, so the surface carries its own
    // coverage and a single action that lands on the first family with work left.
    if (suite) {
      const suiteBar = element('div', 'suite-bar');
      suiteBar.append(coverageBar(suite.tested, suite.executable));
      const meta = element('div', 'suite-meta');
      const bits = [`${suite.coverage === null ? '—' : `${suite.coverage}%`} covered`, `${suite.families} families`];
      if (suite.blocked) bits.push(`${suite.blocked} blocked`);
      if (suite.na) bits.push(`${suite.na} N/A`);
      if (suite.confirmed) bits.push(`${suite.confirmed} confirmed`);
      bits.push(`don't miss ${suite.variantsCovered}/${suite.variantsTotal}`);
      meta.append(element('span', '', bits.join(' · ')));
      if (suite.nextFamily) {
        const action = element('a', 'button button-quiet suite-continue', 'Continue this suite →');
        action.href = `#family/${suite.nextFamily}`;
        action.dataset.suiteContinue = slug;
        meta.append(action);
      } else {
        meta.append(element('span', 'family-done', 'surface complete'));
      }
      suiteBar.append(meta);
      block.append(suiteBar);
    }
    const grid = element('div', 'family-grid');
    grid.append(...rows);
    block.append(grid);
    root.append(block);
  }
  if (!shown) root.append(element('p', 'empty-copy', 'No families match this filter. Clear the filter or switch attack surface.'));
}

// ------------------------------------------------------------------------ family workspace
export function renderFamilyWorkspace(root, context) {
  const {
    familyId, familyIndex, records, getState, commit, categoryNames, itemsById,
    chains, renderEvidenceForm, categoryOf, suggestions, itemList = [], payloads = [], onCopyCoverage
  } = context;
  const family = familyIndex.byId.get(familyId);
  root.replaceChildren();
  if (!family) {
    root.append(element('p', 'empty-copy', 'Unknown test family. Open the families board to pick one.'));
    return;
  }
  const state = getState();
  const byFamily = familyRecordMap(records, familyIndex);
  const familyRecords = byFamily.get(family.id) || [];
  const coverage = familyCoverage(family, familyRecords, state);
  const shell = element('div', 'family-shell');
  shell.dataset.familyBlock = family.id;

  // hero: what surface, how covered, what to do next
  const hero = element('header', 'family-hero');
  const crumbs = element('p', 'family-crumbs');
  const boardLink = element('a', '', 'Test families');
  boardLink.href = '#families';
  const categoryLink = element('a', '', categoryNames[family.category] || family.category);
  categoryLink.href = `#checklist/${family.category}`;
  crumbs.append(boardLink, document.createTextNode(' › '), categoryLink);
  hero.append(crumbs);
  hero.append(element('h2', '', family.title));
  hero.append(element('p', 'family-summary', family.summary));
  const contract = familyContract(family, itemList);
  hero.append(contractRow(contract));
  hero.append(statRow(coverage.checks, { variants: coverage.variants }));

  // Boundary: what this family does NOT cover, expressed as the sibling families that own the
  // rest of the surface. Derived from the category, so scope can never drift out of sync.
  const siblingFamilies = familyBoundary(family.id, familyIndex);
  if (siblingFamilies.length) {
    const boundary = element('p', 'family-boundary');
    boundary.dataset.familyBoundary = family.id;
    boundary.append(element('span', 'contract-key', 'NOT HERE'));
    boundary.append(document.createTextNode(`the rest of ${categoryNames[family.category] || family.category} — `));
    siblingFamilies.slice(0, 4).forEach((sibling, index) => {
      if (index) boundary.append(document.createTextNode(' · '));
      const link = element('a', '', sibling.title);
      link.href = `#family/${sibling.id}`;
      boundary.append(link);
    });
    if (siblingFamilies.length > 4) {
      boundary.append(document.createTextNode(' · '));
      const all = element('a', '', `+${siblingFamilies.length - 4} more`);
      all.href = '#families';
      boundary.append(all);
    }
    hero.append(boundary);
  }

  const actions = element('div', 'family-actions');
  const nextId = nextInFamily(family, state.statuses, '');
  if (nextId) {
    const continueButton = element('button', 'button button-primary', `Continue → ${nextId}`);
    continueButton.type = 'button';
    continueButton.dataset.familyContinue = nextId;
    continueButton.addEventListener('click', () => {
      const row = root.querySelector(`[data-family-check-row="${nextId}"] .check-open`);
      row?.click();
      row?.scrollIntoView({ block: 'center' });
      row?.focus();
    });
    actions.append(continueButton);
  } else {
    actions.append(element('span', 'family-done', 'Every check in this family is recorded.'));
  }
  if (onCopyCoverage) {
    const copy = element('button', 'button button-quiet', 'Copy coverage');
    copy.type = 'button';
    copy.dataset.copyCoverage = family.id;
    copy.title = 'Copy a Markdown coverage block for notes, status updates, and the report';
    copy.addEventListener('click', async () => {
      const done = await onCopyCoverage(family, coverage);
      copy.textContent = done ? 'Copied' : 'Unavailable';
      setTimeout(() => { copy.textContent = 'Copy coverage'; }, 1400);
    });
    actions.append(copy);
  }
  const siblings = familyIndex.byCategory.get(family.category) || [];
  const position = siblings.findIndex(({ id }) => id === family.id);
  if (position > 0) {
    const previous = element('a', 'button button-quiet', '← ' + siblings[position - 1].title);
    previous.href = `#family/${siblings[position - 1].id}`;
    actions.append(previous);
  }
  if (position >= 0 && position < siblings.length - 1) {
    const following = element('a', 'button button-quiet', siblings[position + 1].title + ' →');
    following.href = `#family/${siblings[position + 1].id}`;
    actions.append(following);
  }
  hero.append(actions);
  shell.append(hero);

  // quick test + don't miss, side by side
  const columns = element('div', 'family-columns');
  const quick = element('section', 'panel quick-panel');
  quick.dataset.quickTest = family.id;
  quick.append(element('p', 'micro-label', 'QUICK TEST'));
  const quickList = element('ol', 'quick-steps');
  for (const line of family.quick_test) quickList.append(element('li', '', line));
  quick.append(quickList);
  quick.append(element('p', 'micro-label', 'VALIDATE'));
  quick.append(element('p', 'quick-validate', family.validate));
  columns.append(quick);

  const miss = element('section', 'panel dont-miss-panel');
  miss.dataset.dontMiss = family.id;
  const missHead = element('div', 'panel-heading-compact');
  missHead.append(element('p', 'micro-label', "DON'T MISS"));
  missHead.append(element('span', 'variant-count', `${coverage.variants.covered}/${coverage.variants.total} covered`));
  miss.append(missHead);
  const missList = element('ul', 'dont-miss-list');
  for (const variant of familyVariants(family, state.variants).entries) {
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
  miss.append(element('p', 'panel-footnote', 'Ticks record variant coverage only. They never imply a finding.'));
  columns.append(miss);
  shell.append(columns);

  // Tool band: the Burp workflow pages and payload references that already exist for this
  // family, one click from the checks instead of a separate library visit.
  const familyPayloads = payloads.filter(({ related }) => (related || []).some((id) => (family.items || []).includes(id)));
  if (contract.tools.length || familyPayloads.length) {
    const band = element('section', 'panel tool-band');
    band.dataset.toolBand = family.id;
    band.append(element('span', 'micro-label', 'TOOLING'));
    const links = element('div', 'tool-band-links');
    for (const tool of contract.tools) {
      const link = element('a', 'chip tool-chip', tool.label.replace(/^Burp /, ''));
      link.href = `workflow.html?tool=${tool.workflow}`;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.title = `Safe ${tool.label} workflow: when to use it, evidence to keep, and what it does not prove`;
      links.append(link);
    }
    band.append(links);
    if (familyPayloads.length) {
      const details = element('details', 'tool-band-payloads');
      details.append(element('summary', '', `Payload references for this family (${familyPayloads.length})`));
      const list = element('ul', 'payload-mini-list');
      for (const payload of familyPayloads) {
        const row = document.createElement('li');
        row.append(element('span', 'chip id-chip', payload.id));
        row.append(element('strong', '', payload.title));
        row.append(element('code', '', payload.review_only ? 'REVIEW ONLY — open the payload library' : payload.payload));
        list.append(row);
      }
      details.append(list);
      band.append(details);
    }
    shell.append(band);
  }

  // checks: dense rows that expand into the full card
  const checks = element('section', 'panel checks-panel');
  const checksHead = element('div', 'panel-heading-compact');
  checksHead.append(element('p', 'micro-label', 'CHECKS'));
  checksHead.append(element('span', 'variant-count', `${coverage.checks.tested}/${coverage.checks.executable} tested`));
  checks.append(checksHead);
  const list = element('div', 'check-list');
  for (const record of familyRecords) {
    const { row, open } = renderCheckRow(record, { getState, commit });
    const holder = element('div', 'check-holder');
    holder.append(row);
    const detail = element('div', 'check-detail');
    detail.hidden = true;
    holder.append(detail);
    open.addEventListener('click', () => {
      const expanded = open.getAttribute('aria-expanded') === 'true';
      open.setAttribute('aria-expanded', String(!expanded));
      detail.hidden = expanded;
      if (!expanded && !detail.childElementCount) {
        detail.append(renderCard(record, { getState, commit, familyIndex, categoryOf, renderEvidenceForm, playbookIndex: context.playbookIndex, embedded: true, inFamilyView: true }));
      }
    });
    list.append(holder);
  }
  checks.append(list);
  shell.append(checks);

  // next + what else
  const footer = element('div', 'family-columns');
  const next = element('section', 'panel');
  next.dataset.familyNext = family.id;
  next.append(element('p', 'micro-label', 'AFTER THIS FAMILY'));
  const nextList = element('ul', 'suggested-list');
  const familySuggestions = (suggestions || []).slice(0, 5);
  if (!familySuggestions.length) nextList.append(element('li', 'empty-copy', 'No executable checks remain in scope for this context.'));
  else nextList.append(element('li', 'panel-footnote', 'Ranked by proximity to this surface, your scope, and open attack chains.'));
  for (const suggestion of familySuggestions) {
    const li = document.createElement('li');
    const link = element('a', 'suggested-row');
    const targetFamily = familyIndex.byItem.get(suggestion.item.id);
    link.href = targetFamily ? `#family/${targetFamily.id}` : `#checklist/${suggestion.item.category}`;
    link.append(element('span', 'chip id-chip', suggestion.item.id));
    const copy = element('div');
    copy.append(element('strong', '', suggestion.item.title), element('small', '', suggestion.reasons.join(' · ')));
    link.append(copy);
    li.append(link);
    nextList.append(li);
  }
  next.append(nextList);
  footer.append(next);

  const related = element('section', 'panel');
  related.dataset.relatedFamilies = family.id;
  related.append(element('p', 'micro-label', 'WHAT ELSE SHOULD I CHECK?'));
  const relatedList = element('ul', 'related-family-list');
  const neighbours = relatedFamilies(family.id, { index: familyIndex, itemsById, chains, limit: 6 });
  for (const neighbour of neighbours) {
    const neighbourRecords = byFamily.get(neighbour.id) || [];
    const neighbourCoverage = neighbourRecords.length ? familyCoverage(neighbour.family, neighbourRecords, state) : null;
    const li = document.createElement('li');
    const link = element('a', 'related-family');
    link.href = `#family/${neighbour.id}`;
    const copy = element('div');
    copy.append(element('strong', '', neighbour.family.title));
    const reason = neighbour.reasons.join(' · ');
    const progress = neighbourCoverage ? `${neighbourCoverage.checks.tested}/${neighbourCoverage.checks.executable} tested` : 'not loaded';
    copy.append(element('small', '', `${categoryNames[neighbour.family.category] || neighbour.family.category} · ${progress} · ${reason}`));
    link.append(copy);
    li.append(link);
    relatedList.append(li);
  }
  if (!neighbours.length) relatedList.append(element('li', 'empty-copy', 'No related families recorded for this surface.'));
  related.append(relatedList);
  footer.append(related);
  shell.append(footer);
  root.append(shell);
}

// ------------------------------------------------------------------- dashboard gap panel
export function renderFamilyGaps(root, context) {
  const { familyIndex, records, getState, categoryNames, limit = 6 } = context;
  const state = getState();
  const byFamily = familyRecordMap(records, familyIndex);
  const gaps = familyGaps(familyIndex, byFamily, state, { limit });
  root.replaceChildren();
  if (!gaps.length) {
    root.append(element('p', 'empty-copy', 'No family has executable work left in this scope.'));
    return;
  }
  const list = element('ul', 'gap-list');
  for (const gap of gaps) {
    const li = document.createElement('li');
    const link = element('a', 'gap-row');
    link.href = `#family/${gap.family.id}`;
    const copy = element('div', 'gap-copy');
    copy.append(element('strong', '', gap.family.title));
    const detail = [`${gap.remaining} check${gap.remaining === 1 ? '' : 's'} left`];
    if (gap.variantsLeft) detail.push(`${gap.variantsLeft} don't-miss variants`);
    if (gap.coverage.checks.blocked) detail.push(`${gap.coverage.checks.blocked} blocked`);
    detail.push(categoryNames[gap.family.category] || gap.family.category);
    copy.append(element('small', '', detail.join(' · ')));
    link.append(copy);
    link.append(element('span', 'gap-progress', `${gap.coverage.checks.tested}/${gap.coverage.checks.executable}`));
    li.append(link);
    list.append(li);
  }
  root.append(list);
}

// Compact coverage list for one category, with true state separation per check.
export function renderCategoryCoverage(root, context) {
  const { category, familyIndex, records, getState, onOpenItem } = context;
  const state = getState();
  const byFamily = familyRecordMap(records, familyIndex);
  const families = familyIndex.byCategory.get(category) || [];
  root.replaceChildren();
  const blocks = [];
  for (const family of families) {
    const familyRecords = byFamily.get(family.id) || [];
    if (!familyRecords.length) continue;
    const coverage = familyCoverage(family, familyRecords, state);
    const block = element('section', 'coverage-family');
    const head = element('header', 'coverage-family-head');
    const link = element('a', 'coverage-family-title', family.title);
    link.href = `#family/${family.id}`;
    head.append(link, element('span', 'family-count', `${coverage.checks.tested}/${coverage.checks.executable}`), coverageBar(coverage.checks.tested, coverage.checks.executable));
    block.append(head, statRow(coverage.checks, { variants: coverage.variants }));
    const list = element('div', 'coverage-list');
    for (const record of familyRecords) {
      const status = itemStatus(record.item, state);
      const contextNa = record.applicability.state === APPLICABILITY.NA_CONTEXT;
      const row = element('div', `coverage-row status-${contextNa ? 'na' : status}`);
      const open = element('button', 'coverage-open');
      open.type = 'button';
      open.append(element('span', 'coverage-glyph', contextNa ? '—' : (STATUS_GLYPHS[status] || '□')), element('span', 'coverage-id', record.item.id), element('span', 'coverage-title', record.item.title));
      open.addEventListener('click', () => onOpenItem(record.item.id, family.id));
      row.append(open);
      const label = contextNa ? 'N/A (context)' : (status === 'not_tested' ? 'Not tested' : undefined);
      if (label) row.append(element('span', 'coverage-status', label));
      else if (record.applicability.blocked && status === 'not_tested') row.append(element('span', 'coverage-status', 'Blocked'));
      else row.append(element('span', 'coverage-status', ''));
      list.append(row);
    }
    block.append(list);
    blocks.push(block);
  }
  if (!blocks.length) root.append(element('p', 'empty-copy', 'No families are defined for this attack surface yet.'));
  else root.append(...blocks);
}
