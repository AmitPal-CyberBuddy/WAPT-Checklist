# Phase 4 — core content progress

> In progress — 2026-08-17

Phase 4 authors production methodology for categories 01–10. Floors remain release gates, not quotas. A category is marked complete only when its production JSON, manifest count, semantic validation, and focused content/safety tests pass.

| # | Category | Floor | Current | Status |
|---:|---|---:|---:|---|
| 01 | Reconnaissance | 30 | 37 | Complete |
| 02 | HTTP / Web fundamentals | 25 | 0 | Not started |
| 03 | Authentication | 40 | 0 | Not started |
| 04 | Session management | 25 | 0 | Not started |
| 05 | Authorization | 35 | 0 | Not started |
| 06 | Injection | 45 | 0 | Not started |
| 07 | Cross-site scripting | 25 | 0 | Not started |
| 08 | Cross-site request forgery | 15 | 0 | Not started |
| 09 | File handling | 20 | 0 | Not started |
| 10 | API security | 35 | 0 | Not started |

Core floor total: **295**. Current production total: **37**.

## Reconnaissance coverage

The first production category deliberately separates discovery from vulnerability confirmation. Its 37 items cover:

- passive search, certificate transparency, DNS, hosting, TLS, and bounded service discovery;
- web server, framework, packaged-application, routing, and architecture fingerprinting;
- robots, sitemaps, well-known resources, HTML, JavaScript, and source maps;
- forms, parameters, route/method operations, errors, and workflow state maps;
- authentication/account lifecycle, APIs, OpenAPI, GraphQL, WebSocket/SSE, files, and search surfaces;
- admin/non-production assets, edge/origin comparisons, third parties, browser storage, role/tenant matrices, and the final attack-surface register.

Every item includes distinct objectives and steps, secure/vulnerable decision boundaries, at least two realistic false positives, reproducible/redacted evidence guidance, original wording, pinned WSTG 4.2 traceability, context expressions where relevant, and safety notes for active or potentially disruptive work.

## Incremental validation

During phased authoring, run:

```bash
node tools/validate.js --floors-present
node --test
```

`--floors-present` enforces the floor for every production category file currently present without failing categories not authored yet. The final Phase 4 gate will additionally require categories 01–10 and at least 295 core items. The eventual full release uses `--floors` for all 24 categories.
