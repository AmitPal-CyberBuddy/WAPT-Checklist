# WAPT Checklist

A professional, context-aware Web Application Penetration Testing methodology, checklist, knowledge base, and local-first tester workspace for **authorized security assessments only**.

[Open the GitHub Pages site](https://amitpal-cyberbuddy.github.io/WAPT-Checklist/) · [Start a WAPT](https://amitpal-cyberbuddy.github.io/WAPT-Checklist/app.html#wizard) · [Review the architecture](docs/ARCHITECTURE.md)

> **Project status:** Version **1.0.0 release candidate**; Phases 1–10 implementation and QA are complete. The local-first adaptive workspace contains 623 validated production items across all 25 categories, five attack-chain graphs, 40 contextual payload references, and 12 Burp workflows. Deployed via GitHub Actions on 2026-08-18 (PR #3 merged, `9874987`); browser and visual QA sign-off remains pending.

## What is implemented

- Responsive dark/light homepage and app-style workspace with professional operator tooling: project metrics, an assessment-loop pipeline, an attack-chain preview, skeleton loading, filter chips, and a shortcuts dialog.
- Optional engagement name and target URL fields plus all 18 adaptive scoping questions, including intermediary, outbound-fetch, and asynchronous-job scope.
- Quick-start presets for a static site, multi-tenant JWT SaaS, corporate SSO portal, and payment-enabled e-commerce application.
- Back/next navigation, explicit Unknown choices, editable presets, progress, focus movement, visible keyboard focus, and safe shortcuts (`/`, `g d`, `g c`, `g f`, `?`, `Esc`).
- Conservative low-confidence URL suggestions without any target request or transmission.
- Intermediary (CDN/proxy/WAF), outbound URL-fetching (webhooks/imports), and asynchronous-job scoping with category gates for SSRF and cache-poisoning/deception suites.
- Multiple resumable engagements in one validated local portfolio under `wapt.state.v1`; no backend, account, synchronization, or telemetry.
- Pure DOM-free context, applicability, priority, and state engines shared by browser code and Node tests.
- Three-state Active / Confirm / N/A evaluation, visible credential-blocked roadmap work, conditional methodology variants, and reason codes.
- Deterministic Suggested next scoring with workflow, severity, context, prerequisite, and attack-chain components, and per-recommendation explanations (state, category, severity, reasons, chain unlocks).
- Strict JSON import/export with automatic schema v1 → v2 state migration, reasoned applicability overrides, per-item notes, evidence-pack records, and Confirmed Finding retest invariants.
- Explainable category rationale in the checklist view: why a suite is active, boosted, or waiting for scope confirmation.
- Lazy category loading plus full-text search across IDs, objectives, steps, tags, tools, technologies, and mappings.
- Combined category, severity, difficulty, status, mode, applicability, technology, tool, tag, and ID filters, with removable active-filter chips, a Testing/Coverage view toggle, and 196 validated test families that group every checklist item so testers can work an attack surface without losing context.
- Tester-first cards with four disclosure levels — always-visible Quick Test and Validate, Don't miss & related (family don't-miss lists, related chips, next-in-family), the full detailed methodology, and references — plus a Tester notes & evidence drawer with a second quick status control.
- Dashboard command center: catalog/tested/potential/confirmed/blocked/scoped-out metrics, live category progress, coverage confidence (executable work excluding context-N/A), Suggested next with explanations, a retest queue, attack-chain progress, findings table, structured evidence packs with exploitability and retest verdicts, Markdown checklist/report generation, retest matrix, and print view.
- Directed attack-chain graphs with checklist links, per-node test status, unlock hints, and priority boosts; the homepage previews the same chains.
- Searchable contextual payload/reference library with collapsed REVIEW-ONLY content and related tests.
- Safe when/why/evidence/boundary workflows for 12 Burp Suite tools and extensions.
- Designed methodology, security, contributing, license, project-documentation, and Burp-workflow pages—no user-facing raw Markdown redirects.
- Manifest-driven navigation for all 25 categories and honest live local/project statistics.
- Restrictive CSP, authorized-use messaging, self-hosted Sora and IBM Plex Mono fonts, reduced-motion support, visible focus, and print foundations.
- Ready-to-apply GitHub Pages deployment and zero-dependency CI workflow templates.
- Phase 1 architecture, taxonomy, schema, validator, and 20 complete methodology samples.

> **Workflow permission note:** this session's GitHub App cannot push `.github/workflows/**`. GitHub rejected those paths, so the exact `ci.yml` and `deploy.yml` files are carried in [`docs/workflows/`](docs/workflows/README.md) for a maintainer to copy after merge.

## Run locally

No package install or build step is required. Use Node.js 18 or newer for verification:

```bash
node --test
node tools/validate.js checklist/sample.json
node tools/validate.js --floors
node tools/check-references.js
node tools/audit-content.js
# Optional network-enabled recheck after the committed live snapshot:
node tools/check-references.js --live
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
checklist/graphql.json      Phase 6 GraphQL methodology
checklist/jwt.json          Phase 6 JSON Web Token methodology
checklist/oauth-sso-saml.json Phase 6 federation methodology
checklist/ssrf.json         Phase 6 server-side request forgery methodology
checklist/request-smuggling.json Phase 6 HTTP desynchronization methodology
checklist/business-logic.json Phase 6 workflow and invariant methodology
checklist/race-conditions.json Phase 6 bounded concurrency methodology
checklist/client-side.json    Phase 6 browser trust-boundary methodology
checklist/websocket.json      Phase 6 WebSocket methodology
checklist/security-headers.json Phase 6 browser policy methodology
checklist/cloud-storage.json  Phase 6 cloud identity and object-storage methodology
checklist/information-disclosure.json Phase 6 disclosure methodology
checklist/rate-limiting.json Phase 6 anti-automation and abuse methodology
checklist/advanced.json      Phase 6 cross-component advanced methodology
checklist/sample.json      20 Phase 1 review items (not production counts)
attack-chains/             Directed graphs over stable checklist IDs
payloads/                  Contextual, safety-labeled reference values
burp-workflows/            Tool-specific safe testing workflows
schema/item.schema.json    Checklist item contract
tools/validate.js          Zero-dependency content validator
tests/                     Node standard-library tests
docs/                      Architecture, taxonomy, content rules, QA, release runbook
release.json               Machine-readable 1.0.0 release manifest
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
- [Engagement workspace](docs/PHASE5-WORKSPACE.md)
- [Connected testing libraries](docs/PHASE7-LIBRARIES.md)
- [Evidence, reportability, and retest workflow](docs/EVIDENCE-WORKFLOW.md)
- [Feature verification matrix](docs/FEATURE-VERIFICATION.md)
- [Functional test report](docs/FUNCTIONAL-TEST-REPORT.md) — application-level runs: 41/41 checks, two scripted user journeys, runtime privacy audit
- [Reference and mapping QA](docs/REFERENCE-QA.md)
- [Content and safety QA report](docs/CONTENT-QA-REPORT.md)
- [Version 1.0.0 release and deployment runbook](docs/RELEASE.md)
- [Responsive layout QA](docs/RESPONSIVE-QA.md)
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
5. ~~Search, filters, statuses, notes, import/export, reporting, retesting, and print workspace~~
6. ~~Advanced production content, categories 11–24~~ — **261 items; all 24 catalog floors pass**
7. ~~Attack chains, contextual payload library, and Burp workflows~~
8. ~~Reference and mapping verification~~ — **source snapshots and live-source catalog green**
9. ~~Content and safety QA~~ — **0 errors and 0 unresolved warnings**
10. ~~Release hardening and deployment review~~ — **deployment pending maintainer workflow installation and merge**
11. ~~Post-release review~~ — **609-item baseline verified; five defects fixed; scope dimensions, Suggested-next explanations, and privacy regression suite**
12. ~~Reportability layer~~ — **do-not-report boundaries and retest guidance on 59+17 items**
13. ~~Modern coverage~~ — **gated AI/LLM category, XS-Leaks, bfcache, subdomain-takeover identification (623 items / 25 categories)**
14. ~~Evidence and retesting~~ — **state v2 evidence packs, reportability gate, coverage confidence, retest verdicts**
15. ~~UI/UX modernization~~ — **dashboard command center, homepage loop, shortcuts, skeletons, filter chips**
16. ~~QA and release hardening~~ — **vocabulary parity, severity diversity, end-to-end workflow test, evidence documentation**
