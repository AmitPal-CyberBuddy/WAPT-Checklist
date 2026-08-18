# Phase 6 — advanced content progress

> Complete — 2026-08-18

Phase 6 authors production methodology for categories 11–24. Category floors remain independent release gates.

| # | Category | Floor | Current | Status |
|---:|---|---:|---:|---|
| 11 | GraphQL | 12 | 15 | Complete |
| 12 | JWT | 15 | 18 | Complete |
| 13 | OAuth / SSO / SAML | 18 | 22 | Complete |
| 14 | SSRF | 12 | 15 | Complete |
| 15 | Request smuggling / desync | 12 | 14 | Complete |
| 16 | Business logic | 30 | 35 | Complete |
| 17 | Race conditions | 10 | 12 | Complete |
| 18 | Client-side security | 25 | 29 | Complete |
| 19 | WebSocket | 8 | 10 | Complete |
| 20 | Security headers | 20 | 24 | Complete |
| 21 | Cloud / storage | 15 | 18 | Complete |
| 22 | Information disclosure | 15 | 18 | Complete |
| 23 | Rate limiting / abuse | 10 | 12 | Complete |
| 24 | Advanced topics | 15 | 18 | Complete |

Advanced floor total: **217**. Current Phase 6 production total: **260**. Overall production catalog: **608**.

## Advanced-topic coverage

The advanced catalog adds 18 cross-component tests for cache poisoning/deception/key canonicalization/origin parity, Java/Python/PHP/.NET deserialization, JSON/URL/type parser differentials, request-signature canonicalization, shared cache/index tenant isolation, custom domains, service confused deputies, webhook signature/replay, attack-chain prerequisite validation, and root-cause retesting. Gadget payloads, production key use, real domains, and high-traffic cache poisoning are prohibited.

## Rate-limiting / abuse coverage

The abuse catalog adds 12 REVIEW-ONLY tests for password guessing and distributed stuffing, OTP/MFA/recovery codes and push fatigue, reset messages, registration/invitations, API resource budgets, search/scraping/exports, uploads/storage/processing, email/chat fan-out, payment/coupon/reservation fraud, and spoofed source/channel accounting. Every test uses a tiny written ceiling and stops on the first control or operational signal.

## Information-disclosure coverage

The disclosure catalog adds 18 impact-gated tests for stack traces/errors, debug consoles, client secrets, source maps, comments/hidden markup, backups, version-control metadata, environment/deployment files, listings, component versions, health/metrics/tracing/actuator endpoints, API errors, logs, caches, robots/sitemaps false positives, identity data, document/media metadata, and stale-copy remediation. Secrets are never retained or broadly exercised.

## Cloud / storage coverage

The cloud catalog adds 18 provider-aware tests for inventory, public reads/listing, object read/write/delete authorization, signed downloads and uploads, storage CORS, metadata and workload credential isolation, least-privilege and cross-account IAM, CDN/origin bypass, tenant prefixes, versions/deletes, retention/holds, event consumers, and audit logging. Vendor references cover AWS S3, Google Cloud Storage, and Azure Blob Storage. Metadata tests prohibit real endpoint or token retrieval.

## Security-header coverage

The security-header catalog adds 24 context-and-impact tests for HSTS, CSP and nonce/hash/base/object/navigation directives, frame-ancestors and legacy X-Frame-Options, MIME/type/charset, referrer and feature policies, COOP/COEP/CORP, caching and Clear-Site-Data, Content-Disposition, version disclosure, obsolete X-XSS-Protection/HPKP/Expect-CT guidance, route consistency, duplicate parser behavior, and report-only telemetry. Every item explicitly rejects missing-header-only findings.

## WebSocket coverage

The WebSocket catalog adds 10 protocol-gated tests for WSS, Origin, explicit socket authentication, token leakage, per-message and subscription authorization, schema/parser boundaries, bounded message/rate/fan-out/subscription resources, replay/idempotency, and revocation/reconnect after session or permission changes. HTTP 101 is never treated as proof of application authentication or authorization.

## Client-side security coverage

The client-side catalog adds 29 browser-traced tests for DOM and dynamic-code sinks, HTML/redirect/CSS/resource manipulation, CORS/clickjacking, postMessage, storage/IndexedDB, service workers and offline cache, workers/BroadcastChannel, prototype pollution and gadgets, DOM clobbering, window.name, reverse tabnabbing, third-party scripts/SRI, XSSI, source maps, client secrets/WASM, client-only authorization, and Web Crypto key handling. Static delivery intentionally retains this category as Active.

## Race-condition coverage

The race catalog adds 12 REVIEW-ONLY tests for duplicate redemption/payment, inventory allocation, balance/quota TOCTOU, single-use auth/recovery tokens, authorization state changes, workflow transitions, idempotency keys, file validation/publish, partial construction, synchronized delivery, and remediation parity. Every test uses a fresh disposable resource and only a few synchronized requests; response counts never substitute for authoritative ledger/state evidence.

## Business logic coverage

The business-logic catalog adds 35 synthetic-state tests for workflow sequence/replay/token binding, numeric and price/quantity/currency/tax/shipping calculations, coupons and stored value, payment/refund/cancellation/subscription lifecycle, quotas and alternate identities, invitations/referrals, approval separation, integrity fields and callbacks, asynchronous/idempotent effects, account/tenant/plan/time invariants, reservation hoarding, application misuse, consent, and cross-channel retesting. Every item prohibits real charges, fulfillment, messages, approvals, inventory loss, or customer impact.

## HTTP request smuggling / desync coverage

The desynchronization catalog adds 14 REVIEW-ONLY tests for topology and framing controls, CL.TE, TE.CL, TE.TE, H2.CL, H2.TE, downgrade header injection, isolated queue confirmation, 0.CL/early-response, client-side and pause-based desync, infrastructure false positives, and remediation parity. No ready-to-run payloads are included; every item requires explicit approval, isolation, one canary pair at a time, monitoring, and immediate stop conditions.

## SSRF coverage

The SSRF catalog adds 15 safe-by-default tests for direct and blind fetches, scheme/host/IP/port/parser validation, redirects and connection-time DNS, cloud metadata controls with AWS/GCP/Azure variants, response handling, webhooks, document/media renderers, stored second-order URLs, and egress architecture. Every item prohibits private, loopback, link-local, metadata, internal, or third-party runtime targets.

## OAuth / SSO / SAML coverage

The federation catalog adds 22 tests for exact OAuth redirects, state, OIDC nonce, PKCE, code use/lifetime, mix-up and callback pollution, leakage, scope/consent, grants, refresh/access/client credentials and redirect chains; plus SAML signature and wrapping, issuer/audience/recipient/destination, request/replay/time binding, RelayState, attribute mapping, and coordinated logout/fallback assurance. OAuth references use RFC 9700; SAML references use the OASIS 2.0 core standard.

## JWT coverage

The JWT catalog adds 18 tests for signature enforcement, server-side algorithm allowlists, none and algorithm confusion, HMAC secret strength, issuer/audience/type/time/identity/privilege claims, kid and remote/embedded key trust, key rotation, bearer replay, refresh-family rotation, token leakage, and browser storage/transport. WSTG mappings remain empty because WSTG 4.2 has no JWT scenario; references are pinned to RFC 8725 and PortSwigger.

## GraphQL coverage

The GraphQL catalog adds 15 context-gated tests for endpoint/transports, introspection and schema reconciliation, object/field/input/function authorization, depth and resolver cost, aliases/fragments, operation batches, pagination/connections, browser request forgery, subscriptions, and safe error behavior. Query-cost tests use tiny increments and owner telemetry; HTTP 200 and schema names are never treated as findings by themselves.

## Incremental validation

```bash
node tools/validate.js --floors-present
node --test
```

The Phase 6 gate now uses `node tools/validate.js --floors`; all 24 category files and every independent floor pass.
