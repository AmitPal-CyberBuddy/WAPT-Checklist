#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { referenceUrlAllowed } = require('./validate.js');

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests', 'tools', 'assets']);
function walk(dir, extensions) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) files.push(...walk(full, extensions));
    else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) files.push(full);
  }
  return files;
}

function collectLocalRefs() {
  const missing = [];
  const total = { refs: 0 };
  const refGroups = [];
  for (const file of walk(ROOT, ['.html', '.css', '.js', '.mjs'])) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file);
    for (const match of source.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      refGroups.push({ file: relative, ref: match[1], rootBase: false });
    }
    for (const match of source.matchAll(/url\('([^')]+)'\)/g)) {
      refGroups.push({ file: relative, ref: match[1], rootBase: false });
    }
    for (const match of source.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)) {
      refGroups.push({ file: relative, ref: match[1], rootBase: true });
    }
  }
  for (const { file, ref, rootBase } of refGroups) {
    if (/^(?:https?:)?\/\//.test(ref) || ref.startsWith('#') || ref.startsWith('mailto:') || ref.includes('${')) continue;
    if (ref.startsWith('data:')) continue;
    total.refs += 1;
    const clean = ref.split('?')[0].split('#')[0];
    const base = rootBase ? '' : path.dirname(file);
    const target = path.resolve(ROOT, base, clean);
    if (!fs.existsSync(target)) missing.push(`${file} -> ${ref}`);
  }
  return { total: total.refs, missing };
}

const DOC_ALLOWED = new Set([
  'owasp.org', 'genai.owasp.org', 'portswigger.net', 'cwe.mitre.org', 'www.rfc-editor.org',
  'www.w3.org', 'html.spec.whatwg.org', 'fetch.spec.whatwg.org', 'www.whatwg.org',
  'developer.mozilla.org', 'github.com', 'www.apache.org', 'keepachangelog.com',
  'creativecommons.org', 'json-schema.org', 'www.sitemaps.org', 'docs.oasis-open.org',
  'cloud.google.com', 'learn.microsoft.com', 'docs.aws.amazon.com', 'mitre.org',
  'amitpal-cyberbuddy.github.io', 'linux.die.net', 'tools.ietf.org', 'datatracker.ietf.org',
  'www.iana.org', 'infosec.mozilla.org', 'cwe-api.mitre.org'
]);

function collectExternalRefs() {
  const links = new Map();
  for (const file of walk(ROOT, ['.html', '.md', '.json', '.js', '.mjs'])) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/https?:\/\/([a-z0-9.-]+)(\/[^\s"'<>)\]]*)?/gi)) {
      if (source.charAt(match.index + match[0].length) === '\\') continue; // escaped regex pattern artifacts
      const host = match[1].toLowerCase();
      if (host.includes('example.com') || host.includes('example.test') || host === 'localhost') continue;
      if (!links.has(host)) links.set(host, new Set());
      links.get(host).add(`${path.relative(ROOT, file)}`);
    }
  }
  return links;
}

function main() {
  const local = collectLocalRefs();
  const external = collectExternalRefs();
  const unallowed = [...external.entries()]
    .filter(([host]) => !DOC_ALLOWED.has(host) && !referenceUrlAllowed(`https://${host}/`))
    .map(([host, files]) => [host, files.size]);

  console.log(`Local references checked: ${local.total}`);
  if (local.missing.length) {
    console.log(`MISSING local references (${local.missing.length}):`);
    for (const item of local.missing) console.log(`  - ${item}`);
  } else {
    console.log('All local references resolve.');
  }
  console.log(`Distinct external hosts referenced: ${external.size}`);
  if (unallowed.length) {
    console.log('EXTERNAL HOSTS OUTSIDE THE ALLOWLIST (review required):');
    for (const [host, count] of unallowed) console.log(`  - ${host} (${count} files)`);
  } else {
    console.log('All external hosts are within the documented allowlist.');
  }
  if (local.missing.length || unallowed.length) process.exitCode = 1;
}

main();
