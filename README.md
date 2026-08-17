# WAPT Checklist

A professional, context-aware Web Application Penetration Testing methodology, checklist, knowledge base, and local-first tester workspace for **authorized security assessments only**.

[Open the GitHub Pages site](https://amitpal-cyberbuddy.github.io/WAPT-Checklist/) · [Start a WAPT](https://amitpal-cyberbuddy.github.io/WAPT-Checklist/app.html#wizard) · [Review the architecture](docs/ARCHITECTURE.md)

> **Project status:** Phases 1–4 are implemented. Core categories 01–10 contain 348 production items and every category-specific floor passes. The 20 Phase 1 items remain schema review samples and do not count toward production totals. Phase 5 workspace functionality is next.

## What is implemented

- Responsive dark/light homepage and app-style workspace with independent CyberBuddy-compatible design tokens.
- Optional engagement name and target URL fields plus all 14 scoping questions.
- Quick-start presets for a static site, multi-tenant JWT SaaS, corporate SSO portal, and payment-enabled e-commerce application.
- Back/next navigation, explicit Unknown choices, editable presets, progress, focus movement, and keyboard interaction.
- Conservative low-confidence URL suggestions without any target request or transmission.
- One validated local state document under `wapt.state.v1`; no backend, account, synchronization, or telemetry.
- Pure DOM-free context, applicability, priority, and state engines shared by browser code and Node tests.
- Three-state Active / Confirm / N/A evaluation, visible credential-blocked roadmap work, conditional methodology variants, and reason codes.
- Deterministic Suggested next scoring with workflow, severity, context, prerequisite, and attack-chain components.
- Strict JSON state portability helpers, reasoned applicability overrides, per-item notes, and Confirmed Finding retest invariants.
- Manifest-driven navigation for all 24 categories and honest live local/project statistics.
- Restrictive CSP, authorized-use messaging, self-hosted Sora and IBM Plex Mono fonts, reduced-motion support, visible focus, and print foundations.
- Ready-to-apply GitHub Pages deployment and zero-dependency CI workflow templates.
- Phase 1 architecture, taxonomy, schema, validator, and 20 complete methodology samples.

> **Workflow permission note:** this session's GitHub App cannot push `.github/workflows/**`. GitHub rejected those paths, so the exact `ci.yml` and `deploy.yml` files are carried in [`docs/workflows/`](docs/workflows/README.md) for a maintainer to copy after merge.

## Run locally

No package install or build step is required. Use Node.js 18 or newer for verification:

```bash
node --test
node tools/validate.js checklist/sample.json
node tools/validate.js --core-floors
python3 -m http.server 8000 --bind 0.0.0.0
```

Open `http://localhost:8000/`. Same-origin JSON fetches mean the site should be served over HTTP rather than opened with a `file:` URL.

## Repository map

```text
index.html                 Homepage and live statistics
app.html                   Workspace, wizard, and catalog shell
css/                       Independent design tokens, responsive UI, print
js/ui/                     Browser rendering, wizard, storage adapter
js/engine/                 Pure context, applicability, priority, state policy
js/data/presets.mjs        Plain context mappings for quick starts
checklist/manifest.json    Category metadata and honest production counts
checklist/reconnaissance.json  Phase 4 production reconnaissance methodology
checklist/http.json          Phase 4 HTTP and browser protocol methodology
checklist/authentication.json Phase 4 authentication methodology
checklist/session-management.json Phase 4 session lifecycle methodology
checklist/authorization.json Phase 4 object, function, field, and tenant authorization
checklist/injection.json     Phase 4 interpreter-boundary methodology
checklist/xss.json           Phase 4 browser execution and context methodology
checklist/csrf.json          Phase 4 browser request-intent methodology
checklist/file-handling.json Phase 4 upload, download, path, and parser methodology
checklist/api-security.json  Phase 4 API Top 10 and protocol methodology
checklist/sample.json      20 Phase 1 review items (not production counts)
schema/item.schema.json    Checklist item contract
tools/validate.js          Zero-dependency content validator
tests/                     Node standard-library tests
docs/                      Architecture, taxonomy, content rules, and QA
```

The pure context, applicability, priority, and state modules live in `js/engine/`; see the [adaptive engine contract](docs/ENGINE.md). UI modules consume these functions without mixing policy into DOM rendering.

## Safety and privacy

Use this project only where you have explicit authorization. Prefer reversible test objects and the least-impacting proof. Coordinate any technique that can affect shared infrastructure. Never retain real credentials or unredacted tokens, personal data, or tenant identifiers as evidence.

Target URLs, answers, notes, and statuses are designed to remain in the browser's local storage unless the tester explicitly exports them. The application does not fetch the target URL. There is no project-operated backend, telemetry, remote font, or CDN request.

## Quality model

The production release requires 24 categories and at least 512 validated items. Floors are release gates, not quotas. Every item must explain its security objective, prerequisites, controlled steps, secure/vulnerable behavior, validation, likely false positives, realistic impact, redacted evidence, safety where needed, and authoritative references.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Adaptive engine contract](docs/ENGINE.md)
- [Taxonomy and stable identifiers](docs/TAXONOMY.md)
- [Content authoring guide](docs/CONTENT-GUIDE.md)
- [Manual browser QA](docs/QA.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Standards and attribution

The methodology uses original wording and maps to authoritative material including the [OWASP Web Security Testing Guide 4.2](https://owasp.org/www-project-web-security-testing-guide/v42/), [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0), OWASP API Security Top 10, OWASP Top 10 (2021 and 2025), CWE, IETF specifications, WHATWG/W3C specifications, official vendor documentation, and PortSwigger Web Security Academy.

OWASP WSTG and ASVS are available under Creative Commons Attribution-ShareAlike licenses. Their names, identifiers, and links are used for attribution and traceability; checklist prose is independently authored. Sora and IBM Plex Mono are distributed under the SIL Open Font License; notices are retained in `assets/fonts/`.

This repository's original software and content are licensed under the [Apache License 2.0](LICENSE), except where a third-party notice states otherwise.

## Roadmap

1. ~~Architecture, taxonomy, schema, and 20-item sample~~
2. ~~Repository shell, responsive UI, scoping wizard, presets, and Pages workflow templates~~
3. ~~Pure adaptive engine with derivation and scenario tests~~
4. ~~Core production content, categories 01–10~~ — **348 items; every category floor passes**
5. Search, filters, statuses, notes, import/export, and report generation
6. Advanced production content, categories 11–24
7. Attack chains, contextual payload library, and Burp workflows
8. Reference and mapping verification
9. Content and safety QA
10. Public release hardening and deployment review
