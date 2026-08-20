#!/usr/bin/env node
// Build the publishable site (used by the GitHub Pages deploy workflow).
//
// Two jobs in one pass:
//
// 1. Host only what the product needs. The repository doubles as the project
//    workspace — tests, validation tooling, schema, and maintainer documents
//    (QA reports, phase notes, runbooks) live here. None of that belongs on the
//    public site, so the publish tree copies an explicit allowlist instead of
//    the whole repository.
// 2. Clean URLs. GitHub Pages cannot rewrite /name → /name.html, so every
//    secondary page is also published as a directory index:
//      /name/     → the real page (relative asset paths rebased with ../)
//      /name.html → a tiny redirect stub for existing links and bookmarks
//    plus a 404 page that maps extensionless typos to the clean URL.
//
// The repository files are never modified: repo-root pages remain the source
// of truth and keep working for local development.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'publish');
const PAGES = ['app', 'methodology', 'docs', 'workflow'];

const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
const CACHE = release.cache_version || '';
const SITE_ROOT = String(release.pages_url || '').replace(/\/+$/, '');

// Everything the running site may request at build or runtime.
const PUBLIC_DIRS = ['css', 'js', 'assets', 'checklist', 'playbooks', 'payloads', 'attack-chains', 'burp-workflows'];
const PUBLIC_FILES = [
  'index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html',
  'robots.txt', 'sitemap.xml', '.nojekyll', 'release.json', 'SECURITY.md', 'LICENSE'
];
const PUBLIC_DOCS = ['docs/OPERATING.md', 'docs/EVIDENCE-WORKFLOW.md'];
const SKIP_FILES = new Set(['package.json', 'package-lock.json']);

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (SKIP_FILES.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

// Rebase page links for a copy served one directory deeper (/name/index.html):
// assets get ../, page links become clean directory URLs.
function rebaseForDirectory(html) {
  let output = html.replace(/(<html\b[^>]*?)(\s*data-asset-root="[^"]*")?/, '$1 data-asset-root="../"');
  output = output.replace(/(href|src)="(css|js|assets|checklist|playbooks|payloads|attack-chains|burp-workflows|release\.json|SECURITY\.md|LICENSE|docs\/OPERATING\.md|docs\/EVIDENCE-WORKFLOW\.md)\//g, '$1="../$2/');
  output = output.replace(/(href|src)="(app|docs|methodology|workflow)\.html(\?[^#"]*)?(#[^"]*)?"/g, '$1="../$2/$3$4"');
  output = output.replace(/(href|src)="index\.html(#[^"]*)?"/g, '$1="../$2"');
  return output;
}

// Root pages link straight to the clean directory URLs.
function rebaseRootLinks(html) {
  return html.replace(/(href|src)="(app|docs|methodology|workflow)\.html(\?[^#"]*)?(#[^"]*)?"/g, '$1="$2/$3$4"');
}

function canonicalTag(page) {
  return SITE_ROOT ? `<link rel="canonical" href="${SITE_ROOT}/${page}/">` : '';
}

function injectCanonical(html, page) {
  if (!SITE_ROOT) return html;
  return html.replace(/<\/head>/, `  ${canonicalTag(page)}\n</head>`);
}

function stubPage(page) {
  return `<!doctype html>
<html lang="en" data-redirect="${page}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${page}/">
  <title>Redirecting — WAPT Checklist</title>
  <script src="js/legacy-redirect.js?v=${CACHE}" defer></script>
</head>
<body>
  <p>This page has moved to <a href="${page}/">${page}/</a>.</p>
</body>
</html>
`;
}

function notFoundPage() {
  const links = [
    ['', 'Home'], ['app/', 'Start testing'], ['methodology/', 'Methodology'], ['docs/', 'Documentation'], ['workflow/', 'Burp workflows']
  ].map(([slug, label]) => `<li><a href="${SITE_ROOT ? `${SITE_ROOT}/` : ''}${slug}">${label}</a></li>`).join('\n    ');
  return `<!doctype html>
<html lang="en" data-redirect="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found — WAPT Checklist</title>
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/styles.css?v=${CACHE}">
  <link rel="stylesheet" href="css/polish.css?v=${CACHE}">
  <script src="js/legacy-redirect.js?v=${CACHE}" defer></script>
</head>
<body class="app-body">
  <main class="view" style="max-width:640px">
    <p class="eyebrow">404</p>
    <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Page not found</h1>
    <p style="color:var(--muted);font-size:.8rem;line-height:1.6">The page you asked for does not exist on this site. If you followed a link without an extension, you are being redirected to the right place. Otherwise, pick a destination:</p>
    <ul style="display:grid;gap:.4rem;margin:1.2rem 0;padding:0;list-style:none">
    ${links}
    </ul>
  </main>
</body>
</html>
`;
}

fs.rmSync(OUT, { recursive: true, force: true });

// 1. Public allowlist.
for (const dir of PUBLIC_DIRS) {
  const source = path.join(ROOT, dir);
  if (fs.existsSync(source)) copyTree(source, path.join(OUT, dir));
}
for (const file of [...PUBLIC_FILES, ...PUBLIC_DOCS]) {
  const source = path.join(ROOT, file);
  if (!fs.existsSync(source)) throw new Error(`Missing public file: ${file}`);
  fs.mkdirSync(path.join(OUT, path.dirname(file)), { recursive: true });
  fs.copyFileSync(source, path.join(OUT, file));
}

// 2. Clean-URL directory copies + legacy redirect stubs.
for (const page of PAGES) {
  const source = fs.readFileSync(path.join(ROOT, `${page}.html`), 'utf8');
  const directory = path.join(OUT, page);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), injectCanonical(rebaseForDirectory(source), page));
  fs.writeFileSync(path.join(OUT, `${page}.html`), stubPage(page));
}

// 3. Root homepage links directly to the clean URLs; sitemap follows suit.
fs.writeFileSync(path.join(OUT, 'index.html'), rebaseRootLinks(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8')
  .replace(/\/(app|methodology|docs|workflow)\.html</g, '/$1/<');
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

// 4. Friendly 404 with extensionless-path recovery.
fs.writeFileSync(path.join(OUT, '404.html'), notFoundPage());

const published = fs.readdirSync(OUT).length;
console.log(`Publish tree ready: ${OUT} (${published} top-level entries, ${PAGES.length} clean-URL pages, redirect stubs + 404).`);
