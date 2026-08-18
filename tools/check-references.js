#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { referenceUrlAllowed } = require('./validate.js');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference-catalog.json'), 'utf8'));

function productionItems() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'manifest.json'), 'utf8'));
  return manifest.categories.filter(({ count }) => count > 0).flatMap(({ file }) => {
    const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', file), 'utf8'));
    return document.items;
  });
}

function wstgPath(url) {
  const marker = '/www-project-web-security-testing-guide/';
  if (!url.includes(marker)) return null;
  return url.split(marker, 2)[1] + '.md';
}

function offlineCheck(items) {
  const errors = [];
  const urls = new Set();
  const wstgPaths = new Set(CATALOG.wstg_paths);
  const wstgIds = new Set(CATALOG.wstg_ids);
  const asvsIds = new Set(CATALOG.asvs_ids);
  const topIds = new Set(CATALOG.owasp_top10_ids);
  const apiIds = new Set(CATALOG.api_top10_ids);

  for (const item of items) {
    const seen = new Set();
    for (const reference of item.references) {
      if (!referenceUrlAllowed(reference.url)) errors.push(`${item.id}: unapproved reference URL ${reference.url}`);
      if (seen.has(reference.url)) errors.push(`${item.id}: duplicate reference URL ${reference.url}`);
      seen.add(reference.url); urls.add(reference.url);
      const pathName = wstgPath(reference.url);
      if (pathName && !wstgPaths.has(pathName)) errors.push(`${item.id}: WSTG v4.2 path absent from verified repository snapshot: ${pathName}`);
      if (reference.source === 'OWASP WSTG' && !pathName) errors.push(`${item.id}: OWASP WSTG source does not use a pinned v42 URL`);
      if (/placeholder|example title|owasp reference:/i.test(reference.title)) errors.push(`${item.id}: placeholder reference title ${reference.title}`);
    }
    if (item.mappings.wstg.length && !item.references.some(({ source }) => source === 'OWASP WSTG')) errors.push(`${item.id}: WSTG mapping has no WSTG reference`);
    const referencedWstgIds = new Set(item.references.flatMap((reference) => {
      const page = wstgPath(reference.url);
      return page ? (CATALOG.wstg_page_ids[page] || []).map((id) => `WSTG-v42-${id.slice(5)}`) : [];
    }));
    for (const id of item.mappings.wstg) {
      if (!wstgIds.has(id)) errors.push(`${item.id}: WSTG ID absent from official v4.2 page snapshot: ${id}`);
      if (!referencedWstgIds.has(id)) errors.push(`${item.id}: WSTG mapping ${id} is not declared by its referenced WSTG page`);
    }
    for (const id of item.mappings.asvs) if (!asvsIds.has(id)) errors.push(`${item.id}: ASVS ID absent from official 5.0.0 snapshot: ${id}`);
    for (const id of item.mappings.owasp_top10) if (!topIds.has(id)) errors.push(`${item.id}: unsupported OWASP Top 10 edition ID: ${id}`);
    for (const id of item.mappings.api_top10) if (!apiIds.has(id)) errors.push(`${item.id}: unsupported API Top 10 ID: ${id}`);
    for (const id of item.mappings.cwe) urls.add(`https://cwe.mitre.org/data/definitions/${id.slice(4)}.html`);
    for (const url of item.mappings.portswigger) urls.add(url);
  }
  return { errors, urls };
}

async function checkOne(url, attempts = 3) {
  let last = 'unknown error';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { 'User-Agent': 'WAPT-Checklist-reference-checker/0.8 (+https://github.com/AmitPal-CyberBuddy/WAPT-Checklist)', Range: 'bytes=0-4095' }
      });
      clearTimeout(timeout);
      const reachable = (response.status >= 200 && response.status < 400) || [401, 403, 405, 429].includes(response.status);
      try { await response.body?.cancel(); } catch {}
      if (reachable) return { url, ok: true, status: response.status, finalUrl: response.url };
      last = `HTTP ${response.status}`;
    } catch (error) {
      clearTimeout(timeout);
      last = error.name === 'AbortError' ? 'timeout' : error.message;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  return { url, ok: false, error: last };
}

async function liveCheck(urls, concurrency = 8) {
  const queue = [...urls];
  const results = [];
  async function worker() {
    while (queue.length) results.push(await checkOne(queue.shift()));
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

async function main() {
  const live = process.argv.includes('--live');
  const items = productionItems();
  const offline = offlineCheck(items);
  if (offline.errors.length) {
    console.error(`Reference validation failed with ${offline.errors.length} error(s):`);
    offline.errors.forEach((error) => console.error(`  - ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Offline reference validation passed for ${items.length} items, ${offline.urls.size} unique reference/mapping URLs, ${CATALOG.wstg_paths.length} pinned WSTG paths, and ${new Set(items.flatMap((item) => item.mappings.asvs)).size} used ASVS IDs.`);
  if (!live) return;
  const results = await liveCheck(offline.urls);
  const failures = results.filter(({ ok }) => !ok);
  const report = { checked_at: new Date().toISOString(), total: results.length, passed: results.length - failures.length, failed: failures.length, results };
  fs.writeFileSync(path.join(ROOT, 'tools', 'link-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (failures.length === results.length && failures.every(({ error }) => /fetch failed|timeout/.test(error))) {
    console.error(`Live link check could not reach any of ${results.length} URLs; outbound HTTP is unavailable in this environment. Offline source snapshots still passed. Run --live from a connected environment.`);
    process.exitCode = 2;
    return;
  }
  if (failures.length) {
    console.error(`Live link check failed for ${failures.length}/${results.length} URL(s):`);
    failures.forEach(({ url, error }) => console.error(`  - ${url}: ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Live link check passed for ${results.length}/${results.length} unique URLs.`);
}

if (require.main === module) main();
module.exports = { productionItems, offlineCheck, liveCheck, wstgPath };
