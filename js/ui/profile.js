// Assessment context editor: the dashboard's "Edit context" surface.
// The assessment preset flow (wizard) is the primary setup; this editor lets the
// tester evolve the same context as the target is learned — add a discovered auth
// mechanism, WebSocket, file upload, or role tier — while every status, note, and
// finding is preserved.
import { matchAssessment } from '../data/presets.mjs?v=1.0.0-r16';
import { importScope } from '../engine/scope-import.js?v=1.0.0-r16';
import { element } from './dom.js?v=1.0.0-r16';

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function optionButton(name, value, label, detail, checked, type = 'checkbox') {
  const wrap = element('label', `profile-option${checked ? ' is-on' : ''}`);
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrap.append(input);
  const copy = element('span', 'profile-option-copy');
  copy.append(element('strong', '', label));
  copy.append(element('small', '', detail));
  wrap.append(copy);
  return wrap;
}

// Direct answer-level groups. Unlike the old page/function picker, editing here
// changes only the attributes the tester touches — everything else carries over.
const CONTEXT_GROUPS = Object.freeze([
  {
    id: 'auth',
    legend: 'Authentication mechanisms',
    hint: 'Select every mechanism present — mixed stacks add each mechanism’s own categories.',
    fields: [
      { name: 'auth_mechanism', value: 'cookie', label: 'Cookie / session', detail: 'Browser ambient session cookies' },
      { name: 'auth_mechanism', value: 'jwt', label: 'JWT / bearer', detail: 'Tokens or similar bearer flows' },
      { name: 'auth_mechanism', value: 'oauth', label: 'OAuth / OIDC', detail: 'Delegated authorization or SSO' },
      { name: 'auth_mechanism', value: 'saml', label: 'SAML', detail: 'SAML federation' },
      { name: 'auth_mechanism', value: 'ldap', label: 'Directory / LDAP', detail: 'Enterprise directory sign-in' },
      { name: 'auth_mechanism', value: 'none', label: 'None', detail: 'No authentication in scope' }
    ]
  },
  {
    id: 'identity',
    legend: 'Identity capabilities',
    hint: 'MFA, recovery, and passkey checks appear only when selected.',
    fields: [
      { name: 'identity_features', value: 'password', label: 'Passwords', detail: 'Password sign-in or changes' },
      { name: 'identity_features', value: 'mfa', label: 'MFA / OTP', detail: 'Second factors or recovery codes' },
      { name: 'identity_features', value: 'passkey', label: 'Passkeys', detail: 'WebAuthn credentials' },
      { name: 'identity_features', value: 'recovery', label: 'Account recovery', detail: 'Reset, recovery, or unlock' },
      { name: 'identity_features', value: 'passwordless', label: 'Passwordless', detail: 'Magic links or one-time codes' },
      { name: 'identity_features', value: 'remember_device', label: 'Trusted devices', detail: 'MFA suppression / device trust' }
    ]
  },
  {
    id: 'interfaces',
    legend: 'APIs & realtime',
    hint: 'GraphQL, WebSocket, and SOAP each add their own testing categories.',
    fields: [
      { name: 'api_style', value: 'rest', label: 'HTTP / REST', detail: 'Resource or action endpoints' },
      { name: 'api_style', value: 'graphql', label: 'GraphQL', detail: 'Queries, mutations, subscriptions' },
      { name: 'api_style', value: 'soap', label: 'SOAP / XML', detail: 'WSDL or XML envelope services' },
      { name: 'api_style', value: 'websocket', label: 'WebSocket', detail: 'Persistent bidirectional channels' },
      { name: 'api_style', value: 'grpc', label: 'gRPC', detail: 'Protocol Buffer services' },
      { name: 'api_style', value: 'none', label: 'None', detail: 'No first-party API' }
    ]
  },
  {
    id: 'features',
    legend: 'Features & workflows',
    hint: 'File handling, payments, and AI features enable their dedicated suites.',
    fields: [
      { name: 'features', value: 'file_upload', label: 'File handling', detail: 'Upload, import, export, preview' },
      { name: 'features', value: 'payments', label: 'Payments', detail: 'Checkout, coupons, credits' },
      { name: 'features', value: 'search', label: 'Search', detail: 'Queries, filters, exports' },
      { name: 'features', value: 'email', label: 'Email messaging', detail: 'Invites, notifications, recovery' },
      { name: 'features', value: 'chat', label: 'Chat / user content', detail: 'User-to-user content' },
      { name: 'features', value: 'multi_tenant', label: 'Multi-tenant', detail: 'Strong tenant boundaries' },
      { name: 'features', value: 'mobile_api', label: 'Mobile / desktop API', detail: 'Non-browser clients' },
      { name: 'features', value: 'ai_llm', label: 'AI / LLM', detail: 'Prompts, retrieval, tool calls' },
      { name: 'features', value: 'none', label: 'None', detail: 'No listed workflow' }
    ]
  },
  {
    id: 'roles',
    legend: 'Roles & privilege tiers',
    hint: 'Multiple tiers enable the cross-role and privilege-escalation matrix.',
    fields: [
      { name: 'role_types', value: 'standard', label: 'Standard user', detail: 'Ordinary authenticated account' },
      { name: 'role_types', value: 'privileged', label: 'Privileged user', detail: 'Manager or elevated tier' },
      { name: 'role_types', value: 'admin', label: 'Administrator', detail: 'Full administrative access' },
      { name: 'role_types', value: 'support', label: 'Support / internal', detail: 'Staff or helpdesk access' },
      { name: 'role_types', value: 'custom', label: 'Custom roles', detail: 'Named or tenant-specific tiers' }
    ]
  }
]);

const ROLE_CHOICES = Object.freeze([['none', 'No roles'], ['one', 'One role'], ['few', '2–3 roles'], ['many', 'Many / granular'], ['unknown', 'Not confirmed']]);

function contextChips(answers = {}) {
  const chips = [];
  const auth = list(answers.auth_mechanism).filter((value) => value !== 'unknown');
  for (const value of auth) chips.push(value === 'none' ? 'No authentication' : `${value} auth`.replace('oauth auth', 'OAuth/SSO').replace('jwt auth', 'JWT').replace('cookie auth', 'cookie sessions').replace('saml auth', 'SAML').replace('ldap auth', 'LDAP'));
  const api = list(answers.api_style).filter((value) => value !== 'none' && value !== 'unknown');
  for (const value of api) chips.push(value.toUpperCase());
  const roles = answers.roles;
  if (roles && roles !== 'none' && roles !== 'unknown') chips.push(roles === 'many' ? 'many roles' : `${roles} roles`);
  const features = list(answers.features).filter((value) => value !== 'none' && value !== 'unknown');
  for (const value of features) chips.push(String(value).replaceAll('_', ' '));
  return [...new Set(chips)];
}

export function renderProfile(root, context) {
  const { answers = {}, engagement = {}, onApply, playbooks = [], currentSurface, onSurfaceSelect } = context;
  root.replaceChildren();
  const assessment = matchAssessment(answers);
  const chips = contextChips(answers);

  const shell = element('section', 'surface-context');
  shell.dataset.appProfile = 'true';
  const picker = element('details', 'surface-picker');
  picker.dataset.contextEditor = 'true';
  const summary = element('summary', 'surface-picker-summary');
  const summaryCopy = element('span');
  summaryCopy.append(element('span', 'micro-label', assessment ? 'ASSESSMENT CONTEXT' : 'START HERE'));
  summaryCopy.append(element('strong', '', assessment?.title || 'Set up your assessment'));
  summaryCopy.append(element('small', '', chips.length ? chips.slice(0, 6).join(' · ') : 'Pick an assessment scenario, then refine it as you learn the target.'));
  summary.append(summaryCopy, element('span', 'surface-picker-action', assessment ? 'Edit context' : 'Set up'));
  picker.append(summary);

  const body = element('div', 'surface-picker-body');
  const target = element('div', 'app-profile-target');
  const urlLabel = element('label', 'field-group');
  urlLabel.append(element('span', '', 'Target URL'));
  const url = document.createElement('input');
  url.type = 'url';
  url.placeholder = 'https://www.example.com';
  url.value = engagement.targetUrl || '';
  url.maxLength = 2048;
  url.autocomplete = 'off';
  url.name = 'profile-url';
  urlLabel.append(url);
  target.append(urlLabel);
  const nameLabel = element('label', 'field-group');
  nameLabel.append(element('span', '', 'Engagement name'));
  const name = document.createElement('input');
  name.type = 'text';
  name.placeholder = 'Example: Acme public site';
  name.value = engagement.name || '';
  name.maxLength = 120;
  name.autocomplete = 'off';
  name.name = 'profile-name';
  nameLabel.append(name);
  target.append(nameLabel);
  body.append(target);

  const head = element('div', 'surface-question');
  head.append(element('p', 'micro-label', 'EDIT ASSESSMENT CONTEXT'));
  head.append(element('h2', '', 'What applies to this target?'));
  head.append(element('p', '', 'Change anything you have learned — a new mechanism, API, upload, or role tier expands the plan automatically. Completed tests, findings, and notes are always preserved.'));
  body.append(head);

  const importRow = element('div', 'scope-import compact');
  const importOpen = element('button', 'scope-import-button', '⤓ Import from API definition');
  importOpen.type = 'button';
  importOpen.dataset.scopeOpen = 'true';
  const importHint = element('small', '', 'OpenAPI / Swagger JSON or Postman collection — parsed locally; ticks the matching boxes for you to review.');
  const importFile = document.createElement('input');
  importFile.type = 'file';
  importFile.accept = 'application/json,.json';
  importFile.hidden = true;
  importFile.dataset.scopeFile = 'true';
  importRow.append(importOpen, importHint, importFile);
  body.append(importRow);
  const importResult = element('div', 'scope-import-result');
  importResult.hidden = true;
  body.append(importResult);

  for (const group of CONTEXT_GROUPS) {
    const block = element('fieldset', 'app-profile-set context-group');
    block.dataset.contextGroup = group.id;
    block.append(element('legend', '', group.legend));
    block.append(element('p', 'context-group-hint', group.hint));
    const grid = element('div', 'profile-grid');
    const selected = list(answers[group.fields[0].name]).filter((value) => value !== 'unknown');
    for (const field of group.fields) {
      grid.append(optionButton(field.name, field.value, field.label, field.detail, selected.includes(field.value)));
    }
    block.append(grid);
    if (group.id === 'roles') {
      const roleRow = element('label', 'context-inline-select');
      roleRow.append(element('span', '', 'How many roles?'));
      const select = document.createElement('select');
      select.name = 'roles';
      for (const [value, label] of ROLE_CHOICES) select.append(new Option(label, value));
      select.value = answers.roles || 'unknown';
      roleRow.append(select);
      block.append(roleRow);
    }
    body.append(block);
  }

  const actions = element('p', 'app-profile-actions');
  const apply = element('button', 'button button-primary', assessment ? 'Update testing plan →' : 'Build testing plan →');
  apply.type = 'button';
  apply.dataset.profileApply = 'true';
  const advanced = element('a', 'button button-quiet', 'Full setup wizard');
  advanced.href = '#wizard';
  actions.append(apply, advanced);
  const preserved = element('span', 'context-preserved-note', 'Progress is preserved — statuses, notes, findings, and evidence stay attached to their tests.');
  actions.append(preserved);
  body.append(actions);
  picker.append(body);
  shell.append(picker);

  function paint() {
    shell.querySelectorAll('.profile-option').forEach((node) => {
      const input = node.querySelector('input');
      node.classList.toggle('is-on', Boolean(input?.checked));
    });
  }

  shell.addEventListener('change', (event) => {
    const input = event.target;
    if (!input || input.tagName !== 'INPUT' || !['checkbox', 'radio'].includes(input.type)) return;
    // "None" is exclusive within its group; anything else clears "None".
    const groupNames = new Set(CONTEXT_GROUPS.flatMap(({ fields }) => fields.map(({ name }) => name)));
    if (groupNames.has(input.name) && input.value !== 'none') {
      const none = shell.querySelector(`input[name="${input.name}"][value="none"]`);
      if (none) none.checked = false;
    }
    if (input.value === 'none' && input.checked) {
      shell.querySelectorAll(`input[name="${input.name}"]`).forEach((node) => { node.checked = node === input; });
    }
    paint();
  });

  let importedScalars = null;
  importOpen.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;
    let parsed;
    try { parsed = importScope(JSON.parse(await file.text())); }
    catch { parsed = { ok: false, error: 'The file is not valid JSON.' }; }
    if (!parsed.ok) {
      importResult.hidden = false;
      importResult.className = 'scope-import-result scope-import-error';
      importResult.replaceChildren(element('p', '', `Could not import. ${parsed.error}`));
      return;
    }
    // Tick the editor boxes the definition actually supports; scalar answers ride
    // along and merge on Update, where the tester still sees and controls them.
    for (const group of ['auth_mechanism', 'identity_features', 'api_style', 'features', 'role_types']) {
      const values = parsed.answers[group];
      if (!Array.isArray(values)) continue;
      shell.querySelectorAll(`input[name="${group}"]`).forEach((input) => { input.checked = values.includes(input.value); });
    }
    const { auth_mechanism, identity_features, api_style, features, role_types, ...scalars } = parsed.answers;
    importedScalars = scalars;
    paint();
    importResult.hidden = false;
    importResult.className = 'scope-import-result';
    importResult.replaceChildren(
      element('p', 'micro-label', `PROPOSED CONTEXT FROM ${parsed.meta.kind.toLocaleUpperCase('en-US')}`),
      element('p', 'scope-import-title', `${parsed.meta.title || file.name} · ${parsed.meta.endpoints} paths · ${parsed.meta.operations} operations`),
      element('ul', 'preset-assumptions', ''),
    );
    const list = importResult.querySelector('ul');
    for (const line of parsed.meta.detections) {
      const item = element('li', '', `✓ ${line}`);
      list.append(item);
    }
    const note = element('p', 'preset-note', 'Boxes below are pre-ticked from the definition. Review them, then Update testing plan.');
    importResult.append(note);
    importResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  apply.addEventListener('click', () => {
    const selected = (groupName) => [...shell.querySelectorAll(`input[name="${groupName}"]:checked`)].map((node) => node.value);
    const patch = {};
    const auth = selected('auth_mechanism');
    if (auth.length) {
      patch.auth_mechanism = auth;
      patch.has_login = 'yes';
      if (['none', 'unknown'].includes(answers.creds || 'unknown')) patch.creds = 'low';
      if (!list(answers.identity_features).some((value) => value !== 'unknown' && value !== 'none') && !auth.includes('none')) {
        patch.identity_features = ['unknown'];
      }
    }
    const identity = selected('identity_features');
    if (identity.length) patch.identity_features = identity;
    const api = selected('api_style');
    if (api.length) patch.api_style = api;
    const features = selected('features');
    if (features.length) patch.features = features;
    const roleTypes = selected('role_types');
    if (roleTypes.length) patch.role_types = roleTypes;
    const rolesSelect = shell.querySelector('select[name="roles"]');
    if (rolesSelect) patch.roles = rolesSelect.value;
    const merged = importedScalars ? { ...importedScalars, ...patch } : patch;
    importedScalars = null;
    onApply?.({
      answers: { ...answers, ...merged },
      engagement: { name: name.value.trim() || engagement.name || '', targetUrl: url.value }
    });
  });

  void playbooks;
  void currentSurface;
  void onSurfaceSelect;
  root.append(shell);
}
