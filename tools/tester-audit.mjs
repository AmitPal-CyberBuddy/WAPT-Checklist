#!/usr/bin/env node
// Tester-first UX audit harness.
//
// Runs the real application in jsdom and walks a realistic engagement the way an experienced
// pentester would, asserting the workflow questions from the review brief: families as the
// working unit, honest coverage states, tickable Don't Miss, explicit Quick Test, contextual
// Suggested next, cross-family navigation, resume, and density.
//
// Usage:
//   python3 -m http.server 8000 --bind 0.0.0.0
//   npm i --prefix /tmp/wapt-jsdom jsdom
//   NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/tester-audit.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadJsdom, createRuntime, waitFor, text, ROOT } from './jsdom-harness.mjs';

const JSDOM = loadJsdom();
if (!JSDOM) {
  console.log('SKIPPED: jsdom is not installed. npm i --prefix /tmp/wapt-jsdom jsdom && NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/tester-audit.mjs');
  process.exit(0);
}

const runtime = createRuntime();
const results = [];
const record = (id, feature, result, notes = '') => {
  results.push({ id, feature, result, notes });
  console.log(`${result.padEnd(10)} ${id.padEnd(4)} ${feature}${notes ? ` :: ${notes}` : ''}`);
};

const AUTHZ_FAMILY = 'authorization-object-level';
const fire = (window, node, type = 'change') => node.dispatchEvent(new window.Event(type, { bubbles: true }));
const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function goto(dom, hash) {
  dom.window.location.hash = hash;
  await settle(450);
}

async function setCoverage(dom, itemId, value) {
  const select = dom.window.document.querySelector(`[data-coverage-control="${itemId}"]`);
  if (!select) throw new Error(`no coverage control for ${itemId}`);
  select.value = value;
  fire(dom.window, select);
  await settle(200);
}

async function setFinding(dom, itemId, value) {
  const select = dom.window.document.querySelector(`[data-finding-toggle="${itemId}"]`);
  if (!select) throw new Error(`no finding control for ${itemId}`);
  select.value = value;
  fire(dom.window, select);
  await settle(200);
}

async function run() {
  const dom = await runtime.boot(JSDOM, null, null);
  const doc = dom.window.document;
  const window = dom.window;
  await waitFor(() => doc.querySelector('[data-category-nav] a'), 10000, 'catalog manifest');

  // ------------------------------------------------------------------ engagement setup
  const name = doc.querySelector('#engagement-name');
  name.value = 'Tester audit engagement';
  fire(window, name, 'input');
  const url = doc.querySelector('#target-url');
  url.value = 'https://app.example.com';
  fire(window, url, 'input');
  doc.querySelector('[data-preset="saas_jwt_api"]')?.click();
  let guard = 0;
  while (doc.querySelector('[data-wizard-next]') && guard < 40) { doc.querySelector('[data-wizard-next]').click(); guard += 1; }
  await waitFor(() => doc.querySelector('[data-wizard-finish]'), 5000, 'wizard review');
  doc.querySelector('[data-wizard-finish]').click();
  await waitFor(() => doc.querySelectorAll('[data-suggested-next] a').length >= 1, 15000, 'dashboard suggestions');
  await waitFor(() => doc.querySelector('[data-family-gaps] .gap-row'), 15000, 'family gaps');

  // ------------------------------------------------------------------ T1 three questions
  const hasCoverage = /of executable checks tested/.test(text(doc.querySelector('[data-coverage-summary]')));
  const gapRows = doc.querySelectorAll('[data-family-gaps] .gap-row').length;
  const nextRows = doc.querySelectorAll('[data-suggested-next] a').length;
  record('T1', 'Dashboard answers tested / missed / next', hasCoverage && gapRows && nextRows ? 'PASS' : 'FAIL',
    `coverage=${hasCoverage} gaps=${gapRows} next=${nextRows}`);

  // ------------------------------------------------------------------ T2 families first class
  await goto(dom, 'families');
  await waitFor(() => doc.querySelectorAll('[data-family-board] [data-family-row]').length > 5, 10000, 'family board');
  const boardRows = doc.querySelectorAll('[data-family-board] [data-family-row]').length;
  const sidebarLink = doc.querySelectorAll('[data-view-link="families"]').length;
  record('T2', 'Families reachable as the primary working unit', boardRows > 5 && sidebarLink ? 'PASS' : 'FAIL',
    `${boardRows} family rows, sidebar=${Boolean(sidebarLink)}`);

  // ------------------------------------------------------------------ T3 family workspace
  await goto(dom, `family/${AUTHZ_FAMILY}`);
  await waitFor(() => doc.querySelector('[data-family-block] [data-family-check-row]'), 10000, 'family workspace');
  const checkRows = doc.querySelectorAll('[data-family-check-row]').length;
  const stats = text(doc.querySelector('[data-family-block] .stat-row')).toLowerCase();
  const statesShown = ['coverage', 'tested', 'not tested', 'blocked', 'n/a', 'confirmed', "don't miss"].filter((token) => stats.includes(token));
  record('T3', 'Family workspace shows checks with full coverage states', checkRows > 5 && statesShown.length >= 6 ? 'PASS' : 'PARTIAL',
    `${checkRows} checks, states: ${statesShown.join(', ')}`);

  // ------------------------------------------------------------------ T4 explicit quick test
  const quickLines = [...doc.querySelectorAll('[data-quick-test] .quick-steps li')].map((li) => text(li));
  const authz = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/authorization.json'), 'utf8'));
  const steps = authz.items.find(({ id }) => id === 'WAPT-AUTHZ-003').steps;
  const duplicated = quickLines.join('|') === steps.join('|');
  record('T4', 'Quick Test is authored, not a copy of methodology steps', quickLines.length >= 3 && !duplicated ? 'PASS' : 'FAIL',
    `${quickLines.length} quick lines, duplicate=${duplicated}`);

  // ------------------------------------------------------------------ T5 don't miss coverage
  const missBoxes = doc.querySelectorAll('[data-dont-miss] input[type="checkbox"]').length;
  record('T5', "Don't Miss variants are tickable coverage", missBoxes > 0 ? 'PASS' : 'FAIL', `${missBoxes} variant checkboxes`);

  // ------------------------------------------------------------------ T6 contextual next
  await setCoverage(dom, 'WAPT-AUTHZ-003', 'tested');
  await settle(400);
  const familyNextIds = [...doc.querySelectorAll('[data-family-next] .id-chip')].map((chip) => text(chip));
  await goto(dom, 'dashboard');
  await waitFor(() => doc.querySelectorAll('[data-suggested-next] .id-chip').length > 0, 10000, 'suggestions');
  const suggestionIds = [...doc.querySelectorAll('[data-suggested-next] .id-chip')].map((chip) => text(chip));
  const siblings = new Set(['WAPT-AUTHZ-004', 'WAPT-AUTHZ-005', 'WAPT-AUTHZ-006', 'WAPT-AUTHZ-007', 'WAPT-AUTHZ-008', 'WAPT-AUTHZ-009', 'WAPT-AUTHZ-010', 'WAPT-AUTHZ-011', 'WAPT-AUTHZ-012', 'WAPT-AUTHZ-031', 'WAPT-AUTHZ-032', 'WAPT-AUTHZ-034', 'WAPT-AUTHZ-039']);
  const topThree = suggestionIds.slice(0, 3);
  const hits = topThree.filter((id) => siblings.has(id)).length;
  record('T6', 'Suggested next continues the family just worked', hits >= 2 ? 'PASS' : (hits === 1 ? 'PARTIAL' : 'FAIL'),
    `dashboard top3=${topThree.join(', ')}; family panel=${familyNextIds.slice(0, 3).join(', ')}`);

  // ------------------------------------------------------------------ T7 N/A is not tested
  await goto(dom, `family/${AUTHZ_FAMILY}`);
  await waitFor(() => doc.querySelector('[data-coverage-control="WAPT-AUTHZ-004"]'), 8000, 'family reload');
  await setCoverage(dom, 'WAPT-AUTHZ-004', 'na');
  await setCoverage(dom, 'WAPT-AUTHZ-005', 'blocked');
  await goto(dom, 'dashboard');
  await settle(600);
  const testedMetric = Number(text(doc.querySelector('[data-dashboard-tested]')).replace(/[^0-9]/g, '') || '0');
  const naMetric = Number(text(doc.querySelector('[data-dashboard-na]')).replace(/[^0-9]/g, '') || '0');
  const blockedMetric = Number(text(doc.querySelector('[data-dashboard-blocked]')).replace(/[^0-9]/g, '') || '0');
  record('T7', 'N/A and blocked never count as tested', testedMetric === 1 && naMetric >= 1 && blockedMetric >= 1 ? 'PASS' : 'FAIL',
    `tested=${testedMetric} na=${naMetric} blocked=${blockedMetric} after 1 tested + 1 N/A + 1 blocked`);

  // ------------------------------------------------------------------ T8 category coverage view
  await goto(dom, 'checklist/authorization');
  doc.querySelector('[data-checklist-mode="coverage"]')?.click();
  await settle(400);
  const coverageText = text(doc.querySelector('[data-checklist-results]')).toLowerCase();
  const coverageStates = ['tested', 'n/a', 'blocked', 'confirmed', "don't miss"].filter((token) => coverageText.includes(token));
  record('T8', 'Category coverage view separates every state', coverageStates.length >= 4 ? 'PASS' : 'PARTIAL', `states: ${coverageStates.join(', ')}`);
  doc.querySelector('[data-checklist-mode="testing"]')?.click();
  await settle(300);

  // ------------------------------------------------------------------ T9 check vs finding
  await goto(dom, `family/${AUTHZ_FAMILY}`);
  await waitFor(() => doc.querySelector('[data-finding-toggle="WAPT-AUTHZ-006"]'), 8000, 'finding control');
  await setFinding(dom, 'WAPT-AUTHZ-006', 'confirmed');
  const stored = JSON.parse(window.localStorage.getItem('wapt.state.v1')).engagements[0].state.statuses['WAPT-AUTHZ-006'];
  const coverageAfter = doc.querySelector('[data-coverage-control="WAPT-AUTHZ-006"]')?.value;
  record('T9', 'Coverage state and finding verdict are separate controls', stored === 'confirmed_finding' && coverageAfter === 'tested' ? 'PASS' : 'FAIL',
    `status=${stored} coverage=${coverageAfter}`);

  // ------------------------------------------------------------------ T10 what else to check
  const relatedLinks = [...doc.querySelectorAll('[data-related-families] a')];
  const reasoned = relatedLinks.filter((link) => text(link).length > 20).length;
  record('T10', '"What else should I check?" cross-family navigation', relatedLinks.length >= 3 && reasoned >= 3 ? 'PASS' : 'FAIL',
    `${relatedLinks.length} related families with reasons`);

  // ------------------------------------------------------------------ T11 resume
  const snapshot = window.localStorage.getItem('wapt.state.v1');
  const dom2 = await runtime.boot(JSDOM, null, snapshot);
  const doc2 = dom2.window.document;
  await waitFor(() => doc2.querySelector('[data-category-nav] a'), 10000, 'reboot');
  await settle(900);
  const bootView = [...doc2.querySelectorAll('[data-view]')].find((section) => !section.hidden)?.dataset.view;
  const resumeControl = doc2.querySelector('[data-resume]');
  record('T11', 'Application resumes where the tester stopped', bootView === 'family' ? 'PASS' : (resumeControl ? 'PARTIAL' : 'FAIL'),
    `boot view=${bootView}, resume control=${Boolean(resumeControl)}`);

  // ------------------------------------------------------------------ T12 variant persistence
  await goto(dom2, `family/${AUTHZ_FAMILY}`);
  await waitFor(() => doc2.querySelector('[data-dont-miss] input[type="checkbox"]'), 8000, 'variants');
  const box = doc2.querySelector('[data-dont-miss] input[type="checkbox"]');
  box.checked = true;
  fire(dom2.window, box);
  await settle(300);
  const snapshot2 = dom2.window.localStorage.getItem('wapt.state.v1');
  const dom3 = await runtime.boot(JSDOM, null, snapshot2);
  const doc3 = dom3.window.document;
  await waitFor(() => doc3.querySelector('[data-category-nav] a'), 10000, 'reboot 2');
  await goto(dom3, `family/${AUTHZ_FAMILY}`);
  await waitFor(() => doc3.querySelector('[data-dont-miss] input[type="checkbox"]'), 8000, 'variants 2');
  const restored = doc3.querySelector('[data-dont-miss] input[type="checkbox"]').checked;
  const variantCount = text(doc3.querySelector('[data-dont-miss] .variant-count'));
  record('T12', "Don't Miss ticks persist across reload", restored ? 'PASS' : 'FAIL', `restored=${restored}, ${variantCount}`);

  // ------------------------------------------------------------------ T13 density
  const row = doc3.querySelector('[data-family-check-row]');
  const rowChars = text(row).replace(/\s+/g, ' ').length;
  const familyChars = text(doc3.querySelector('[data-family-block]')).replace(/\s+/g, ' ').length;
  record('T13', 'Default family screen stays scannable', rowChars <= 160 && familyChars <= 6000 ? 'PASS' : 'PARTIAL',
    `check row ${rowChars} chars, family screen ${familyChars} chars before expanding anything`);

  // ------------------------------------------------------------------ T14 keyboard walk
  const firstOpen = doc3.querySelector('[data-family-check-row] .check-open');
  firstOpen.focus();
  doc3.dispatchEvent(new dom3.window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  await settle(200);
  const expanded = firstOpen.getAttribute('aria-expanded') === 'true';
  doc3.dispatchEvent(new dom3.window.KeyboardEvent('keydown', { key: 'n', bubbles: true }));
  await settle(150);
  const movedTo = doc3.activeElement?.closest('[data-family-check-row]')?.dataset.familyCheckRow || '';
  record('T14', 'Keyboard: expand and walk checks without the mouse', expanded && movedTo ? 'PASS' : 'PARTIAL',
    `expand=${expanded} next-focus=${movedTo || 'none'}`);

  // ------------------------------------------------------------------ T15 runtime health
  record('T15', 'No console errors across the engagement walk', runtime.state.consoleErrors.length === 0 ? 'PASS' : 'FAIL',
    runtime.state.consoleErrors.slice(0, 3).join(' | '));

  const summary = results.reduce((acc, { result }) => ({ ...acc, [result]: (acc[result] || 0) + 1 }), {});
  console.log(`\n${results.length} tester checks: ${Object.entries(summary).map(([key, value]) => `${value} ${key}`).join(', ')}`);
  process.exit(results.some(({ result }) => result === 'FAIL') && process.env.WAPT_STRICT === '1' ? 1 : 0);
}

run().catch((error) => { console.error(error); process.exit(1); });
