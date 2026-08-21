// Assessment plan (item 4): feature-aware, not page-type-primary.
//
// Application Profile → Surfaces/Features → Applicable Tests (catalog) → Authored
// overlays where they exist. A page type is one way of discovering a surface, not the
// plan. buildAssessmentPlan() starts from the applicable catalog items for the profile,
// attaches authored playbook overlays where they exist, and groups by attack surface.
// Playbook matching still lights up (SaaS → login + SPA + API + JWT + profile), but the
// dashboard list IS the catalog, grouped by surface.
import { classifyPlaybook, playbookChecks, suggestedPlaybook } from './playbooks.js?v=1.0.0-r17';
import { SURFACES, surfaceForItem, surfaceMeta, isHiddenSurface } from './surfaces.js?v=1.0.0-r17';
import { applicableItems } from './applicable.js?v=1.0.0-r17';
import { checkFromItem } from './probes.js?v=1.0.0-r17';
import { checkMaturity, MATURITY } from './maturity.js?v=1.0.0-r17';

// Best authored overlay for an item across every testing plan. Only a check that owns the
// catalog item can supply its practical procedure; related IDs remain recommendation edges.
// Prefer the current page/function, then any plan that matches the application context.
function overlayHit(index, itemId, context, preferredPlaybookId = '') {
  const hits = index?.byItem?.get(itemId) || [];
  if (!hits.length) return null;
  const inScope = (hit) => {
    const kind = classifyPlaybook(hit.playbook, context);
    return kind === 'match' || kind === 'relevant';
  };
  // `related` is an adjacency edge, not a practical implementation of the target item.
  // Only the overlay that owns this item may provide its variants.
  const primary = hits.filter((hit) => hit.check.item === itemId);
  if (!primary.length) return null;
  const preferred = primary.find((hit) => hit.playbook.id === preferredPlaybookId && inScope(hit));
  if (preferred) return preferred;
  const scopedPrimary = primary.find(inScope);
  if (scopedPrimary) return scopedPrimary;
  return primary.find((hit) => hit.playbook.id === preferredPlaybookId) || primary[0];
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

export const PLAN_TIERS = Object.freeze([
  Object.freeze({ id: 'dont-miss', title: "Don't miss", description: 'The short senior-tester pass for this page or function.' }),
  Object.freeze({ id: 'high-value', title: 'High-value tests', description: 'Likely impact and common trust-boundary failures.' }),
  Object.freeze({ id: 'standard', title: 'Standard coverage', description: 'The normal breadth expected for a complete assessment.' }),
  Object.freeze({ id: 'advanced', title: 'Advanced / conditional', description: 'Specialist, protocol-edge, or higher-effort work.' })
]);

// The static-page list is deliberately curated. It is the answer to “if I only have a
// short window, what must I not forget?” — not another copy of the full catalog.
const STATIC_DONT_MISS = Object.freeze([
  'WAPT-HTTP-011',  // Host / forwarded authority
  'WAPT-RECON-011', // directory enumeration
  'WAPT-INFO-009',  // directory listing
  'WAPT-INFO-007',  // .git
  'WAPT-INFO-006',  // backups / leftovers
  'WAPT-INFO-004',  // source maps
  'WAPT-HDR-003',   // CSP
  'WAPT-HDR-002',   // HSTS
  'WAPT-HDR-006',   // clickjacking
  'WAPT-RECON-007', // TLS
  'WAPT-HTTP-014',  // HTTP → HTTPS
  'WAPT-CLIENT-027' // client-delivered secrets
]);

const SEVERITY_RANK = Object.freeze({ critical: 5, high: 4, medium: 3, low: 2, informational: 1 });
const SPECIALIST_CATEGORIES = new Set(['advanced', 'request-smuggling', 'race-conditions']);

function priorityOrder(left, right) {
  const authored = Number(Boolean(right.authored)) - Number(Boolean(left.authored));
  if (authored) return authored;
  const severity = (SEVERITY_RANK[right.severity] || 0) - (SEVERITY_RANK[left.severity] || 0);
  if (severity) return severity;
  return String(left.title).localeCompare(String(right.title));
}

// A mutually-exclusive progression over the applicable catalog. The total across these
// tiers is always the catalog-derived Applicable Test Count; nothing is duplicated merely
// because it also appears in a relationship or playbook.
export function tierAssessmentChecks(checks = [], { surfaceId = '' } = {}) {
  const dontMiss = new Set();
  if (surfaceId === 'static-page') {
    for (const id of STATIC_DONT_MISS) if (checks.some(({ item }) => item === id)) dontMiss.add(id);
  } else {
    // Every attack-surface tab gets a small Don't Miss pass. Authored and high-impact work
    // wins, with a strict cap so a large catalog never turns the entry tier into a wall.
    const bySurface = new Map();
    for (const check of checks) {
      const list = bySurface.get(check.surface) || [];
      list.push(check);
      bySurface.set(check.surface, list);
    }
    for (const members of bySurface.values()) {
      for (const check of [...members].sort(priorityOrder).slice(0, 3)) dontMiss.add(check.item);
    }
  }

  const highValue = new Set();
  // Core stays usable: keep practical high-impact work, every critical item, and only the
  // first four methodology-only high-severity checks per attack-surface tab. The remaining
  // high-severity breadth is still present under Standard — it is never discarded.
  for (const check of checks) {
    if (check.severity === 'critical' || (check.authored && check.severity === 'high')) highValue.add(check.item);
  }
  const highBySurface = new Map();
  for (const check of checks) {
    if (check.authored || check.severity !== 'high' || dontMiss.has(check.item)) continue;
    const list = highBySurface.get(check.surface) || [];
    list.push(check);
    highBySurface.set(check.surface, list);
  }
  for (const members of highBySurface.values()) {
    for (const check of [...members].sort(priorityOrder).slice(0, 4)) highValue.add(check.item);
  }

  const buckets = new Map(PLAN_TIERS.map(({ id }) => [id, []]));
  for (const check of checks) {
    let tier = 'standard';
    if (dontMiss.has(check.item)) tier = 'dont-miss';
    else if (SPECIALIST_CATEGORIES.has(check.category) || check.difficulty === 'high') tier = 'advanced';
    else if (highValue.has(check.item)) tier = 'high-value';
    buckets.get(tier).push(Object.freeze({ ...check, tier }));
  }
  return Object.freeze(PLAN_TIERS.map((meta) => {
    const members = buckets.get(meta.id);
    if (meta.id === 'dont-miss' && surfaceId === 'static-page') {
      members.sort((left, right) => STATIC_DONT_MISS.indexOf(left.item) - STATIC_DONT_MISS.indexOf(right.item));
    } else members.sort(priorityOrder);
    return Object.freeze({ ...meta, checks: Object.freeze(members) });
  }));
}

// Plan = applicable catalog items (the canonical count) with authored overlays attached,
// grouped by attack surface.
export function buildAssessmentPlan(index, context, answers = {}, items = [], options = {}) {
  const applicable = applicableItems(items, context);
  const pack = assessmentSurfaces(index, context);
  const bySurface = new Map();
  let fullAuthoredCount = 0;
  let authoredCount = 0;
  let variantCompleteCount = 0;
  let methodologyCount = 0;
  for (const item of applicable) {
    const hit = overlayHit(index, item.id, context, options.surfaceId || '');
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
      surface: sid,
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
  const tiers = tierAssessmentChecks(checks, { surfaceId: options.surfaceId || pack.primary?.id || '' });
  return Object.freeze({
    ...pack,
    currentSurface: index?.byId?.get(options.surfaceId || '') || pack.primary || null,
    families: Object.freeze(visible),
    hiddenFamilies: Object.freeze(hiddenFamilies),
    checks: Object.freeze(checks),
    tiers,
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
