// Assessment plan (item 4): feature-aware, not page-type-primary.
//
// Application Profile → Surfaces/Features → Applicable Tests (catalog) → Authored
// overlays where they exist. A page type is one way of discovering a surface, not the
// plan. buildAssessmentPlan() starts from the applicable catalog items for the profile,
// attaches authored playbook overlays where they exist, and groups by attack surface.
// Playbook matching still lights up (SaaS → login + SPA + API + JWT + profile), but the
// dashboard list IS the catalog, grouped by surface.
import { classifyPlaybook, playbookChecks, suggestedPlaybook } from './playbooks.js?v=1.0.0-r6';
import { SURFACES, surfaceForItem, surfaceMeta, isHiddenSurface } from './surfaces.js?v=1.0.0-r6';
import { applicableItems } from './applicable.js?v=1.0.0-r6';
import { checkFromItem } from './probes.js?v=1.0.0-r6';
import { checkMaturity, MATURITY } from './maturity.js?v=1.0.0-r6';

// Best authored overlay for an item across every playbook. Prefer overlays from a
// playbook that matches or is relevant to the current profile, then the check where the
// item is the primary item, then the first check that references it.
function overlayHit(index, itemId, context) {
  const hits = index?.byItem?.get(itemId) || [];
  if (!hits.length) return null;
  const inScope = (hit) => {
    const kind = classifyPlaybook(hit.playbook, context);
    return kind === 'match' || kind === 'relevant';
  };
  const scopedPrimary = hits.find((hit) => inScope(hit) && hit.check.item === itemId);
  if (scopedPrimary) return scopedPrimary;
  const scoped = hits.find((hit) => inScope(hit));
  if (scoped) return scoped;
  const primary = hits.find(({ check }) => check.item === itemId);
  return primary || hits[0];
}

function withPrimaryFirst(list, primaryId) {
  if (!primaryId) return list.slice();
  const head = list.filter(({ playbook }) => playbook.id === primaryId);
  const rest = list.filter(({ playbook }) => playbook.id !== primaryId);
  return [...head, ...rest];
}

// Which playbooks light up for this scope. Kept for the board / banner; the plan list
// itself is the catalog.
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

// Plan = applicable catalog items (the canonical count) with authored overlays attached,
// grouped by attack surface.
export function buildAssessmentPlan(index, context, answers = {}, items = []) {
  const applicable = applicableItems(items, context);
  const pack = assessmentSurfaces(index, context);
  const bySurface = new Map();
  let fullAuthoredCount = 0;
  let authoredCount = 0;
  let variantCompleteCount = 0;
  let methodologyCount = 0;
  for (const item of applicable) {
    const hit = overlayHit(index, item.id, context);
    const overlay = hit?.check || null;
    const check = checkFromItem(item, overlay);
    const maturity = checkMaturity(check);
    // "Authored" = the item has a real playbook overlay (named variants + payloads),
    // whether fully described (AUTHORED) or still variant-complete. Only catalog-only
    // rows are methodology. So authored + methodology === applicable.
    if (maturity === MATURITY.CATALOG_ONLY) methodologyCount += 1;
    else {
      authoredCount += 1;
      if (maturity === MATURITY.AUTHORED) fullAuthoredCount += 1;
      else variantCompleteCount += 1;
    }
    const sid = surfaceForItem(item, overlay, hit?.check?.group);
    const bucket = bySurface.get(sid) || [];
    bucket.push({
      ...check,
      playbookId: hit?.playbook?.id || null,
      playbookTitle: hit?.playbook?.title || null,
      kind: hit?.playbook ? classifyPlaybook(hit.playbook, context) : null
    });
    bySurface.set(sid, bucket);
  }
  const families = SURFACES.map((surface) => {
    const checks = bySurface.get(surface.id) || [];
    // Authored rows first (they have a playbook), then the methodology-only split
    // ("Methodology available — practical variants pending").
    const ordered = [...checks].sort((a, b) => {
      const am = a.maturity === 'catalog-only' ? 1 : 0;
      const bm = b.maturity === 'catalog-only' ? 1 : 0;
      return am - bm;
    });
    return Object.freeze({
      ...surface,
      checks: Object.freeze(ordered),
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
    checks: Object.freeze(checks),
    applicableCount: applicable.length,
    authoredCount,
    fullAuthoredCount,
    variantCompleteCount,
    methodologyCount
  });
}

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function composeAssessmentMarkdown(plan, options = {}) {
  const { name = '', targetUrl = '', chips = [], surfaces = [], hidden = [], families, hiddenFamilies, applicableCount, authoredCount, methodologyCount } = plan;
  const grouped = families?.length
    ? families
    : surfaces.map(({ playbook, kind }) => ({ title: playbook.title, summary: playbook.summary, checks: playbookChecks(playbook).map((check) => ({ ...check, playbookId: playbook.id })), kind }));
  const checks = grouped.flatMap(({ checks: list }) => list);
  const applicable = typeof applicableCount === 'number' ? applicableCount : checks.length;
  const authored = typeof authoredCount === 'number' ? authoredCount : 0;
  const methodology = typeof methodologyCount === 'number' ? methodologyCount : 0;
  const lines = [
    `# ${safe(name || 'WAPT assessment')} — Applicable tests`,
    '',
    `- Target: ${safe(targetUrl || 'Not provided')}`,
    `- Profile: ${safe(chips.join(' · ') || 'Not scoped')}`,
    `- Attack surfaces: ${grouped.length}`,
    `- Applicable tests: ${applicable} (${authored} with playbooks · ${methodology} methodology-only)`,
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
