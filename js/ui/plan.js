// Current Assessment: profile → attack-surface families → named practical tests.
import { checkItemIds } from '../engine/playbooks.js?v=1.0.0-r6';
import { buildAssessmentPlan, composeAssessmentMarkdown } from '../engine/assessment.js?v=1.0.0-r6';
import { shareHref } from '../engine/share.js?v=1.0.0-r6';
import { profileIsScoped, answersToProfile } from '../engine/profile.js?v=1.0.0-r6';
import { APPLICABILITY } from '../engine/applicability.js?v=1.0.0-r6';
import { itemStatus } from './filters.js?v=1.0.0-r6';
import { element, STATUS_GLYPHS } from './dom.js?v=1.0.0-r6';
import { STATUS_LABELS } from './export.js?v=1.0.0-r6';
import { featureChips } from './plan-chips.js?v=1.0.0-r6';

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
  if (!derived || !profileIsScoped(answersToProfile(answers))) {
    root.append(element('p', 'empty-copy', 'Set the application type above, then generate the test plan.'));
    return;
  }

  const plan = buildAssessmentPlan(index, derived, answers);
  const families = plan.families || [];
  if (!families.length) {
    root.append(element('p', 'empty-copy', 'No tests matched this profile. Adjust the type, authentication, or features.'));
    return;
  }

  const state = getState ? getState() : { statuses: {} };
  const recordsById = new Map(records.map((record) => [record.item.id, record]));
  const checks = plan.checks || [];
  const statuses = checks.map((check) => checkStatus(check, recordsById, state));
  const completed = statuses.filter((status) => ['passed', 'potential_finding', 'confirmed_finding'].includes(status)).length;
  const potential = statuses.filter((status) => status === 'potential_finding').length;
  const confirmed = statuses.filter((status) => status === 'confirmed_finding').length;
  const naContext = coverage?.overall?.na_context ?? records.filter(({ applicability }) => applicability.state === APPLICABILITY.NA_CONTEXT).length;
  const chips = featureChips(answers);

  const shell = element('section', 'assessment-plan');
  shell.dataset.assessmentPlan = families.map(({ id }) => id).join(' ');

  const hero = element('header', 'assessment-hero');
  hero.append(element('p', 'micro-label', 'CURRENT ASSESSMENT'));
  const title = chips[0] || 'Assessment plan';
  hero.append(element('h2', '', title));
  const target = element('p', 'assessment-target');
  target.append(element('strong', '', engagement.targetUrl?.trim() || engagement.name?.trim() || 'No target URL set'));
  target.append(document.createTextNode(` · ${checks.length} applicable tests`));
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
  add(checks.length, 'applicable tests');
  add(completed, 'completed');
  add(potential + confirmed, 'potential findings');
  add(naContext, 'not applicable');
  add(families.length, families.length === 1 ? 'attack surface' : 'attack surfaces');
  hero.append(stats);

  const actions = element('p', 'assessment-actions');
  const first = checks[0];
  const start = element('a', 'button button-primary', first ? `Start ${first.title} →` : 'Open tests →');
  start.href = first ? `#playbook/${first.playbookId}/${first.id}` : '#playbooks';
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
        families,
        hiddenFamilies: plan.hiddenFamilies
      }));
      flash(sharePlan, 'Plan copied');
    } catch {
      flash(sharePlan, 'Copy unavailable');
    }
  });
  sharePlan.dataset.shareMarkdown = 'true';
  actions.append(start, shareLink, sharePlan);
  hero.append(actions);
  const shareNote = element('p', 'assessment-share-note');
  shareNote.textContent = 'Click a test for Quick Test, variants, payloads, and validation. Share link carries answers only.';
  hero.append(shareNote);
  shell.append(hero);

  for (const family of families) {
    const block = element('section', 'assessment-surface');
    block.dataset.assessmentSurface = family.id;
    const head = element('header', 'assessment-surface-head');
    const copy = element('div', 'assessment-surface-copy');
    copy.append(element('p', 'micro-label', 'ATTACK SURFACE'));
    copy.append(element('h3', '', family.title));
    if (family.summary) copy.append(element('p', '', family.summary));
    head.append(copy);
    head.append(element('span', '', `${family.checks.length}`));
    block.append(head);
    const list = element('ul', 'assessment-check-list');
    for (const check of family.checks) {
      const status = checkStatus(check, recordsById, state);
      const row = element('li', `assessment-check status-${status}`);
      const link = element('a', '');
      link.href = `#playbook/${check.playbookId}/${check.id}`;
      link.append(element('span', 'assessment-mark', STATUS_GLYPHS[status] || '□'));
      link.append(element('strong', '', check.title));
      link.append(element('small', '', STATUS_LABELS[status] || status));
      row.append(link);
      list.append(row);
    }
    block.append(list);
    shell.append(block);
  }

  if (plan.hiddenFamilies?.length) {
    const note = element('p', 'assessment-footnote');
    note.append(document.createTextNode('Hidden until the profile includes them: '));
    note.append(document.createTextNode(plan.hiddenFamilies.map(({ title }) => title).join(', ')));
    note.append(document.createTextNode('.'));
    shell.append(note);
  }
  root.append(shell);
}
