'use strict';

// Engagement templates (portfolio-scoped) and scope snapshots with a diff that
// names answers and affected categories both ways.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const portfolioModule = import(pathToFileURL(path.resolve(ROOT, 'js/engine/portfolio.js')).href);
const diffModule = import(pathToFileURL(path.resolve(ROOT, 'js/engine/scopediff.js')).href);
const stateModule = import(pathToFileURL(path.resolve(ROOT, 'js/engine/state.js')).href);

function loadItems() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/manifest.json'), 'utf8'));
  const items = [];
  for (const category of manifest.categories) items.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', category.file), 'utf8')).items);
  return items;
}

test('templates freeze scope only and create engagements in one click', async () => {
  const { createPortfolio, activeEngagement, saveTemplate, createEngagementFromTemplate, deleteTemplate, MAX_TEMPLATES } = await portfolioModule;
  const { setAnswers, setItemStatus } = await stateModule;
  let portfolio = createPortfolio();
  let state = activeEngagement(portfolio);
  state = setAnswers(state, { app_type: 'spa', auth_mechanism: ['jwt'], has_login: 'yes' });
  state = setItemStatus(state, 'WAPT-JWT-001', 'passed');
  portfolio = { ...portfolio, engagements: portfolio.engagements.map((record, index) => index === 0 ? { ...record, state } : record) };

  portfolio = saveTemplate(portfolio, 'Acme SaaS');
  const [template] = portfolio.templates;
  assert.equal(template.name, 'Acme SaaS');
  assert.deepEqual(template.answers.auth_mechanism, ['jwt']);
  assert.equal(Object.keys(template.answers).length, 19, 'full controlled vocabulary');
  assert.equal(template.engagement.name.length >= 0, true);

  portfolio = createEngagementFromTemplate(portfolio, template.id);
  const fresh = activeEngagement(portfolio);
  assert.deepEqual(fresh.answers.auth_mechanism, ['jwt']);
  assert.deepEqual(fresh.statuses, {}, 'no progress ever carried');
  assert.equal(portfolio.engagements.length, 2);

  for (let index = 0; index < MAX_TEMPLATES - 1; index += 1) portfolio = saveTemplate(portfolio, `T${index}`);
  assert.equal(portfolio.templates.length, MAX_TEMPLATES);
  assert.throws(() => saveTemplate(portfolio, 'One too many'), /maximum/);
  portfolio = deleteTemplate(portfolio, template.id);
  assert.throws(() => createEngagementFromTemplate(portfolio, template.id), /Unknown template/);
});

test('hostile portfolio documents keep only well-formed templates', async () => {
  const { normalizePortfolio } = await portfolioModule;
  const hostile = normalizePortfolio({
    kind: 'wapt-engagement-portfolio', portfolio_version: 1,
    engagements: [{ id: 'eng-1', state: { schema_version: 4 } }],
    templates: [
      { id: 'tpl-good-0001', name: 'Good', answers: { auth_mechanism: ['jwt'] }, engagement: {} },
      { id: 'bad id!', name: 'Bad', answers: {} },
      { id: 'tpl-noname-2', answers: {} },
      'nonsense'
    ]
  });
  assert.equal(hostile.templates.length, 1);
  assert.equal(hostile.templates[0].name, 'Good');
});

test('scope snapshots ring-buffer at ten and validate on import', async () => {
  const { createState, pushScopeSnapshot, removeScopeSnapshot, normalizeState } = await stateModule;
  let state = createState();
  for (let index = 0; index < 12; index += 1) state = pushScopeSnapshot(state, `S${index}`);
  assert.equal(state.scope_snapshots.length, 10);
  assert.equal(state.scope_snapshots[0].label, 'S2');
  const round = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(round.scope_snapshots.length, 10);
  state = removeScopeSnapshot(state, state.scope_snapshots[0].id);
  assert.equal(state.scope_snapshots.length, 9);
  assert.throws(() => removeScopeSnapshot(state, 'snap-nope'), /Unknown scope snapshot/);
});

test('diffAnswers names added, removed, and changed scope decisions', async () => {
  const { diffAnswers } = await diffModule;
  const before = { app_type: 'spa', auth_mechanism: ['jwt'], features: ['search'] };
  const after = { app_type: 'spa', auth_mechanism: ['jwt', 'cookie'], features: ['unknown'], api_style: ['websocket'] };
  const changes = diffAnswers(before, after);
  const byKey = Object.fromEntries(changes.map((change) => [change.key, change]));
  assert.equal(byKey.auth_mechanism.direction, 'changed');
  assert.ok(byKey.auth_mechanism.to.includes('cookie'));
  assert.equal(byKey.api_style.direction, 'added');
  assert.equal(byKey.features.direction, 'removed');
  assert.equal(diffAnswers(after, after).length, 0);
});

test('categoryImpact lists categories both ways using the real engine', async () => {
  const { categoryImpact } = await diffModule;
  const items = loadItems();
  // Cookie-only scope gains JWT: the JWT category lights up from zero…
  const cookieOnly = { app_type: 'spa', has_login: 'yes', creds: 'high', auth_mechanism: ['cookie'] };
  const jwtOn = categoryImpact(items, cookieOnly, { ...cookieOnly, auth_mechanism: ['cookie', 'jwt'] });
  const jwt = jwtOn.find((entry) => entry.category === 'jwt');
  assert.equal(jwt.direction, 'on');
  assert.equal(jwt.before, 0);
  assert.ok(jwt.after > 0, 'jwt category gained applicable tests');
  // …while dropping JWT again narrows it back to zero — both directions honest.
  const jwtOff = categoryImpact(items, { ...cookieOnly, auth_mechanism: ['cookie', 'jwt'] }, cookieOnly);
  const jwtOffEntry = jwtOff.find((entry) => entry.category === 'jwt');
  assert.equal(jwtOffEntry.direction, 'off');
  assert.equal(jwtOffEntry.after, 0);
  // Pinning api_style=websocket from unknown narrows graphql out entirely.
  const narrowed = categoryImpact(items, { ...cookieOnly, api_style: ['unknown'] }, { ...cookieOnly, api_style: ['websocket'] });
  const graphql = narrowed.find((entry) => entry.category === 'graphql');
  assert.equal(graphql.direction, 'off');
  assert.equal(graphql.after, 0);
  assert.ok(jwtOn.every((entry) => entry.before !== entry.after));
  const same = categoryImpact(items, cookieOnly, cookieOnly);
  assert.equal(same.length, 0);
});
