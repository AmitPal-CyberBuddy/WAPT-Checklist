# Phase 6 — advanced content progress

> In progress — 2026-08-18

Phase 6 authors production methodology for categories 11–24. Category floors remain independent release gates.

| # | Category | Floor | Current | Status |
|---:|---|---:|---:|---|
| 11 | GraphQL | 12 | 15 | Complete |
| 12 | JWT | 15 | 18 | Complete |
| 13 | OAuth / SSO / SAML | 18 | 0 | Not started |
| 14 | SSRF | 12 | 0 | Not started |
| 15 | Request smuggling / desync | 12 | 0 | Not started |
| 16 | Business logic | 30 | 0 | Not started |
| 17 | Race conditions | 10 | 0 | Not started |
| 18 | Client-side security | 25 | 0 | Not started |
| 19 | WebSocket | 8 | 0 | Not started |
| 20 | Security headers | 20 | 0 | Not started |
| 21 | Cloud / storage | 15 | 0 | Not started |
| 22 | Information disclosure | 15 | 0 | Not started |
| 23 | Rate limiting / abuse | 10 | 0 | Not started |
| 24 | Advanced topics | 15 | 0 | Not started |

Advanced floor total: **217**. Current Phase 6 production total: **33**. Overall production catalog: **381**.

## JWT coverage

The JWT catalog adds 18 tests for signature enforcement, server-side algorithm allowlists, none and algorithm confusion, HMAC secret strength, issuer/audience/type/time/identity/privilege claims, kid and remote/embedded key trust, key rotation, bearer replay, refresh-family rotation, token leakage, and browser storage/transport. WSTG mappings remain empty because WSTG 4.2 has no JWT scenario; references are pinned to RFC 8725 and PortSwigger.

## GraphQL coverage

The GraphQL catalog adds 15 context-gated tests for endpoint/transports, introspection and schema reconciliation, object/field/input/function authorization, depth and resolver cost, aliases/fragments, operation batches, pagination/connections, browser request forgery, subscriptions, and safe error behavior. Query-cost tests use tiny increments and owner telemetry; HTTP 200 and schema names are never treated as findings by themselves.

## Incremental validation

```bash
node tools/validate.js --floors-present
node --test
```

The final Phase 6 gate will use `node tools/validate.js --floors` once all 24 category files are present.
