# Phase 5 — engagement workspace

> Complete — 2026-08-18

Phase 5 turns the validated core methodology into a usable local assessment workspace. No target, answer, status, note, finding, or report data leaves the browser.

## Content loading

`js/ui/catalog.js` loads the manifest once and fetches individual same-origin category JSON files on demand. Requests are cached per category for the page lifetime. Opening one category loads only that file; global search, dashboard suggestions, or reporting deliberately loads all currently published categories.

## Search and filters

Full-text indexing covers test ID, title, objective, steps, manipulate guidance, secure/vulnerable behavior, impact, tags, tools, and mappings. Search terms combine with AND semantics.

Available filters:

- category;
- severity;
- difficulty;
- recorded status;
- manual/automated mode;
- Active, Confirm, or context-N/A applicability;
- technology/context term;
- tool;
- tag;
- exact or partial test ID.

Checklist browsing hides context-N/A by default while keeping Confirm visible. Selecting the N/A filter exposes excluded tests. A tester can override context-N/A only after entering a reason; the declarative item condition remains unchanged.

## Test cards and local state

Cards expose the complete methodology contract in expandable sections, including context variants, examples, false-positive guidance, safety boundaries, references, and mappings. Copy controls operate on individual methodology sections.

Each item supports:

- Not Tested, In Progress, Passed, Potential Finding, Confirmed Finding, and N/A status;
- local free-text tester notes;
- a retest flag only for Confirmed Findings;
- reasoned applicability override.

Status and notes are written through pure immutable `state.js` helpers and persisted through the single `wapt.state.v1` browser key.

## Dashboard

The dashboard loads production content to compute:

- catalog and recorded-status metrics;
- per-category tested progress;
- context-aware Suggested next items from the Phase 3 priority engine;
- potential and confirmed findings;
- retest indicators;
- live tested/total counts in category navigation.

Scanner leads should remain notes or Potential Findings until the methodology's validation and false-positive checks are complete.

## Portability and reports

Client-side exports include:

- Markdown checklist grouped by category;
- validated JSON state;
- Markdown assessment report with engagement summary, findings table, CVSS placeholder, retest matrix, reporting quality gate, and methodology coverage.

JSON import is limited to 1 MB and passes through strict v1 state normalization before replacing local state. Markdown escapes raw HTML in user notes. Exported drafts explicitly require review and redaction before distribution.

## Print

The print stylesheet produces a light A4 engagement view, removes navigation and controls, preserves dashboard metrics/findings/progress, and prints checklist cards without decorative effects. Expanded methodology sections print when the tester intentionally opens them.

## Verification

```bash
node --test
node tools/validate.js --core-floors
python3 -m http.server 8000 --bind 0.0.0.0
```

Automated coverage verifies exact full-text CORS results, combined structured filters, category-fetch caching, HTML-safe notes export, findings/retest report composition, required workspace controls, cache-version consistency, state import/export invariants, and all prior engine/content gates.
