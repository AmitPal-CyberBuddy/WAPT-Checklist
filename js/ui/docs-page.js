import { initializeTheme } from './theme.js?v=1.0.0-r15';
import { renderMarkdown } from './markdown.js?v=1.0.0-r15';
import { asset } from './paths.js?v=1.0.0-r15';

// Public documentation map. Only operator-facing documents are served here;
// project-management material (QA reports, phase notes, release runbooks,
// architecture write-ups) stays in the repository for maintainers.
const DOCUMENTS = Object.freeze({
  operating: { title: 'How to run an engagement', kicker: 'OPERATOR GUIDE', summary: 'Quick start, the coverage vocabulary, the family contract, keyboard model, outputs, and the honest limits of this workspace.', file: 'docs/OPERATING.md' },
  security: { title: 'Security policy', kicker: 'RESPONSIBLE DISCLOSURE', summary: 'How to report a vulnerability in WAPT Checklist privately, what is in scope, and which versions receive fixes.', file: 'SECURITY.md' },
  'evidence-workflow': { title: 'Evidence & retest workflow', kicker: 'FINDINGS / VERDICTS / COVERAGE', summary: 'How observations become reportable findings, how evidence packs and retest verdicts work, and how coverage confidence is computed.', file: 'docs/EVIDENCE-WORKFLOW.md' },
  license: { title: 'Apache License 2.0', kicker: 'OPEN SOURCE LICENSE', summary: 'Terms for using, modifying, and distributing the project’s original software and content.', file: 'LICENSE', plain: true }
});

async function loadDocument() {
  initializeTheme();
  const requested = new URLSearchParams(location.search).get('doc') || 'operating';
  const key = Object.hasOwn(DOCUMENTS, requested) ? requested : 'operating';
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
    const response = await fetch(asset(documentInfo.file), { headers: { Accept: 'text/plain' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderMarkdown(await response.text(), root, { plain: documentInfo.plain });
  } catch (error) {
    root.replaceChildren();
    const message = document.createElement('p');
    message.className = 'document-error';
    message.textContent = 'This document could not be loaded. Refresh the page and try again.';
    root.append(message);
  }
}

loadDocument();
