'use strict';

// The scope wizard is answered 20 times in a row at the start of every engagement. If one
// question plus its Continue button does not fit a laptop viewport, the tester scrolls twenty
// times before testing anything. These assertions guard the density that makes it fit.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const cssSource = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');
const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, '');
const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const wizard = fs.readFileSync(path.join(ROOT, 'js', 'ui', 'wizard.js'), 'utf8');

// Last declaration wins, so read the effective value the way the cascade would. Rules are
// split on braces rather than regex-escaped, which keeps this readable and selector-safe.
function declarations(selector, property) {
  const values = [];
  for (const block of css.split('}')) {
    const brace = block.indexOf('{');
    if (brace < 0) continue;
    const selectors = block.slice(0, brace).split(',').map((entry) => entry.trim().replace(/\s+/g, ' '));
    if (!selectors.includes(selector)) continue;
    for (const entry of block.slice(brace + 1).split(';')) {
      const split = entry.indexOf(':');
      if (split < 0) continue;
      if (entry.slice(0, split).trim() === property) values.push(entry.slice(split + 1).trim());
    }
  }
  return values;
}

function clampMaxRem(value) {
  const match = /clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/.exec(value || '');
  if (match) return Number(match[1]);
  const rem = /^([\d.]+)rem/.exec(value || '');
  return rem ? Number(rem[1]) : Number.POSITIVE_INFINITY;
}

test('wizard body no longer reserves a fixed 460px block', () => {
  assert.equal(declarations('.wizard-body', 'min-height').length, 0, 'min-height on .wizard-body forces scrolling on short questions');
  const padding = declarations('.wizard-body', 'padding').at(-1);
  assert.ok(clampMaxRem(padding) <= 1.8, `wizard body padding too generous: ${padding}`);
});

test('Continue stays reachable: the wizard footer is sticky', () => {
  assert.deepEqual(declarations('.wizard-footer', 'position').at(-1), 'sticky');
  assert.deepEqual(declarations('.wizard-footer', 'bottom').at(-1), '0');
  // A scroll-container ancestor would neutralise the sticky footer.
  assert.notEqual(declarations('.wizard-shell', 'overflow').at(-1), 'hidden');
});

test('option cards and long questions stay compact', () => {
  const minHeights = declarations('.option-card', 'min-height');
  const effective = minHeights.at(-1);
  assert.ok(effective === '0' || Number.parseInt(effective, 10) <= 56, `option cards too tall: ${effective}`);
  // Seven or more options must widen the grid instead of adding rows.
  assert.match(cssSource, /\.option-grid:has\(> :nth-child\(7\)\)\{grid-template-columns:repeat\(3/);
});

test('the wizard page chrome above the question is trimmed', () => {
  assert.ok(clampMaxRem(declarations('.wizard-view', 'padding-top').at(-1)) <= 1.5);
  assert.ok(clampMaxRem(declarations('.wizard-view .wizard-heading h1', 'font-size').at(-1)) <= 1.8, 'wizard h1 is display-sized');
  assert.ok(clampMaxRem(declarations('.wizard-question h2', 'font-size').at(-1)) <= 1.6, 'question heading is display-sized');
  // The local-storage explanation is one collapsed line, not a permanent block on every step.
  assert.match(appHtml, /<details class="local-persistence-notice compact" data-persistence-note>/);
  assert.doesNotMatch(appHtml, /<aside class="local-persistence-notice"/);
  assert.match(css, /@media \(max-height:720px\)\{\.wizard-view \.wizard-intro\{display:none\}/, 'short viewports drop the intro');
  assert.doesNotMatch(css, /\.wizard-body\{min-height/, 'no viewport may reintroduce a fixed wizard body height');
});

test('estimated vertical budget keeps a question and Continue on one laptop screen', () => {
  // Fixed chrome above the first option, from the values asserted above plus the constant
  // page furniture. Measured against 650px (1366×768 with browser chrome).
  const bar = Number.parseInt(declarations('.authorization-bar', 'height').at(-1), 10);
  const header = Number.parseInt(declarations('.workspace-header', 'height').at(-1), 10);
  const viewPad = clampMaxRem(declarations('.wizard-view', 'padding-top').at(-1)) * 16;
  const heading = clampMaxRem(declarations('.wizard-view .wizard-heading h1', 'font-size').at(-1)) * 16 * 1.25 + 24;
  const bodyPad = clampMaxRem(declarations('.wizard-body', 'padding').at(-1)) * 16;
  const question = clampMaxRem(declarations('.wizard-question h2', 'font-size').at(-1)) * 16 * 1.25 + 46;
  const chrome = bar + header + viewPad + heading + 26 + 26 + bodyPad + question;
  assert.ok(chrome < 400, `wizard chrome grew back to ${Math.round(chrome)}px (budget 400px)`);

  const optionRow = 56 + 8;
  const footer = 58 + bodyPad;
  const sixOption = chrome + Math.ceil(6 / 2) * optionRow + footer;
  assert.ok(sixOption < 650, `a six-option question needs ${Math.round(sixOption)}px (budget 650px)`);
  const elevenOption = chrome + Math.ceil(11 / 3) * optionRow + footer;
  assert.ok(elevenOption < 700, `the largest question needs ${Math.round(elevenOption)}px`);
});

test('navigation lands on the question instead of the previous scroll position', () => {
  assert.match(wizard, /focus\(\{ preventScroll: true \}\)/);
  assert.match(wizard, /window\.scrollTo\(\{ top: Math\.max\(0, window\.scrollY \+ anchor - 12\)/);
  // The step counter is stated once (shell meta plus an inline pill), not as a separate block.
  assert.doesNotMatch(wizard, /<span class="wizard-step-id">SCOPE QUESTION/);
  assert.match(wizard, /<h2 tabindex="-1"><span class="wizard-step-id">SCOPE /);
});
