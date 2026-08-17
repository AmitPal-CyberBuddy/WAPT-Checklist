'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const REQUIRED_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

test('every HTML page carries the required restrictive CSP and authorized-use message', () => {
  for (const page of ['index.html', 'app.html']) {
    const html = read(page);
    assert.ok(html.includes(REQUIRED_CSP), `${page} CSP differs`);
    assert.match(html, /Authorized testing only/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>/i, `${page} contains inline executable content`);
  }
});

test('all page CSS and JavaScript entry URLs share one cache version', () => {
  const versions = [];
  for (const page of ['index.html', 'app.html']) {
    for (const match of read(page).matchAll(/(?:href|src)="(?:css|js)\/[^"?]+\?v=([^"]+)"/g)) versions.push(match[1]);
  }
  assert.ok(versions.length >= 5);
  assert.deepEqual(new Set(versions), new Set(['0.3.0']));
});

test('font assets are self-hosted WOFF2 files', () => {
  const css = read('css/styles.css');
  for (const font of ['sora-400.woff2', 'sora-600.woff2', 'ibm-plex-mono-400.woff2', 'ibm-plex-mono-500.woff2']) {
    assert.ok(css.includes(font));
    assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts', font)).size > 1_000);
  }
  assert.doesNotMatch(css, /https?:\/\//);
});

test('manifest matches the architecture taxonomy without hardcoded production counts', () => {
  const manifest = JSON.parse(read('checklist/manifest.json'));
  assert.equal(manifest.categories.length, 24);
  assert.equal(manifest.sample_count, 20);
  assert.ok(manifest.categories.every(({ count }) => count === 0));
  assert.equal(manifest.categories.reduce((sum, category) => sum + category.floor, 0), 512);
});

test('wizard source defines all 14 question keys and the one localStorage key', () => {
  const wizard = read('js/ui/wizard.js');
  const app = read('js/ui/app.js');
  const engineState = read('js/engine/state.js');
  const questionKeys = [...wizard.matchAll(/\{ key: '([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(questionKeys, ['mode', 'creds', 'app_type', 'has_login', 'registration', 'roles', 'auth_mechanism', 'api_docs', 'source_access', 'backend', 'api_style', 'database', 'cloud', 'features']);
  assert.match(engineState, /STATE_KEY = 'wapt\.state\.v1'/);
  assert.match(app, /localStorage\.setItem\(STATE_KEY/);
  assert.equal((app.match(/localStorage\.setItem/g) || []).length, 1);
});
