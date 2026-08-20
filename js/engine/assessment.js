// Assessment plan: profile → attack-surface families → named tests.
import { classifyPlaybook, playbookChecks, suggestedPlaybook } from './playbooks.js?v=1.0.0-r6';
import { SURFACES, surfaceFor, surfaceMeta, isHiddenSurface } from './surfaces.js?v=1.0.0-r6';

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

export function buildAssessmentPlan(index, context, answers = {}) {
  const pack = assessmentSurfaces(index, context);
  const bySurface = new Map();
  const seen = new Set();
  for (const { playbook, kind } of pack.surfaces) {
    for (const group of playbook.groups || []) {
      for (const check of group.checks || []) {
        if (seen.has(check.id)) continue;
        seen.add(check.id);
        const sid = surfaceFor(check, group, playbook);
        const bucket = bySurface.get(sid) || [];
        bucket.push({ ...check, playbookId: playbook.id, playbookTitle: playbook.title, kind, groupId: group.id });
        bySurface.set(sid, bucket);
      }
    }
  }
  const families = SURFACES.map((surface) => {
    const checks = bySurface.get(surface.id) || [];
    return Object.freeze({
      ...surface,
      checks: Object.freeze(checks),
      hidden: !checks.length && isHiddenSurface(surface.id, answers)
    });
  });
  const visible = families.filter(({ checks }) => checks.length);
  const hiddenFamilies = families.filter(({ hidden, checks }) => hidden && !checks.length);
  const checks = visible.flatMap(({ checks: list }) => list);
  return Object.freeze({
    ...pack,
    families: Object.freeze(visible),
    hiddenFamilies: Object.freeze(hiddenFamilies),
    checks: Object.freeze(checks)
  });
}

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function composeAssessmentMarkdown(plan, options = {}) {
  const { name = '', targetUrl = '', chips = [], surfaces = [], hidden = [], families, hiddenFamilies } = plan;
  const grouped = families?.length
    ? families
    : surfaces.map(({ playbook, kind }) => ({ title: playbook.title, summary: playbook.summary, checks: playbookChecks(playbook).map((check) => ({ ...check, playbookId: playbook.id })), kind }));
  const checks = grouped.flatMap(({ checks: list }) => list);
  const lines = [
    `# ${safe(name || 'WAPT assessment')} — Applicable tests`,
    '',
    `- Target: ${safe(targetUrl || 'Not provided')}`,
    `- Profile: ${safe(chips.join(' · ') || 'Not scoped')}`,
    `- Attack surfaces: ${grouped.length}`,
    `- Applicable tests: ${checks.length}`,
    '',
    '> Scope only. This plan does not include findings, notes, or evidence.',
    '> Authorized testing only.',
    ''
  ];
  for (const family of grouped) {
    lines.push(`## ${safe(family.title)}`, '');
    if (family.summary) lines.push(safe(family.summary), '');
    for (const check of family.checks || []) {
      const mark = options.checked?.has?.(check.id) ? 'x' : ' ';
      lines.push(`- [${mark}] **${safe(check.title)}**`);
    }
    lines.push('');
  }
  const hiddenTitles = (hiddenFamilies || []).map(({ title }) => title);
  if (!hiddenTitles.length && hidden?.length) hiddenTitles.push(...hidden.map(({ title }) => title));
  if (hiddenTitles.length) {
    lines.push('## Hidden until the profile includes them', '');
    for (const title of hiddenTitles) lines.push(`- ${safe(title)}`);
    lines.push('');
  }
  return lines.join('\n');
}

export { surfaceMeta };
