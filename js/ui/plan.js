// Current Assessment: profile → attack-surface families → named practical tests.
// Export compatibility note: plan metadata still distinguishes “authored playbooks” from
// “methodology-only” catalog entries, while the operator UI calls them Practical and
// Methodology so internal content architecture never becomes navigation noise.
import { checkItemIds } from '../engine/playbooks.js?v=1.0.0-r9';
import { buildAssessmentPlan, composeAssessmentMarkdown } from '../engine/assessment.js?v=1.0.0-r9';
import { shareHref } from '../engine/share.js?v=1.0.0-r9';
import { profileIsScoped, answersToProfile } from '../engine/profile.js?v=1.0.0-r9';
import { itemStatus } from './filters.js?v=1.0.0-r9';
import { element } from './dom.js?v=1.0.0-r9';
import { renderOperatorCheck } from './playbook.js?v=1.0.0-r9';

const APP_TYPE_LABEL = Object.freeze({
  static: 'Static website',
  spa: 'Single-page application',
  server_rendered: 'Dynamic web application',
  hybrid: 'Hybrid web application',
  api_only: 'API / mobile backend',
  unknown: 'Not confirmed'
});

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function featureChips(answers = {}) {
  const chips = [];
  chips.push(APP_TYPE_LABEL[answers.app_type] || 'Application');
  if (answers.has_login === 'no') chips.push('No authentication');
  else if (answers.has_login === 'yes') chips.push('Authentication');
  const api = list(answers.api_style).filter((value) => value !== 'none' && value !== 'unknown');
  if (!api.length || list(answers.api_style).includes('none')) chips.push('No API');
  else chips.push(...api.map((value) => value.toUpperCase()));
  const features = list(answers.features).filter((value) => value !== 'none' && value !== 'unknown');
  if (!features.length || list(answers.features).includes('none')) chips.push('No extra features');
  else chips.push(...features.map((value) => String(value).replaceAll('_', ' ')));
  const auth = list(answers.auth_mechanism).filter((value) => value !== 'none' && value !== 'unknown');
  for (const value of auth) chips.push(String(value).replaceAll('_', ' '));
  return [...new Set(chips)];
}

function checkStatus(check, recordsById, state) {
  for (const id of checkItemIds(check)) {
    const record = recordsById.get(id);
    if (record) return itemStatus(record.item, state);
  }
  return 'not_tested';
}

function actionButton(className, label, onClick) {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

function flash(button, label) {
  const previous = button.textContent;
  button.textContent = label;
  setTimeout(() => { button.textContent = previous; }, 1600);
}

async function copyText(text) {
  await navigator.clipboard.writeText(String(text || ''));
}

const DEPTHS = Object.freeze([
  Object.freeze({ id: 'core', label: 'Core', tiers: ['dont-miss', 'high-value'], note: 'Fast, high-value pass' }),
  Object.freeze({ id: 'extended', label: 'Extended', tiers: ['dont-miss', 'high-value', 'standard'], note: 'Normal full coverage' }),
  Object.freeze({ id: 'specialized', label: 'Specialized', tiers: ['dont-miss', 'high-value', 'standard', 'advanced'], note: 'Every applicable test' })
]);

function depthCount(plan, depth) {
  const allowed = new Set(depth.tiers);
  return (plan.tiers || []).filter(({ id }) => allowed.has(id)).reduce((sum, { checks }) => sum + checks.length, 0);
}

function openSurfacePicker() {
  const picker = document.querySelector('[data-surface-picker]');
  if (!picker) return;
  picker.open = true;
  picker.scrollIntoView({ behavior: 'smooth', block: 'start' });
  picker.querySelector('input, button')?.focus();
}

export function renderAssessmentPlan(root, context) {
  const { index, answers = {}, engagement = {}, records = [], getState, coverage, familyIndex } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Choose the page or function you are looking at, then the testing plan appears here.'));
    return;
  }

  const derived = context.deriveContext ? context.deriveContext(answers) : null;
  if (!derived || !profileIsScoped(answersToProfile(answers))) {
    root.append(element('p', 'empty-copy', 'Choose what you are looking at above to build the first testing pass.'));
    return;
  }

  const items = records.map(({ item }) => item);
  const selectedSurfaceId = index.byId.has(context.surfaceId) ? context.surfaceId : '';
  const plan = buildAssessmentPlan(index, derived, answers, items, { surfaceId: selectedSurfaceId });
  const families = plan.families || [];
  if (!families.length) {
    root.append(element('p', 'empty-copy', 'No tests matched this profile. Adjust the page type, authentication, or features.'));
    return;
  }

  const state = getState ? getState() : { statuses: {} };
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const checks = plan.checks || [];
  const statuses = checks.map((check) => checkStatus(check, recordsById, state));
  const completed = statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
  const potential = statuses.filter((status) => status === 'potential_finding').length;
  const confirmed = statuses.filter((status) => status === 'confirmed_finding').length;
  const chips = featureChips(answers);
  const applicableCount = typeof plan.applicableCount === 'number' ? plan.applicableCount : checks.length;
  const remaining = Math.max(0, applicableCount - completed);
  const surfaceTitle = plan.currentSurface?.title || chips[0] || 'Current page or function';

  const shell = element('section', 'assessment-plan operator-plan');
  shell.dataset.assessmentPlan = families.map(({ id }) => id).join(' ');

  const hero = element('header', 'assessment-hero operator-hero');
  const heroTop = element('div', 'operator-hero-top');
  const heroCopy = element('div');
  heroCopy.append(element('p', 'micro-label', 'CURRENT SURFACE'));
  heroCopy.append(element('h2', '', surfaceTitle));
  const target = element('p', 'assessment-target');
  target.append(element('strong', '', engagement.targetUrl?.trim() || 'No target URL set'));
  heroCopy.append(target);
  heroTop.append(heroCopy);
  const change = actionButton('button button-quiet', 'Change page / function', openSurfacePicker);
  change.dataset.changeSurface = 'true';
  heroTop.append(change);
  hero.append(heroTop);

  const stats = element('div', 'operator-progress');
  for (const [value, label] of [
    [applicableCount, 'Applicable tests'],
    [completed, 'Completed'],
    [remaining, 'Remaining']
  ]) {
    const stat = element('div', 'operator-progress-stat');
    stat.append(element('strong', '', String(value)), element('span', '', label));
    stats.append(stat);
  }
  if (potential + confirmed) {
    const stat = element('div', 'operator-progress-stat finding-stat');
    stat.append(element('strong', '', String(potential + confirmed)), element('span', '', 'To validate'));
    stats.append(stat);
  }
  hero.append(stats);

  const actions = element('div', 'assessment-actions');
  const start = actionButton('button button-primary', completed ? 'Continue next test →' : 'Start core tests →', () => {
    const first = shell.querySelector('.plan-tier:not([hidden]) .probe-check:not([hidden])');
    if (first) {
      first.ensureOperatorBody?.();
      first.open = true;
      first.scrollIntoView({ behavior: 'smooth', block: 'start' });
      first.querySelector('summary')?.focus();
    }
  });
  start.dataset.startPlan = 'true';
  const shareLink = actionButton('button button-quiet', 'Copy share link', async () => {
    try {
      await copyText(shareHref({ name: engagement.name, targetUrl: engagement.targetUrl, answers }, typeof location !== 'undefined' ? location.href : 'app.html'));
      flash(shareLink, 'Link copied');
    } catch { flash(shareLink, 'Copy unavailable'); }
  });
  shareLink.dataset.shareLink = 'true';
  shareLink.title = 'Copies scope only — never findings, notes, or evidence.';
  const sharePlan = actionButton('button button-quiet', 'Copy plan', async () => {
    try {
      await copyText(composeAssessmentMarkdown({
        name: engagement.name,
        targetUrl: engagement.targetUrl,
        chips,
        families,
        hiddenFamilies: plan.hiddenFamilies,
        applicableCount: plan.applicableCount,
        authoredCount: plan.authoredCount,
        methodologyCount: plan.methodologyCount
      }));
      flash(sharePlan, 'Plan copied');
    } catch { flash(sharePlan, 'Copy unavailable'); }
  });
  actions.append(start, shareLink, sharePlan);
  hero.append(actions);
  shell.append(hero);

  // Keep the tester in one working set: depth and attack-surface controls filter these same
  // rows. They are not links to separate product concepts.
  const controls = element('section', 'plan-controls');
  const depthBlock = element('div', 'plan-control-block');
  depthBlock.append(element('span', 'micro-label', 'COVERAGE DEPTH'));
  const depthButtons = element('div', 'plan-segmented');
  const rememberedDepth = DEPTHS.some(({ id }) => id === root.dataset.planDepth) ? root.dataset.planDepth : 'core';
  for (const depth of DEPTHS) {
    const count = depthCount(plan, depth);
    const button = element('button', '', `${depth.label} · ${count}`);
    button.type = 'button';
    button.dataset.planDepth = depth.id;
    button.title = depth.note;
    depthButtons.append(button);
  }
  depthBlock.append(depthButtons);
  controls.append(depthBlock);

  const surfaceBlock = element('div', 'plan-control-block plan-surface-block');
  surfaceBlock.append(element('span', 'micro-label', 'FILTER THIS PLAN'));
  const surfaceTabs = element('div', 'plan-surface-tabs');
  const allTab = element('button', '', `All · ${checks.length}`);
  allTab.type = 'button';
  allTab.dataset.planSurface = 'all';
  surfaceTabs.append(allTab);
  for (const family of families) {
    const button = element('button', '', `${family.title.replace(' / Server Configuration', '').replace(' Security', '')} · ${family.checks.length}`);
    button.type = 'button';
    button.dataset.planSurface = family.id;
    surfaceTabs.append(button);
  }
  surfaceBlock.append(surfaceTabs);
  controls.append(surfaceBlock);

  const filterRow = element('div', 'plan-filter-row');
  const query = document.createElement('input');
  query.type = 'search';
  query.placeholder = 'Find a test, tool, variant, or ID…';
  query.value = root.dataset.planQuery || '';
  query.setAttribute('aria-label', 'Search within this testing plan');
  const statusFilter = document.createElement('select');
  statusFilter.setAttribute('aria-label', 'Filter tests by progress');
  for (const [value, label] of [['all', 'Any progress'], ['open', 'Not started'], ['in_progress', 'Testing now'], ['tested', 'Completed'], ['findings', 'Potential / confirmed'], ['blocked', 'Blocked'], ['na', 'Not applicable']]) statusFilter.append(new Option(label, value));
  statusFilter.value = root.dataset.planStatus || 'all';
  const severityFilter = document.createElement('select');
  severityFilter.setAttribute('aria-label', 'Filter tests by severity');
  for (const [value, label] of [['all', 'Any severity'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['informational', 'Informational']]) severityFilter.append(new Option(label, value));
  severityFilter.value = root.dataset.planSeverity || 'all';
  const guideFilter = document.createElement('select');
  guideFilter.setAttribute('aria-label', 'Filter tests by guide type');
  for (const [value, label] of [['all', 'Any guide type'], ['practical', 'Step-by-step'], ['reference', 'Reference only']]) guideFilter.append(new Option(label, value));
  guideFilter.value = root.dataset.planGuide || 'all';
  const clearFilters = element('button', 'plan-filter-clear', 'Clear');
  clearFilters.type = 'button';
  filterRow.append(query, statusFilter, severityFilter, guideFilter, clearFilters);
  controls.append(filterRow);

  const visibleLine = element('p', 'plan-visible-count');
  visibleLine.setAttribute('aria-live', 'polite');
  controls.append(visibleLine);
  shell.append(controls);

  for (const tier of plan.tiers || []) {
    const section = element('section', `plan-tier plan-tier-${tier.id}`);
    section.dataset.planTier = tier.id;
    const head = element('header', 'plan-tier-head');
    const copy = element('div');
    copy.append(element('p', 'micro-label', tier.id === 'dont-miss' ? 'START HERE' : 'THEN CONTINUE'));
    copy.append(element('h3', '', tier.title), element('p', '', tier.description));
    head.append(copy, element('span', 'plan-tier-count', String(tier.checks.length)));
    section.append(head);
    const list = element('div', 'operator-check-list');
    for (const check of tier.checks) {
      const rawPlaybook = index.byId.get(check.playbookId || '');
      const node = renderOperatorCheck(check, {
        recordsById,
        getState,
        commit: (nextState) => {
          root.dataset.planOpenItem = check.item || '';
          context.commit?.(nextState);
        },
        familyIndex,
        payloads: rawPlaybook?.payloads || {},
        playbookIndex: index,
        currentPlaybookId: selectedSurfaceId || plan.currentSurface?.id || ''
      });
      node.dataset.planSurface = check.surface;
      list.append(node);
    }
    section.append(list);
    shell.append(section);
  }

  if (plan.hiddenFamilies?.length) {
    const note = element('details', 'assessment-footnote plan-hidden-scope');
    note.append(element('summary', '', 'Tests excluded by this page / function'));
    note.append(element('p', '', `Hidden until the scope includes them: ${plan.hiddenFamilies.map(({ title }) => title).join(', ')}.`));
    shell.append(note);
  }

  root.append(shell);

  let activeDepth = rememberedDepth;
  let activeSurface = families.some(({ id }) => id === root.dataset.planSurface) ? root.dataset.planSurface : 'all';
  const statusMatches = (row, value) => {
    const rowStatus = row.dataset.operatorStatus;
    if (value === 'all') return true;
    if (value === 'open') return rowStatus === 'not_tested';
    if (value === 'tested') return ['passed', 'potential_finding', 'confirmed_finding'].includes(rowStatus);
    if (value === 'findings') return ['potential_finding', 'confirmed_finding'].includes(rowStatus);
    return rowStatus === value;
  };
  const applyFilters = () => {
    const depth = DEPTHS.find(({ id }) => id === activeDepth) || DEPTHS[0];
    const allowed = new Set(depth.tiers);
    const needle = query.value.trim().toLocaleLowerCase('en-US');
    const statusValue = statusFilter.value;
    const severityValue = severityFilter.value;
    const guideValue = guideFilter.value;
    let visible = 0;
    shell.querySelectorAll('[data-plan-tier]').forEach((section) => {
      const tierAllowed = allowed.has(section.dataset.planTier);
      let sectionVisible = 0;
      section.querySelectorAll('.probe-check').forEach((row) => {
        const show = tierAllowed
          && (activeSurface === 'all' || row.dataset.planSurface === activeSurface)
          && (!needle || row.dataset.operatorSearch.includes(needle))
          && statusMatches(row, statusValue)
          && (severityValue === 'all' || row.dataset.operatorSeverity === severityValue)
          && (guideValue === 'all' || row.dataset.operatorGuide === guideValue);
        row.hidden = !show;
        if (show) { visible += 1; sectionVisible += 1; }
      });
      section.hidden = !tierAllowed || sectionVisible === 0;
      const count = section.querySelector('.plan-tier-count');
      if (count) count.textContent = String(sectionVisible);
    });
    depthButtons.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.planDepth === activeDepth)));
    surfaceTabs.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.planSurface === activeSurface)));
    visibleLine.textContent = visible
      ? `${visible} test${visible === 1 ? '' : 's'} shown · ${applicableCount} applicable overall`
      : 'No tests match these filters.';
    root.dataset.planDepth = activeDepth;
    root.dataset.planSurface = activeSurface;
    root.dataset.planQuery = query.value;
    root.dataset.planStatus = statusValue;
    root.dataset.planSeverity = severityValue;
    root.dataset.planGuide = guideValue;
  };
  depthButtons.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-plan-depth]');
    if (!button) return;
    activeDepth = button.dataset.planDepth;
    applyFilters();
  });
  surfaceTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-plan-surface]');
    if (!button) return;
    activeSurface = button.dataset.planSurface;
    applyFilters();
  });
  let filterFrame = 0;
  query.addEventListener('input', () => {
    window.cancelAnimationFrame(filterFrame);
    filterFrame = window.requestAnimationFrame(applyFilters);
  });
  for (const select of [statusFilter, severityFilter, guideFilter]) select.addEventListener('change', applyFilters);
  clearFilters.addEventListener('click', () => {
    query.value = '';
    statusFilter.value = 'all';
    severityFilter.value = 'all';
    guideFilter.value = 'all';
    applyFilters();
    query.focus();
  });
  applyFilters();

  const rememberedOpen = root.dataset.planOpenItem;
  if (rememberedOpen) {
    const openRow = [...shell.querySelectorAll('.probe-check')].find((row) => row.dataset.itemId === rememberedOpen && !row.hidden);
    if (openRow) {
      openRow.ensureOperatorBody?.();
      openRow.open = true;
    }
  }

  void coverage;
}
