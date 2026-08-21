'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const portfolioModule = import('../js/engine/portfolio.js');
const stateModule = import('../js/engine/state.js');

test('legacy single-engagement state migrates into a one-record portfolio', async () => {
  const { normalizePortfolio, activeEngagement, PORTFOLIO_KIND } = await portfolioModule;
  const { createState, setEngagement } = await stateModule;
  const legacy = { ...setEngagement(createState(), { name: 'Legacy portal' }, '2026-08-18T00:00:00.000Z'), preferences: { theme: 'light' } };
  const portfolio = normalizePortfolio(legacy);
  assert.equal(portfolio.kind, PORTFOLIO_KIND);
  assert.equal(portfolio.preferences.theme, 'light');
  assert.equal(portfolio.engagements.length, 1);
  assert.equal(activeEngagement(portfolio).engagement.name, 'Legacy portal');
});

test('engagement portfolios add, switch, update, and delete independent progress', async () => {
  const { createPortfolio, addEngagement, activeEngagement, selectEngagement, updateActiveEngagement, removeEngagement } = await portfolioModule;
  const { setEngagement, setItemStatus } = await stateModule;
  let portfolio = createPortfolio();
  const firstId = portfolio.active_id;
  let first = setEngagement(activeEngagement(portfolio), { name: 'First' }, '2026-08-18T00:00:00.000Z');
  first = setItemStatus(first, 'WAPT-AUTHZ-001', 'passed', '2026-08-18T00:00:00.000Z');
  portfolio = updateActiveEngagement(portfolio, first);
  portfolio = addEngagement(portfolio);
  const secondId = portfolio.active_id;
  portfolio = updateActiveEngagement(portfolio, setEngagement(activeEngagement(portfolio), { name: 'Second' }, '2026-08-18T01:00:00.000Z'));
  assert.equal(portfolio.engagements.length, 2);
  assert.equal(activeEngagement(selectEngagement(portfolio, firstId)).statuses['WAPT-AUTHZ-001'], 'passed');
  assert.equal(activeEngagement(portfolio).engagement.name, 'Second');
  portfolio = removeEngagement(portfolio, secondId);
  assert.equal(portfolio.active_id, firstId);
  assert.equal(activeEngagement(portfolio).engagement.name, 'First');
});

test('removing the only engagement creates a safe blank replacement', async () => {
  const { createPortfolio, removeEngagement, activeEngagement } = await portfolioModule;
  let portfolio = createPortfolio();
  portfolio = removeEngagement(portfolio, portfolio.active_id);
  assert.equal(portfolio.engagements.length, 1);
  assert.equal(activeEngagement(portfolio).engagement.name, '');
});

test('schema v1 portfolio records upgrade in place without data loss', async () => {
  const { normalizePortfolio, activeEngagement } = await portfolioModule;
  const legacyPortfolio = {
    kind: 'wapt-engagement-portfolio',
    portfolio_version: 1,
    preferences: { theme: null },
    active_id: 'eng-a',
    engagements: [{
      id: 'eng-a',
      state: {
        schema_version: 1,
        engagement: { name: 'V1 engagement', targetUrl: 'https://app.example.com', started_at: null },
        answers: { mode: 'grey_box' },
        statuses: { 'WAPT-AUTHZ-001': 'passed' },
        notes: { 'WAPT-AUTHZ-001': 'Kept through migration.' },
        overrides: {}, retests: {}, updated_at: null
      }
    }]
  };
  const portfolio = normalizePortfolio(legacyPortfolio);
  const state = activeEngagement(portfolio);
  assert.equal(state.schema_version, 4);
  assert.deepEqual(state.findings, []);
  assert.equal(state.engagement.name, 'V1 engagement');
  assert.equal(state.statuses['WAPT-AUTHZ-001'], 'passed');
  assert.equal(state.notes['WAPT-AUTHZ-001'], 'Kept through migration.');
});
