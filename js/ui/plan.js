// Current Assessment: the tester-facing plan generated from scope.
// Profile → attack surfaces → practical tests. Methodology stays one click behind.
import { suggestedPlaybook, playbookChecks, checkItemIds } from '../engine/playbooks.js?v=1.0.0-r6';
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

function featureChips(answers = {}) {
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

export function renderAssessmentPlan(root, context) {
  const { index, answers = {}, engagement = {}, records = [], getState, coverage } = context;
  root.replaceChildren();
  if (!index?.playbooks?.length) {
    root.append(element('p', 'empty-copy', 'Scope the engagement, then this plan fills in with the tests that apply.'));
    return;
  }

  const derived = context.deriveContext ? context.deriveContext(answers) : null;
  const playbook = derived ? suggestedPlaybook(index, derived) : index.playbooks[0];
  if (!playbook) return;

  const state = getState ? getState() : { statuses: {} };
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const checks = playbookChecks(playbook);
  const statuses = checks.map((check) => checkStatus(check, recordsById, state));
  const completed = statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
  const potential = statuses.filter((status) => status === 'potential_finding').length;
  const confirmed = statuses.filter((status) => status === 'confirmed_finding').length;
  const naContext = coverage?.overall?.na_context ?? records.filter(({ applicability }) => applicability.state === APPLICABILITY.NA_CONTEXT).length;

  const shell = element('section', 'assessment-plan');
  shell.dataset.assessmentPlan = playbook.id;

  const hero = element('header', 'assessment-hero');
  hero.append(element('p', 'micro-label', 'CURRENT ASSESSMENT'));
  const title = element('h2', '', APP_TYPE_LABEL[answers.app_type] || playbook.title);
  hero.append(title);
  const target = element('p', 'assessment-target');
  target.append(element('strong', '', engagement.targetUrl?.trim() || 'No target URL set'));
  target.append(document.createTextNode(` · ${playbook.title}`));
  hero.append(target);
  const chips = element('div', 'chip-row assessment-chips');
  for (const label of featureChips(answers)) chips.append(element('span', 'chip', label));
  hero.append(chips);

  const stats = element('div', 'assessment-stats');
  const add = (value, label) => {
    const stat = element('div', 'assessment-stat');
    stat.append(element('strong', '', String(value)));
    stat.append(element('span', '', label));
    stats.append(stat);
  };
  add(checks.length, 'applicable tests');
  add(completed, 'completed');
  add(potential + confirmed, 'potential / confirmed');
  add(naContext, 'not applicable');
  hero.append(stats);

  const actions = element('p', 'assessment-actions');
  const open = element('a', 'button button-primary', `Open ${playbook.title} playbook →`);
  open.href = `#playbook/${playbook.id}`;
  const edit = element('a', 'button button-quiet', 'Edit scope');
  edit.href = '#wizard';
  actions.append(open, edit);
  hero.append(actions);
  shell.append(hero);

  for (const group of playbook.groups || []) {
    const block = element('section', 'assessment-surface');
    const head = element('header', 'assessment-surface-head');
    head.append(element('h3', '', group.title));
    head.append(element('span', '', `${(group.checks || []).length}`));
    block.append(head);
    const list = element('ul', 'assessment-check-list');
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
    block.append(list);
    shell.append(block);
  }

  const note = element('p', 'assessment-footnote');
  note.textContent = 'Authentication, session, IDOR, and privilege tests stay hidden until the profile includes those features. Click a test for variants, payloads, and validation — not methodology prose.';
  shell.append(note);
  root.append(shell);
}
