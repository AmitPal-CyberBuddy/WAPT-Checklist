import { PRESET_LIST } from '../data/presets.mjs?v=0.5.0';
import { deriveUrlHints } from '../engine/context.js?v=0.5.0';

const UNKNOWN = 'unknown';

export const QUESTIONS = Object.freeze([
  { key: 'mode', title: 'What assessment mode are you using?', description: 'This shapes how much implementation knowledge and internal evidence the plan can assume.', options: [['black_box', 'Black-box', 'External behavior only'], ['grey_box', 'Grey-box', 'Limited knowledge or test access'], ['white_box', 'White-box', 'Source and implementation access'], [UNKNOWN, 'Unknown', 'Keep every mode-dependent test visible']] },
  { key: 'creds', title: 'Which credentials are available?', description: 'Authenticated checks remain visible when no credentials are available, but are marked as blocked roadmap work.', options: [['none', 'None', 'Unauthenticated coverage only'], ['low', 'Low-privilege only', 'One standard user context'], ['high', 'Multiple roles', 'Low and high privilege accounts'], [UNKNOWN, 'Unknown', 'Confirm access during the engagement']] },
  { key: 'app_type', title: 'How is the application delivered?', description: 'Delivery style changes the balance between server, browser, identity, and workflow checks.', options: [['server_rendered', 'Server-rendered', 'HTML primarily composed by the server'], ['spa', 'Single-page application', 'Client-rendered application shell'], ['static', 'Static site', 'No dynamic server application'], ['hybrid', 'Hybrid', 'Mixed server and client rendering'], [UNKNOWN, 'Unknown', 'Retain all delivery variants']] },
  { key: 'has_login', title: 'Is a login page or authentication flow present?', description: 'This can be a form, redirect to an identity provider, passkey flow, or API-based login.', options: [['yes', 'Yes', 'An authentication flow is in scope'], ['no', 'No', 'No user login was identified'], [UNKNOWN, 'Unknown', 'Confirm during reconnaissance']] },
  { key: 'registration', title: 'Can users register openly?', description: 'Registration introduces account creation, verification, invitation, and abuse cases.', options: [['yes', 'Yes', 'Anyone can begin registration'], ['no', 'No', 'Accounts are provisioned or invited'], [UNKNOWN, 'Unknown', 'Registration behavior is not confirmed']] },
  { key: 'roles', title: 'How many user roles or privilege tiers exist?', description: 'Larger role models boost authorization matrices and vertical access checks.', options: [['one', 'One role', 'A single authenticated privilege tier'], ['few', '2–3 roles', 'A small role hierarchy'], ['many', 'Many / RBAC', 'Complex roles, groups, or permissions'], [UNKNOWN, 'Unknown', 'Map roles during testing']] },
  { key: 'auth_mechanism', title: 'Which authentication mechanisms are used?', description: 'Select every confirmed mechanism. Mixed identity paths often need separate session and federation variants.', multi: true, options: [['cookie', 'Cookie sessions', 'Browser ambient session cookies'], ['jwt', 'JWT', 'JSON Web Tokens'], ['oauth', 'OAuth2 / SSO', 'OAuth 2.0 or OpenID Connect'], ['saml', 'SAML', 'SAML-based federation'], ['ldap', 'LDAP', 'Directory-backed authentication'], ['mixed', 'Mixed / other', 'Multiple or custom mechanisms'], [UNKNOWN, 'Unknown', 'Keep identity-specific groups available']] },
  { key: 'api_docs', title: 'Is API documentation available?', description: 'Documentation can accelerate inventory work and may itself be unintentionally exposed.', options: [['openapi', 'OpenAPI / Swagger', 'A schema or interactive documentation exists'], ['none', 'None identified', 'No API schema is available'], [UNKNOWN, 'Unknown', 'Confirm while mapping the attack surface']] },
  { key: 'source_access', title: 'How much source access is available?', description: 'Source access enables targeted review for secrets, debug paths, dangerous APIs, and control placement.', options: [['full', 'Full', 'Complete relevant source and configuration'], ['partial', 'Partial', 'Selected modules or build artifacts'], ['none', 'None', 'Runtime testing only'], [UNKNOWN, 'Unknown', 'Access is not yet confirmed']] },
  { key: 'backend', title: 'Which backend stacks are in scope?', description: 'Stack hints enable relevant serialization, expression-language, template, and framework checks.', multi: true, options: [['node', 'Node.js', 'JavaScript / TypeScript services'], ['java', 'Java', 'JVM frameworks and services'], ['dotnet', '.NET', 'ASP.NET and CLR services'], ['python', 'Python', 'Python frameworks and workers'], ['php', 'PHP', 'PHP applications and frameworks'], ['ruby', 'Ruby', 'Ruby applications and frameworks'], ['go', 'Go', 'Go services'], [UNKNOWN, 'Unknown', 'Fingerprint conservatively']] },
  { key: 'api_style', title: 'Which API or real-time styles are present?', description: 'Only selected protocol groups become active; unknown keeps discovery and confirmation work visible.', multi: true, options: [['rest', 'REST / HTTP API', 'Resource or RPC-style HTTP endpoints'], ['graphql', 'GraphQL', 'GraphQL queries and mutations'], ['soap', 'SOAP', 'XML envelopes and WSDL'], ['websocket', 'WebSocket', 'Persistent bidirectional messages'], ['grpc', 'gRPC', 'Protocol Buffer services'], ['none', 'None', 'No application API identified'], [UNKNOWN, 'Unknown', 'Discover protocols during mapping']] },
  { key: 'database', title: 'Which data layers are used?', description: 'Data-layer context focuses injection methodology without assuming every parameter reaches every interpreter.', multi: true, options: [['sql', 'SQL', 'Relational database queries'], ['nosql', 'NoSQL', 'Document, key-value, or graph queries'], ['ldap', 'LDAP', 'Directory queries or filters'], ['none', 'None', 'No dynamic application data layer'], [UNKNOWN, 'Unknown', 'Retain broad injection discovery']] },
  { key: 'cloud', title: 'Where is the application hosted?', description: 'Cloud context selects provider-specific storage, signed URL, workload identity, and metadata checks.', options: [['aws', 'AWS', 'Amazon Web Services'], ['gcp', 'GCP', 'Google Cloud Platform'], ['azure', 'Azure', 'Microsoft Azure'], ['self_hosted', 'Self-hosted', 'Private or traditional infrastructure'], ['none', 'None / not relevant', 'No cloud-specific surface'], [UNKNOWN, 'Unknown', 'Provider is not confirmed']] },
  { key: 'features', title: 'Which security-relevant features are in scope?', description: 'Feature selection activates workflow checks such as upload handling, tenant isolation, payment integrity, and messaging abuse.', multi: true, options: [['file_upload', 'File upload', 'User-controlled file handling'], ['payments', 'Payments', 'Price, checkout, coupon, or settlement'], ['search', 'Search', 'Queries, indexing, and resource abuse'], ['email', 'Email', 'Invitations, notifications, and address workflows'], ['chat', 'Chat / messaging', 'User-to-user content and delivery'], ['multi_tenant', 'Multi-tenant', 'Strong tenant data boundaries'], ['mobile_api', 'Mobile API backend', 'APIs consumed by mobile clients'], [UNKNOWN, 'Unknown', 'Discover features during mapping']] }
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

export function createWizard(root, initialState, callbacks = {}) {
  let state = initialState;
  let currentKey = 'engagement';
  let selectedPreset = null;

  const activeQuestions = () => QUESTIONS.filter((question) => !(question.key === 'creds' && state.answers.mode === 'white_box'));
  const stepKeys = () => ['engagement', ...activeQuestions().map(({ key }) => key), 'review'];
  const currentIndex = () => Math.max(0, stepKeys().indexOf(currentKey));

  function updateState(patch) {
    state = { ...state, ...patch, updated_at: new Date().toISOString() };
    callbacks.onChange?.(state);
  }

  function updateAnswers(patch) {
    updateState({ answers: { ...state.answers, ...patch } });
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
        <span class="wizard-step-id">QUESTION ${String(QUESTIONS.indexOf(question) + 1).padStart(2, '0')} / 14</span>
        <h2 tabindex="-1">${question.title}</h2>
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
        <p>Completing scope keeps all existing item status and notes. You can rerun this wizard at any time.</p>
        <div class="wizard-summary">
          <div class="summary-context">
            <div class="summary-row"><span>Engagement</span><strong>${escapeHtml(state.engagement.name || 'Unnamed')}</strong></div>
            <div class="summary-row"><span>Target</span><strong>${escapeHtml(state.engagement.targetUrl || 'Not provided')}</strong></div>${rows}
          </div>
          <div><div class="summary-message"><strong>Nothing leaves this browser.</strong><p>This single engagement is saved under <code>wapt.state.v1</code>. There is no account, cloud sync, target request, or telemetry endpoint.</p></div><p class="completion-note">Unknown values deliberately widen the future active checklist and create “confirm applicability” prompts.</p></div>
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
      updateState({ answers: structuredClone(preset.answers) });
      render(false);
    }));
    root.querySelectorAll('.option-card input').forEach((input) => input.addEventListener('change', (event) => {
      const question = QUESTIONS.find(({ key }) => key === currentKey);
      selectedPreset = null;
      if (!question.multi) {
        updateAnswers({ [question.key]: event.target.value });
      } else {
        const inputs = [...root.querySelectorAll(`input[name="${question.key}"]`)];
        if (event.target.value === UNKNOWN && event.target.checked) {
          inputs.forEach((candidate) => { candidate.checked = candidate === event.target; });
        } else if (event.target.checked) {
          const unknown = inputs.find((candidate) => candidate.value === UNKNOWN);
          if (unknown) unknown.checked = false;
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
      <div class="wizard-footer"><button class="button button-quiet" type="button" data-wizard-back ${index === 0 ? 'disabled' : ''}>← Back</button><div class="wizard-footer-actions">${question ? '<button class="wizard-skip" type="button" data-wizard-skip>Use Unknown</button>' : ''}${isLast ? '<button class="button button-primary" type="button" data-wizard-finish>Save scope & open dashboard →</button>' : '<button class="button button-primary" type="button" data-wizard-next>Continue →</button>'}</div></div>`;
    attachEvents();
    if (manageFocus) root.querySelector('[data-focus-region] h2')?.focus();
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
