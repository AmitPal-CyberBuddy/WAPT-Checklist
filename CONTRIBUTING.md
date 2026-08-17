# Contributing to WAPT Checklist

Thank you for helping build a rigorous, safe, open WAPT methodology.

## Before contributing

- Use this project only for authorized security work.
- Read [the architecture](docs/ARCHITECTURE.md), [taxonomy](docs/TAXONOMY.md), and [content guide](docs/CONTENT-GUIDE.md).
- Search existing and proposed items by objective and synonyms before drafting a new check.
- Open an issue for taxonomy, schema, state-format, or UI architecture changes before implementation.

## Development setup

The site has no build step or runtime dependencies. Use Node.js 18 or newer for tests, then serve the repository over HTTP:

```bash
node --test
node tools/validate.js checklist/sample.json
python3 -m http.server 8000 --bind 0.0.0.0
```

Open `http://localhost:8000/`. Do not open HTML with a `file:` URL because same-origin JSON fetches will not work consistently.

## Content contributions

A checklist item must:

1. prove one clear security objective;
2. use original, imperative wording;
3. describe controlled steps and observable secure/vulnerable behavior;
4. include meaningful validation and false-positive analysis;
5. state realistic impact without assuming maximum compromise;
6. specify sufficient, redacted evidence;
7. cite a real authoritative source and use verified versioned mappings;
8. include a production-safety note whenever the technique can disrupt service or alter data.

Do not submit copied OWASP text, scanner-only checks, uncontextualized payload lists, random blog references, live credentials, target data, denial-of-service instructions, or destructive proof paths.

Stable IDs are assigned during review and are never reused after publication. Floors are minimum quality gates, not quotas; do not split or pad tests to increase counts.

## Code contributions

- Keep the runtime dependency-free and compatible with static GitHub Pages hosting.
- Keep `js/engine/` pure and DOM-free; browser behavior belongs in `js/ui/`.
- Preserve the restrictive CSP. Do not add inline scripts/styles, external assets, telemetry, or network calls to assessment targets.
- Render user and imported content as text, not trusted HTML.
- Use the existing design tokens and severity semantics in both themes.
- Support keyboard operation, visible focus, reduced motion, narrow viewports, and print.
- When CSS or JavaScript changes, bump the single version query consistently in both HTML pages and module imports.

## Tests and review

Add Node standard-library tests for policy, state, preset, or schema changes. Run:

```bash
node --test
node tools/validate.js checklist/sample.json
git diff --check
```

Include manual browser results for changes affecting focus, navigation, storage, themes, responsive layout, or printing. See [docs/QA.md](docs/QA.md).

Pull requests should be small enough to review, explain security and safety decisions, and list verification performed. At least one maintainer review is required. Contributors must not merge around failing validation or unresolved reference concerns.

## Licensing and attribution

By contributing, you agree that your original contribution is licensed under Apache License 2.0. Do not contribute material you cannot license. Framework names, identifiers, and links remain attributed to their respective projects; OWASP WSTG and ASVS source materials have their own CC BY-SA terms.
