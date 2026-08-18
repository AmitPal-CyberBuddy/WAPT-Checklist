'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');

function tokensFor(block) {
  const brace = block.indexOf('{');
  const content = brace >= 0 ? block.slice(brace + 1) : '';
  const tokens = {};
  for (const pair of content.split(';')) {
    const [key, value] = pair.split(':');
    if (key && value) tokens[key.trim()] = value.trim();
  }
  return tokens;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

function mix(rgb, tint, base) {
  return rgb.map((channel, index) => Math.round(channel * tint + base[index] * (1 - tint)));
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function tintRgb(value) {
  // tints are defined as rgba(R,G,B,A) — a is the last number
  const match = value.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  return match ? { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: Number(match[4]) } : null;
}

function themeTokens(themeName) {
  const blocks = css.split('}');
  const root = blocks.find((block) => block.includes(':root{') || block.includes(':root\n'));
  const light = blocks.find((block) => block.includes(":root[data-theme='light']"));
  const source = themeName === 'light' ? light : root;
  return tokensFor(source);
}

test('dark and light themes meet WCAG AA contrast for body, muted, and brand text', () => {
  for (const theme of ['dark', 'light']) {
    const tokens = themeTokens(theme);
    const paper = hexToRgb(tokens['--paper']);
    const chipBase = hexToRgb(tokens['--paper-2']);
    assert.ok(ratio(hexToRgb(tokens['--ink']), paper) >= 4.5, `${theme} ink on paper`);
    assert.ok(ratio(hexToRgb(tokens['--ink-2']), paper) >= 4.5, `${theme} ink-2 on paper`);
    assert.ok(ratio(hexToRgb(tokens['--muted']), paper) >= 4.5, `${theme} muted on paper`);
    assert.ok(ratio(hexToRgb(tokens['--brand']), paper) >= 4.5, `${theme} brand on paper`);
    // severity + status chip text sits on a translucent tint over the surface
    for (const name of ['--high', '--med', '--low', '--info']) {
      const tint = tintRgb(tokens[`${name}-bg`]);
      assert.ok(tint, `${theme} ${name}-bg is a parsed rgba tint`);
      const effective = mix(tint.rgb, tint.alpha, chipBase);
      const chipRatio = ratio(hexToRgb(tokens[name]), effective);
      assert.ok(chipRatio >= 4.5, `${theme} ${name} chip text on tinted surface (${chipRatio.toFixed(2)})`);
    }
    // Neutral chips everywhere use muted text on the surface-3 tint
    const surface3 = tintRgb(tokens['--surface-3']);
    assert.ok(surface3, `${theme} --surface-3 is a parsed rgba tint`);
    const chipSurface = mix(surface3.rgb, surface3.alpha, paper);
    const mutedChip = ratio(hexToRgb(tokens['--muted']), chipSurface);
    assert.ok(mutedChip >= 4.5, `${theme} muted chip text on surface-3 (${mutedChip.toFixed(2)})`);
  }
});

test('themes define independent, deliberate token sets rather than an inversion', () => {
  const dark = themeTokens('dark');
  const light = themeTokens('light');
  assert.notDeepEqual(dark, light);
  assert.ok(hexToRgb(dark['--paper'])[0] < 30, 'dark paper is dark');
  assert.ok(hexToRgb(light['--paper'])[0] > 200, 'light paper is light');
});
