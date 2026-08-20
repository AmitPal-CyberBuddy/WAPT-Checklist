import { PRESET_LIST } from '../data/presets.mjs?v=1.0.0-r8';
import { deriveUrlHints, normalizeScopeAnswers } from '../engine/context.js?v=1.0.0-r8';

const UNKNOWN = 'unknown';

export const QUESTIONS = Object.freeze([
  { key: 'mode', title: 'What assessment mode are you using?', description: 'This shapes how much implementation knowledge and internal evidence the plan can assume.', options: [['black_box', 'Black-box', 'External behavior only'], ['grey_box', 'Grey-box', 'Limited knowledge or test access'], ['white_box', 'White-box', 'Source, configuration, and implementation access'], [UNKNOWN, 'Not confirmed yet', 'Keep mode-dependent work visible']] },
  { key: 'app_type', title: 'How is the application delivered?', description: 'Choose the closest architecture; API-only prevents browser-runtime checks from being suggested for a service without a first-party web interface.', options: [['server_rendered', 'Server-rendered', 'HTML primarily composed by the server'], ['spa', 'Single-page application', 'Client-rendered application shell backed by services'], ['static', 'Static site', 'Published files with no first-party runtime backend'], ['hybrid', 'Hybrid web application', 'Mixed server and client rendering or micro-frontends'], ['api_only', 'API-only service', 'No first-party browser interface; REST, GraphQL, SOAP, gRPC, or realtime clients'], [UNKNOWN, 'Not confirmed yet', 'Retain all delivery variants']] },
  { key: 'has_login', title: 'Is any user authentication flow present?', description: 'Include forms, identity-provider redirects, API login, passkeys, magic links, and authenticated client applications.', options: [['yes', 'Yes', 'At least one authentication flow is in scope'], ['no', 'No authentication', 'The scoped surface has no user identity flow'], [UNKNOWN, 'Not confirmed yet', 'Confirm during reconnaissance']] },
  { key: 'creds', title: 'What test-account access is available?', description: 'Choose the best available coverage. Missing authenticated access stays visible as blocked roadmap work.', options: [['none', 'No test account', 'Unauthenticated coverage only'], ['low', 'One role / standard user', 'At least one ordinary authenticated context'], ['high', 'Multiple or privileged roles', 'Cross-role and vertical authorization coverage'], [UNKNOWN, 'Not confirmed yet', 'Account access is still being arranged']] },
  { key: 'registration', title: 'How are user accounts created?', description: 'Account creation affects verification, invitation, enrollment, and abuse paths.', options: [['yes', 'Open or self-service', 'A user can begin signup or enrollment'], ['no', 'Invite or administrator provisioned', 'No open self-registration path'], [UNKNOWN, 'Not confirmed yet', 'Account creation behavior is unclear']] },
  { key: 'roles', title: 'How complex is the role and permission model?', description: 'Include application roles, groups, tenant roles, service identities, and delegated permissions.', options: [['none', 'No authenticated roles', 'No user identity or privilege tier is in scope'], ['one', 'One role', 'A single authenticated privilege tier'], ['few', '2–3 roles', 'A small role hierarchy'], ['many', 'Many / granular permissions', 'RBAC, ABAC, groups, or complex permissions'], [UNKNOWN, 'Not confirmed yet', 'Map roles during testing']] },
  { key: 'auth_mechanism', title: 'Which authentication mechanisms are used?', description: 'Select every confirmed mechanism; “mixed / other” covers passkeys, magic links, API keys, HTTP auth, or custom identity.', multi: true, options: [['none', 'None', 'No authentication mechanism in scope'], ['cookie', 'Cookie sessions', 'Browser ambient session cookies'], ['jwt', 'JWT / bearer tokens', 'JSON Web Tokens or similar bearer flows'], ['oauth', 'OAuth 2.0 / OpenID Connect', 'Delegated authorization or OIDC SSO'], ['saml', 'SAML', 'SAML-based federation'], ['ldap', 'Directory-backed', 'LDAP or enterprise directory authentication'], ['mixed', 'Mixed / other', 'Passkeys, magic links, API keys, HTTP auth, or custom mechanisms'], [UNKNOWN, 'Not confirmed yet', 'Keep identity-specific groups available']] },
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

function safeUrlHints(raw) {
  const derived = deriveUrlHints(raw);
  return Object.entries(derived.hints).filter(([, enabled]) => enabled).map(([key]) => key);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.map((entry) => entry.replaceAll('_', ' ')).join(', ');
  return String(value || UNKNOWN).replaceAll('_', ' ');
}

export function applicableQuestions(answers = {}) {
  const loginRelevant = answers.has_login !== 'no';
  const apiStyles = Array.isArray(answers.api_style) ? answers.api_style : [UNKNOWN];
  const apiRelevant = !apiStyles.includes('none');
  const runtimeRelevant = answers.app_type !== 'static' || apiRelevant;
  const hidden = new Set();
  if (!loginRelevant) ['creds', 'registration', 'roles', 'auth_mechanism', 'identity_features'].forEach((key) => hidden.add(key));
  if (!apiRelevant) hidden.add('api_docs');
  if (!runtimeRelevant) ['backend', 'database', 'outbound_fetch', 'async_jobs'].forEach((key) => hidden.add(key));
  if (answers.mode === 'black_box') hidden.add('source_access');
  return QUESTIONS.filter(({ key }) => !hidden.has(key));
}

export function createWizard(root, initialState, callbacks = {}) {
  let state = initialState;
  let currentKey = 'engagement';
  let selectedPreset = null;

  const activeQuestions = () => applicableQuestions(state.answers);
  const stepKeys = () => ['engagement', ...activeQuestions().map(({ key }) => key), 'review'];
  const currentIndex = () => Math.max(0, stepKeys().indexOf(currentKey));

  function updateState(patch) {
    state = { ...state, ...patch, updated_at: new Date().toISOString() };
    callbacks.onChange?.(state);
  }

  function updateAnswers(patch) {
    updateState({ answers: normalizeScopeAnswers({ ...state.answers, ...patch }) });
  }

  function renderEngagement() {
    const hints = safeUrlHints(state.engagement.targetUrl);
    return `
      <div class="wizard-question" data-focus-region>
        <span class="wizard-step-id">TARGET / OPTIONAL</span>
        <h2 tabindex="-1">Name the engagement and add a target</h2>
        <p>The target URL is parsed locally for a small set of low-confidence suggestions. The application never requests or transmits it.</p>
        <div class="target-fields">
          <div class="field-group"><label for="engagement-name">Engagement name</label><input id="engagement-name" name="engagement-name" autocomplete="off" maxlength="120" value="${escapeHtml(state.engagement.name)}" placeholder="Example: Acme customer portal"><small>A label for your local workspace and exports.</small></div>
          <div class="field-group"><label for="target-url">Target URL</label><input id="target-url" name="target-url" type="url" inputmode="url" autocomplete="off" maxlength="2048" value="${escapeHtml(state.engagement.targetUrl)}" placeholder="https://app.example.com"><small>Stored only in <code>wapt.state.v1</code> on this device.</small></div>
        </div>
        <ul class="hint-list" data-url-hints>${hints.map((hint) => `<li>${HINT_LABELS[hint]} · low confidence</li>`).join('')}</ul>
        <p class="preset-heading">QUICK-START PRESETS — APPLY, THEN EDIT</p>
        <div class="preset-grid">${PRESET_LIST.map((preset) => `<button class="preset-card" type="button" data-preset="${preset.id}" aria-pressed="${preset.id === selectedPreset}"><em>PRESET</em><strong>${preset.title}</strong><span>${preset.description}</span></button>`).join('')}</div>
      </div>`;
  }

  function renderQuestion(question) {
    const value = state.answers[question.key];
    const selected = Array.isArray(value) ? value : [value];
    return `
      <fieldset class="wizard-question" data-question="${question.key}" data-focus-region>
        <legend class="sr-only">${question.title}</legend>
        <h2 tabindex="-1"><span class="wizard-step-id">SCOPE ${String(activeQuestions().indexOf(question) + 1).padStart(2, '0')}/${String(activeQuestions().length).padStart(2, '0')}</span>${question.title}</h2>
        <p>${question.description}</p>
        <div class="option-grid" role="${question.multi ? 'group' : 'radiogroup'}">${question.options.map(([optionValue, label, detail]) => `
          <label class="option-card" ${question.multi ? 'data-multi' : ''}>
            <input type="${question.multi ? 'checkbox' : 'radio'}" name="${question.key}" value="${optionValue}" ${selected.includes(optionValue) ? 'checked' : ''}>
            <span class="option-control" aria-hidden="true"></span>
            <span class="option-copy"><strong>${label}</strong><small>${detail}</small></span>
          </label>`).join('')}</div>
      </fieldset>`;
  }

  function renderReview() {
    const rows = activeQuestions().map((question) => `<div class="summary-row"><span>${question.title.replace('?', '')}</span><strong>${escapeHtml(displayValue(state.answers[question.key]))}</strong></div>`).join('');
    return `
      <div class="wizard-question" data-focus-region>
        <span class="wizard-step-id">REVIEW / LOCAL-ONLY</span>
        <h2 tabindex="-1">Review your assessment context</h2>
        <p>Start testing opens every matching surface for this application — not one page type. You can share that plan as a link (scope only, no findings).</p>
        <div class="wizard-summary">
          <div class="summary-context">
            <div class="summary-row"><span>Engagement</span><strong>${escapeHtml(state.engagement.name || 'Unnamed')}</strong></div>
            <div class="summary-row"><span>Target</span><strong>${escapeHtml(state.engagement.targetUrl || 'Not provided')}</strong></div>${rows}
          </div>
          <div><div class="summary-message"><strong>Saved locally for you to resume.</strong><p>This engagement, its progress, findings, and notes are stored under <code>wapt.state.v1</code> on this browser and origin only — no account, cloud sync, target request, or telemetry. Private browsing, cleanup tools, or a different origin can remove or isolate it, so export JSON regularly and treat exports as sensitive. Unknown answers deliberately widen the checklist.</p></div></div>
        </div>
      </div>`;
  }

  function attachEvents() {
    root.querySelector('[data-wizard-back]')?.addEventListener('click', () => navigate(-1));
    root.querySelector('[data-wizard-next]')?.addEventListener('click', () => navigate(1));
    root.querySelector('[data-wizard-skip]')?.addEventListener('click', () => {
      const question = QUESTIONS.find(({ key }) => key === currentKey);
      if (question) updateAnswers({ [question.key]: question.multi ? [UNKNOWN] : UNKNOWN });
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
    root.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => {
      const preset = PRESET_LIST.find(({ id }) => id === button.dataset.preset);
      selectedPreset = preset.id;
      updateState({ answers: normalizeScopeAnswers(structuredClone(preset.answers)) });
      render(false);
    }));
    root.querySelectorAll('.option-card input').forEach((input) => input.addEventListener('change', (event) => {
      const question = QUESTIONS.find(({ key }) => key === currentKey);
      selectedPreset = null;
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
    const keys = stepKeys();
    const next = Math.max(0, Math.min(keys.length - 1, currentIndex() + direction));
    currentKey = keys[next];
    render(true);
  }

  function render(manageFocus = false) {
    const keys = stepKeys();
    if (!keys.includes(currentKey)) currentKey = 'app_type';
    const index = currentIndex();
    const question = QUESTIONS.find(({ key }) => key === currentKey);
    const content = currentKey === 'engagement' ? renderEngagement() : currentKey === 'review' ? renderReview() : renderQuestion(question);
    const isLast = currentKey === 'review';
    root.innerHTML = `
      <div class="wizard-progress" aria-hidden="true"><progress max="100" value="${Math.round((index / (keys.length - 1)) * 100)}"></progress></div>
      <div class="wizard-meta"><span>STEP ${String(index + 1).padStart(2, '0')} OF ${String(keys.length).padStart(2, '0')}</span><span>${Math.round((index / (keys.length - 1)) * 100)}% scoped</span></div>
      <div class="wizard-body">${content}</div>
      <div class="wizard-footer"><button class="button button-quiet" type="button" data-wizard-back ${index === 0 ? 'disabled' : ''}>← Back</button><div class="wizard-footer-actions">${question ? '<button class="wizard-skip" type="button" data-wizard-skip>Use Unknown</button>' : ''}${isLast ? '<button class="button button-primary" type="button" data-wizard-finish>Start testing →</button>' : '<button class="button button-primary" type="button" data-wizard-next>Continue →</button>'}</div></div>`;
    attachEvents();
    if (manageFocus) {
      // Land on the question, not wherever the previous (possibly longer) step was scrolled to.
      const heading = root.querySelector('[data-focus-region] h2');
      heading?.focus({ preventScroll: true });
      const anchor = root.getBoundingClientRect?.().top ?? 0;
      if (typeof window !== 'undefined' && anchor < 0) window.scrollTo({ top: Math.max(0, window.scrollY + anchor - 12), behavior: 'auto' });
    }
  }

  function reset(nextState) {
    state = nextState;
    currentKey = 'engagement';
    selectedPreset = null;
    render(true);
  }

  render(false);
  return { reset, getState: () => state, getCurrentKey: () => currentKey };
}
