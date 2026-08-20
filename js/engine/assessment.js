// Assessment plan: every matching surface for the scoped application, not one playbook.
import { classifyPlaybook, playbookChecks, suggestedPlaybook } from './playbooks.js?v=1.0.0-r6';

function withPrimaryFirst(list, primaryId) {
  if (!primaryId) return list.slice();
  const head = list.filter(({ playbook }) => playbook.id === primaryId);
  const rest = list.filter(({ playbook }) => playbook.id !== primaryId);
  return [...head, ...rest];
}

export function assessmentSurfaces(index, context) {
  const matches = [];
  const relevant = [];
  const hidden = [];
  const primary = suggestedPlaybook(index, context);
  for (const playbook of index?.playbooks || []) {
    const kind = classifyPlaybook(playbook, context);
    if (kind === 'match') matches.push({ playbook, kind });
    else if (kind === 'relevant') relevant.push({ playbook, kind });
    else if (kind === 'none') hidden.push(playbook);
  }
  const orderedMatches = withPrimaryFirst(matches, primary?.id);
  const orderedRelevant = withPrimaryFirst(relevant, primary?.id);
  return Object.freeze({
    primary,
    matches: Object.freeze(orderedMatches),
    relevant: Object.freeze(orderedRelevant),
    hidden: Object.freeze(hidden),
    surfaces: Object.freeze([...orderedMatches, ...orderedRelevant])
  });
}

export function assessmentChecks(surfaces = []) {
  return surfaces.flatMap(({ playbook }) => playbookChecks(playbook).map((check) => ({
    ...check,
    playbookId: playbook.id,
    playbookTitle: playbook.title
  })));
}

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function composeAssessmentMarkdown(plan, options = {}) {
  const { name = '', targetUrl = '', chips = [], surfaces = [], hidden = [] } = plan;
  const checks = assessmentChecks(surfaces);
  const lines = [
    `# ${safe(name || 'WAPT assessment')} — Applicable tests`,
    '',
    `- Target: ${safe(targetUrl || 'Not provided')}`,
    `- Profile: ${safe(chips.join(' · ') || 'Not scoped')}`,
    `- Matching surfaces: ${surfaces.length}`,
    `- Applicable tests: ${checks.length}`,
    '',
    '> Scope only. This plan does not include findings, notes, or evidence.',
    '> Authorized testing only.',
    ''
  ];
  for (const { playbook, kind } of surfaces) {
    const label = kind === 'match' ? 'matches this scope' : 'also relevant';
    lines.push(`## ${safe(playbook.title)} (${label})`, '');
    if (playbook.summary) lines.push(safe(playbook.summary), '');
    for (const group of playbook.groups || []) {
      lines.push(`### ${safe(group.title)}`, '');
      for (const check of group.checks || []) {
        const mark = options.checked?.has?.(`${playbook.id}:${check.id}`) ? 'x' : ' ';
        lines.push(`- [${mark}] **${safe(check.title)}**`);
      }
      lines.push('');
    }
  }
  if (hidden.length) {
    lines.push('## Hidden until the profile includes them', '');
    for (const playbook of hidden) lines.push(`- ${safe(playbook.title)}`);
    lines.push('');
  }
  return lines.join('\n');
}
