# Taxonomy and identifiers

> Version 1 taxonomy baseline — 2026-08-17

## Categories and measurable floors

Floors are release gates, not writing targets. An item counts only after schema, mapping, reference, duplication, and editorial checks pass.

| Order | Slug | Category | ID prefix | Floor |
|---:|---|---|---|---:|
| 01 | `reconnaissance` | Reconnaissance | `WAPT-RECON` | 30 |
| 02 | `http` | HTTP / Web fundamentals | `WAPT-HTTP` | 25 |
| 03 | `authentication` | Authentication | `WAPT-AUTH` | 40 |
| 04 | `session-management` | Session management | `WAPT-SESS` | 25 |
| 05 | `authorization` | Authorization | `WAPT-AUTHZ` | 35 |
| 06 | `injection` | Injection | `WAPT-INJ` | 45 |
| 07 | `xss` | Cross-site scripting | `WAPT-XSS` | 25 |
| 08 | `csrf` | Cross-site request forgery | `WAPT-CSRF` | 15 |
| 09 | `file-handling` | File handling | `WAPT-UPLOAD` | 20 |
| 10 | `api-security` | API security | `WAPT-API` | 35 |
| 11 | `graphql` | GraphQL | `WAPT-GQL` | 12 |
| 12 | `jwt` | JSON Web Token | `WAPT-JWT` | 15 |
| 13 | `oauth-sso-saml` | OAuth / SSO / SAML | `WAPT-OAUTH` | 18 |
| 14 | `ssrf` | Server-side request forgery | `WAPT-SSRF` | 12 |
| 15 | `request-smuggling` | HTTP request smuggling / desync | `WAPT-SMUG` | 12 |
| 16 | `business-logic` | Business logic | `WAPT-BL` | 30 |
| 17 | `race-conditions` | Race conditions | `WAPT-RACE` | 10 |
| 18 | `client-side` | Client-side security | `WAPT-CLIENT` | 25 |
| 19 | `websocket` | WebSocket | `WAPT-WS` | 8 |
| 20 | `security-headers` | Security headers | `WAPT-HDR` | 20 |
| 21 | `cloud-storage` | Cloud / storage | `WAPT-CLOUD` | 15 |
| 22 | `information-disclosure` | Information disclosure | `WAPT-INFO` | 15 |
| 23 | `rate-limiting` | Rate limiting / abuse | `WAPT-RATE` | 10 |
| 24 | `advanced` | Advanced topics | `WAPT-ADV` | 15 |
| | | **Minimum total** | | **512** |

Category ownership follows the primary security objective, not every technology touched. Cross-cutting discovery items use `related`, tags, mappings, and chains rather than duplicate tests.

## Stable item IDs

Format: `WAPT-<PREFIX>-<NNN>`, with a three-digit, category-local sequence starting at `001`.

- IDs are assigned only when an item enters review.
- A published ID is never reused, even if the item is retired.
- Moving an item conceptually does not change its ID; its original category remains canonical unless a versioned migration explicitly creates a replacement.
- Splitting an item leaves the original as the broad test and assigns new IDs to independently executable tests.
- Examples and methodology variants never receive top-level IDs.

## Controlled values

### Item enums

- severity: `critical`, `high`, `medium`, `low`, `informational`
- difficulty: `low`, `medium`, `high`
- mode: `manual`, `automated`
- status (state only): `not_tested`, `in_progress`, `passed`, `potential_finding`, `confirmed_finding`, `na`
- applicability result (derived only): `active`, `confirm`, `na_context`

Severity is the plausible default risk for triage, not a final finding severity. Testers must rate verified findings in engagement context.

### Context attributes

| Attribute | Kind | Allowed values |
|---|---|---|
| `mode` | single | `black_box`, `grey_box`, `white_box`, `unknown` |
| `creds` | single | `none`, `low`, `high`, `unknown` |
| `app_type` | single | `server_rendered`, `spa`, `static`, `hybrid`, `api_only`, `unknown` |
| `has_login` | single | `yes`, `no`, `unknown` |
| `registration` | single | `yes`, `no`, `unknown` |
| `roles` | single | `none`, `one`, `few`, `many`, `unknown` |
| `auth_mechanism` | multi | `none`, `cookie`, `jwt`, `oauth`, `saml`, `ldap`, `mixed`, `unknown` |
| `identity_features` | multi | `password`, `mfa`, `passkey`, `recovery`, `passwordless`, `remember_device`, `none`, `unknown` |
| `api_docs` | single | `openapi`, `none`, `unknown` |
| `source_access` | single | `full`, `partial`, `none`, `unknown` |
| `backend` | multi | `none`, `node`, `java`, `dotnet`, `python`, `php`, `ruby`, `go`, `other`, `unknown` |
| `api_style` | multi | `rest`, `graphql`, `soap`, `websocket`, `grpc`, `none`, `unknown` |
| `database` | multi | `sql`, `nosql`, `ldap`, `other`, `none`, `unknown` |
| `cloud` | single | `aws`, `gcp`, `azure`, `self_hosted`, `none`, `other`, `unknown` |
| `features` | multi | `file_upload`, `payments`, `search`, `email`, `chat`, `multi_tenant`, `mobile_api`, `other`, `none`, `unknown` |

Confidence values are `answer`, `url_hint`, and `unknown`.

URL hints use the separate names `plain_http`, `unusual_tls_port`, `api_subdomain`, `admin_subdomain`, `nonproduction_subdomain`, and `punycode_hostname`. They are not accepted as answer values. Applicability may refer to a hint as `url_hints.api_subdomain:true` only where a suggestion is appropriate.

### Expression grammar

```json
{
  "any_of": { "auth_mechanism": ["jwt"], "api_style": ["rest"] },
  "requires": ["has_login:yes", "creds:low|high"],
  "excludes": ["app_type:static"]
}
```

- Keys in `any_of` are context attributes; arrays contain allowed values for that attribute.
- `requires` and `excludes` are `<attribute>:<value>[|<value>...]` tokens.
- Dotted URL hint keys are the only permitted dotted keys.
- `variants[].when` and `priority_when` use the same key/value object vocabulary as `any_of`; no ad hoc JavaScript conditions are allowed in content.

## Tags

Tags are lower-case kebab case. Prefer an existing canonical term over a synonym:

- vulnerability families: `idor`, `bola`, `bfla`, `sqli`, `nosqli`, `ldap-injection`, `xss`, `csrf`, `ssrf`, `ssti`;
- mechanisms: `cookie`, `jwt`, `oauth2`, `openid-connect`, `saml`, `rbac`, `cors`, `csp`;
- surfaces: `rest-api`, `graphql`, `websocket`, `file-upload`, `multi-tenant`, `cloud-metadata`;
- goals: `enumeration`, `privilege-escalation`, `data-exposure`, `account-takeover`.

Do not encode category, severity, difficulty, status, tool, or framework mapping again as tags. The validator reports unknown tags after the canonical registry is introduced with production content.

## Mapping formats

Mappings are traceability aids, not claims that frameworks define identical tests.

- WSTG 4.2: `WSTG-v42-<AREA>-<NN>`; versioned `v42` URLs are mandatory.
- ASVS 5.0.0: `v5.0.0-<chapter>.<section>.<requirement>`.
- OWASP Top 10: array entries such as `A01:2021` and `A01:2025`; include only applicable editions.
- OWASP API Security Top 10: `API1:2023` through `API10:2023`.
- CWE: `CWE-<number>`.
- PortSwigger: canonical `https://portswigger.net/web-security/...` URLs.

A mapping dimension may be an empty array when there is no honest direct mapping. Every item still needs at least one verified authoritative reference and at least one non-empty mapping dimension. Forced or approximate mappings are prohibited.

## Coverage boundaries

- **Authorization** owns horizontal, vertical, context, object, function, property, and tenant access decisions. API Security may test API-specific discovery and mass-assignment behavior but links back to canonical authorization tests.
- **Injection** owns interpreter boundary failures. XSS remains separate because its contexts, browser proof, and remediation methodology are extensive.
- **File handling** owns upload, retrieval, archive extraction, path traversal, and inclusion workflows.
- **API Security** owns inventory, versioning, object-property exposure, unsafe API consumption, and API-specific abuse.
- **Business logic** owns violated process invariants; **race conditions** owns concurrency as the enabling mechanism.
- **Security headers** evaluates whether a policy is relevant and effective. A missing header alone is never automatically a vulnerability.
- **Advanced** holds cross-cutting parser, cache, serialization, tenant, and chain techniques that do not have a more precise owner.

## Workflow order

Suggested-next uses this consulting workflow, with categories mapped into stages:

1. Scope
2. Reconnaissance
3. Attack Surface Mapping
4. Authentication
5. Session Management
6. Authorization
7. Input Validation
8. Business Logic
9. API Security
10. Client-Side
11. Configuration
12. Advanced Testing
13. Evidence
14. Reporting
15. Retesting

Workflow ordering guides work; it never suppresses a context-relevant high-risk test.
