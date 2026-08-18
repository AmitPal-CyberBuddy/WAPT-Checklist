'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function collect(dir) {
  const files = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) files.push(read(path.join(dir, entry.name)));
  }
  return files;
}

test('every runtime fetch is same-origin and relative; the target URL is never requested', () => {
  const sources = collect('js').concat(['index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html'].map(read));
  for (const source of sources) {
    for (const match of source.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)) {
      assert.doesNotMatch(match[1], /^(?:https?:)?\/\//, `absolute fetch target ${match[1]}`);
      assert.ok(!match[1].includes('${'), 'template-literal fetches must stay relative');
    }
    assert.doesNotMatch(source, /fetch\(\s*(?:engagement|state)\.(?:targetUrl|engagement\.targetUrl)/);
  }
});

test('only the wapt.state.v1 key is used for local storage', () => {
  for (const source of collect('js')) {
    for (const match of source.matchAll(/localStorage\.(getItem|setItem)\(['"]([^'"]+)['"]/g)) {
      assert.equal(match[2], 'wapt.state.v1', `unexpected storage key ${match[2]}`);
    }
    for (const match of source.matchAll(/const STORAGE_KEY = '([^']+)'/g)) {
      assert.equal(match[1], 'wapt.state.v1', `unexpected storage constant ${match[1]}`);
    }
  }
});

test('all user-facing pages keep the identical restrictive CSP', () => {
  const CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
  for (const page of ['index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html']) {
    assert.ok(read(page).includes(CSP), `${page} CSP`);
    assert.doesNotMatch(read(page), /https?:\/\/(?!github\.com\/AmitPal-CyberBuddy)[a-z0-9.-]+\.(?:com|org|net|io)\/[^"'<> ]*\.(?:js|css|woff2?|png|svg)/i, `${page} external asset`);
  }
});

test('REVIEW-ONLY payload references never auto-expand', () => {
  const payloads = read('js/ui/payloads.js');
  assert.match(payloads, /details\.className = 'payload-details'/);
  assert.doesNotMatch(payloads, /details\.open\s*=\s*true/);
  assert.match(payloads, /review_only \? 'Review safety context' : 'Open reference'/);
});
