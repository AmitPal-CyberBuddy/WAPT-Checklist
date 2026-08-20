// One test card, built for a tester who already knows the technique.
//
// Always visible (level 1):  ID · severity · title · what the check proves · how to validate · status
// Level 2  Procedure & variants   — the item's own steps, the one-change rule, related tests, next in family
// Level 3  Detailed methodology   — the full knowledge base, unchanged
// Level 4  References & mappings
// Level 5  Notes & evidence
//
// The family's Quick Test lives on the family header, not on every card, so a 14-check family
// no longer repeats the same procedure fourteen times.
import { APPLICABILITY } from '../engine/applicability.js?v=1.0.0-r7';
import { clearOverride, setItemNote, setOverride, setRetestFlag } from '../engine/state.js?v=1.0.0-r7';
import { itemStatus } from './filters.js?v=1.0.0-r7';
import { APP_LABELS, SEVERITY_GLYPHS, element, section, statusControls } from './dom.js?v=1.0.0-r7';
import { renderItemProbes } from './playbook.js?v=1.0.0-r7';

export function renderCard(record, context) {
  const { getState, commit, familyIndex, categoryOf, renderEvidenceForm } = context;
  const state = getState();
  const { item, applicability } = record;
  const status = itemStatus(item, state);
  const card = element('article', `test-card severity-${item.severity} status-${status}`);
  card.dataset.itemId = item.id;

  const header = element('header', 'test-card-header');
  const line = element('div', 'test-head-line');
  const identity = element('div', 'test-identity');
  const idRow = element('div', 'test-id-row');
  idRow.append(element('span', 'chip id-chip', item.id));
  const severityChip = element('span', `chip severity-chip ${item.severity}`, `${SEVERITY_GLYPHS[item.severity] || ''} ${item.severity}`);
  idRow.append(severityChip);
  if (applicability.state !== APPLICABILITY.ACTIVE || applicability.overridden) {
    idRow.append(element('span', `chip applicability-chip ${applicability.state}`, applicability.overridden ? 'Active (override)' : APP_LABELS[applicability.state]));
  }
  if (applicability.blocked) idRow.append(element('span', 'chip blocked-chip', 'Needs credentials'));
  const cardFamily = familyIndex?.byItem?.get(item.id);
  if (cardFamily && !context.inFamilyView) {
    // Keep family context visible wherever a card is shown (search, all tests, chains).
    const chip = element('a', 'chip family-chip', cardFamily.title);
    chip.href = `#family/${cardFamily.id}`;
    idRow.append(chip);
  }
  identity.append(idRow, element('h3', '', item.title));
  line.append(identity);
  // Inside a family the check row already carries the controls; do not repeat them.
  if (!context.embedded) line.append(statusControls(item, status, { getState, commit }));
  header.append(line);
  header.append(element('p', 'test-objective', item.objective));
  const validate = element('p', 'test-validate');
  validate.append(element('span', 'micro-label', 'VALIDATE'), document.createTextNode(` ${item.validation}`));
  header.append(validate);
  card.append(header);
  if (context.playbookIndex) renderItemProbes(card, context.playbookIndex, item.id);

  if (applicability.reasons?.length || applicability.overridden) {
    const reason = element('p', 'applicability-reason');
    const descriptions = applicability.reasons.map(({ code, key }) => `${code.replaceAll('_', ' ')}${key ? `: ${key}` : ''}`);
    if (applicability.overrideReason) descriptions.unshift(`override: ${applicability.overrideReason}`);
    reason.textContent = descriptions.join(' · ');
    card.append(reason);
  }

  // ---------------------------------------------------------------- level 2: procedure
  const procedure = element('details', 'method-details level-details');
  procedure.append(element('summary', '', 'Procedure & variants'));
  const procedureBody = element('div', 'method-body');
  procedureBody.append(section('Steps', item.steps, true));
  procedureBody.append(element('p', 'quick-change', `One condition at a time — ${item.manipulate}`));
  const behavior = element('div', 'behavior-grid');
  behavior.append(section('Secure behavior', item.secure_behavior), section('Vulnerable behavior', item.vulnerable_behavior));
  procedureBody.append(behavior);
  if (context.playbookIndex) renderItemProbes(procedureBody, context.playbookIndex, item.id);
  if (item.examples?.length) {
    const examples = element('section', 'method-section');
    examples.append(element('h4', '', 'Examples'));
    for (const example of item.examples) {
      const block = element('div', 'example-block');
      for (const key of ['request', 'response', 'note']) {
        if (!example[key]) continue;
        block.append(element('strong', 'example-label', key.toUpperCase()));
        block.append(element(key === 'note' ? 'p' : 'pre', '', example[key]));
      }
      examples.append(block);
    }
    procedureBody.append(examples);
  }
  if (item.variants?.length) {
    const variants = element('section', 'method-section');
    variants.append(element('h4', '', 'Context variants'));
    for (const variant of item.variants) {
      const box = element('div', 'variant-box');
      box.append(element('strong', '', Object.entries(variant.when).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' · ')));
      box.append(section('Variant steps', variant.steps, true));
      if (variant.notes) box.append(element('p', 'method-note', variant.notes));
      variants.append(box);
    }
    procedureBody.append(variants);
  }

  const links = element('div', 'card-links');
  if (cardFamily) {
    const familyLink = element('a', 'chip family-chip', `Open family: ${cardFamily.title}`);
    familyLink.href = `#family/${cardFamily.id}`;
    links.append(familyLink);
  }
  for (const id of item.related || []) {
    const link = element('a', 'chip id-chip related-chip', id);
    link.href = `#checklist/${categoryOf(id)}`;
    links.append(link);
  }
  if (links.childElementCount) {
    const relatedSection = element('section', 'method-section');
    relatedSection.append(element('h4', '', 'Related'));
    relatedSection.append(links);
    procedureBody.append(relatedSection);
  }
  procedure.append(procedureBody);
  card.append(procedure);

  // ---------------------------------------------------------------- level 3: methodology
  const details = element('details', 'method-details');
  details.append(element('summary', '', 'Reporting and reference information'));
  const body = element('div', 'method-body');
  body.append(section('Prerequisites', item.prerequisites));
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

  // ---------------------------------------------------------------- level 4: references
  const references = element('details', 'method-details level-details');
  references.append(element('summary', '', 'References & mappings'));
  const referenceBody = element('div', 'method-body');
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
  refs.append(element('p', 'mapping-line', Object.entries(item.mappings).filter(([, values]) => values.length).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' · ')));
  referenceBody.append(refs);
  if (item.attack_chains?.length) {
    const chains = element('section', 'method-section');
    chains.append(element('h4', '', 'Attack chains'));
    const row = element('div', 'chain-link-row');
    for (const id of item.attack_chains) {
      const link = element('a', 'chip id-chip', id);
      link.href = '#chains';
      row.append(link);
    }
    chains.append(row);
    referenceBody.append(chains);
  }
  references.append(referenceBody);
  card.append(references);

  // ---------------------------------------------------------------- level 5: tester records
  const records = element('details', 'method-details level-details');
  records.append(element('summary', '', 'Notes & evidence'));
  const recordsBody = element('div', 'method-body');
  const notes = element('section', 'method-section notes-section');
  const noteLabel = element('label');
  noteLabel.append(element('span', '', 'Tester notes (stored locally)'));
  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.maxLength = 20000;
  textarea.value = state.notes?.[item.id] || '';
  textarea.placeholder = 'Endpoint, accounts used, observation, evidence reference…';
  textarea.addEventListener('change', () => commit(setItemNote(getState(), item.id, textarea.value)));
  noteLabel.append(textarea);
  notes.append(noteLabel);
  if (status === 'confirmed_finding') {
    const retest = element('label', 'retest-control');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(state.retests?.[item.id]);
    box.addEventListener('change', () => commit(setRetestFlag(getState(), item.id, box.checked)));
    retest.append(box, document.createTextNode(' Include in retest matrix'));
    notes.append(retest);
    if (renderEvidenceForm) notes.append(renderEvidenceForm(item, getState, commit));
  }
  if (record.rawApplicability.state === APPLICABILITY.NA_CONTEXT) {
    const override = element('button', 'button button-quiet', applicability.overridden ? 'Clear applicability override' : 'Override context N/A');
    override.type = 'button';
    override.addEventListener('click', () => {
      if (applicability.overridden) commit(clearOverride(getState(), item.id));
      else {
        const reason = window.prompt('Why is this test applicable despite the current context?');
        if (reason?.trim()) commit(setOverride(getState(), item.id, reason));
      }
    });
    notes.append(override);
  }
  recordsBody.append(notes);
  records.append(recordsBody);
  card.append(records);
  return card;
}

// Dense one-line check row used inside a family: status glyph, ID, title, controls.
export function renderCheckRow(record, context) {
  const { getState, commit } = context;
  const state = getState();
  const { item, applicability } = record;
  const status = itemStatus(item, state);
  const row = element('div', `check-row status-${status}`);
  row.dataset.itemId = item.id;
  row.dataset.familyCheckRow = item.id;
  const open = element('button', 'check-open');
  open.type = 'button';
  open.setAttribute('aria-expanded', 'false');
  open.append(element('span', 'check-id', item.id), element('span', 'check-title', item.title));
  if (applicability.blocked) open.append(element('span', 'chip blocked-chip', 'creds'));
  if (applicability.state === APPLICABILITY.NA_CONTEXT) open.append(element('span', 'chip applicability-chip na_context', 'N/A'));
  row.append(open, statusControls(item, status, { getState, commit, compact: true }));
  return { row, open };
}
