// Scope import: derive assessment context from an API definition the tester
// already has — OpenAPI 3 / Swagger 2 (JSON) or a Postman Collection v2.x.
//
// Everything happens locally: the caller reads the file, this module only
// inspects the parsed object and proposes an answers patch. Nothing is
// uploaded, fetched, or stored beyond the engagement's local state, and the
// tester always reviews the result through the normal context questions —
// an import is a suggestion, never a silent scope decision.
//
// Heuristics are deliberately conservative: only signal what the document
// actually states, and list every detection so the tester can audit it.

const LOGIN_PATH = /(^|\/)(login|signin|sign-in|auth|authenticate|token|session|password)(\/|$)/i;
const REGISTER_PATH = /(^|\/)(register|signup|sign-up|users?|accounts?)(\/|$)/i;
const RESET_PATH = /(reset|recover|forgot|verify|otp|mfa|2fa)/i;
const UPLOAD_HINT = /(^|\/)(upload|files?|imports?|attachments?|documents?|media|avatars?)(\/|$)/i;
const PAY_HINT = /(pay|checkout|billing|invoice|charge|subscription|coupon|cart)/i;
const SEARCH_HINT = /(^|\/)(search|queries|query|filters?|lookup)(\/|$)/i;
const MAIL_HINT = /(mail|invite|invitation|notif|verification|contact)/i;
const WEBHOOK_HINT = /(webhook|callback|notify)/i;

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function operationsOfPaths(paths) {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  const operations = [];
  for (const [route, definition] of Object.entries(paths || {})) {
    if (!definition || typeof definition !== 'object') continue;
    for (const [method, operation] of Object.entries(definition)) {
      if (!methods.has(method) || !operation || typeof operation !== 'object') continue;
      operations.push({ route, method, operation });
    }
  }
  return operations;
}

function mapSecurityScheme(scheme) {
  if (!scheme || typeof scheme !== 'object') return null;
  const type = String(scheme.type || '').toLowerCase();
  if (type === 'http') {
    const schemeName = String(scheme.scheme || '').toLowerCase();
    if (schemeName === 'bearer') return 'jwt';
    if (schemeName === 'basic' || schemeName === 'digest') return 'mixed';
    return null;
  }
  if (type === 'oauth2' || type === 'openidconnect') return 'oauth';
  if (type === 'apikey') {
    const where = String(scheme.in || '').toLowerCase();
    const name = String(scheme.name || '').toLowerCase();
    if (where === 'cookie' || name === 'session' || name.includes('csrf')) return 'cookie';
    return 'mixed'; // header/query keys: bearer-ish or custom — confirm manually
  }
  return null;
}

function collectOpenApi(document) {
  const operations = operationsOfPaths(document.paths);
  const routes = operations.map(({ route }) => route);
  const allText = JSON.stringify(document.paths || {}).toLocaleLowerCase('en-US');

  const schemes = document.components?.securitySchemes || document.securityDefinitions || {};
  const mechanisms = uniq(Object.values(schemes).map(mapSecurityScheme));

  // Global security plus per-operation security both count as declared auth.
  const usesSecurity = Boolean(document.security?.length) || operations.some(({ operation }) => operation.security?.length);

  const hasLoginRoute = routes.some((route) => LOGIN_PATH.test(route)) || allText.includes('/login');
  const hasRegisterRoute = routes.some((route) => REGISTER_PATH.test(route));
  const hasResetRoute = routes.some((route) => RESET_PATH.test(route));

  const styles = ['rest'];
  if (allText.includes('graphql')) styles.push('graphql');
  if (JSON.stringify(document.servers || []).includes('ws:') || JSON.stringify(document.servers || []).includes('wss:')) styles.push('websocket');

  const features = [];
  if (routes.some((route) => UPLOAD_HINT.test(route)) || allText.includes('multipart/form-data') || allText.includes('binary')) features.push('file_upload');
  if (routes.some((route) => PAY_HINT.test(route))) features.push('payments');
  if (routes.some((route) => SEARCH_HINT.test(route))) features.push('search');
  if (routes.some((route) => MAIL_HINT.test(route))) features.push('email');
  const outbound = routes.some((route) => WEBHOOK_HINT.test(route)) ? ['webhooks'] : null;

  return {
    title: document.info?.title || '',
    version: document.info?.version || '',
    endpoints: Object.keys(document.paths || {}).length,
    operations: operations.length,
    kind: document.openapi ? `OpenAPI ${document.openapi}` : `Swagger ${document.swagger}`,
    mechanisms,
    styles,
    features,
    outbound,
    hasLogin: mechanisms.length > 0 || usesSecurity || hasLoginRoute ? 'yes' : 'unknown',
    registration: hasRegisterRoute ? 'yes' : 'unknown',
    identityFeatures: hasResetRoute ? ['recovery', 'mfa'] : ['unknown'],
    detections: [
      `${Object.keys(document.paths || {}).length} paths · ${operations.length} operations`,
      ...Object.entries(schemes).map(([name, scheme]) => `${scheme.type}${scheme.scheme ? ` ${scheme.scheme}` : ''} security scheme "${name}"`).slice(0, 6),
      hasLoginRoute && 'login/auth/token paths present',
      hasRegisterRoute && 'registration paths present',
      hasResetRoute && 'recovery/verification paths present',
      features.includes('file_upload') && 'file upload surface detected',
      features.includes('payments') && 'payment workflows detected',
      outbound && 'webhook/callback paths detected'
    ].filter(Boolean)
  };
}

function collectRequests(items, sink) {
  for (const item of items || []) {
    if (Array.isArray(item?.item)) {
      collectRequests(item.item, sink);
      continue;
    }
    const request = item?.request;
    if (!request) continue;
    const raw = typeof request.url === 'string' ? request.url
      : request.url?.raw || [request.url?.host, request.url?.path].flat().filter(Boolean).join('/') || '';
    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
    const auth = request.auth || itemAuthFallback;
    sink.push({ name: String(item.name || ''), url: String(raw), method: String(request.method || ''), body, auth: typeof auth === 'object' ? auth : null });
  }
  return sink;
}
let itemAuthFallback = null;

function mapPostmanAuth(auth) {
  const type = String(auth?.type || '').toLowerCase();
  if (type === 'bearer') return 'jwt';
  if (type === 'oauth2' || type === 'oauth1') return 'oauth';
  if (type === 'basic' || type === 'digest' || type === 'apikey' || type === 'ntlm' || type === 'awsv4') return 'mixed';
  return null;
}

function collectPostman(document) {
  itemAuthFallback = document.auth || null;
  const requests = collectRequests(document.item, []);
  itemAuthFallback = null;
  const urls = requests.map(({ url }) => url);
  const joined = urls.join(' ').toLocaleLowerCase('en-US');

  const styles = [];
  if (requests.some(({ url, body }) => url.includes('graphql') || body.toLocaleLowerCase('en-US').includes('"query"'))) styles.push('graphql');
  if (joined.includes('ws://') || joined.includes('wss://')) styles.push('websocket');
  if (!styles.length || !styles.includes('graphql')) styles.unshift('rest');

  const mechanisms = uniq([
    mapPostmanAuth(document.auth),
    ...requests.map(({ auth }) => mapPostmanAuth(auth))
  ]);

  const hasLoginRoute = urls.some((url) => LOGIN_PATH.test(url));
  const hasRegisterRoute = urls.some((url) => REGISTER_PATH.test(url));
  const hasResetRoute = urls.some((url) => RESET_PATH.test(url));

  const features = [];
  if (urls.some((url) => UPLOAD_HINT.test(url)) || requests.some(({ body }) => body.includes('"file"') || body.includes('formdata'))) features.push('file_upload');
  if (urls.some((url) => PAY_HINT.test(url))) features.push('payments');
  if (urls.some((url) => SEARCH_HINT.test(url))) features.push('search');
  if (urls.some((url) => MAIL_HINT.test(url))) features.push('email');
  const outbound = urls.some((url) => WEBHOOK_HINT.test(url)) ? ['webhooks'] : null;

  return {
    title: document.info?.name || '',
    version: document.info?.version ? `v${document.info.version}` : '',
    endpoints: new Set(urls.map((url) => url.split('?')[0])).size,
    operations: requests.length,
    kind: 'Postman collection',
    mechanisms,
    styles: uniq(styles),
    features,
    outbound,
    hasLogin: mechanisms.length > 0 || hasLoginRoute ? 'yes' : 'unknown',
    registration: hasRegisterRoute ? 'yes' : 'unknown',
    identityFeatures: hasResetRoute ? ['recovery'] : ['unknown'],
    detections: [
      `${requests.length} saved requests`,
      mechanisms.length ? `auth types: ${mechanisms.join(', ')}` : 'no declared auth',
      hasLoginRoute && 'login/auth/token requests present',
      hasRegisterRoute && 'registration requests present',
      styles.includes('graphql') && 'GraphQL requests present',
      styles.includes('websocket') && 'WebSocket URLs present',
      features.includes('file_upload') && 'file upload surface detected',
      outbound && 'webhook/callback requests detected'
    ].filter(Boolean)
  };
}

export function importScope(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, error: 'Not a JSON object.' };
  }
  let analysis;
  if (candidate.openapi || candidate.swagger) analysis = collectOpenApi(candidate);
  else if (candidate.info?.schema && String(candidate.info.schema).includes('postman')) analysis = collectPostman(candidate);
  else return { ok: false, error: 'Unrecognized definition — expected OpenAPI/Swagger JSON or a Postman collection v2.x.' };

  if (!analysis.endpoints && !analysis.operations) {
    return { ok: false, error: 'The definition contains no paths or requests to learn from.' };
  }

  const answers = {
    app_type: 'api_only',
    api_style: analysis.styles,
    api_docs: 'openapi',
    has_login: analysis.hasLogin,
    auth_mechanism: analysis.mechanisms.length ? analysis.mechanisms : ['unknown'],
    identity_features: analysis.identityFeatures,
    registration: analysis.registration
  };
  if (analysis.features.length) answers.features = analysis.features;
  if (analysis.outbound) answers.outbound_fetch = analysis.outbound;

  return {
    ok: true,
    answers,
    meta: {
      title: analysis.title,
      version: analysis.version,
      kind: analysis.kind,
      endpoints: analysis.endpoints,
      operations: analysis.operations,
      detections: analysis.detections
    }
  };
}
