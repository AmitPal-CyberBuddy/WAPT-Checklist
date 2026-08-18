'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js/ui/app.js'), 'utf8');

test('responsive layout has deliberate monitor, laptop, tablet, phone, and compact-phone transitions', () => {
  for (const width of ['1050px', '960px', '820px', '600px', '520px', '380px']) {
    assert.ok(css.includes(`max-width:${width}`) || css.includes(`max-width: ${width}`), `missing ${width} breakpoint`);
  }
  assert.match(css, /\.view\{max-width:1240px/);
  assert.match(css, /@media \(max-width:1050px\).*?\.dashboard-columns\{grid-template-columns:1fr\}/s);
  assert.match(css, /@media \(max-width:960px\).*?\.sidebar\{position:fixed.*?translateX\(-102%\)/s);
  assert.match(css, /@media \(max-width:520px\).*?\.dashboard-grid\{grid-template-columns:1fr\}/s);
  assert.match(css, /@media \(max-width:380px\).*?\.wizard-footer\{[^}]*flex-direction:column-reverse/s);
  assert.match(css, /@keyframes rise-in/);
  assert.match(css, /\.view:not\(\[hidden\]\)\{animation:view-in/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\).*?animation:none!important/s);
});

test('mobile navigation removes off-canvas content from focus order', () => {
  assert.match(app, /matchMedia\('\(max-width: 960px\)'\)/);
  assert.match(app, /sidebar\.setAttribute\('inert', ''\)/);
  assert.match(app, /sidebar\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(app, /setSidebar\(false, true\)/);
});

test('dense workspace surfaces reflow instead of merely scaling down', () => {
  assert.match(css, /@media \(max-width:960px\).*?\.filter-grid\{grid-template-columns:repeat\(2/s);
  assert.match(css, /@media \(max-width:600px\).*?\.filter-grid\{grid-template-columns:1fr\}/s);
  assert.match(css, /@media\(max-width:820px\).*?\.chain-browser,\.payload-grid\{grid-template-columns:1fr\}/s);
  assert.match(css, /@media \(max-width:520px\).*?\.metric-card\{display:grid/s);
  assert.match(css, /\.findings-table\{display:block;overflow-x:auto\}/);
  assert.match(css, /\.method-section a,\.mapping-line,\.payload-related\{word-break:break-word\}/);
});
