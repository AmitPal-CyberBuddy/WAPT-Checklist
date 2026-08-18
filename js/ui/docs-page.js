import { initializeTheme } from './theme.js?v=1.0.0-r5';
import { renderMarkdown } from './markdown.js?v=1.0.0-r5';

const DOCUMENTS = Object.freeze({
  security: { title: 'Security policy', kicker: 'RESPONSIBLE DISCLOSURE', summary: 'How to report project vulnerabilities privately, what is in scope, and which versions receive fixes.', file: 'SECURITY.md' },
  contributing: { title: 'Contributing', kicker: 'BUILD WITH RIGOR', summary: 'Content quality, code architecture, safety, testing, attribution, and pull-request expectations.', file: 'CONTRIBUTING.md' },
  'content-guide': { title: 'Content standard', kicker: 'DECISION-GRADE METHODOLOGY', summary: 'The editorial and safety contract every production checklist item must satisfy.', file: 'docs/CONTENT-GUIDE.md' },
  architecture: { title: 'Architecture', kicker: 'STATIC-FIRST SYSTEM', summary: 'Runtime boundaries, data flow, state, applicability, security controls, and delivery decisions.', file: 'docs/ARCHITECTURE.md' },
  taxonomy: { title: 'Taxonomy and IDs', kicker: '25-CATEGORY MODEL', summary: 'Stable item identifiers, controlled context vocabulary, category ownership, mappings, and workflow order.', file: 'docs/TAXONOMY.md' },
  engine: { title: 'Adaptive engine', kicker: 'PURE POLICY MODULES', summary: 'Context normalization, applicability, priority scoring, and immutable local state.', file: 'docs/ENGINE.md' },
  'browser-qa': { title: 'Browser QA', kicker: 'MANUAL RELEASE MATRIX', summary: 'Pages, wizard, workspace, accessibility, responsiveness, persistence, and print smoke checks.', file: 'docs/QA.md' },
  responsive: { title: 'Responsive QA', kicker: 'PHONE TO WIDE MONITOR', summary: 'Intended screen compositions, structural protections, automated assertions, and manual sign-off sizes.', file: 'docs/RESPONSIVE-QA.md' },
  'reference-qa': { title: 'Reference QA', kicker: 'AUTHORITATIVE TRACEABILITY', summary: 'WSTG, ASVS, CWE, Top 10, live-source snapshots, and mapping corrections.', file: 'docs/REFERENCE-QA.md' },
  'content-qa': { title: 'Content QA report', kicker: 'ZERO UNRESOLVED WARNINGS', summary: 'Duplication, terminology, evidence depth, safety, payload, and content-quality audit results.', file: 'docs/CONTENT-QA-REPORT.md' },
  libraries: { title: 'Connected libraries', kicker: 'CHAINS / PAYLOADS / BURP', summary: 'Attack-chain graphs, contextual references, REVIEW-ONLY behavior, and safe tool workflows.', file: 'docs/PHASE7-LIBRARIES.md' },
  release: { title: 'Release and deployment', kicker: 'VERSION 1.0.0', summary: 'Quality gates, GitHub Pages setup, maintainer actions, publication, and rollback.', file: 'docs/RELEASE.md' },
  license: { title: 'Apache License 2.0', kicker: 'OPEN SOURCE LICENSE', summary: 'Terms for using, modifying, and distributing the project’s original software and content.', file: 'LICENSE', plain: true }
});

async function loadDocument() {
  initializeTheme();
  const requested = new URLSearchParams(location.search).get('doc') || 'security';
  const key = Object.hasOwn(DOCUMENTS, requested) ? requested : 'security';
  const documentInfo = DOCUMENTS[key];
  document.title = `${documentInfo.title} — WAPT Checklist`;
  document.querySelector('[data-doc-title]').textContent = documentInfo.title;
  document.querySelector('[data-doc-kicker]').textContent = documentInfo.kicker;
  document.querySelector('[data-doc-summary]').textContent = documentInfo.summary;
  document.querySelectorAll('[data-doc-link]').forEach((link) => {
    if (link.dataset.docLink === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const root = document.querySelector('[data-doc-content]');
  try {
    const response = await fetch(documentInfo.file, { headers: { Accept: 'text/plain' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderMarkdown(await response.text(), root, { plain: documentInfo.plain });
  } catch (error) {
    root.replaceChildren();
    const message = document.createElement('p');
    message.className = 'document-error';
    message.textContent = `The document could not be loaded: ${error.message}. Serve the repository over HTTP rather than opening this page directly.`;
    root.append(message);
  }
}

loadDocument();
