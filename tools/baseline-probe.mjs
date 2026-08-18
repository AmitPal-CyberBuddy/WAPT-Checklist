// Behavior probe: runs unchanged against the baseline commit and the current branch.
// It exercises only APIs that existed at baseline and prints comparable JSON.
import { ATTRIBUTE_OPTIONS, deriveContext, normalizeScopeAnswers, deriveUrlHints } from '../js/engine/context.js';
import { evaluateApplicability } from '../js/engine/applicability.js';
import { suggestedNext } from '../js/engine/priorities.js';
import { createState, setEngagement, setItemStatus, setItemNote, serializeState, importState } from '../js/engine/state.js';

const out = {};
out.attributeKeys = Object.keys(ATTRIBUTE_OPTIONS);

out.urlHints = {};
const urls = [
  'https://app.example.com', 'http://app.example.com', 'https://api.app.example.com',
  'https://admin.app.example.com', 'https://dev.app.example.com', 'https://xn--bcher-kva.example',
  'https://user:pass@example.com', 'http://169.254.169.254/latest/meta-data', 'https://localhost',
  'file:///etc/passwd', 'javascript:alert(1)', 'http://10.2.3.4'
];
for (const url of urls) out.urlHints[url] = deriveUrlHints(url);

const item = (id, category, applies) => ({ id, category, severity: 'medium', applies, variants: [] });
const probes = [
  item('WAPT-AUTH-900', 'authentication', {}),
  item('WAPT-AUTH-901', 'authentication', { requires: ['creds:low|high'] }),
  item('WAPT-AUTHZ-900', 'authorization', { any_of: { features: ['multi_tenant'] } }),
  item('WAPT-JWT-900', 'jwt', { any_of: { auth_mechanism: ['jwt'] } }),
  item('WAPT-SSRF-900', 'ssrf', { excludes: ['app_type:static'] }),
  item('WAPT-CLIENT-900', 'client-side', { excludes: ['app_type:api_only'] }),
  item('WAPT-BL-900', 'business-logic', { any_of: { features: ['payments'] } })
];
const contexts = {
  unknown: deriveContext({}),
  jwt: deriveContext({ auth_mechanism: ['jwt'] }),
  cookie: deriveContext({ auth_mechanism: ['cookie'] }),
  static: deriveContext({ app_type: 'static' }),
  blackbox_no_creds: deriveContext({ mode: 'black_box', creds: 'none' }),
  api_only: deriveContext({ app_type: 'api_only' }),
  payments: deriveContext({ features: ['payments'] })
};
out.applicability = {};
for (const [name, context] of Object.entries(contexts)) {
  out.applicability[name] = {};
  for (const probe of probes) {
    const result = evaluateApplicability(probe, context);
    out.applicability[name][probe.id] = { state: result.state, blocked: Boolean(result.blocked) };
  }
}

const first = suggestedNext(probes, contexts.jwt, { limit: 5 }).map(({ item: entry }) => entry.id);
const second = suggestedNext(probes, contexts.jwt, { limit: 5 }).map(({ item: entry }) => entry.id);
out.suggestedDeterministic = JSON.stringify(first) === JSON.stringify(second);
out.suggested = first;

let state = setEngagement(createState(), { name: 'Probe', targetUrl: 'https://app.example.com' }, '2026-08-18T00:00:00.000Z');
state = setItemStatus(state, 'WAPT-AUTHZ-900', 'passed', '2026-08-18T00:00:00.000Z');
state = setItemNote(state, 'WAPT-AUTHZ-900', 'note', '2026-08-18T00:00:00.000Z');
out.stateRoundTrip = JSON.stringify(importState(serializeState(state))) === JSON.stringify(state);

out.importRejects = {};
for (const [label, json] of [['badJson', '{bad'], ['wrongVersion', '{"schema_version":99}'], ['oversize', `{"a":"${'x'.repeat(1_100_000)}"}`]]) {
  try { importState(json); out.importRejects[label] = false; } catch (error) { out.importRejects[label] = String(error.message).slice(0, 60); }
}

out.normalizedStatic = normalizeScopeAnswers({ app_type: 'static', api_style: ['none'], has_login: 'no' });

console.log(JSON.stringify(out, null, 1));
