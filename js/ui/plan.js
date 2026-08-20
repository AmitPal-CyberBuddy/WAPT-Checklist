// Current Assessment: every matching surface for this application, with a shareable plan.
import { playbookChecks, checkItemIds } from '../engine/playbooks.js?v=1.0.0-r6';
import { assessmentSurfaces, assessmentChecks, composeAssessmentMarkdown } from '../engine/assessment.js?v=1.0.0-r6';
import { shareHref } from '../engine/share.js?v=1.0.0-r6';
import { APPLICABILITY } from '../engine/applicability.js?v=1.0.0-r6';
import { itemStatus } from './filters.js?v=1.0.0-r6';
import { element, STATUS_GLYPHS } from './dom.js?v=1.0.0-r6';
import { STATUS_LABELS } from './export.js?v=1.0.0-r6';

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
  const type = APP_TYPE_LABEL[answers.app_type] || 'Application';
  chips.push(type);
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

export function renderAssessmentPlan(root, context) {
  const { index, answers = {}, engagement = {}, records = [], getState, coverage } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Scope the engagement, then this plan fills in with the tests that apply.'));
    return;
  }

  const derived = context.deriveContext ? context.deriveContext(answers) : null;
  const plan = derived ? assessmentSurfaces(index, derived) : { surfaces: index.playbooks.map((playbook) => ({ playbook, kind: 'browse' })), matches: [], relevant: [], hidden: [], primary: index.playbooks[0] };
  const surfaces = plan.surfaces || [];
  if (!surfaces.length) {
    root.append(element('p', 'empty-copy', 'No surfaces matched this scope. Edit the answers or open page playbooks to browse.'));
    return;
  }

  const state = getState ? getState() : { statuses: {} };
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const checks = assessmentChecks(surfaces);
  const statuses = checks.map((check) => checkStatus(check, recordsById, state));
  const completed = statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
  const potential = statuses.filter((status) => status === 'potential_finding').length;
  const confirmed = statuses.filter((status) => status === 'confirmed_finding').length;
  const naContext = coverage?.overall?.na_context ?? records.filter(({ applicability }) => applicability.state === APPLICABILITY.NA_CONTEXT).length;
  const chips = featureChips(answers);

  const shell = element('section', 'assessment-plan');
  shell.dataset.assessmentPlan = (plan.matches || []).map(({ playbook }) => playbook.id).join(' ') || plan.primary?.id || 'plan';

  const hero = element('header', 'assessment-hero');
  hero.append(element('p', 'micro-label', 'CURRENT ASSESSMENT'));
  hero.append(element('h2', '', APP_TYPE_LABEL[answers.app_type] || 'Assessment plan'));
  const target = element('p', 'assessment-target');
  target.append(element('strong', '', engagement.targetUrl?.trim() || engagement.name?.trim() || 'No target URL set'));
  const surfaceLabel = plan.matches.length === 1
    ? plan.matches[0].playbook.title
    : `${surfaces.length} matching surfaces`;
  target.append(document.createTextNode(` · ${surfaceLabel}`));
  hero.append(target);
  const chipRow = element('div', 'chip-row assessment-chips');
  for (const label of chips) chipRow.append(element('span', 'chip', label));
  hero.append(chipRow);

  const stats = element('div', 'assessment-stats');
  const add = (value, label) => {
    const stat = element('div', 'assessment-stat');
    stat.append(element('strong', '', String(value)));
    stat.append(element('span', '', label));
    stats.append(stat);
  };
  add(surfaces.length, surfaces.length === 1 ? 'matching surface' : 'matching surfaces');
  add(checks.length, 'applicable tests');
  add(completed, 'completed');
  add(potential + confirmed, 'potential / confirmed');
  add(naContext, 'not applicable');
  hero.append(stats);

  const actions = element('p', 'assessment-actions');
  const start = element('a', 'button button-primary', plan.primary ? `Open ${plan.primary.title} →` : 'Open first surface →');
  start.href = `#playbook/${(plan.primary || surfaces[0].playbook).id}`;
  const edit = element('a', 'button button-quiet', 'Edit scope');
  edit.href = '#wizard';
  const shareLink = actionButton('button button-quiet', 'Copy share link', async () => {
    try {
      await copyText(shareHref({
        name: engagement.name,
        targetUrl: engagement.targetUrl,
        answers
      }, typeof location !== 'undefined' ? location.href : 'app.html'));
      flash(shareLink, 'Link copied');
    } catch {
      flash(shareLink, 'Copy unavailable');
    }
  });
  shareLink.dataset.shareLink = 'true';
  shareLink.title = 'Copies a URL with this scope only — no findings, notes, or evidence.';
  const sharePlan = actionButton('button button-quiet', 'Copy plan Markdown', async () => {
    try {
      await copyText(composeAssessmentMarkdown({
        name: engagement.name,
        targetUrl: engagement.targetUrl,
        chips,
        surfaces,
        hidden: plan.hidden
      }));
      flash(sharePlan, 'Plan copied');
    } catch {
      flash(sharePlan, 'Copy unavailable');
    }
  });
  sharePlan.dataset.shareMarkdown = 'true';
  actions.append(start, shareLink, sharePlan, edit);
  hero.append(actions);
  const shareNote = element('p', 'assessment-share-note');
  shareNote.textContent = 'Share link carries the answers that built this plan. Findings, notes, and evidence stay on this device.';
  hero.append(shareNote);
  shell.append(hero);

  for (const { playbook, kind } of surfaces) {
    const block = element('section', 'assessment-surface');
    block.dataset.assessmentSurface = playbook.id;
    const head = element('header', 'assessment-surface-head');
    const title = element('a', '', playbook.title);
    title.href = `#playbook/${playbook.id}`;
    const copy = element('div', 'assessment-surface-copy');
    copy.append(element('p', 'micro-label', kind === 'match' ? 'MATCHES THIS SCOPE' : kind === 'relevant' ? 'ALSO RELEVANT' : 'SURFACE'));
    const heading = element('h3', '');
    heading.append(title);
    copy.append(heading);
    if (playbook.summary) copy.append(element('p', '', playbook.summary));
    head.append(copy);
    head.append(element('span', '', `${playbookChecks(playbook).length}`));
    block.append(head);
    const list = element('ul', 'assessment-check-list');
    for (const group of playbook.groups || []) {
      for (const check of group.checks || []) {
        const status = checkStatus(check, recordsById, state);
        const row = element('li', `assessment-check status-${status}`);
        const link = element('a', '');
        link.href = `#playbook/${playbook.id}/${check.id}`;
        link.append(element('span', 'assessment-mark', STATUS_GLYPHS[status] || '□'));
        link.append(element('strong', '', check.title));
        link.append(element('small', '', STATUS_LABELS[status] || status));
        row.append(link);
        list.append(row);
      }
    }
    block.append(list);
    shell.append(block);
  }

  if (plan.hidden?.length) {
    const note = element('p', 'assessment-footnote');
    note.append(document.createTextNode('Hidden until the profile includes them: '));
    note.append(document.createTextNode(plan.hidden.map(({ title }) => title).join(', ')));
    note.append(document.createTextNode('.'));
    shell.append(note);
  } else {
    const note = element('p', 'assessment-footnote');
    note.textContent = 'Click a test for variants, payloads, and validation — not methodology prose.';
    shell.append(note);
  }
  root.append(shell);
}
