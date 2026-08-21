// Surface playbooks: page-type packs of named test variants and payloads.
// Matching uses the same condition-map vocabulary as item.applies / variants.when.
// Expansion adds EVERY applicable checklist item for that page type — authored
// overlays first, then the catalog-only remainder (methodology available, practical
// variants pending). Nothing is synthesized from a title.
import { contextHas, deriveContext } from './context.js?v=1.0.0-r15';
import { APPLICABILITY, evaluateApplicability, evaluateConditionMap } from './applicability.js?v=1.0.0-r15';
import { checkFromItem } from './probes.js?v=1.0.0-r15';
import { checkMaturity, MATURITY } from './maturity.js?v=1.0.0-r15';

const PAGE = Object.freeze([
  'reconnaissance', 'http', 'security-headers', 'information-disclosure',
  'client-side', 'xss', 'request-smuggling', 'advanced', 'cloud-storage'
]);

const WEB = Object.freeze({
  mode: 'grey_box', creds: 'high', app_type: 'hybrid', has_login: 'yes', registration: 'no', roles: 'few',
  auth_mechanism: ['cookie'], identity_features: ['password', 'mfa', 'recovery'], api_docs: 'unknown',
  source_access: 'none', backend: ['unknown'], api_style: ['none'], database: ['sql'], cloud: 'unknown',
  features: ['none'], intermediary: ['unknown'], outbound_fetch: ['none'], async_jobs: 'no'
});

const API = Object.freeze({
  mode: 'grey_box', creds: 'high', app_type: 'api_only', has_login: 'yes', registration: 'no', roles: 'few',
  auth_mechanism: ['jwt'], identity_features: ['unknown'], api_docs: 'openapi', source_access: 'none',
  backend: ['unknown'], api_style: ['rest'], database: ['sql'], cloud: 'unknown', features: ['none'],
  intermediary: ['unknown'], outbound_fetch: ['webhooks'], async_jobs: 'unknown'
});

export const PLAYBOOK_SURFACES = Object.freeze({
  'static-page': Object.freeze({
    path: '/',
    include: PAGE,
    scope: Object.freeze({
      mode: 'black_box', creds: 'none', app_type: 'static', has_login: 'no', registration: 'no', roles: 'none',
      auth_mechanism: ['none'], identity_features: ['none'], api_docs: 'none', source_access: 'none',
      backend: ['none'], api_style: ['none'], database: ['none'], cloud: 'unknown', features: ['none'],
      intermediary: ['unknown'], outbound_fetch: ['none'], async_jobs: 'no'
    })
  }),
  'login-page': Object.freeze({
    path: '/login',
    include: [...PAGE, 'authentication', 'session-management', 'csrf', 'rate-limiting', 'injection'],
    scope: WEB
  }),
  registration: Object.freeze({
    path: '/register',
    include: [...PAGE, 'authentication', 'csrf', 'rate-limiting', 'injection', 'authorization'],
    scope: Object.freeze({ ...WEB, registration: 'yes' })
  }),
  'password-reset': Object.freeze({
    path: '/forgot-password',
    include: [...PAGE, 'authentication', 'csrf', 'rate-limiting', 'injection', 'session-management'],
    scope: Object.freeze({ ...WEB, features: ['email'] })
  }),
  'account-profile': Object.freeze({
    path: '/settings',
    include: [...PAGE, 'authorization', 'authentication', 'csrf', 'session-management', 'injection'],
    scope: Object.freeze({ ...WEB, api_style: ['rest'] })
  }),
  session: Object.freeze({
    path: '/',
    include: [...PAGE, 'session-management', 'csrf', 'authentication'],
    scope: WEB
  }),
  'file-upload': Object.freeze({
    path: '/upload',
    include: [...PAGE, 'file-handling', 'authorization', 'injection', 'csrf', 'rate-limiting'],
    scope: Object.freeze({ ...WEB, features: ['file_upload'] })
  }),
  'search-page': Object.freeze({
    path: '/search',
    include: [...PAGE, 'injection', 'authorization', 'rate-limiting', 'business-logic', 'csrf'],
    scope: Object.freeze({ ...WEB, features: ['search'] })
  }),
  checkout: Object.freeze({
    path: '/checkout',
    include: [...PAGE, 'business-logic', 'race-conditions', 'csrf', 'rate-limiting', 'authorization', 'injection'],
    scope: Object.freeze({ ...WEB, features: ['payments'], outbound_fetch: ['webhooks'], async_jobs: 'yes' })
  }),
  'admin-panel': Object.freeze({
    path: '/admin',
    include: [...PAGE, 'authorization', 'authentication', 'csrf', 'session-management', 'rate-limiting'],
    scope: Object.freeze({ ...WEB, roles: 'many' })
  }),
  'api-endpoint': Object.freeze({
    path: '/api/v1/resource/1001',
    include: ['api-security', 'http', 'authorization', 'authentication', 'jwt', 'injection', 'information-disclosure', 'rate-limiting', 'reconnaissance', 'security-headers', 'ssrf'],
    scope: API
  }),
  graphql: Object.freeze({
    path: '/graphql',
    include: ['graphql', 'api-security', 'http', 'authorization', 'authentication', 'jwt', 'csrf', 'injection', 'information-disclosure', 'rate-limiting'],
    scope: Object.freeze({ ...API, api_style: ['graphql'] })
  }),
  websocket: Object.freeze({
    path: '/chat',
    include: ['websocket', 'http', 'authorization', 'authentication', 'csrf', 'client-side', 'injection'],
    scope: Object.freeze({ ...WEB, app_type: 'spa', api_style: ['websocket'], features: ['chat'] })
  }),
  'oauth-sso': Object.freeze({
    path: '/login',
    include: ['oauth-sso-saml', 'authentication', 'session-management', 'http', 'security-headers', 'csrf'],
    scope: Object.freeze({ ...WEB, auth_mechanism: ['cookie', 'oauth'] })
  }),
  'jwt-token': Object.freeze({
    path: '/api/v1/me',
    include: ['jwt', 'authentication', 'api-security', 'http', 'authorization'],
    scope: API
  }),
  'spa-client': Object.freeze({
    path: '/',
    include: [...PAGE, 'jwt', 'csrf', 'session-management', 'authentication'],
    scope: Object.freeze({ ...WEB, app_type: 'spa', auth_mechanism: ['jwt'], api_style: ['rest'] })
  })
});

export function indexPlaybooks(manifest, documents = []) {
  const byId = new Map();
  const byItem = new Map();
  const playbooks = [];
  const files = new Map((documents || []).map((document) => [document.id, document]));
  for (const entry of manifest?.playbooks || []) {
    const document = files.get(entry.id);
    if (!document) continue;
    const playbook = Object.freeze({
      ...document,
      title: document.title || entry.title,
      summary: document.summary || entry.summary,
      groups: Object.freeze((document.groups || []).map((group) => Object.freeze({
        ...group,
        checks: Object.freeze(group.checks || [])
      })))
    });
    playbooks.push(playbook);
    byId.set(playbook.id, playbook);
    for (const check of playbookChecks(playbook)) {
      for (const itemId of checkItemIds(check)) {
        const bucket = byItem.get(itemId) || [];
        bucket.push({ playbook, check });
        byItem.set(itemId, bucket);
      }
    }
  }
  return Object.freeze({ playbooks: Object.freeze(playbooks), byId, byItem });
}

export function playbookChecks(playbook) {
  return (playbook?.groups || []).flatMap((group) => (group.checks || []).map((check) => ({ ...check, group })));
}

export function checkItemIds(check) {
  const ids = [];
  if (check?.item) ids.push(check.item);
  for (const id of check?.related || []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export function playbookMatches(playbook, context) {
  return classifyPlaybook(playbook, context) !== 'none';
}

// match = this surface is in the scoped target (certain `when`)
// relevant = also applies (also_when, or a hinted/unknown when)
// browse = still openable; not claimed by this scope
export function classifyPlaybook(playbook, context) {
  if (!playbook?.when || !Object.keys(playbook.when).length) return 'browse';
  const primary = evaluateConditionMap(playbook.when, context);
  if (primary.certain) return 'match';
  if (primary.matches) return 'relevant';
  if (playbook.also_when && Object.keys(playbook.also_when).length) {
    const extra = evaluateConditionMap(playbook.also_when, context);
    if (extra.certain || extra.matches) return 'relevant';
    if (extra.unknown && !primary.unknown) return 'relevant';
  }
  if (primary.unknown) return 'browse';
  return 'none';
}

export function isPrimaryPlaybook(playbook, context) {
  return (playbook?.default_for || []).some((value) => contextHas(context, 'app_type', [value]));
}

export function matchPlaybooks(index, context) {
  return (index?.playbooks || []).filter((playbook) => {
    const kind = classifyPlaybook(playbook, context);
    return kind === 'match' || kind === 'relevant';
  });
}

export function suggestedPlaybook(index, context) {
  const playbooks = index?.playbooks || [];
  const certain = playbooks.filter((playbook) => classifyPlaybook(playbook, context) === 'match');
  const primaryCertain = certain.find((playbook) => isPrimaryPlaybook(playbook, context));
  if (primaryCertain) return primaryCertain;
  if (certain.length) return certain[0];
  const relevant = playbooks.filter((playbook) => classifyPlaybook(playbook, context) === 'relevant');
  const primaryRelevant = relevant.find((playbook) => isPrimaryPlaybook(playbook, context));
  return primaryRelevant || relevant[0] || playbooks[0] || null;
}

export function probesForItem(index, itemId) {
  return Object.freeze(index?.byItem?.get(itemId) || []);
}

export function overlayByItem(playbook) {
  const map = new Map();
  for (const check of playbookChecks(playbook)) {
    if (check.item) map.set(check.item, check);
    for (const id of check.related || []) if (!map.has(id)) map.set(id, check);
  }
  return map;
}

export function applicableItemsForPlaybook(playbook, items = []) {
  const surface = PLAYBOOK_SURFACES[playbook?.id] || {};
  const allow = new Set(surface.include || []);
  const context = deriveContext(surface.scope || {});
  const out = [];
  for (const item of items) {
    if (allow.size && !allow.has(item.category)) continue;
    const result = evaluateApplicability(item, context);
    if (result.state === APPLICABILITY.NA_CONTEXT) continue;
    out.push(item);
  }
  return out;
}

export function expandPlaybook(playbook, items = [], familyIndex = null) {
  if (!playbook) return playbook;
  const surface = PLAYBOOK_SURFACES[playbook.id] || {};
  const path = surface.path || '/';
  const overlays = overlayByItem(playbook);
  const applicable = applicableItemsForPlaybook(playbook, items);
  const seen = new Set();
  const authoredGroups = (playbook.groups || []).map((group) => {
    const checks = (group.checks || []).map((check) => {
      const item = items.find((candidate) => candidate.id === check.item);
      if (item) seen.add(item.id);
      for (const id of check.related || []) seen.add(id);
      return item ? checkFromItem(item, check, path) : { ...check, maturity: checkMaturity(check) };
    });
    return Object.freeze({ ...group, checks: Object.freeze(checks) });
  });

  const remaining = applicable.filter((item) => !seen.has(item.id));
  const extraGroups = [];
  if (remaining.length) {
    const byFamily = new Map();
    const ungrouped = [];
    for (const item of remaining) {
      const family = familyIndex?.byItem?.get(item.id);
      if (!family) { ungrouped.push(item); continue; }
      const bucket = byFamily.get(family.id) || [];
      bucket.push(item);
      byFamily.set(family.id, bucket);
    }
    const families = familyIndex?.families || [...byFamily.keys()].map((id) => ({ id, title: id, summary: '' }));
    for (const family of families) {
      const members = byFamily.get(family.id);
      if (!members?.length) continue;
      extraGroups.push(Object.freeze({
        id: `all-${family.id}`.slice(0, 40),
        title: family.title,
        summary: family.summary || '',
        checks: Object.freeze(members.map((item) => checkFromItem(item, overlays.get(item.id), path)))
      }));
    }
    if (ungrouped.length) {
      extraGroups.push(Object.freeze({
        id: 'all-other',
        title: 'Other applicable checks',
        summary: 'Applicable to this page type and not already listed above.',
        checks: Object.freeze(ungrouped.map((item) => checkFromItem(item, overlays.get(item.id), path)))
      }));
    }
  }

  const groups = [
    ...authoredGroups.map((group) => Object.freeze({ ...group, authored: true })),
    ...extraGroups
  ];
  return Object.freeze({
    ...playbook,
    expanded: true,
    groups: Object.freeze(groups)
  });
}

export function expandedCheckCount(playbook, items = []) {
  if (!items.length) return playbookChecks(playbook).length;
  const authored = new Set(playbookChecks(playbook).flatMap((check) => checkItemIds(check)));
  const applicable = applicableItemsForPlaybook(playbook, items);
  const extra = applicable.filter((item) => !authored.has(item.id)).length;
  return playbookChecks(playbook).length + extra;
}

// Split an expanded playbook's checks into authored (real variants) and catalog-only
// (methodology available, practical variants pending). Variant-complete checks — variants
// exist but per-variant why/class is incomplete — are still "authored" in the sense that
// they have named variants and payloads; only catalog-only checks have no procedure.
export function expandedMaturityCounts(playbook, items = []) {
  let applicable = 0;
  let authored = 0;
  let methodology = 0;
  const checks = items.length ? playbookChecks(expandPlaybook(playbook, items)) : playbookChecks(playbook);
  for (const check of checks) {
    applicable += 1;
    const maturity = checkMaturity(check);
    if (maturity === MATURITY.CATALOG_ONLY) methodology += 1;
    else authored += 1;
  }
  return Object.freeze({ applicable, authored, methodology });
}
