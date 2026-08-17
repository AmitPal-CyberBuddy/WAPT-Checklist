# Phase 6 — advanced content progress

> In progress — 2026-08-18

Phase 6 authors production methodology for categories 11–24. Category floors remain independent release gates.

| # | Category | Floor | Current | Status |
|---:|---|---:|---:|---|
| 11 | GraphQL | 12 | 15 | Complete |
| 12 | JWT | 15 | 18 | Complete |
| 13 | OAuth / SSO / SAML | 18 | 22 | Complete |
| 14 | SSRF | 12 | 15 | Complete |
| 15 | Request smuggling / desync | 12 | 14 | Complete |
| 16 | Business logic | 30 | 35 | Complete |
| 17 | Race conditions | 10 | 0 | Not started |
| 18 | Client-side security | 25 | 0 | Not started |
| 19 | WebSocket | 8 | 0 | Not started |
| 20 | Security headers | 20 | 0 | Not started |
| 21 | Cloud / storage | 15 | 0 | Not started |
| 22 | Information disclosure | 15 | 0 | Not started |
| 23 | Rate limiting / abuse | 10 | 0 | Not started |
| 24 | Advanced topics | 15 | 0 | Not started |

Advanced floor total: **217**. Current Phase 6 production total: **119**. Overall production catalog: **467**.

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

The final Phase 6 gate will use `node tools/validate.js --floors` once all 24 category files are present.
