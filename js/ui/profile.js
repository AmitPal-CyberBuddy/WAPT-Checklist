// Compact application profile: page/function first, then optional application context.
// “Generate test plan” remains the compatibility name for the profile-to-engine action;
// the tester-facing control now says Build/Update testing plan. Advanced keeps all 18 questions.
import { APP_TYPES, AUTH_OPTIONS, FEATURE_OPTIONS, answersToProfile, profileToAnswers, profileIsScoped } from '../engine/profile.js?v=1.0.0-r8';
import { element } from './dom.js?v=1.0.0-r8';

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
  const { answers = {}, engagement = {}, onApply, playbooks = [], currentSurface, onSurfaceSelect } = context;
  const profile = answersToProfile(answers);
  const scoped = profileIsScoped(profile);
  root.replaceChildren();

  const shell = element('section', 'surface-context');
  shell.dataset.appProfile = 'true';
  const picker = element('details', 'surface-picker');
  picker.dataset.surfacePicker = 'true';
  picker.open = !scoped || !currentSurface;
  const summary = element('summary', 'surface-picker-summary');
  const summaryCopy = element('span');
  summaryCopy.append(element('span', 'micro-label', currentSurface ? 'CURRENT SURFACE' : 'START HERE'));
  summaryCopy.append(element('strong', '', currentSurface?.title || 'What are you looking at?'));
  summaryCopy.append(element('small', '', currentSurface
    ? 'Change the page or function without leaving the testing console.'
    : 'Choose the page or function in front of you.'));
  summary.append(summaryCopy, element('span', 'surface-picker-action', currentSurface ? 'Change' : 'Choose'));
  picker.append(summary);

  const body = element('div', 'surface-picker-body');
  const target = element('div', 'app-profile-target');
  const urlLabel = element('label', 'field-group');
  urlLabel.append(element('span', '', 'URL in front of you'));
  const url = document.createElement('input');
  url.type = 'url';
  url.placeholder = 'https://www.example.com/about';
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

  const surfaceHead = element('div', 'surface-question');
  surfaceHead.append(element('p', 'micro-label', 'WHAT ARE YOU LOOKING AT?'));
  surfaceHead.append(element('h2', '', 'Choose the page or function'));
  surfaceHead.append(element('p', '', 'This becomes the current testing plan. You can change it at any time.'));
  body.append(surfaceHead);
  const surfaceGrid = element('div', 'surface-choice-grid');
  for (const playbook of playbooks) {
    const button = element('button', `surface-choice${currentSurface?.id === playbook.id ? ' is-current' : ''}`);
    button.type = 'button';
    button.dataset.surfaceChoice = playbook.id;
    button.append(element('strong', '', playbook.title), element('small', '', playbook.summary));
    if (currentSurface?.id === playbook.id) button.append(element('span', 'chip', 'Current'));
    button.addEventListener('click', () => onSurfaceSelect?.({
      surfaceId: playbook.id,
      engagement: { name: name.value, targetUrl: url.value }
    }));
    surfaceGrid.append(button);
  }
  body.append(surfaceGrid);

  const fineTune = element('details', 'profile-fine-tune');
  fineTune.append(element('summary', '', 'Fine-tune application context'));
  const fineBody = element('div', 'profile-fine-body');
  fineBody.append(element('p', 'profile-fine-intro', 'Optional: add authentication and features so the same plan includes the right conditional tests.'));

  const typeBlock = element('fieldset', 'app-profile-set');
  typeBlock.append(element('legend', '', 'Application architecture'));
  const typeGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of APP_TYPES) typeGrid.append(optionButton('app_type', value, label, detail, profile.app_type === value, 'radio'));
  typeBlock.append(typeGrid);
  fineBody.append(typeBlock);

  const authBlock = element('fieldset', 'app-profile-set');
  authBlock.append(element('legend', '', 'Authentication present'));
  const authGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of AUTH_OPTIONS) authGrid.append(optionButton('auth', value, label, detail, profile.auth.includes(value)));
  authBlock.append(authGrid);
  fineBody.append(authBlock);

  const featBlock = element('fieldset', 'app-profile-set');
  featBlock.append(element('legend', '', 'Features on this application'));
  const featGrid = element('div', 'profile-grid');
  for (const [value, label, detail] of FEATURE_OPTIONS) featGrid.append(optionButton('features', value, label, detail, profile.features.includes(value)));
  featBlock.append(featGrid);
  fineBody.append(featBlock);

  const actions = element('p', 'app-profile-actions');
  const apply = element('button', 'button button-primary', scoped ? 'Update testing plan →' : 'Build testing plan →');
  apply.type = 'button';
  apply.dataset.profileApply = 'true';
  const advanced = element('a', 'button button-quiet', 'Advanced scope');
  advanced.href = '#wizard';
  actions.append(apply, advanced);
  fineBody.append(actions);
  fineTune.append(fineBody);
  body.append(fineTune);
  picker.append(body);
  shell.append(picker);

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
    paint();
  });

  apply.addEventListener('click', () => {
    onApply?.({
      answers: profileToAnswers(readProfile(), context.answers || {}),
      engagement: { name: name.value, targetUrl: url.value }
    });
  });
  root.append(shell);
}
