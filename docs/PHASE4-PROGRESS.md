# Phase 4 — core content progress

> In progress — 2026-08-17

Phase 4 authors production methodology for categories 01–10. Floors remain release gates, not quotas. A category is marked complete only when its production JSON, manifest count, semantic validation, and focused content/safety tests pass.

| # | Category | Floor | Current | Status |
|---:|---|---:|---:|---|
| 01 | Reconnaissance | 30 | 37 | Complete |
| 02 | HTTP / Web fundamentals | 25 | 26 | Complete |
| 03 | Authentication | 40 | 45 | Complete |
| 04 | Session management | 25 | 28 | Complete |
| 05 | Authorization | 35 | 43 | Complete |
| 06 | Injection | 45 | 55 | Complete |
| 07 | Cross-site scripting | 25 | 30 | Complete |
| 08 | Cross-site request forgery | 15 | 18 | Complete |
| 09 | File handling | 20 | 26 | Complete |
| 10 | API security | 35 | 0 | Not started |

Core floor total: **295**. Current production total: **308**.

## File handling coverage

The file-handling catalog adds 26 tests for per-flow contracts, extension/type/signature and filename canonicalization, server execution and same-origin active content, overwrite/collision, filename traversal, ZIP Slip, archive links and expansion limits, quotas and image dimensions, normalization/metadata, SVG and inert polyglot review, malware-scanning boundaries, upload/download authorization, traversal encodings, local/remote inclusion, safe Content-Disposition, quarantine/temp files, privileged previews, and generated artifact delivery. Destructive files, malware, shells, parser exploits, decompression bombs, system-file reads, and internal fetches are explicitly prohibited.

## Cross-site request forgery coverage

The CSRF catalog adds 18 browser-validated tests for ambient-credential action inventory, missing/invalid/session/action-bound tokens, token entropy and leakage, Origin/Referer, actual SameSite behavior with cookie and JWT transport variants, simple media types and method overrides, unsafe GET, login/logout CSRF, multipart uploads, GraphQL mutations, CORS-versus-CSRF false-positive analysis, and critical-action step-up/transaction binding. Every conclusion requires a real browser and committed server state, not Repeater success or status codes alone.

## Cross-site scripting coverage

The XSS catalog adds 30 tests for reflected context analysis (HTML text, quoted/unquoted attributes, JavaScript strings/templates/JSON, and URL attributes as sub-steps rather than duplicate items), ordinary and privileged stored paths, URL/message/storage/API/WebSocket DOM flows, HTML and dynamic-code sinks, URL schemes, sanitizers and mutation XSS, rich text/SVG/Markdown, framework escape hatches and client templates, active uploads, JSONP/charset differentials, CSP/WAF interpretation, self-XSS and tooling false positives, dangling markup/base injection, script gadgets, Trusted Types, and safe impact evidence. Proofs never collect cookies, tokens, credentials, or personal data.

## Injection coverage

The injection catalog adds 55 context-aware tests covering SQL and ORM query construction, NoSQL operators/auth/aggregation, LDAP filters and DNs, XPath, XML/XXE/DTD/XInclude, shell command and argument boundaries, server-side templates with stack variants, Java/.NET/Node/Python expression evaluation, CRLF response/log/email paths, parameter pollution, CSV formulas/structure, Host and forwarded authority, SMTP/IMAP, regular expressions/ReDoS, and SSI. Runtime probes use paired inert controls, strict delay/request ceilings, synthetic records, and no destructive commands or sensitive-file retrieval.

## Authorization coverage

The authorization catalog adds 43 detailed tests spanning unauthenticated and horizontal object access, reads/writes/deletes/collections/bulk/nested/files/reports/jobs, vertical functions and role/ownership/property manipulation, field-level policy, multi-tenant isolation and invitations, groups and delegation, workflow approvals and impersonation, stale authorization caches/claims, batched and real-time operations, search and existence oracles, signed capabilities, confused-deputy integrations, deny-by-default, administrative layering, state/version/representation parity, and auditability. Mutation tests use synthetic objects with explicit restoration guidance.

## Session management coverage

The session catalog adds 28 tests for token inventory and transport, cookie attributes/scope/lifetime, token entropy and contents, fixation and rotation, concurrency, logout and device revocation, idle/absolute/server expiry, URL and browser-storage exposure, disablement and credential-change termination, puzzling and cross-application isolation, account switching, federated logout and user intent, distributed revocation, and rotated-token replay. Token values are explicitly redacted throughout.

## Authentication coverage

The authentication catalog adds 45 tests across credential transport, default/bootstrap secrets, account enumeration, username and password policy, brute-force/stuffing/lockout behavior, route/parser bypasses, persistent login, password change and reset, MFA enrollment/challenges/codes/recovery/removal/trusted devices/push, alternate channels and SSO fallback, fail-closed behavior, step-up, notifications/logging, WebAuthn passkeys, and recovery assurance. Active guessing and factor changes carry explicit test ceilings and cleanup guidance.

## HTTP / Web fundamentals coverage

The second production category adds 26 tests for methods and safe semantics, body and response types, MIME/charset behavior, path and encoding normalization, duplicate parameters, request-target/authority/proxy trust, redirects and HTTPS entry, CORS, browser/shared caching, cache keys and variation, conditional/range requests, compression side channels, and safe message-framing checks. Missing headers or protocol differences are never findings without a demonstrated security effect.

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
