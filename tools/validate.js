#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'item.schema.json');

const CATEGORIES = Object.freeze({
  reconnaissance: { prefix: 'WAPT-RECON', floor: 30 },
  http: { prefix: 'WAPT-HTTP', floor: 25 },
  authentication: { prefix: 'WAPT-AUTH', floor: 40 },
  'session-management': { prefix: 'WAPT-SESS', floor: 25 },
  authorization: { prefix: 'WAPT-AUTHZ', floor: 35 },
  injection: { prefix: 'WAPT-INJ', floor: 45 },
  xss: { prefix: 'WAPT-XSS', floor: 25 },
  csrf: { prefix: 'WAPT-CSRF', floor: 15 },
  'file-handling': { prefix: 'WAPT-UPLOAD', floor: 20 },
  'api-security': { prefix: 'WAPT-API', floor: 35 },
  graphql: { prefix: 'WAPT-GQL', floor: 12 },
  jwt: { prefix: 'WAPT-JWT', floor: 15 },
  'oauth-sso-saml': { prefix: 'WAPT-OAUTH', floor: 18 },
  ssrf: { prefix: 'WAPT-SSRF', floor: 12 },
  'request-smuggling': { prefix: 'WAPT-SMUG', floor: 12 },
  'business-logic': { prefix: 'WAPT-BL', floor: 30 },
  'race-conditions': { prefix: 'WAPT-RACE', floor: 10 },
  'client-side': { prefix: 'WAPT-CLIENT', floor: 25 },
  websocket: { prefix: 'WAPT-WS', floor: 8 },
  'security-headers': { prefix: 'WAPT-HDR', floor: 20 },
  'cloud-storage': { prefix: 'WAPT-CLOUD', floor: 15 },
  'information-disclosure': { prefix: 'WAPT-INFO', floor: 15 },
  'rate-limiting': { prefix: 'WAPT-RATE', floor: 10 },
  advanced: { prefix: 'WAPT-ADV', floor: 15 }
});

const OPTIONS = Object.freeze({
  mode: ['black_box', 'grey_box', 'white_box', 'unknown'],
  creds: ['none', 'low', 'high', 'unknown'],
  app_type: ['server_rendered', 'spa', 'static', 'hybrid', 'api_only', 'unknown'],
  has_login: ['yes', 'no', 'unknown'],
  registration: ['yes', 'no', 'unknown'],
  roles: ['none', 'one', 'few', 'many', 'unknown'],
  auth_mechanism: ['none', 'cookie', 'jwt', 'oauth', 'saml', 'ldap', 'mixed', 'unknown'],
  identity_features: ['password', 'mfa', 'passkey', 'recovery', 'passwordless', 'remember_device', 'none', 'unknown'],
  api_docs: ['openapi', 'none', 'unknown'],
  source_access: ['full', 'partial', 'none', 'unknown'],
  backend: ['none', 'node', 'java', 'dotnet', 'python', 'php', 'ruby', 'go', 'other', 'unknown'],
  api_style: ['rest', 'graphql', 'soap', 'websocket', 'grpc', 'none', 'unknown'],
  database: ['sql', 'nosql', 'ldap', 'other', 'none', 'unknown'],
  cloud: ['aws', 'gcp', 'azure', 'self_hosted', 'none', 'other', 'unknown'],
  features: ['file_upload', 'payments', 'search', 'email', 'chat', 'multi_tenant', 'mobile_api', 'ai_llm', 'other', 'none', 'unknown'],
  intermediary: ['cdn', 'proxy', 'waf', 'none', 'unknown'],
  outbound_fetch: ['webhooks', 'import', 'none', 'unknown'],
  async_jobs: ['yes', 'no', 'unknown']
});

const URL_HINTS = new Set([
  'plain_http', 'unusual_tls_port', 'api_subdomain', 'admin_subdomain',
  'nonproduction_subdomain', 'punycode_hostname'
]);

const ENUMS = Object.freeze({
  severity: new Set(['critical', 'high', 'medium', 'low', 'informational']),
  difficulty: new Set(['low', 'medium', 'high']),
  mode: new Set(['manual', 'automated'])
});

const REQUIRED = [
  'id', 'title', 'category', 'severity', 'difficulty', 'mode', 'objective',
  'prerequisites', 'steps', 'examples', 'manipulate', 'secure_behavior',
  'vulnerable_behavior', 'validation', 'false_positives', 'impact', 'evidence',
  'tools', 'references', 'mappings', 'related', 'tags', 'attack_chains',
  'applies', 'variants'
];

const OPTIONAL = new Set(['priority_when', 'safety', 'remediation']);
const ALLOWED_FIELDS = new Set([...REQUIRED, ...OPTIONAL]);
const ARRAY_FIELDS = [
  'prerequisites', 'steps', 'examples', 'false_positives', 'evidence', 'tools',
  'references', 'related', 'tags', 'attack_chains', 'variants'
];
const NON_EMPTY_ARRAY_FIELDS = new Set(['steps', 'examples', 'false_positives', 'evidence', 'tools', 'references', 'tags']);

const MAPPING_RULES = Object.freeze({
  wstg: /^WSTG-v42-[A-Z]{4}-\d{2}$/,
  asvs: /^v5\.0\.0-\d+\.\d+\.\d+$/,
  owasp_top10: /^A(?:0[1-9]|10):(?:2021|2025)$/,
  api_top10: /^API(?:[1-9]|10):2023$/,
  cwe: /^CWE-[1-9]\d*$/,
  portswigger: /^https:\/\/portswigger\.net\/web-security(?:\/|$)/
});

const SOURCE_NAMES = new Set([
  'OWASP', 'OWASP WSTG', 'OWASP ASVS', 'OWASP API Security', 'OWASP Top 10',
  'PortSwigger', 'CWE', 'IETF', 'OASIS', 'W3C', 'WHATWG', 'Official vendor'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && /\S/.test(value);
}

function duplicates(values) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function parseJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(ROOT, file)}: invalid JSON (${error.message})`);
    return null;
  }
}

function referenceUrlAllowed(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;

  const host = url.hostname.toLowerCase();
  if (host === 'owasp.org') return true;
  if (host === 'portswigger.net') return url.pathname === '/web-security' || url.pathname.startsWith('/web-security/');
  if (host === 'www.rfc-editor.org') return /^\/rfc\/rfc\d+\/?$/.test(url.pathname);
  if (host === 'cwe.mitre.org') return url.pathname.startsWith('/data/definitions/');
  if (host === 'html.spec.whatwg.org' || host.endsWith('.spec.whatwg.org')) return true;
  if (host === 'www.w3.org') return true;
  if (host === 'docs.oasis-open.org') return url.pathname.startsWith('/security/saml/');
  if (host === 'docs.aws.amazon.com' || host === 'cloud.google.com' || host === 'learn.microsoft.com') return true;
  if (host === 'github.com') return url.pathname === '/OWASP/ASVS/tree/v5.0.0' || url.pathname.startsWith('/OWASP/ASVS/blob/v5.0.0/');
  return false;
}

function conditionValues(key) {
  if (key.startsWith('url_hints.')) {
    return URL_HINTS.has(key.slice('url_hints.'.length)) ? [true, false] : null;
  }
  return OPTIONS[key] || null;
}

function validateConditionMap(value, at, errors) {
  if (!isObject(value) || Object.keys(value).length === 0) {
    errors.push(`${at}: must be a non-empty condition object`);
    return;
  }

  for (const [key, expected] of Object.entries(value)) {
    const allowed = conditionValues(key);
    if (!allowed) {
      errors.push(`${at}.${key}: unknown context attribute`);
      continue;
    }
    if (!Array.isArray(expected) || expected.length === 0) {
      errors.push(`${at}.${key}: must be a non-empty array`);
      continue;
    }
    if (duplicates(expected).length) errors.push(`${at}.${key}: contains duplicate values`);
    for (const option of expected) {
      if (!allowed.includes(option)) errors.push(`${at}.${key}: invalid option ${JSON.stringify(option)}`);
    }
  }
}

function validateToken(token, at, errors) {
  if (!hasText(token) || !token.includes(':')) {
    errors.push(`${at}: must use attribute:value[|value] syntax`);
    return;
  }
  const separator = token.indexOf(':');
  const key = token.slice(0, separator);
  const values = token.slice(separator + 1).split('|');
  const allowed = conditionValues(key);
  if (!allowed) {
    errors.push(`${at}: unknown context attribute ${JSON.stringify(key)}`);
    return;
  }
  if (values.some((value) => value === '') || duplicates(values).length) {
    errors.push(`${at}: has empty or duplicate alternatives`);
  }
  for (const value of values) {
    const normalized = value === 'true' ? true : value === 'false' ? false : value;
    if (!allowed.includes(normalized)) errors.push(`${at}: invalid option ${JSON.stringify(value)} for ${key}`);
  }
}

function validateApplicability(value, at, errors) {
  if (!isObject(value)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!['any_of', 'requires', 'excludes'].includes(key)) errors.push(`${at}.${key}: unknown applicability operator`);
  }
  if (value.any_of !== undefined) validateConditionMap(value.any_of, `${at}.any_of`, errors);
  for (const operator of ['requires', 'excludes']) {
    if (value[operator] === undefined) continue;
    if (!Array.isArray(value[operator])) {
      errors.push(`${at}.${operator}: must be an array`);
      continue;
    }
    if (duplicates(value[operator]).length) errors.push(`${at}.${operator}: contains duplicate tokens`);
    value[operator].forEach((token, index) => validateToken(token, `${at}.${operator}[${index}]`, errors));
  }
}

function validateStringArray(value, at, errors, nonEmpty = false) {
  if (!Array.isArray(value)) return;
  if (nonEmpty && value.length === 0) errors.push(`${at}: must not be empty`);
  value.forEach((entry, index) => {
    if (!hasText(entry)) errors.push(`${at}[${index}]: must be a non-empty string`);
  });
  if (duplicates(value).length) errors.push(`${at}: contains duplicate values`);
}

function validateReference(reference, at, errors) {
  if (!isObject(reference)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  for (const field of ['source', 'title', 'url']) {
    if (!hasText(reference[field])) errors.push(`${at}.${field}: must be a non-empty string`);
  }
  if (hasText(reference.source) && !SOURCE_NAMES.has(reference.source)) errors.push(`${at}.source: unsupported source name`);
  if (hasText(reference.url) && !referenceUrlAllowed(reference.url)) errors.push(`${at}.url: URL is not an allowed authoritative HTTPS reference`);
  if (reference.source === 'OWASP WSTG' && !reference.url.includes('/v42/')) errors.push(`${at}.url: WSTG references must be pinned to v42`);
  const extra = Object.keys(reference).filter((key) => !['source', 'title', 'url'].includes(key));
  if (extra.length) errors.push(`${at}: unknown fields: ${extra.join(', ')}`);
}

function validateExample(example, at, errors) {
  if (!isObject(example)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  const keys = Object.keys(example);
  if (!keys.some((key) => ['request', 'response', 'note'].includes(key))) errors.push(`${at}: needs request, response, or note`);
  for (const key of keys) {
    if (!['request', 'response', 'note'].includes(key)) errors.push(`${at}.${key}: unknown example field`);
    else if (!hasText(example[key])) errors.push(`${at}.${key}: must be a non-empty string`);
  }
}

function validateMappings(value, at, errors) {
  if (!isObject(value)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  let total = 0;
  for (const [name, regex] of Object.entries(MAPPING_RULES)) {
    const entries = value[name];
    if (!Array.isArray(entries)) {
      errors.push(`${at}.${name}: must be an array`);
      continue;
    }
    total += entries.length;
    if (duplicates(entries).length) errors.push(`${at}.${name}: contains duplicate mappings`);
    entries.forEach((entry, index) => {
      if (typeof entry !== 'string' || !regex.test(entry)) errors.push(`${at}.${name}[${index}]: invalid mapping ${JSON.stringify(entry)}`);
    });
  }
  const extra = Object.keys(value).filter((key) => !Object.hasOwn(MAPPING_RULES, key));
  if (extra.length) errors.push(`${at}: unknown mapping fields: ${extra.join(', ')}`);
  if (total === 0) errors.push(`${at}: at least one mapping dimension must be non-empty`);
}

function validateVariant(variant, at, errors) {
  if (!isObject(variant)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  const extra = Object.keys(variant).filter((key) => !['when', 'steps', 'notes'].includes(key));
  if (extra.length) errors.push(`${at}: unknown fields: ${extra.join(', ')}`);
  validateConditionMap(variant.when, `${at}.when`, errors);
  validateStringArray(variant.steps, `${at}.steps`, errors, true);
  if (!Array.isArray(variant.steps)) errors.push(`${at}.steps: must be an array`);
  if (variant.notes !== undefined && !hasText(variant.notes)) errors.push(`${at}.notes: must be a non-empty string`);
}

function validateItem(item, at, errors) {
  if (!isObject(item)) {
    errors.push(`${at}: must be an object`);
    return;
  }

  for (const field of REQUIRED) {
    if (!Object.hasOwn(item, field)) errors.push(`${at}: missing required field ${field}`);
  }
  const unknown = Object.keys(item).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknown.length) errors.push(`${at}: unknown fields: ${unknown.join(', ')}`);

  for (const field of ['id', 'title', 'objective', 'manipulate', 'secure_behavior', 'vulnerable_behavior', 'validation', 'impact']) {
    if (!hasText(item[field])) errors.push(`${at}.${field}: must be a non-empty string`);
  }
  for (const field of ['safety', 'remediation']) {
    if (item[field] !== undefined && !hasText(item[field])) errors.push(`${at}.${field}: must be a non-empty string`);
  }

  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(item[field])) errors.push(`${at}.${field}: must be an array`);
  }
  for (const field of ['prerequisites', 'steps', 'false_positives', 'evidence', 'tools', 'related', 'tags', 'attack_chains']) {
    validateStringArray(item[field], `${at}.${field}`, errors, NON_EMPTY_ARRAY_FIELDS.has(field));
  }

  if (!Object.hasOwn(CATEGORIES, item.category)) {
    errors.push(`${at}.category: unknown category ${JSON.stringify(item.category)}`);
  } else if (hasText(item.id) && !new RegExp(`^${CATEGORIES[item.category].prefix}-\\d{3}$`).test(item.id)) {
    errors.push(`${at}.id: prefix does not match category ${item.category}`);
  }

  if (!/^WAPT-[A-Z]+-\d{3}$/.test(item.id || '')) errors.push(`${at}.id: invalid item ID format`);
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (!allowed.has(item[field])) errors.push(`${at}.${field}: invalid value ${JSON.stringify(item[field])}`);
  }

  if (Array.isArray(item.tags)) {
    item.tags.forEach((tag, index) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) errors.push(`${at}.tags[${index}]: tags must be lower-case kebab case`);
    });
  }
  if (Array.isArray(item.related)) {
    item.related.forEach((id, index) => {
      if (!/^WAPT-[A-Z]+-\d{3}$/.test(id)) errors.push(`${at}.related[${index}]: invalid item ID`);
      if (id === item.id) errors.push(`${at}.related[${index}]: item cannot relate to itself`);
    });
  }
  if (Array.isArray(item.attack_chains)) {
    item.attack_chains.forEach((id, index) => {
      if (!/^[A-Z][A-Z0-9]*-\d{2}$/.test(id)) errors.push(`${at}.attack_chains[${index}]: invalid chain ID`);
    });
  }

  if (Array.isArray(item.examples)) item.examples.forEach((example, index) => validateExample(example, `${at}.examples[${index}]`, errors));
  if (Array.isArray(item.references)) item.references.forEach((reference, index) => validateReference(reference, `${at}.references[${index}]`, errors));
  validateMappings(item.mappings, `${at}.mappings`, errors);
  validateApplicability(item.applies, `${at}.applies`, errors);
  if (Array.isArray(item.variants)) item.variants.forEach((variant, index) => validateVariant(variant, `${at}.variants[${index}]`, errors));
  if (item.priority_when !== undefined) validateConditionMap(item.priority_when, `${at}.priority_when`, errors);

  if (['request-smuggling', 'race-conditions'].includes(item.category) && !hasText(item.safety)) {
    errors.push(`${at}.safety: mandatory for ${item.category}`);
  }
  if (Array.isArray(item.false_positives) && item.false_positives.some((text) => /^(none|n\/a|not applicable)\.?$/i.test(text.trim()))) {
    errors.push(`${at}.false_positives: placeholder guidance is not allowed`);
  }
}

function discoverFiles(args) {
  if (args.length) return args.map((file) => path.resolve(ROOT, file));
  const checklist = path.join(ROOT, 'checklist');
  return fs.readdirSync(checklist)
    .filter((name) => name.endsWith('.json') && !['manifest.json', 'sample.json'].includes(name))
    .map((name) => path.join(checklist, name));
}

function validateDocument(document, file, errors) {
  const at = path.relative(ROOT, file);
  if (!hasText(document.schema_version)) errors.push(`${at}.schema_version: required`);
  if (!Array.isArray(document.items)) {
    errors.push(`${at}.items: must be an array`);
    return false;
  }

  if (document.sample === true) {
    const extra = Object.keys(document).filter((key) => !['schema_version', 'sample', 'description', 'items'].includes(key));
    if (extra.length) errors.push(`${at}: unknown sample document fields: ${extra.join(', ')}`);
    return true;
  }

  const allowed = ['schema_version', 'category', 'lastmod', 'items'];
  const extra = Object.keys(document).filter((key) => !allowed.includes(key));
  if (extra.length) errors.push(`${at}: unknown production document fields: ${extra.join(', ')}`);
  if (!Object.hasOwn(CATEGORIES, document.category)) errors.push(`${at}.category: unknown production category ${JSON.stringify(document.category)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.lastmod || '')) errors.push(`${at}.lastmod: must use YYYY-MM-DD`);
  if (Object.hasOwn(CATEGORIES, document.category) && path.basename(file) !== `${document.category}.json`) {
    errors.push(`${at}: production filename must be ${document.category}.json`);
  }
  return true;
}

function validatePhase7(itemIds = new Set()) {
  const errors = [];
  const chainRoot = path.join(ROOT, 'attack-chains');
  const chainManifest = parseJson(path.join(chainRoot, 'manifest.json'), errors);
  const memberships = new Map();
  const chainIds = new Set();
  if (chainManifest && Array.isArray(chainManifest.chains)) {
    for (const entry of chainManifest.chains) {
      const at = `attack-chains/manifest.json.${entry?.id || 'unknown'}`;
      if (!/^[A-Z][A-Z0-9]*-\d{2}$/.test(entry?.id || '')) errors.push(`${at}: invalid chain ID`);
      if (chainIds.has(entry.id)) errors.push(`${at}: duplicate chain ID`);
      chainIds.add(entry.id);
      const document = parseJson(path.join(chainRoot, entry.file || ''), errors);
      if (!document) continue;
      if (document.id !== entry.id) errors.push(`${at}: document ID does not match manifest`);
      if (!hasText(document.title) || !hasText(document.summary) || !hasText(document.safety)) errors.push(`${at}: title, summary, and safety are required`);
      if (!Array.isArray(document.nodes) || document.nodes.length < 2) errors.push(`${at}.nodes: at least two nodes required`);
      if (!Array.isArray(document.edges) || document.edges.length < 1) errors.push(`${at}.edges: at least one edge required`);
      const nodes = new Set();
      for (const [index, node] of (document.nodes || []).entries()) {
        if (!itemIds.has(node?.item_id)) errors.push(`${at}.nodes[${index}]: unresolved item ${node?.item_id}`);
        if (!hasText(node?.label)) errors.push(`${at}.nodes[${index}].label: required`);
        if (nodes.has(node?.item_id)) errors.push(`${at}.nodes[${index}]: duplicate item`);
        nodes.add(node?.item_id);
        if (node?.item_id) {
          const set = memberships.get(node.item_id) || new Set();
          set.add(entry.id);
          memberships.set(node.item_id, set);
        }
      }
      const adjacency = new Map([...nodes].map((id) => [id, []]));
      for (const [index, edge] of (document.edges || []).entries()) {
        if (!nodes.has(edge?.from) || !nodes.has(edge?.to)) errors.push(`${at}.edges[${index}]: endpoints must be chain nodes`);
        if (!hasText(edge?.condition)) errors.push(`${at}.edges[${index}].condition: required`);
        if (nodes.has(edge?.from) && nodes.has(edge?.to)) adjacency.get(edge.from).push(edge.to);
      }
      const visiting = new Set(); const visited = new Set();
      const cyclic = (id) => {
        if (visiting.has(id)) return true;
        if (visited.has(id)) return false;
        visiting.add(id);
        for (const next of adjacency.get(id) || []) if (cyclic(next)) return true;
        visiting.delete(id); visited.add(id); return false;
      };
      if ([...nodes].some(cyclic)) errors.push(`${at}: chain graph must be acyclic`);
    }
  } else if (chainManifest) errors.push('attack-chains/manifest.json.chains: must be an array');

  const payloadRoot = path.join(ROOT, 'payloads');
  const payloadManifest = parseJson(path.join(payloadRoot, 'manifest.json'), errors);
  const payloadIds = new Set();
  if (payloadManifest && Array.isArray(payloadManifest.categories)) {
    for (const entry of payloadManifest.categories) {
      const document = parseJson(path.join(payloadRoot, entry.file || ''), errors);
      const at = `payloads/${entry.file || 'unknown'}`;
      if (!document || !Array.isArray(document.items)) { if (document) errors.push(`${at}.items: must be an array`); continue; }
      if (document.category !== entry.slug) errors.push(`${at}.category: must match manifest slug`);
      if (document.items.length !== entry.count) errors.push(`${at}: manifest count differs`);
      for (const [index, payload] of document.items.entries()) {
        const where = `${at}.items[${index}]`;
        if (!/^PAYLOAD-[A-Z0-9]+-\d{3}$/.test(payload?.id || '')) errors.push(`${where}.id: invalid payload ID`);
        if (payloadIds.has(payload?.id)) errors.push(`${where}.id: duplicate payload ID`);
        payloadIds.add(payload?.id);
        for (const field of ['title', 'context', 'intended_use', 'payload', 'safety']) if (!hasText(payload?.[field])) errors.push(`${where}.${field}: required`);
        if (!Array.isArray(payload?.caveats) || payload.caveats.length === 0) errors.push(`${where}.caveats: required`);
        if (typeof payload?.review_only !== 'boolean') errors.push(`${where}.review_only: must be boolean`);
        if (!Array.isArray(payload?.related) || payload.related.some((id) => !itemIds.has(id))) errors.push(`${where}.related: contains unresolved item`);
        if (payload?.review_only && !(payload.tags || []).includes('review-only')) errors.push(`${where}.tags: REVIEW-ONLY entry needs review-only tag`);
      }
    }
  } else if (payloadManifest) errors.push('payloads/manifest.json.categories: must be an array');

  const requiredWorkflows = ['proxy','repeater','intruder','scanner','comparer','decoder','sequencer','logger','param-miner','autorize','turbo-intruder','collaborator'];
  for (const slug of requiredWorkflows) {
    const file = path.join(ROOT, 'burp-workflows', `${slug}.md`);
    if (!fs.existsSync(file)) errors.push(`burp-workflows/${slug}.md: missing`);
    else {
      const text = fs.readFileSync(file, 'utf8');
      for (const heading of ['## When and why', '## Safe workflow', '## Evidence to retain', '## Boundaries', '## What this tool does not prove']) {
        if (!text.includes(heading)) errors.push(`burp-workflows/${slug}.md: missing ${heading}`);
      }
    }
  }
  return { errors, chainIds, memberships, payloadCount: payloadIds.size };
}

function validateFiles(files, options = {}) {
  const errors = [];
  const schema = parseJson(SCHEMA_PATH, errors);
  if (schema && JSON.stringify(schema.required) !== JSON.stringify(REQUIRED)) {
    errors.push('schema/item.schema.json: required field list is out of sync with tools/validate.js');
  }

  const documents = [];
  const allItems = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      errors.push(`${path.relative(ROOT, file)}: file does not exist`);
      continue;
    }
    const document = parseJson(file, errors);
    if (!document) continue;
    if (!isObject(document)) {
      errors.push(`${path.relative(ROOT, file)}: top level must be an object`);
      continue;
    }
    if (!validateDocument(document, file, errors)) continue;
    documents.push({ file, document });
    document.items.forEach((item, index) => {
      const at = `${path.relative(ROOT, file)}.items[${index}]`;
      validateItem(item, at, errors);
      if (document.sample !== true && isObject(item) && item.category !== document.category) {
        errors.push(`${at}.category: must match document category ${document.category}`);
      }
      if (isObject(item)) allItems.push({ item, at, sample: document.sample === true });
    });
  }

  const idOwners = new Map();
  const titleOwners = new Map();
  for (const { item, at } of allItems) {
    if (hasText(item.id)) {
      if (idOwners.has(item.id)) errors.push(`${at}.id: duplicate of ${idOwners.get(item.id)}`);
      else idOwners.set(item.id, at);
    }
    if (hasText(item.title)) {
      const normalized = item.title.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
      if (titleOwners.has(normalized)) errors.push(`${at}.title: duplicate of ${titleOwners.get(normalized)}`);
      else titleOwners.set(normalized, at);
    }
  }

  for (const { item, at } of allItems) {
    if (!Array.isArray(item.related)) continue;
    for (const related of item.related) {
      if (!idOwners.has(related)) errors.push(`${at}.related: unresolved item ${related}`);
    }
  }

  let phase7 = null;
  if (options.validateAuxiliary) {
    phase7 = validatePhase7(new Set(idOwners.keys()));
    errors.push(...phase7.errors);
    for (const { item, at, sample } of allItems) {
      if (sample) continue;
      const declared = new Set(item.attack_chains || []);
      const actual = phase7.memberships.get(item.id) || new Set();
      for (const id of declared) if (!phase7.chainIds.has(id)) errors.push(`${at}.attack_chains: unresolved chain ${id}`);
      for (const id of actual) if (!declared.has(id)) errors.push(`${at}.attack_chains: missing membership ${id}`);
      for (const id of declared) if (!actual.has(id)) errors.push(`${at}.attack_chains: item is not a node in ${id}`);
    }
  }

  const productionDocuments = documents.filter(({ document }) => document.sample !== true);
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((category) => [category, 0]));
  for (const { item, sample } of allItems) {
    if (!sample && Object.hasOwn(counts, item.category)) counts[item.category] += 1;
  }
  if ((options.enforceFloors || options.enforceCoreFloors || options.enforcePresentFloors) && productionDocuments.length) {
    const requiredCategories = options.enforceFloors
      ? Object.keys(CATEGORIES)
      : options.enforceCoreFloors
        ? Object.keys(CATEGORIES).slice(0, 10)
        : [...new Set(productionDocuments.map(({ document }) => document.category))];
    for (const category of requiredCategories) {
      const meta = CATEGORIES[category];
      if (meta && counts[category] < meta.floor) errors.push(`floor.${category}: ${counts[category]} items; requires ${meta.floor}`);
    }
  }

  return { errors, itemCount: allItems.length, documentCount: documents.length, counts, phase7 };
}

function main() {
  const args = process.argv.slice(2);
  const enforceFloors = args.includes('--floors');
  const enforceCoreFloors = args.includes('--core-floors');
  const enforcePresentFloors = args.includes('--floors-present');
  if ([enforceFloors, enforceCoreFloors, enforcePresentFloors].filter(Boolean).length > 1) {
    console.error('Choose one floor mode: --floors, --core-floors, or --floors-present.');
    process.exitCode = 2;
    return;
  }
  const paths = args.filter((arg) => !['--floors', '--core-floors', '--floors-present'].includes(arg));
  const files = discoverFiles(paths);
  const result = validateFiles(files, { enforceFloors, enforceCoreFloors, enforcePresentFloors, validateAuxiliary: paths.length === 0 });

  if (result.errors.length) {
    console.error(`Validation failed with ${result.errors.length} error(s):`);
    result.errors.forEach((error) => console.error(`  - ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${result.itemCount} item(s) in ${result.documentCount} file(s).`);
  if (enforceFloors) console.log('All 24 category floors satisfied.');
  else if (enforceCoreFloors) console.log('Phase 4 floors satisfied for core categories 01–10.');
  else if (enforcePresentFloors) console.log('Floors satisfied for every production category present.');
  else console.log('Category floors were not enforced.');
  if (result.phase7) console.log(`Validated ${result.phase7.chainIds.size} attack chain(s), ${result.phase7.payloadCount} payload reference(s), and 12 Burp workflow(s).`);
}

if (require.main === module) main();

module.exports = { CATEGORIES, OPTIONS, validateFiles, validatePhase7, referenceUrlAllowed };
