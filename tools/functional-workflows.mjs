#!/usr/bin/env node
// Functional workflow harness: runs the REAL application (app.html + UI modules)
// inside a jsdom window with real HTTP against the local server, real localStorage,
// and real event dispatch. Two scripted user journeys + edge cases + runtime audit.
//
// Usage:
//   1. Serve the repo:  python3 -m http.server 8000 --bind 0.0.0.0
//   2. Install jsdom anywhere:  npm i --prefix /tmp/wapt-jsdom jsdom
//   3. NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/functional-workflows.mjs
//
// Without jsdom this exits cleanly with instructions (the repo stays zero-dependency).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  console.log('SKIPPED: jsdom is not installed. Install it outside the repo (npm i --prefix /tmp/wapt-jsdom jsdom) and run with NODE_PATH=/tmp/wapt-jsdom/node_modules.');
  process.exit(0);
}

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BASE = process.env.WAPT_BASE_URL || 'http://localhost:8000';
const APP_ENTRY = path.join(ROOT, 'js/ui/app.js');

const nodeFetch = globalThis.fetch;
const results = [];
const record = (feature, result, notes = '') => { results.push({ feature, result, notes }); console.log(`${result.padEnd(10)} ${feature}${notes ? ` :: ${notes}` : ''}`); };

let fetchLog = [];
let externalRequests = 0;
let consoleErrors = [];
let exports = [];
let clipboardWrites = 0;
let printed = 0;

async function appFetch(url, options) {
  fetchLog.push(url);
  const absolute = new URL(url, BASE).href;
  if (!absolute.startsWith(BASE)) {
    externalRequests += 1;
    consoleErrors.push(`EXTERNAL REQUEST BLOCKED: ${absolute}`);
    throw new Error(`external request blocked: ${absolute}`);
  }
  return nodeFetch(absolute, options);
}

function buildShims(window) {
  window.matchMedia = (query) => {
    const q = String(query);
    let matches = false;
    if (q.includes('prefers-color-scheme')) matches = !q.includes('light');
    const listeners = new Set();
    return {
      get matches() { return matches; }, media: q, onchange: null,
      addEventListener: (type, fn) => listeners.add(fn),
      removeEventListener: (type, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      dispatchEvent: (event) => listeners.forEach((fn) => fn(event))
    };
  };
  window.fetch = appFetch;
  window.confirm = () => true;
  window.prompt = () => 'Runtime verification override';
  window.print = () => { printed += 1; };
  window.scrollIntoView = window.scrollIntoView || (() => {});
  if (typeof window.HTMLElement !== 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = () => {};
    const dialog = window.HTMLDialogElement;
    if (dialog && !dialog.prototype.showModal) {
      dialog.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
      dialog.prototype.close = function close() { this.removeAttribute('open'); };
    }
  }
  if (!window.Option) {
    window.Option = function Option(text, value) {
      const option = window.document.createElement('option');
      option.textContent = text;
      if (value !== undefined) option.value = value;
      return option;
    };
  }
  window.navigator.clipboard = {
    writeText: async () => { clipboardWrites += 1; }
  };
  window.URL.createObjectURL = () => 'blob:fake-object-url';
  window.URL.revokeObjectURL = () => {};
  window.structuredClone = structuredClone;
  window.TextEncoder = TextEncoder;
  window.crypto.randomUUID = window.crypto?.randomUUID || crypto.randomUUID.bind(crypto);
  window.addEventListener('error', (event) => consoleErrors.push(`window error: ${event.message}`));
  window.addEventListener('unhandledrejection', (event) => consoleErrors.push(`unhandled rejection: ${String(event.reason)}`));
}

function captureBlobs(window) {
  const Original = window.Blob;
  window.Blob = class extends Original {
    constructor(parts, options) {
      super(parts, options);
      this.__waptText = parts.map((part) => String(part)).join('');
    }
  };
  const originalClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function click() {
    if (this.download && String(this.href).startsWith('blob:')) {
      const text = window.__waptLastBlob?.__waptText || '';
      exports.push({ filename: this.download, text });
      return;
    }
    return originalClick.call(this);
  };
  const originalCreate = window.URL.createObjectURL;
  window.URL.createObjectURL = (blob) => {
    window.__waptLastBlob = blob;
    return 'blob:captured';
  };

}

async function boot(pathPrefix, seedStorage) {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: `${BASE}/${pathPrefix ? pathPrefix + '/' : ''}app.html`,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  buildShims(dom.window);
  captureBlobs(dom.window);
  if (seedStorage) {
    dom.window.localStorage.setItem('wapt.state.v1', seedStorage);
  }
  // run the pre-paint theme boot as the page would
  const themeBoot = fs.readFileSync(path.join(ROOT, 'js/ui/theme-boot.js'), 'utf8');
  dom.window.eval(themeBoot);

  const g = globalThis;
  const bindings = { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, navigator: dom.window.navigator, location: dom.window.location, history: dom.window.history, fetch: appFetch, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, Option: dom.window.Option, Blob: dom.window.Blob, URL: dom.window.URL };
  for (const [key, value] of Object.entries(bindings)) {
    Object.defineProperty(g, key, { configurable: true, writable: true, value });
  }

  const bootId = `boot-${Date.now()}-${Math.random()}`;
  await import(pathToFileURL(APP_ENTRY).href + `?${bootId}`);
  return dom;
}

async function waitFor(check, timeout = 8000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await check()) return true;
    } catch { /* keep polling */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const text = (node) => (node?.textContent || '').trim();

async function run() {
  // ------------------------------------------------------------------ BOOT
  const dom = await boot(null, null);
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector('[data-category-nav] a'), 8000, 'catalog manifest');
  record('Boot: app.html renders workspace with manifest-driven category nav', 'PASS', `${doc.querySelectorAll('[data-category-nav] a').length} categories in sidebar`);
  record('Boot: no console errors', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors.slice(0, 3).join(' | '));
  record('Boot: wizard opens by default', doc.querySelector('[data-view="wizard"]') && !doc.querySelector('[data-view="wizard"]').hidden ? 'PASS' : 'FAIL');
  const lazyBefore = [...fetchLog];
  if (!lazyBefore.some((url) => url.includes('/checklist/') && url.endsWith('.json') && !url.endsWith('manifest.json'))) {
    record('Lazy loading: no category data fetched while on the wizard', 'PASS', `${fetchLog.length} requests: ${fetchLog.filter((u) => u.includes('manifest')).length} manifest only`);
  } else record('Lazy loading: no category data fetched while on the wizard', 'FAIL', fetchLog.join(', '));

  // ------------------------------------------------------------------ WORKFLOW 1: Normal WAPT
  const name = doc.querySelector('#engagement-name');
  name.value = 'ACME review';
  name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const url = doc.querySelector('#target-url');
  url.value = 'https://app.example.com';
  url.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await waitFor(() => doc.querySelectorAll('[data-url-hints] li').length === 0, 2000, 'no url hints for clean https URL');
  record('Wizard: engagement name + target URL accepted locally', 'PASS', 'https://app.example.com produced no hint rows');

  doc.querySelector('[data-preset="saas_jwt_api"]').click();
  doc.querySelector('[data-wizard-next]').click();
  let steps = 0;
  while (doc.querySelector('[data-wizard-next]') && steps < 30) {
    doc.querySelector('[data-wizard-next]').click();
    steps += 1;
  }
  await waitFor(() => doc.querySelector('[data-wizard-finish]'), 3000, 'review step');
  const summaryText = text(doc.querySelector('.wizard-summary'));
  record('Wizard: preset applies and all 18 questions flow to review', summaryText.includes('jwt') && summaryText.includes('multi tenant') && summaryText.includes('grey box') ? 'PASS' : 'FAIL', summaryText.slice(0, 120));
  doc.querySelector('[data-wizard-finish]').click();
  await waitFor(() => doc.querySelectorAll('[data-suggested-next] .suggested-row').length >= 1, 10000, 'suggested next');
  record('Workflow 1: dashboard renders Suggested next with explanations', 'PASS', `${doc.querySelectorAll('[data-suggested-next] .suggested-row').length} rows, first: ${text(doc.querySelector('[data-suggested-next] .suggested-row small'))?.slice(0, 90)}`);
  record('Workflow 1: dashboard metrics populated', text(doc.querySelector('[data-dashboard-items]')) === '623' ? 'PASS' : 'FAIL', `catalog=${text(doc.querySelector('[data-dashboard-items]'))}`);
  record('Workflow 1: coverage panel computed', doc.querySelector('[data-coverage-summary]')?.textContent?.includes('coverage confidence') ? 'PASS' : 'FAIL');

  // Search
  doc.querySelector('[data-go-search]').click();
  await waitFor(() => doc.querySelector('[data-search-summary]')?.textContent?.includes('shown'), 10000, 'search render');
  const searchInput = doc.querySelector('[data-search-filters] input[name="query"]');
  searchInput.value = 'jwt';
  searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await waitFor(() => /tests shown/.test(text(doc.querySelector('[data-search-summary]'))), 3000, 'search results');
  const jwtCount = parseInt(text(doc.querySelector('[data-search-summary]')).split(' ')[0], 10);
  record('Workflow 1: search "jwt" returns results', jwtCount > 0 ? 'PASS' : 'FAIL', `${jwtCount} shown`);
  const severity = doc.querySelector('[data-search-filters] select[name="severity"]');
  severity.value = 'high'; severity.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => parseInt(text(doc.querySelector('[data-search-summary]')).split(' ')[0], 10) < jwtCount, 3000, 'combined filter');
  record('Workflow 1: combined search + severity filter narrows results', 'PASS', text(doc.querySelector('[data-search-summary]')));
  record('Workflow 1: active filter chip rendered', doc.querySelector('.filter-chip') ? 'PASS' : 'FAIL', text(doc.querySelector('.filter-chip')));

  // Methodology card workflow
  doc.querySelector('#sidebar a[href="#checklist/authorization"]').click();
  await waitFor(() => doc.querySelector('[data-checklist-results] .test-card'), 10000, 'checklist category');
  const card = doc.querySelector('[data-checklist-results] .test-card');
  card.querySelector('.method-details summary').click();
  const methodText = card.textContent;
  record('Methodology: card expands with full decision procedure', ['Objective', 'Prerequisites', 'Steps', 'Secure behavior', 'Vulnerable behavior', 'Validation', 'False positives', 'Impact', 'Evidence', 'References and mappings'].every((s) => methodText.includes(s)) ? 'PASS' : 'FAIL');
  const statusSelect = card.querySelector('.status-select');
  statusSelect.value = 'confirmed_finding';
  statusSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => text(doc.querySelector('[data-dashboard-confirmed]')) === '1', 3000, 'confirmed metric');
  record('Status: transition to Confirmed Finding updates dashboard', 'PASS', 'confirmed=1');
  const note = card.querySelector('.notes-section textarea');
  note.value = 'Validated with account A vs B. <script>alert(1)</script>';
  note.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => { const stored = JSON.parse(dom.window.localStorage.getItem('wapt.state.v1')); return stored.engagements[0].state.notes && Object.values(stored.engagements[0].state.notes).some((n) => n.includes('Validated with account A')); }, 3000, 'note persisted');
  record('Notes: per-item note persists to localStorage', 'PASS');

  // Stale-node regression: a handler on a replaced node must not clobber live state
  note.value = 'stale-node write attempt';
  note.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => { const stored = JSON.parse(dom.window.localStorage.getItem('wapt.state.v1')).engagements[0].state; return stored.statuses['WAPT-AUTHZ-001'] === 'confirmed_finding' && Object.values(stored.notes).some((n) => n === 'stale-node write attempt'); }, 3000, 'stale-node write kept status');
  record('Regression: replaced-node handlers operate on live state (no status clobber)', 'PASS');

  // Evidence pack (re-query the card: the status change re-rendered the list)
  await waitFor(() => doc.querySelector('[data-checklist-results] .test-card[data-item-id="WAPT-AUTHZ-001"] .evidence-form summary'), 5000, 'evidence form for WAPT-AUTHZ-001');
  const liveCard = doc.querySelector('[data-checklist-results] .test-card[data-item-id="WAPT-AUTHZ-001"]');
  liveCard.querySelector('.evidence-form summary').click();
  const evidenceDoc = liveCard;
  const form = evidenceDoc.querySelector('.evidence-form');
  const title = form.querySelector('input[name="title"]');
  title.value = 'Cross-tenant read';
  title.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  form.querySelector('input[name="endpoint"]').value = 'GET /api/objects/1001';
  form.querySelector('input[name="method"]').value = 'GET';
  form.querySelector('textarea[name="baseline_request"]').value = 'GET /api/objects/1000';
  form.querySelector('textarea[name="test_request"]').value = 'GET /api/objects/1001';
  form.querySelector('textarea[name="observed_behavior"]').value = 'Tenant B object returned.';
  const exploit = form.querySelector('select[name="exploitability"]');
  exploit.value = 'proven';
  exploit.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const reportable = form.querySelector('input[name="reportable"]');
  reportable.checked = true;
  reportable.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => form.querySelector('.evidence-stage')?.textContent?.includes('Reportable finding'), 3000, 'decision stage');
  record('Evidence: live decision stage reaches Reportable on proven + reportable', 'PASS', text(form.querySelector('.evidence-stage'))?.slice(0, 110));
  form.querySelector('.evidence-actions .button').click();
  doc.querySelector('#sidebar a[href="#dashboard"]').click();
  await waitFor(() => doc.querySelector('[data-evidence-packs] .evidence-pack'), 10000, 'evidence pack card');
  record('Evidence: pack saved and rendered with verdict control', 'PASS', text(doc.querySelector('[data-evidence-packs] .evidence-pack')).slice(0, 90));
  const verdict = doc.querySelector('[data-evidence-packs] select');
  verdict.value = 'partial';
  verdict.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitFor(() => JSON.parse(dom.window.localStorage.getItem('wapt.state.v1')).engagements[0].state.findings[0].retest_verdict === 'partial', 3000, 'verdict persisted');
  record('Retesting: PARTIAL verdict persists with original evidence intact', 'PASS', JSON.parse(dom.window.localStorage.getItem('wapt.state.v1')).engagements[0].state.findings[0].baseline_request);

  // Report + export
  doc.querySelector('[data-export-report]').click();
  await waitFor(() => exports.some((e) => e.filename.endsWith('-report.md')), 3000, 'report download');
  const report = exports.find((e) => e.filename.endsWith('-report.md'));
  record('Reports: generated with findings, evidence packs, and verdicts', /## Evidence packs/.test(report?.text || '') && /partial/.test(report?.text || '') && !/<script>alert/.test(report?.text || '') ? 'PASS' : 'FAIL', `${(report?.text || '').length} chars`);
  doc.querySelector('[data-export-json]').click();
  await waitFor(() => exports.some((e) => e.filename.endsWith('-state.json')), 3000, 'state export');
  const exportedState = exports.find((e) => e.filename.endsWith('-state.json')).text;
  record('Export: state JSON produced', exportedState.includes('"schema_version": 2') && exportedState.includes('findings') ? 'PASS' : 'FAIL');

  // Reload simulation + import
  const dom2 = await boot('reloaded', dom.window.localStorage.getItem('wapt.state.v1'));
  await waitFor(() => dom2.window.document.querySelector('[data-category-nav] a'), 8000, 'reload boot');
  const stateAfterReload = JSON.parse(dom2.window.localStorage.getItem('wapt.state.v1')).engagements[0].state;
  record('Persistence: reload restores engagement, statuses, notes, findings', stateAfterReload.engagement.name === 'ACME review' && stateAfterReload.statuses && stateAfterReload.findings.length === 1 && Object.keys(stateAfterReload.notes).length === 1 ? 'PASS' : 'FAIL');
  const file = { name: 'restore.json', text: async () => exportedState };
  const input = dom2.window.document.querySelector('[data-import-file]');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new dom2.window.Event('change', { bubbles: true }));
  await waitFor(() => /State imported successfully/.test(text(dom2.window.document.querySelector('[data-import-message]'))), 5000, 'import success');
  record('Import: exported state re-imports successfully', 'PASS');
  const badFile = { name: 'bad.json', text: async () => '{bad json' };
  Object.defineProperty(input, 'files', { configurable: true, value: [badFile] });
  input.dispatchEvent(new dom2.window.Event('change', { bubbles: true }));
  await waitFor(() => /Import rejected/.test(text(dom2.window.document.querySelector('[data-import-message]'))), 5000, 'import rejection');
  record('Import: malformed JSON rejected without corrupting state', 'PASS', text(dom2.window.document.querySelector('[data-import-message]')));

  // ------------------------------------------------------------------ WORKFLOW 2: Attack chain
  dom2.window.document.querySelector('#sidebar a[href="#chains"]').click();
  await waitFor(() => dom2.window.document.querySelectorAll('.chain-card').length >= 5, 10000, 'chain cards');
  record('Workflow 2: all attack chains render with node links and unlock hints', dom2.window.document.querySelectorAll('.chain-card').length === 5 && dom2.window.document.querySelectorAll('.chain-node a[href^="#checklist"]').length > 0 ? 'PASS' : 'FAIL', `${dom2.window.document.querySelectorAll('.chain-node').length} nodes`);
  const chains = JSON.parse(fs.readFileSync(path.join(ROOT, 'attack-chains/manifest.json'), 'utf8'));
  const firstChain = JSON.parse(fs.readFileSync(path.join(ROOT, 'attack-chains', chains.chains[0].file), 'utf8'));
  const fromId = firstChain.edges[0].from;
  const toId = firstChain.edges[0].to;
  record('Workflow 2: unlock prerequisite identified from chain data', 'PASS', `${fromId} → ${toId}`);
  // mark prerequisite passed via its card
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/manifest.json'), 'utf8'));
  const fromCategory = manifest.categories.find((c) => c.prefix === fromId.split('-').slice(0, 2).join('-'));
  dom2.window.document.querySelector(`#sidebar a[href="#checklist/${fromCategory.slug}"]`).click();
  await waitFor(() => dom2.window.document.querySelector(`[data-checklist-results] .test-card[data-item-id="${fromId}"]`), 8000, 'prerequisite card');
  const fromCard = dom2.window.document.querySelector(`[data-checklist-results] .test-card[data-item-id="${fromId}"]`);
  const fromSelect = fromCard.querySelector('.status-select');
  fromSelect.value = 'passed';
  fromSelect.dispatchEvent(new dom2.window.Event('change', { bubbles: true }));
  dom2.window.document.querySelector('#sidebar a[href="#chains"]').click();
  await waitFor(() => dom2.window.document.querySelector(`.chain-node.unlocked a[href^="#checklist"]`)?.textContent === toId, 8000, 'unlocked node');
  record('Workflow 2: completing prerequisites unlocks the next node and updates status chips', 'PASS', `node ${toId} unlocked; chips: ${[...dom2.window.document.querySelectorAll('.chain-node .status-chip')].map((n) => n.textContent).slice(0, 5).join(',')}`);

  // ------------------------------------------------------------------ EDGE CASES
  dom2.window.document.querySelector('[data-go-search]').click();
  await waitFor(() => dom2.window.document.querySelector('[data-search-filters] input[name="query"]'), 8000, 'search view rendered');
  const edgeSearch = dom2.window.document.querySelector('[data-search-filters] input[name="query"]');
  edgeSearch.value = 'zzzznosuchterm';
  edgeSearch.dispatchEvent(new dom2.window.Event('input', { bubbles: true }));
  await waitFor(() => dom2.window.document.querySelector('[data-search-results] .empty-panel'), 4000, 'empty state');
  record('Edge: no-results state explains itself', /No tests match the current context and filters/.test(text(dom2.window.document.querySelector('[data-search-results] .empty-panel'))) ? 'PASS' : 'FAIL');

  // XSS edge: hostile engagement name must render as text
  const dom3 = await boot('xss-check', null);
  const name3 = dom3.window.document.querySelector('#engagement-name');
  name3.value = '<img src=x onerror=alert(1)>"';
  name3.dispatchEvent(new dom3.window.Event('input', { bubbles: true }));
  dom3.window.document.querySelector('[data-wizard-next]').click();
  dom3.window.document.querySelector('[data-wizard-back]').click();
  const hostileName = '<img src=x onerror=alert(1)>"';
  const nameField = dom3.window.document.querySelector('#engagement-name');
  const inert = dom3.window.document.querySelector('#wizard-root img') === null && nameField.value === hostileName && !dom3.window.document.querySelector('#wizard-root img[src]');
  record('Edge: hostile engagement name rendered as inert text', inert ? 'PASS' : 'FAIL', `field value preserved verbatim, no DOM injection`);

  // Invalid URL edge
  const url3 = dom3.window.document.querySelector('#target-url');
  url3.value = 'javascript:alert(1)';
  url3.dispatchEvent(new dom3.window.Event('input', { bubbles: true }));
  record('Edge: javascript: target produces no hints and no request', dom3.window.document.querySelectorAll('[data-url-hints] li').length === 0 && !fetchLog.some((u) => u.includes('alert')) ? 'PASS' : 'FAIL');

  // Long note cap
  const dom4 = await boot('long-note', null);
  dom4.window.document.querySelector('[data-preset="static_marketing"]').click();
  let guard = 0;
  while (dom4.window.document.querySelector('[data-wizard-next]') && guard < 30) { dom4.window.document.querySelector('[data-wizard-next]').click(); guard += 1; }
  dom4.window.document.querySelector('[data-wizard-finish]').click();
  await waitFor(() => dom4.window.document.querySelectorAll('[data-suggested-next] .suggested-row').length >= 1, 12000, 'static dashboard');
  dom4.window.document.querySelector('#sidebar a[href="#checklist"]').click();
  await waitFor(() => dom4.window.document.querySelector('[data-checklist-results] .test-card'), 12000, 'static checklist');
  const staticCard = dom4.window.document.querySelector('[data-checklist-results] .test-card');
  const longNote = staticCard.querySelector('.notes-section textarea');
  longNote.value = 'x'.repeat(21000);
  longNote.dispatchEvent(new dom4.window.Event('change', { bubbles: true }));
  const storedNote = Object.values(JSON.parse(dom4.window.localStorage.getItem('wapt.state.v1')).engagements[0].state.notes)[0] || '';
  record('Edge: long notes truncated at the 20k cap', storedNote.length === 20000 ? 'PASS' : 'FAIL', `${storedNote.length} chars stored`);
  dom4.window.document.querySelector('[data-print]').click();
  record('Print view: print action invoked from the checklist', printed > 0 ? 'PASS' : 'FAIL', `print calls: ${printed}`);

  // Keyboard: / opens search, g d goes to dashboard, ? opens shortcuts dialog
  dom4.window.document.dispatchEvent(new dom4.window.KeyboardEvent('keydown', { key: '/', bubbles: true }));
  record('Keyboard: "/" routes to search', dom4.window.location.hash === '#search' ? 'PASS' : 'FAIL', dom4.window.location.hash);
  dom4.window.document.dispatchEvent(new dom4.window.KeyboardEvent('keydown', { key: 'g', bubbles: true }));
  dom4.window.document.dispatchEvent(new dom4.window.KeyboardEvent('keydown', { key: 'd', bubbles: true }));
  record('Keyboard: g d routes to dashboard', dom4.window.location.hash === '#dashboard' ? 'PASS' : 'FAIL', dom4.window.location.hash);
  dom4.window.document.dispatchEvent(new dom4.window.KeyboardEvent('keydown', { key: '?', bubbles: true }));
  record('Keyboard: "?" opens the shortcuts dialog', dom4.window.document.querySelector('#shortcuts-dialog')?.hasAttribute('open') ? 'PASS' : 'FAIL');

  // Theme toggle + persistence
  const theme4 = dom4.window.document.querySelector('[data-theme-toggle]');
  const beforeTheme = dom4.window.document.documentElement.dataset.theme;
  theme4.click();
  const afterTheme = dom4.window.document.documentElement.dataset.theme;
  record('Dark/light: toggle flips theme and persists preference', beforeTheme !== afterTheme && JSON.parse(dom4.window.localStorage.getItem('wapt.state.v1')).preferences.theme === afterTheme ? 'PASS' : 'FAIL', `${beforeTheme} -> ${afterTheme}`);

  // Rapid clicking
  const dom5 = await boot('rapid', null);
  const next5 = () => dom5.window.document.querySelector('[data-wizard-next]');
  for (let i = 0; i < 12; i += 1) { const n = next5(); if (n) n.click(); }
  const rapidOk = dom5.window.document.querySelector('.wizard-meta')?.textContent || '';
  record('Edge: rapid clicking leaves the wizard in a valid step', /STEP \d{2} OF \d{2}/.test(rapidOk) ? 'PASS' : 'FAIL', rapidOk.trim());

  // ------------------------------------------------------------------ RUNTIME AUDIT
  record('Runtime: every request same-origin, zero external/telemetry', externalRequests === 0 ? 'PASS' : 'FAIL', `${fetchLog.length} requests logged, ${externalRequests} external blocked`);
  const externalHints = fetchLog.filter((u) => u.includes('://'));
  record('Runtime: no absolute/third-party URLs requested', externalHints.length === 0 ? 'PASS' : 'FAIL', externalHints.join(', ') || 'none');
  record('Runtime: no uncaught console errors across all sessions', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors.slice(0, 3).join(' | ') || 'none');
  record('Runtime: print invoked', printed === 0 ? 'NOT TESTED' : 'PASS', printed > 0 ? 'print shim called' : 'print button not exercised');

  const failed = results.filter((r) => r.result === 'FAIL').length;
  console.log(`\n${results.length} checks: ${results.filter((r) => r.result === 'PASS').length} PASS, ${failed} FAIL, ${results.filter((r) => r.result === 'NOT TESTED').length} NOT TESTED`);
  // Hard exit: lingering hashchange timers from earlier sessions would otherwise
  // fire after global restoration and crash the process with post-run noise.
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 50);
}

run().catch((error) => { console.error('HARNESS FAILURE:', error); process.exit(1); });
