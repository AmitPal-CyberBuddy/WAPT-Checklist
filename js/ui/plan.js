// Applicable Testing Plan: assessment context → meaningful categories → tests.
// The plan is grouped by attack-surface category (Authentication, JWT Security,
// HTTP/Infrastructure, …). Every category states why it is included, and the whole
// plan re-expands automatically when the tester edits the assessment context.
// Export compatibility note: plan metadata still distinguishes “authored playbooks”
// from “methodology-only” catalog entries, while the operator UI calls them
// Practical and Methodology so internal content architecture never becomes
// navigation noise.
import { checkItemIds } from '../engine/playbooks.js?v=1.0.0-r19';
import { buildAssessmentPlan, composeAssessmentMarkdown } from '../engine/assessment.js?v=1.0.0-r19';
import { shareHref } from '../engine/share.js?v=1.0.0-r19';
import { answersCarryContext } from '../engine/profile.js?v=1.0.0-r19';
import { surfaceRationale, roleLadderLabels, roleModelLadder } from '../engine/surfaces.js?v=1.0.0-r19';
import { matchAssessment } from '../data/presets.mjs?v=1.0.0-r19';
import { itemStatus } from './filters.js?v=1.0.0-r19';
import { element } from './dom.js?v=1.0.0-r19';
import { renderOperatorCheck } from './playbook.js?v=1.0.0-r19';

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

function openContextEditor() {
  const editor = document.querySelector('[data-context-editor]') || document.querySelector('[data-app-profile]');
  if (!editor) return;
  editor.open = true;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  editor.querySelector('input, button, select')?.focus();
}

// Privilege ladder + the directions to walk, shown inside Authorization when the
// context carries more than one role tier.
function roleMatrixBlock(answers, roleModel = []) {
  const roleTypes = list(answers.role_types).filter((value) => value !== 'none' && value !== 'unknown');
  const multiRole = ['few', 'many'].includes(answers.roles);
  const named = roleModelLadder(roleModel);
  if (!multiRole && roleTypes.length < 2 && !named) return null;
  const ladder = named || (roleTypes.length ? roleLadderLabels(roleTypes) : ['Privileged user', 'Standard user']);
  const block = element('div', 'plan-role-matrix');
  block.append(element('p', 'micro-label', 'CROSS-ROLE MATRIX'));
  const ladderLine = element('p', 'plan-role-ladder');
  ladderLine.append(element('strong', '', ladder.join('  ↑  ')));
  block.append(ladderLine);
  block.append(element('p', 'plan-role-hint', 'Walk every direction with each pair of accounts: vertical (up the ladder), horizontal (across same tier), function-level, and object-level (IDOR / cross-tenant) access.'));
  return block;
}

export function renderAssessmentPlan(root, context) {
  const { index, answers = {}, engagement = {}, records = [], getState, coverage, familyIndex, onCustomAdd, onCustomRemove } = context;
  // Groups the tester expanded survive re-renders (e.g. after ticking a check).
  const previouslyOpen = new Set([...root.querySelectorAll('details.plan-group[open]')].map((node) => node.dataset.planGroup));
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Choose the assessment scenario you are performing, then the testing plan appears here.'));
    return;
  }

  const derived = context.deriveContext ? context.deriveContext(answers) : null;
  if (!derived || !answersCarryContext(answers)) {
    root.append(element('p', 'empty-copy', 'Answer “What type of assessment are you performing?” to build the first testing pass.'));
    return;
  }

  const items = records.map(({ item }) => item);
  const selectedSurfaceId = index.byId.has(context.surfaceId) ? context.surfaceId : '';
  const plan = buildAssessmentPlan(index, derived, answers, items, { surfaceId: selectedSurfaceId });
  const families = plan.families || [];
  if (!families.length) {
    root.append(element('p', 'empty-copy', 'No tests matched this profile. Adjust the assessment context above.'));
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
  const assessment = matchAssessment(answers);
  const planTitle = assessment?.title || chips[0] || 'Current assessment';

  const shell = element('section', 'assessment-plan operator-plan');
  shell.dataset.assessmentPlan = families.map(({ id }) => id).join(' ');

  const hero = element('header', 'assessment-hero operator-hero');
  const heroTop = element('div', 'operator-hero-top');
  const heroCopy = element('div');
  heroCopy.append(element('p', 'micro-label', 'APPLICABLE TESTING PLAN'));
  heroCopy.append(element('h2', '', planTitle));
  const target = element('p', 'assessment-target');
  target.append(element('strong', '', engagement.targetUrl?.trim() || 'No target URL set'));
  heroCopy.append(target);
  const customCount = (getState?.().custom_checks || []).length;
  const contextLine = element('p', 'assessment-context-chips');
  contextLine.textContent = customCount ? `${chips.join(' · ')} · +${customCount} custom` : chips.join(' · ');
  heroCopy.append(contextLine);
  heroTop.append(heroCopy);
  const change = actionButton('button button-quiet', 'Edit context', openContextEditor);
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
    const first = shell.querySelector('.plan-group:not([hidden]) .probe-check:not([hidden])');
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

  // Depth and category controls filter one working set of rows; they never navigate away.
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
  const allTab = element('button', '', `All categories · ${checks.length}`);
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

  // Depth tier per test: tiers are computed on plan.tiers, so map item → tier
  // before rendering the category groups (families carry the checks untagged).
  const tierByItem = new Map();
  for (const tier of plan.tiers || []) {
    for (const check of tier.checks) tierByItem.set(check.item, tier.id);
  }

  // One collapsible category per attack surface, each explaining why it is here.
  // The first group starts open; everything else waits one click away.
  let groupIndex = 0;
  for (const family of families) {
    const group = element('details', `plan-group plan-group-${family.id}`);
    group.dataset.planGroup = family.id;
    group.dataset.planSurfaceFamily = family.id;
    group.open = previouslyOpen.has(family.id) || groupIndex === 0;
    const head = element('summary', 'plan-group-head');
    const headCopy = element('span', 'plan-group-copy');
    headCopy.append(element('strong', '', family.title));
    const why = surfaceRationale(family.id, derived);
    headCopy.append(element('small', 'plan-group-why', `Included because: ${why.join(' · ')}`));
    head.append(headCopy);
    head.append(element('span', 'plan-group-count', String(family.checks.length)));
    group.append(head);

    const body = element('div', 'plan-group-body');
    if (family.id === 'authz') {
      const matrix = roleMatrixBlock(answers, engagement.role_model);
      if (matrix) body.append(matrix);
    }
    const list = element('div', 'operator-check-list');
    for (const check of family.checks) {
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
      node.dataset.planTier = tierByItem.get(check.item) || 'standard';
      if (check.category === 'custom' && onCustomRemove) {
        const remove = element('button', 'custom-remove', '×');
        remove.type = 'button';
        remove.title = 'Remove this custom check (statuses and notes go with it)';
        remove.setAttribute('aria-label', `Remove custom check ${check.id}`);
        remove.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onCustomRemove(check.item);
        });
        node.querySelector('.probe-check-summary')?.append(remove);
      }
      list.append(node);
    }
    body.append(list);
    group.append(body);
    shell.append(group);
    groupIndex += 1;
  }

  // Target-specific checks live in their own group above; this is the manager
  // for adding and removing them. IDs are WAPT-CUSTOM-nnn so statuses, notes,
  // findings, and exports treat them like any other check.
  const customState = () => getState?.().custom_checks || [];
  if (onCustomAdd || customState().length) {
    const customBar = element('section', 'plan-custom-bar');
    const label = element('span', 'micro-label', 'CUSTOM CHECKS — TARGET-SPECIFIC WORK THIS ENGAGEMENT');
    customBar.append(label);
    const addToggle = actionButton('button button-quiet', '＋ Add a custom check', () => {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input')?.focus();
    });
    customBar.append(addToggle);
    const form = element('form', 'plan-custom-form');
    form.hidden = true;
    const title = document.createElement('input');
    title.type = 'text';
    title.maxLength = 120;
    title.placeholder = 'Example: Tenant export caps at the boundary';
    title.setAttribute('aria-label', 'Custom check title');
    const objective = document.createElement('input');
    objective.type = 'text';
    objective.maxLength = 300;
    objective.placeholder = 'What to verify (optional)';
    objective.setAttribute('aria-label', 'Custom check objective');
    const severity = document.createElement('select');
    severity.setAttribute('aria-label', 'Custom check severity');
    for (const value of ['high', 'medium', 'low', 'critical', 'informational']) severity.append(new Option(value, value));
    severity.value = 'medium';
    const surface = document.createElement('select');
    surface.setAttribute('aria-label', 'Custom check category');
    for (const family of families) surface.append(new Option(family.title, family.id));
    surface.append(new Option('Custom checks', 'custom'));
    surface.value = 'custom';
    const save = actionButton('button button-primary', 'Add to plan', (event) => {
      event.preventDefault();
      if (!title.value.trim()) {
        title.focus();
        return;
      }
      onCustomAdd?.({ title: title.value, objective: objective.value, severity: severity.value, surface: surface.value });
      form.hidden = true;
      title.value = '';
      objective.value = '';
    });
    save.type = 'submit';
    form.append(title, objective, severity, surface, save);
    form.addEventListener('submit', (event) => event.preventDefault());
    customBar.append(form);
    shell.append(customBar);
  }

  if (plan.hiddenFamilies?.length) {
    const note = element('details', 'assessment-footnote plan-hidden-scope');
    note.append(element('summary', '', 'Categories not in this plan yet'));
    note.append(element('p', '', `Add the matching context with “Edit context” to expand the plan: ${plan.hiddenFamilies.map(({ title }) => title).join(', ')}.`));
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
    shell.querySelectorAll('[data-plan-group]').forEach((group) => {
      let groupVisible = 0;
      group.querySelectorAll('.probe-check').forEach((row) => {
        const show = allowed.has(row.dataset.planTier)
          && (activeSurface === 'all' || row.dataset.planSurface === activeSurface)
          && (!needle || row.dataset.operatorSearch.includes(needle))
          && statusMatches(row, statusValue)
          && (severityValue === 'all' || row.dataset.operatorSeverity === severityValue)
          && (guideValue === 'all' || row.dataset.operatorGuide === guideValue);
        row.hidden = !show;
        if (show) { visible += 1; groupVisible += 1; }
      });
      const emptyBySurface = activeSurface !== 'all' && group.dataset.planSurfaceFamily !== activeSurface;
      group.hidden = groupVisible === 0 || emptyBySurface;
      const count = group.querySelector('.plan-group-count');
      if (count) count.textContent = String(groupVisible);
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
