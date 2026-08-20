// Compact application profile: type · authentication · features.
// This is the tester-facing scope. The 18-question wizard remains as Advanced.
import { APP_TYPES, AUTH_OPTIONS, FEATURE_OPTIONS, answersToProfile, profileToAnswers, profileIsScoped } from '../engine/profile.js?v=1.0.0-r7';
import { element } from './dom.js?v=1.0.0-r7';

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

export function renderProfile(root, context) {
  const { answers = {}, engagement = {}, onApply } = context;
  const profile = answersToProfile(answers);
  root.replaceChildren();

  const shell = element('section', 'app-profile');
  shell.dataset.appProfile = 'true';
  const head = element('header', 'app-profile-head');
  head.append(element('p', 'micro-label', 'APPLICATION PROFILE'));
  head.append(element('h2', '', 'What are you testing?'));
  head.append(element('p', '', 'Pick the application type, authentication, and features. The plan below lists only the tests that apply.'));
  shell.append(head);

  const target = element('div', 'app-profile-target');
  const urlLabel = element('label', 'field-group');
  urlLabel.append(element('span', '', 'Application URL'));
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
  name.placeholder = 'Example: Acme marketing site';
  name.value = engagement.name || '';
  name.maxLength = 120;
  name.autocomplete = 'off';
  name.name = 'profile-name';
  nameLabel.append(name);
  target.append(nameLabel);
  shell.append(target);

  const typeBlock = element('fieldset', 'app-profile-set');
  typeBlock.append(element('legend', '', 'Application type'));
  const typeGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of APP_TYPES) {
    typeGrid.append(optionButton('app_type', value, label, detail, profile.app_type === value, 'radio'));
  }
  typeBlock.append(typeGrid);
  shell.append(typeBlock);

  const authBlock = element('fieldset', 'app-profile-set');
  authBlock.append(element('legend', '', 'Authentication'));
  const authGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of AUTH_OPTIONS) {
    authGrid.append(optionButton('auth', value, label, detail, profile.auth.includes(value)));
  }
  authBlock.append(authGrid);
  shell.append(authBlock);

  const featBlock = element('fieldset', 'app-profile-set');
  featBlock.append(element('legend', '', 'Features'));
  const featGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of FEATURE_OPTIONS) {
    featGrid.append(optionButton('features', value, label, detail, profile.features.includes(value)));
  }
  featBlock.append(featGrid);
  shell.append(featBlock);

  const actions = element('p', 'app-profile-actions');
  const apply = element('button', 'button button-primary', profileIsScoped(profile) ? 'Update test plan →' : 'Generate test plan →');
  apply.type = 'button';
  apply.dataset.profileApply = 'true';
  const advanced = element('a', 'button button-quiet', 'Advanced scope');
  advanced.href = '#wizard';
  actions.append(apply, advanced);
  shell.append(actions);

  function readProfile() {
    const typeInput = shell.querySelector('input[name="app_type"]:checked');
    const auth = [...shell.querySelectorAll('input[name="auth"]:checked')].map((node) => node.value);
    const features = [...shell.querySelectorAll('input[name="features"]:checked')].map((node) => node.value);
    return {
      app_type: typeInput?.value || 'unknown',
      auth: auth.length ? auth : ['unknown'],
      features: features.length ? features : ['unknown']
    };
  }

  function paint() {
    shell.querySelectorAll('.profile-option').forEach((node) => {
      const input = node.querySelector('input');
      node.classList.toggle('is-on', Boolean(input?.checked));
    });
  }

  shell.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === 'auth' || input.name === 'features') {
      if (input.value === 'none' && input.checked) {
        shell.querySelectorAll(`input[name="${input.name}"]`).forEach((node) => { node.checked = node === input; });
      } else if (input.checked) {
        const none = shell.querySelector(`input[name="${input.name}"][value="none"]`);
        if (none) none.checked = false;
      }
    }
    if (input.name === 'app_type' && input.value === 'static') {
      const none = shell.querySelector('input[name="auth"][value="none"]');
      const anyAuth = [...shell.querySelectorAll('input[name="auth"]:checked')].some((node) => node.value !== 'none');
      if (none && !anyAuth) {
        shell.querySelectorAll('input[name="auth"]').forEach((node) => { node.checked = node.value === 'none'; });
      }
      const noFeat = shell.querySelector('input[name="features"][value="none"]');
      const anyFeat = [...shell.querySelectorAll('input[name="features"]:checked')].some((node) => node.value !== 'none');
      if (noFeat && !anyFeat) {
        shell.querySelectorAll('input[name="features"]').forEach((node) => { node.checked = node.value === 'none'; });
      }
    }
    paint();
  });

  apply.addEventListener('click', () => {
    const next = readProfile();
    onApply?.({
      answers: profileToAnswers(next, context.answers || {}),
      engagement: {
        name: name.value,
        targetUrl: url.value
      }
    });
  });
  root.append(shell);
}
