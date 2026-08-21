import { ASSESSMENT_LIST, matchAssessment } from '../data/presets.mjs?v=1.0.0-r19';
import { importScope } from '../engine/scope-import.js?v=1.0.0-r19';
import { deriveUrlHints, normalizeScopeAnswers } from '../engine/context.js?v=1.0.0-r19';

const UNKNOWN = 'unknown';
const ROLE_DEFAULT_NAMES = Object.freeze({ admin: 'Administrator', privileged: 'Privileged user', support: 'Support / internal', standard: 'Standard user', custom: 'Custom role' });

export const QUESTIONS = Object.freeze([
  { key: 'mode', title: 'What assessment mode are you using?', description: 'This shapes how much implementation knowledge and internal evidence the plan can assume.', options: [['black_box', 'Black-box', 'External behavior only'], ['grey_box', 'Grey-box', 'Limited knowledge or test access'], ['white_box', 'White-box', 'Source, configuration, and implementation access'], [UNKNOWN, 'Not confirmed yet', 'Keep mode-dependent work visible']] },
  { key: 'app_type', title: 'How is the application delivered?', description: 'Choose the closest architecture; API-only prevents browser-runtime checks from being suggested for a service without a first-party web interface.', options: [['server_rendered', 'Server-rendered', 'HTML primarily composed by the server'], ['spa', 'Single-page application', 'Client-rendered application shell backed by services'], ['static', 'Static site', 'Published files with no first-party runtime backend'], ['hybrid', 'Hybrid web application', 'Mixed server and client rendering or micro-frontends'], ['api_only', 'API-only service', 'No first-party browser interface; REST, GraphQL, SOAP, gRPC, or realtime clients'], [UNKNOWN, 'Not confirmed yet', 'Retain all delivery variants']] },
  { key: 'has_login', title: 'Is any user authentication flow present?', description: 'Include forms, identity-provider redirects, API login, passkeys, magic links, and authenticated client applications.', options: [['yes', 'Yes', 'At least one authentication flow is in scope'], ['no', 'No authentication', 'The scoped surface has no user identity flow'], [UNKNOWN, 'Not confirmed yet', 'Confirm during reconnaissance']] },
  { key: 'creds', title: 'What test-account access is available?', description: 'Choose the best available coverage. Missing authenticated access stays visible as blocked roadmap work.', options: [['none', 'No test account', 'Unauthenticated coverage only'], ['low', 'One role / standard user', 'At least one ordinary authenticated context'], ['high', 'Multiple or privileged roles', 'Cross-role and vertical authorization coverage'], [UNKNOWN, 'Not confirmed yet', 'Account access is still being arranged']] },
  { key: 'registration', title: 'How are user accounts created?', description: 'Account creation affects verification, invitation, enrollment, and abuse paths.', options: [['yes', 'Open or self-service', 'A user can begin signup or enrollment'], ['no', 'Invite or administrator provisioned', 'No open self-registration path'], [UNKNOWN, 'Not confirmed yet', 'Account creation behavior is unclear']] },
  { key: 'roles', title: 'How complex is the role and permission model?', description: 'Include application roles, groups, tenant roles, service identities, and delegated permissions.', options: [['none', 'No authenticated roles', 'No user identity or privilege tier is in scope'], ['one', 'One role', 'A single authenticated privilege tier'], ['few', '2–3 roles', 'A small role hierarchy'], ['many', 'Many / granular permissions', 'RBAC, ABAC, groups, or complex permissions'], [UNKNOWN, 'Not confirmed yet', 'Map roles during testing']] },
  { key: 'role_types', title: 'Which user role types are available?', description: 'Select every tier that exists. This builds the privilege ladder the plan uses for vertical, horizontal, and cross-role testing.', multi: true, options: [['standard', 'Standard user', 'Ordinary authenticated account'], ['privileged', 'Privileged user', 'Manager, reviewer, or elevated tier'], ['admin', 'Administrator', 'Full administrative access'], ['support', 'Support / internal user', 'Staff, helpdesk, or internal tooling access'], ['custom', 'Custom roles', 'Named or tenant-specific tiers'], ['none', 'None identified', 'No tiered access exists'], [UNKNOWN, 'Not confirmed yet', 'Map the tiers during testing']] },
  { key: 'auth_mechanism', title: 'Which authentication mechanisms are used?', description: 'Select every confirmed mechanism — applications often mix several. Each selection adds only its own testing categories.', multi: true, options: [['none', 'None', 'No authentication mechanism in scope'], ['cookie', 'Cookie sessions', 'Browser ambient session cookies'], ['jwt', 'JWT / bearer tokens', 'JSON Web Tokens or similar bearer flows'], ['oauth', 'OAuth 2.0 / OpenID Connect', 'Delegated authorization or OIDC SSO'], ['saml', 'SAML', 'SAML-based federation'], ['ldap', 'Directory-backed', 'LDAP or enterprise directory authentication'], ['mixed', 'Mixed / other', 'Passkeys, magic links, API keys, HTTP auth, or custom mechanisms'], [UNKNOWN, 'Not confirmed yet', 'Keep identity-specific groups available']] },
  { key: 'identity_features', title: 'Which identity capabilities are present?', description: 'Select confirmed capabilities so MFA, passkey, recovery, and trusted-device checks appear only when relevant.', multi: true, options: [['password', 'Passwords', 'Password sign-in or password changes'], ['mfa', 'MFA / OTP / push', 'Additional factors, OTPs, approvals, or recovery codes'], ['passkey', 'Passkeys / WebAuthn', 'Registration or use of public-key credentials'], ['recovery', 'Account recovery', 'Password reset, account recovery, or unlock flows'], ['passwordless', 'Passwordless links or codes', 'Magic links, email/SMS codes, or equivalent sign-in'], ['remember_device', 'Trusted / remembered devices', 'MFA suppression or device trust'], ['none', 'None identified', 'No listed identity capability is in scope'], [UNKNOWN, 'Not confirmed yet', 'Retain identity capability checks for confirmation']] },
  { key: 'api_style', title: 'Which API or real-time styles are present?', description: 'Select all confirmed first-party interfaces, or None if the scoped site has no application API.', multi: true, options: [['rest', 'HTTP API / REST / RPC', 'Resource or action-style HTTP endpoints'], ['graphql', 'GraphQL', 'GraphQL queries, mutations, or subscriptions'], ['soap', 'SOAP / XML services', 'XML envelopes, WSDL, or related services'], ['websocket', 'WebSocket', 'Persistent bidirectional messages'], ['grpc', 'gRPC', 'Protocol Buffer services'], ['none', 'None', 'No first-party application API identified'], [UNKNOWN, 'Not confirmed yet', 'Discover protocols during mapping']] },
  { key: 'api_docs', title: 'What API definition or documentation is available?', description: 'Include machine-readable definitions, collections, schemas, and interactive documentation.', options: [['openapi', 'Definition or collection available', 'OpenAPI, Swagger, Postman, GraphQL schema, WSDL, or equivalent'], ['none', 'None identified', 'No API definition or collection is available'], [UNKNOWN, 'Not confirmed yet', 'Confirm while mapping the attack surface']] },
  { key: 'source_access', title: 'How much implementation access is available?', description: 'Include source, configuration, infrastructure definitions, build artifacts, and relevant design material.', options: [['full', 'Full', 'Complete relevant source and configuration'], ['partial', 'Partial', 'Selected modules, artifacts, or documentation'], ['none', 'None', 'Runtime testing only'], [UNKNOWN, 'Not confirmed yet', 'Access is not yet confirmed']] },
  { key: 'backend', title: 'Which backend stacks are in scope?', description: 'Select known runtimes. Mixed / other covers serverless functions and stacks not listed explicitly.', multi: true, options: [['none', 'None', 'No first-party runtime backend'], ['node', 'Node.js', 'JavaScript / TypeScript services'], ['java', 'Java / JVM', 'JVM frameworks and services'], ['dotnet', '.NET', 'ASP.NET and CLR services'], ['python', 'Python', 'Python frameworks and workers'], ['php', 'PHP', 'PHP applications and frameworks'], ['ruby', 'Ruby', 'Ruby applications and frameworks'], ['go', 'Go', 'Go services'], ['other', 'Mixed / other', 'Rust, native code, serverless, appliances, or another runtime'], [UNKNOWN, 'Not confirmed yet', 'Fingerprint conservatively']] },
  { key: 'database', title: 'Which data and query layers are used?', description: 'Select known interpreter families; Mixed / other covers search engines, graph stores, caches, and proprietary layers.', multi: true, options: [['none', 'None', 'No first-party dynamic data layer'], ['sql', 'SQL', 'Relational database queries'], ['nosql', 'NoSQL', 'Document, key-value, or graph queries'], ['ldap', 'LDAP / directory', 'Directory queries or filters'], ['other', 'Mixed / other', 'Search, cache, graph, analytics, or proprietary query layers'], [UNKNOWN, 'Not confirmed yet', 'Retain broad injection discovery']] },
  { key: 'cloud', title: 'Where is the scoped workload hosted?', description: 'Choose the primary environment; Mixed / other covers multi-cloud, edge, managed platforms, and providers not listed.', options: [['aws', 'AWS', 'Amazon Web Services'], ['gcp', 'Google Cloud', 'Google Cloud Platform'], ['azure', 'Microsoft Azure', 'Azure services'], ['self_hosted', 'Self-hosted / private cloud', 'Private, on-premises, or traditional infrastructure'], ['none', 'Not relevant', 'No provider-specific surface is in scope'], ['other', 'Mixed / other provider', 'Multi-cloud, edge, PaaS, or another provider'], [UNKNOWN, 'Not confirmed yet', 'Provider is not confirmed']] },
  { key: 'features', title: 'Which security-relevant features are in scope?', description: 'Select every confirmed workflow. Mixed / other keeps unlisted business features represented without making unsafe assumptions.', multi: true, options: [['file_upload', 'Files and document handling', 'Upload, import, export, preview, or conversion'], ['payments', 'Payments and commerce', 'Price, checkout, coupon, credit, or settlement'], ['search', 'Search and reporting', 'Queries, filters, exports, indexing, and resource use'], ['email', 'Email and account messaging', 'Invitations, recovery, notifications, and address workflows'], ['chat', 'Chat / user content', 'User-to-user content and delivery'], ['multi_tenant', 'Multi-tenant', 'Strong tenant data boundaries'], ['mobile_api', 'Mobile or desktop client API', 'Services consumed by non-browser clients'], ['ai_llm', 'AI / LLM features', 'Model prompts, retrieval, tool calls, or generated content'], ['other', 'Mixed / other workflows', 'Admin, webhooks, integrations, scheduling, or other business functions'], ['none', 'None identified', 'No listed application workflow is in scope'], [UNKNOWN, 'Not confirmed yet', 'Discover features during mapping']] },
  { key: 'intermediary', title: 'Which intermediaries sit in front of the application?', description: 'Cache poisoning, deception, and desynchronization work depends on request hops. Select confirmed layers; direct-origin deployments can say None.', multi: true, options: [['cdn', 'CDN or edge cache', 'Content delivery network or edge platform'], ['proxy', 'Reverse proxy or gateway', 'Load balancer, gateway, or caching proxy'], ['waf', 'WAF or security gateway', 'Filtering or inspection layer'], ['none', 'None / direct origin', 'Clients reach the origin directly'], [UNKNOWN, 'Not confirmed yet', 'Map request hops during testing']] },
  { key: 'outbound_fetch', title: 'Does the server fetch URLs outbound?', description: 'Server-side URL fetching drives SSRF and webhook-signature work. Include webhooks, callbacks, integrations, imports, previews, and rendering features.', multi: true, options: [['webhooks', 'Webhooks or callbacks', 'Outbound deliveries, notifications, or provider callbacks'], ['import', 'Import, preview, or rendering', 'URL import, unfurl, avatar, screenshot, or document rendering'], ['none', 'None identified', 'No server-side URL fetching is in scope'], [UNKNOWN, 'Not confirmed yet', 'Confirm while mapping the attack surface']] },
  { key: 'async_jobs', title: 'Are asynchronous jobs or background processing present?', description: 'Queues, scheduled tasks, exports, and workers change authorization, injection, and business-logic risk. Answer conservatively when unsure.', options: [['yes', 'Yes', 'Queues, workers, cron, or background exports exist'], ['no', 'No', 'All processing is synchronous request handling'], [UNKNOWN, 'Not confirmed yet', 'Keep asynchronous-job checks visible for confirmation']] }
]);

const HINT_LABELS = Object.freeze({
  plain_http: 'Plain HTTP — confirm TLS coverage', unusual_tls_port: 'Unusual TLS port — review configuration',
  api_subdomain: 'API subdomain — confirm API scope', admin_subdomain: 'Admin subdomain — confirm privileged surface',
  nonproduction_subdomain: 'Non-production label — review disclosure/configuration', punycode_hostname: 'Punycode hostname — review canonical host handling'
});

// One section label per question so the sequence reads as grouped stages, not a wall.
const QUESTION_SECTIONS = Object.freeze({
  mode: 'APPROACH', app_type: 'DELIVERY',
  has_login: 'IDENTITY & ACCESS', creds: 'IDENTITY & ACCESS', registration: 'IDENTITY & ACCESS',
  roles: 'IDENTITY & ACCESS', role_types: 'IDENTITY & ACCESS', auth_mechanism: 'IDENTITY & ACCESS', identity_features: 'IDENTITY & ACCESS',
  api_style: 'INTERFACES', api_docs: 'INTERFACES',
  source_access: 'ENVIRONMENT', backend: 'ENVIRONMENT', database: 'ENVIRONMENT', cloud: 'ENVIRONMENT',
  features: 'BUSINESS FEATURES',
  intermediary: 'EDGES & JOBS', outbound_fetch: 'EDGES & JOBS', async_jobs: 'EDGES & JOBS'
});

// What each answer shapes in the plan — stated up front so skipping is a conscious choice.
const QUESTION_IMPACT = Object.freeze({
  mode: ['implementation access', 'evidence expectations'],
  app_type: ['client-side suites', 'API suites', 'delivery checks'],
  has_login: ['authentication suites', 'session suites'],
  creds: ['authorization depth', 'blocked roadmap work'],
  registration: ['signup abuse paths', 'verification flows'],
  roles: ['vertical privilege tests', 'RBAC checks'],
  role_types: ['cross-role matrix', 'privilege ladder'],
  auth_mechanism: ['JWT suites', 'SSO / federation suites', 'session suites'],
  identity_features: ['MFA & recovery suites', 'passkey checks'],
  api_style: ['API suites', 'GraphQL suites', 'WebSocket suites'],
  api_docs: ['surface discovery depth'],
  source_access: ['code-assisted review'],
  backend: ['runtime fingerprinting', 'injection variants'],
  database: ['injection suites'],
  cloud: ['cloud metadata suites', 'storage suites'],
  features: ['business-logic suites', 'file handling', 'payments & commerce'],
  intermediary: ['cache poisoning suites', 'request smuggling'],
  outbound_fetch: ['SSRF suites', 'webhook validation'],
  async_jobs: ['job authorization', 'race conditions']
});

function safeUrlHints(raw) {
  const derived = deriveUrlHints(raw);
  return Object.entries(derived.hints).filter(([, enabled]) => enabled).map(([key]) => key);
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.map((entry) => entry.replaceAll('_', ' ')).join(', ');
  return String(value || UNKNOWN).replaceAll('_', ' ');
}

function answerIsUnknown(answers, key) {
  const value = answers[key];
  return value === undefined || value === UNKNOWN || (Array.isArray(value) && (value.includes(UNKNOWN) || !value.length));
}

export function applicableQuestions(answers = {}) {
  const loginRelevant = answers.has_login !== 'no';
  const apiStyles = Array.isArray(answers.api_style) ? answers.api_style : [UNKNOWN];
  const apiRelevant = !apiStyles.includes('none');
  const runtimeRelevant = answers.app_type !== 'static' || apiRelevant;
  const roleTiersRelevant = loginRelevant && !['none', 'one'].includes(answers.roles);
  const hidden = new Set();
  if (!loginRelevant) ['creds', 'registration', 'roles', 'role_types', 'auth_mechanism', 'identity_features'].forEach((key) => hidden.add(key));
  if (!roleTiersRelevant) hidden.add('role_types');
  if (!apiRelevant) hidden.add('api_docs');
  if (!runtimeRelevant) ['backend', 'database', 'outbound_fetch', 'async_jobs'].forEach((key) => hidden.add(key));
  if (answers.mode === 'black_box') hidden.add('source_access');
  return QUESTIONS.filter(({ key }) => !hidden.has(key));
}

// Which questions stay open as steps for a context. Pure so the setup contract
// (preset → only relevant follow-ups) is testable without a DOM:
//   • a question the context already answers is never re-asked;
//   • with a preset, only its focus questions (plus questions revealed by later
//     answers, or reopened from Review) are steps;
//   • without a preset, every applicable unknown question is a step.
export function openQuestionKeys(answers = {}, preset = null, revealed = new Set(), forced = new Set()) {
  const open = applicableQuestions(answers)
    .filter(({ key }) => {
      if (forced.has(key)) return true;
      if (!answerIsUnknown(answers, key)) return false;
      if (!preset || preset.askEverything) return true;
      return preset.focus.includes(key) || revealed.has(key);
    })
    .map(({ key }) => key);
  if (!preset || preset.askEverything) return open;
  // The preset's focus order is the interview order (e.g. authentication mechanism
  // before delivery details); questions revealed by answers follow in catalog order.
  const focusOrder = new Map(preset.focus.map((key, index) => [key, index]));
  return open
    .map((key, index) => ({ key, index }))
    .sort((left, right) => {
      const lf = focusOrder.has(left.key) ? focusOrder.get(left.key) : Infinity;
      const rf = focusOrder.has(right.key) ? focusOrder.get(right.key) : Infinity;
      return lf !== rf ? lf - rf : left.index - right.index;
    })
    .map(({ key }) => key);
}

export function createWizard(root, initialState, callbacks = {}) {
  let state = initialState;
  let currentKey = 'engagement';
  // The applied assessment preset, if any. Progressively disclosed follow-ups come
  // from the preset's focus list plus questions revealed by earlier answers.
  let appliedPreset = matchAssessment(state.answers || {});
  let presetAdjusted = false;
  // A parsed API definition waiting for review (scope import).
  let scopeImport = null;
  // Questions that became relevant because of an earlier answer (e.g. login appears
  // → identity questions open up), or that the tester chose to revisit from Review.
  const extraSteps = new Set();
  const forcedSteps = new Set();

  const presetById = (id) => ASSESSMENT_LIST.find((preset) => preset.id === id) || null;

  const activeQuestions = () => applicableQuestions(state.answers);

  // A question is a step while it is open (unknown) AND the flow wants it asked:
  // preset focus / revealed by an answer / explicitly reopened / or no preset at all.
  // The preset's focus order decides the interview order.
  function openQuestions() {
    return openQuestionKeys(state.answers, appliedPreset, extraSteps, forcedSteps)
      .map((key) => QUESTIONS.find((question) => question.key === key))
      .filter(Boolean);
  }

  const stepKeys = () => ['engagement', ...openQuestionKeys(state.answers, appliedPreset, extraSteps, forcedSteps), 'review'];
  const currentIndex = () => Math.max(0, stepKeys().indexOf(currentKey));

  function updateState(patch) {
    state = { ...state, ...patch, updated_at: new Date().toISOString() };
    callbacks.onChange?.(state);
  }

  function updateAnswers(patch) {
    const before = new Set(activeQuestions().map(({ key }) => key));
    updateState({ answers: normalizeScopeAnswers({ ...state.answers, ...patch }) });
    // Each answer filters the next questions: newly relevant questions open up,
    // questions made irrelevant simply disappear from the remaining steps.
    for (const { key } of activeQuestions()) {
      if (!before.has(key) && answerIsUnknown(state.answers, key)) extraSteps.add(key);
    }
    const preset = appliedPreset;
    if (preset && Object.keys(patch).some((key) => !preset.focus.includes(key))) presetAdjusted = true;
  }

  function applyPreset(preset) {
    appliedPreset = preset;
    presetAdjusted = false;
    extraSteps.clear();
    forcedSteps.clear();
    updateState({ answers: normalizeScopeAnswers(structuredClone(preset.answers || {})) });
    const [first] = openQuestions();
    currentKey = first ? first.key : 'review';
    render(true);
  }

  function renderEngagement() {
    const hints = safeUrlHints(state.engagement.targetUrl);
    const selected = appliedPreset && !appliedPreset.askEverything ? appliedPreset : null;
    return `
      <div class="wizard-question" data-focus-region>
        <span class="wizard-step-id">STEP 1 / ASSESSMENT TYPE</span>
        <h2 tabindex="-1">What type of assessment are you performing?</h2>
        <p>Each preset already understands part of your target. It asks only the follow-up questions that matter for that scenario — everything else stays open to confirm later.</p>
        <div class="target-fields">
          <div class="field-group"><label for="engagement-name">Engagement name <span>(optional)</span></label><input id="engagement-name" name="engagement-name" autocomplete="off" maxlength="120" value="${escapeHtml(state.engagement.name)}" placeholder="Example: Acme customer portal"></div>
          <div class="field-group"><label for="target-url">Target URL <span>(optional)</span></label><input id="target-url" name="target-url" type="url" inputmode="url" autocomplete="off" maxlength="2048" value="${escapeHtml(state.engagement.targetUrl)}" placeholder="https://app.example.com"><small>Stored only in <code>wapt.state.v1</code> on this device.</small></div>
        </div>
        <ul class="hint-list" data-url-hints>${hints.map((hint) => `<li>${HINT_LABELS[hint]} · low confidence</li>`).join('')}</ul>
        <div class="scope-import">
          <button class="scope-import-button" type="button" data-scope-open>⤓ Import from API definition</button>
          <small>OpenAPI / Swagger JSON or a Postman collection — parsed on this device only, never uploaded. Proposes the matching follow-up answers for you to review.</small>
          <input type="file" accept="application/json,.json" data-scope-file hidden>
        </div>
        <div class="scope-import-result" data-scope-result hidden></div>
        <div class="preset-grid" aria-label="Assessment presets">${ASSESSMENT_LIST.map((preset) => {
          const pressed = selected?.id === preset.id || (preset.askEverything && appliedPreset?.askEverything);
          return `<button class="preset-card" type="button" data-preset="${preset.id}" aria-pressed="${pressed}"><em>${preset.askEverything ? 'BUILD FROM SCRATCH' : 'ASSESSMENT PRESET'}</em><strong>${preset.title}</strong><span>${preset.blurb}</span><i class="preset-glyph" aria-hidden="true">${preset.glyph || '◇'}</i></button>`;
        }).join('')}</div>
        ${selected ? `
        <div class="preset-context" data-preset-context>
          <p class="micro-label">INITIAL CONTEXT FROM THIS PRESET</p>
          <ul class="preset-assumptions">${selected.assumptions.map((line) => `<li>✓ ${escapeHtml(line)}</li>`).join('')}</ul>
          <p class="preset-note">Continue to answer only the relevant follow-up questions (${openQuestions().length} open). Discover something new during testing — a login endpoint, a hidden API, WebSocket, file downloads? Add it later with <strong>Edit context</strong>; completed progress is never lost.</p>
        </div>` : ''}
      </div>`;
  }

  function renderQuestion(question) {
    const value = state.answers[question.key];
    const selected = Array.isArray(value) ? value : [value];
    const impact = QUESTION_IMPACT[question.key] || [];
    const open = openQuestions();
    return `
      <fieldset class="wizard-question" data-question="${question.key}" data-focus-region>
        <legend class="sr-only">${question.title}</legend>
        <h2 tabindex="-1"><span class="wizard-step-id">FOLLOW-UP ${String(open.indexOf(question) + 1).padStart(2, '0')}/${String(open.length).padStart(2, '0')}</span>${question.title}</h2>
        <p>${question.description}</p>
        ${impact.length ? `<p class="wizard-impact"><span>SHAPES</span>${impact.map((area) => `<span class="chip">${area}</span>`).join('')}</p>` : ''}
        <div class="option-grid" role="${question.multi ? 'group' : 'radiogroup'}">${question.options.map(([optionValue, label, detail]) => `
          <label class="option-card" ${question.multi ? 'data-multi' : ''}>
            <input type="${question.multi ? 'checkbox' : 'radio'}" name="${question.key}" value="${optionValue}" ${selected.includes(optionValue) ? 'checked' : ''}>
            <span class="option-control" aria-hidden="true"></span>
            <span class="option-copy"><strong>${label}</strong><small>${detail}</small></span>
          </label>`).join('')}</div>
        ${question.key === 'role_types' ? renderRoleNames(selected) : ''}
      </fieldset>`;
  }

  // Name the real roles once the tiers are picked — the plan's cross-role matrix
  // and the exports use these names instead of generic tier labels.
  function renderRoleNames(selectedTiers) {
    const existing = new Map((state.engagement.role_model || []).map(({ name, tier }) => [tier, name]));
    const tiers = selectedTiers.filter((tier) => tier !== 'unknown' && tier !== 'none' && ROLE_DEFAULT_NAMES[tier]);
    if (!tiers.length) return '';
    const rows = tiers.map((tier) => `
      <label class="role-name-row"><span>${ROLE_DEFAULT_NAMES[tier]}${tier === 'custom' ? 's' : ''}</span>
        <input type="text" data-role-tier="${tier}" maxlength="48" value="${escapeHtml(existing.get(tier) || '')}" placeholder="Name on the target (optional)">
      </label>`).join('');
    return `
      <div class="role-name-editor" data-role-editor>
        <p class="micro-label">NAME THESE ROLES (OPTIONAL) — POWERS THE CROSS-ROLE MATRIX</p>
        <div class="role-name-grid">${rows}</div>
        <p class="preset-note">Example: Admin → Manager → Analyst. Use the labels real accounts use; the testing plan walks every direction of this ladder.</p>
      </div>`;
  }

  function renderReview() {
    const questions = activeQuestions();
    const known = questions.filter(({ key }) => !answerIsUnknown(state.answers, key));
    const toConfirm = questions.filter(({ key }) => answerIsUnknown(state.answers, key));
    const row = (question, answered) => `<div class="summary-row"><span>${question.title.replace('?', '')}</span><strong>${escapeHtml(displayValue(state.answers[question.key]))}<button class="summary-change" type="button" data-goto="${question.key}">${answered ? 'Change' : 'Answer'}</button></strong></div>`;
    const preset = appliedPreset && !appliedPreset.askEverything ? appliedPreset : null;
    return `
      <div class="wizard-question" data-focus-region>
        <span class="wizard-step-id">REVIEW / LOCAL-ONLY</span>
        <h2 tabindex="-1">Review your assessment context</h2>
        <p>${preset ? `Built from <strong>${escapeHtml(preset.title)}</strong>${presetAdjusted ? ' (customized)' : ''}. ` : ''}Start testing opens every matching category for this application. Anything left as “unknown” widens the plan so nothing important is missed — you can confirm it later from the dashboard with <strong>Edit context</strong> without losing progress.</p>
        <div class="wizard-summary">
          <div>
            <div class="summary-context">
              <div class="summary-row"><span>Engagement</span><strong>${escapeHtml(state.engagement.name || 'Unnamed')}</strong></div>
              <div class="summary-row"><span>Target</span><strong>${escapeHtml(state.engagement.targetUrl || 'Not provided')}</strong></div>
              ${known.map((question) => row(question, true)).join('')}
            </div>
            ${toConfirm.length ? `<div class="summary-context summary-toconfirm"><p class="micro-label">TO CONFIRM DURING TESTING — UNKNOWN WIDENS THE PLAN</p>${toConfirm.map((question) => row(question, false)).join('')}</div>` : ''}
          </div>
          <div><div class="summary-message"><strong>Saved locally for you to resume.</strong><p>This engagement, its progress, findings, and notes are stored under <code>wapt.state.v1</code> on this browser and origin only — no account, cloud sync, target request, or telemetry. Export JSON regularly and treat exports as sensitive. Unknown answers deliberately widen the checklist.</p></div></div>
        </div>
      </div>`;
  }

  function attachEvents() {
    root.querySelector('[data-wizard-back]')?.addEventListener('click', () => navigate(-1));
    root.querySelector('[data-wizard-next]')?.addEventListener('click', () => navigate(1));
    root.querySelector('[data-wizard-skip]')?.addEventListener('click', () => {
      const question = QUESTIONS.find(({ key }) => key === currentKey);
      if (question) updateAnswers({ [question.key]: question.multi ? [UNKNOWN] : UNKNOWN });
      forcedSteps.delete(currentKey);
      navigate(1);
    });
    root.querySelector('[data-wizard-finish]')?.addEventListener('click', () => {
      updateState({ engagement: { ...state.engagement, started_at: state.engagement.started_at || new Date().toISOString() } });
      callbacks.onComplete?.(state);
    });

    root.querySelector('#engagement-name')?.addEventListener('input', (event) => {
      updateState({ engagement: { ...state.engagement, name: event.target.value } });
    });
    root.querySelector('#target-url')?.addEventListener('input', (event) => {
      updateState({ engagement: { ...state.engagement, targetUrl: event.target.value } });
      const hints = safeUrlHints(event.target.value);
      const list = root.querySelector('[data-url-hints]');
      list.replaceChildren(...hints.map((hint) => {
        const item = document.createElement('li');
        item.textContent = `${HINT_LABELS[hint]} · low confidence`;
        return item;
      }));
    });
    root.querySelector('[data-scope-open]')?.addEventListener('click', () => root.querySelector('[data-scope-file]')?.click());
    root.querySelector('[data-scope-file]')?.addEventListener('change', async (event) => {
      const panel = root.querySelector('[data-scope-result]');
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !panel) return;
      let parsed;
      try { parsed = importScope(JSON.parse(await file.text())); }
      catch { parsed = { ok: false, error: 'The file is not valid JSON.' }; }
      if (!parsed.ok) {
        panel.hidden = false;
        panel.className = 'scope-import-result scope-import-error';
        panel.innerHTML = `<p><strong>Could not import.</strong> ${escapeHtml(parsed.error)}</p>`;
        return;
      }
      scopeImport = parsed;
      panel.hidden = false;
      panel.className = 'scope-import-result';
      panel.innerHTML = `
        <p class="micro-label">PROPOSED CONTEXT FROM ${escapeHtml(parsed.meta.kind.toLocaleUpperCase('en-US'))}</p>
        <p class="scope-import-title"><strong>${escapeHtml(parsed.meta.title || file.name)}</strong>${parsed.meta.version ? ` <span>· ${escapeHtml(parsed.meta.version)}</span>` : ''} <span>· ${parsed.meta.endpoints} paths · ${parsed.meta.operations} operations</span></p>
        <ul class="preset-assumptions">${parsed.meta.detections.map((line) => `<li>✓ ${escapeHtml(line)}</li>`).join('')}</ul>
        <p class="preset-note">Review the proposal — Continue applies it to the open questions; anything you answer yourself always wins later.</p>
        <div class="scope-import-actions"><button class="button button-primary" type="button" data-scope-apply>Apply to assessment →</button><button class="button button-quiet" type="button" data-scope-dismiss>Dismiss</button></div>`;
      root.querySelector('[data-scope-apply]')?.addEventListener('click', () => {
        if (!scopeImport) return;
        appliedPreset = appliedPreset && !appliedPreset.askEverything ? appliedPreset : null;
        presetAdjusted = true;
        updateState({
          answers: normalizeScopeAnswers({ ...state.answers, ...scopeImport.answers }),
          engagement: { ...state.engagement, name: state.engagement.name.trim() || scopeImport.meta.title || '' }
        });
        panel.hidden = true;
        scopeImport = null;
        render(false);
      });
      root.querySelector('[data-scope-dismiss]')?.addEventListener('click', () => {
        panel.hidden = true;
        scopeImport = null;
      });
    });
    root.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => {
      const preset = presetById(button.dataset.preset);
      if (preset) applyPreset(preset);
    }));
    root.querySelectorAll('[data-role-editor] input[data-role-tier]').forEach((input) => input.addEventListener('input', () => {
      const roleModel = [...root.querySelectorAll('[data-role-editor] input[data-role-tier]')]
        .map((node) => ({ tier: node.dataset.roleTier, name: node.value }))
        .filter(({ name }) => name.trim());
      updateState({ engagement: { ...state.engagement, role_model: roleModel } });
    }));
    root.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.goto;
      if (!QUESTIONS.some(({ key: candidate }) => candidate === key)) return;
      forcedSteps.add(key);
      currentKey = key;
      render(true);
    }));
    root.querySelectorAll('.option-card input').forEach((input) => input.addEventListener('change', (event) => {
      const question = QUESTIONS.find(({ key }) => key === currentKey);
      if (!question) return;
      if (!question.multi) {
        updateAnswers({ [question.key]: event.target.value });
      } else {
        const inputs = [...root.querySelectorAll(`input[name="${question.key}"]`)];
        const exclusiveValues = new Set([UNKNOWN, 'none']);
        if (exclusiveValues.has(event.target.value) && event.target.checked) {
          inputs.forEach((candidate) => { candidate.checked = candidate === event.target; });
        } else if (event.target.checked) {
          inputs.filter((candidate) => exclusiveValues.has(candidate.value)).forEach((candidate) => { candidate.checked = false; });
        }
        let values = inputs.filter(({ checked }) => checked).map(({ value: option }) => option);
        if (!values.length) values = [UNKNOWN];
        updateAnswers({ [question.key]: values });
        // Role tiers change the name editor below the options — repaint so it
        // appears, grows, or clears with the selection. The step stays pinned:
        // an answered question drops out of the open list, but the tester is
        // still working on it.
        if (question.key === 'role_types') {
          forcedSteps.add('role_types');
          render(false);
        }
      }
      // Answering the question closes it; Move on to the next open question.
      if (!question.multi) {
        forcedSteps.delete(question.key);
        setTimeout(() => navigate(1), 120);
      }
    }));
    root.querySelector('.option-grid')?.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
      const options = [...root.querySelectorAll('.option-card input')];
      const index = options.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
      options[(index + direction + options.length) % options.length].focus();
    });
  }

  function navigate(direction) {
    forcedSteps.delete(currentKey);
    const keys = stepKeys();
    const next = Math.max(0, Math.min(keys.length - 1, currentIndex() + direction));
    currentKey = keys[next];
    render(true);
  }

  function render(manageFocus = false) {
    const keys = stepKeys();
    if (!keys.includes(currentKey)) {
      // The question the tester was on may have closed; continue from the nearest step.
      const fallback = keys.findIndex((key) => key === 'review');
      currentKey = keys[Math.max(0, fallback - 1)] || 'review';
    }
    const index = currentIndex();
    const question = QUESTIONS.find(({ key }) => key === currentKey);
    const content = currentKey === 'engagement' ? renderEngagement() : currentKey === 'review' ? renderReview() : renderQuestion(question);
    const isLast = currentKey === 'review';
    const preset = appliedPreset && !appliedPreset.askEverything ? appliedPreset : null;
    const sectionLabel = currentKey === 'engagement' ? 'ASSESSMENT' : currentKey === 'review' ? 'REVIEW' : QUESTION_SECTIONS[currentKey] || 'SCOPE';
    root.innerHTML = `
      <div class="wizard-progress" aria-hidden="true"><progress max="100" value="${Math.round((index / (keys.length - 1)) * 100)}"></progress></div>
      <div class="wizard-meta"><span><span class="wizard-meta-section">${sectionLabel}</span> · STEP ${String(index + 1).padStart(2, '0')} OF ${String(keys.length).padStart(2, '0')}${preset ? ` · ${escapeHtml(preset.title.toLocaleUpperCase('en-US'))}` : ''}</span><span>${Math.round((index / (keys.length - 1)) * 100)}% scoped</span></div>
      <div class="wizard-body">${content}</div>
      <div class="wizard-footer"><button class="button button-quiet" type="button" data-wizard-back ${index === 0 ? 'disabled' : ''}>← Back</button><div class="wizard-footer-actions">${question ? '<button class="wizard-skip" type="button" data-wizard-skip>Not confirmed yet</button>' : ''}${isLast ? '<button class="button button-primary" type="button" data-wizard-finish>Start testing →</button>' : '<button class="button button-primary" type="button" data-wizard-next>Continue →</button>'}</div></div>`;
    attachEvents();
    if (manageFocus) {
      const heading = root.querySelector('[data-focus-region] h2');
      heading?.focus({ preventScroll: true });
      const anchor = root.getBoundingClientRect?.().top ?? 0;
      if (typeof window !== 'undefined' && anchor < 0) window.scrollTo({ top: Math.max(0, window.scrollY + anchor - 12), behavior: 'auto' });
    }
  }

  function reset(nextState) {
    state = nextState;
    currentKey = 'engagement';
    appliedPreset = matchAssessment(state.answers || {});
    presetAdjusted = false;
    extraSteps.clear();
    forcedSteps.clear();
    render(true);
  }

  render(false);
  return { reset, getState: () => state, getCurrentKey: () => currentKey };
}
