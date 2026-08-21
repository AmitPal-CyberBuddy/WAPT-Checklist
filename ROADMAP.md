# WAPT Checklist — Upgrade Roadmap

This roadmap is derived from the current codebase and tester workflows, not from a
generic template. Each item names the gap it closes, a concrete sketch, and the
acceptance bar. It is a maintainer document: it lives in the repository and is
deliberately **not** part of the hosted site (the publish allowlist excludes it).

Status legend: ✅ shipped · 🚧 in progress · ○ planned

---

## Where the project stands

- **623 production checks** across 25 categories, 196 coverage families, 5 attack
  chains, 40 payload references, 12 Burp workflow guides — all reference-validated.
- **Assessment-first flow**: scenario presets → relevant follow-ups → categorized
  plan with per-category signal hues and inclusion reasons; context stays editable
  mid-engagement without losing progress.
- **Local-only by design**: state in `wapt.state.v1`, no telemetry, no target
  requests, share links carry scope only.
- **Hosting**: clean URLs from an explicit public allowlist; maintainer material
  stays in the repository.
- **Quality gates**: 300 unit tests, schema/floor/reference/content audits, and a
  jsdom functional suite (53 checks + 19 tester-audit checks) run on every push.

The single biggest lever remaining is **practical depth**: only 16 authored
playbooks (≈19 named variants) exist, so most rows open as methodology
references. Everything below orbits that, plus the workflow features that make a
tester's day shorter.

---

## v1.1 — Now (high value, small-to-medium efforts)

### 1. ✅ Scope import from API definitions
- **Why**: testers already have an OpenAPI file or Postman collection; typing its
  implications into the wizard is wasted minutes and a correctness risk.
- **Shipped**: `js/engine/scope-import.js` parses OpenAPI 3 / Swagger 2 (JSON) and
  Postman v2.x collections locally — proposing `app_type`, `api_style`,
  `auth_mechanism`, registration/identity hints, uploads/payments/search/webhooks
  — with every detection listed for review. Wired into the wizard and the Edit
  context editor.
- **Done when**: import proposes only what the document states; every detection is
  auditable; nothing applies without review; parser has unit tests with fixtures.

### 2. ✅ Role names and privilege hierarchy (state schema v4)
- **Why**: the multi-role preset records tiers but not names; "Admin → Manager →
  Standard" as real names makes the cross-role matrix and exports report-ready.
- **Sketch**: engagement gains `role_model: [{ name, tier }]`; wizard multi-role
  step gains a small inline editor; plan matrix and Markdown exports use the names;
  strict v3 → v4 migration mirrors the existing v1/v2 path.
- **Done when**: names survive export/import; matrix pairs read like the target's
  real roles; old state files migrate losslessly. **Size: M**

### 3. ✅ Custom local tests
- **Why**: every engagement has 5–10 target-specific checks that no catalog can
  predict; testers currently keep them in another note.
- **Sketch**: engagement-scoped `custom_checks: [{ id: WAPT-CUSTOM-nnn, title,
  objective, category-hint }]` rendered inside the matching plan category (or a
  "Custom" group), with the same status/finding/notes controls and exports.
- **Done when**: custom rows behave like catalog rows everywhere except reference
  lookups; they never collide with catalog IDs; they export/import cleanly. **Size: M**

### 4. ✅ Saved filter views
- **Why**: "high severity + not started + JWT" is retyped many times per engagement.
- **Sketch**: name-and-persist the current filter set per engagement; recall from a
  chip row in checklist/search and the plan's filter bar.
- **Done when**: views persist, carry across views, and export with state. **Size: S**

### 5. ✅ HTML engagement report
- **Why**: Markdown report exists; clients increasingly want a single styled HTML
  file with severity ordering and coverage visuals.
- **Sketch**: extend `js/ui/export.js` with a self-contained `report.html` writer
  (inline CSS from existing tokens, no external requests, CSP-safe).
- **Done when**: report renders offline from `file://`, includes findings,
  evidence (redacted fields), coverage, and the cross-role matrix. **Size: M**

---

## v1.2 — Next (the practical-depth program)

### 6. ✅ Practical-variant authoring, wave 1 — COMPLETE (r15–r20)
- **Progress (r15–r16)**: JWT is 18/18 step-by-step (algorithm allowlist, HMAC
  secret strength, jku/x5u/embedded-JWK rejection, kid rotation,
  issuer/audience/type binding, subject–tenant binding, replay limits, refresh
  families, browser storage); OAuth/OIDC/SAML is 22/22 (nonce, mix-up, response
  pollution, scope consent, legacy grants, refresh replay, token audience,
  client secrets, redirect chains, and the six SAML checks: XSW, audience,
  request binding, time conditions, attribute mapping, SLO); and session
  management is 28/28 (token inventory, cookie scope and lifetime, entropy and
  contents, rotation on auth/elevation, fixation, session puzzling, subdomain
  isolation, account switching, concurrent limits, session review/revoke,
  idle and absolute timeouts, server-side expiry, storage hygiene, disabled
  and deleted account replay, credential-change termination, federated logout,
  explicit session creation, revocation propagation, rotated cookie families).
  Authorization is 43/43 as of r17 (role-permission matrix, horizontal
  delete and bulk per-member checks, collection filtering, nested-resource
  chains, opaque references, media/report/async-job artifacts, hidden-UI
  probes, ownership-reassignment mass assignment, field-level read/write
  permissions, state-change rechecks, display-attribute independence, error
  and metadata representations, audit views, tenant binding and isolation,
  tenant switch and invitations, group membership, delegated access scope,
  workflow transitions, separation of duties, revocation freshness, stale
  role claims, batched requests, existence oracles, signed URLs, realtime
  channel authorization, confused-deputy integrations, deny-by-default,
  admin layering, and API-version consistency). API security is 40/40 as of
  r18 (mutation/nested/batch object authorization, mobile-surface parity,
  field filtering and property updates across representations, overfetch
  bounds, API-key scope/revocation, token audience and type, cross-version
  auth parity, page/body/filter cost bounds, side-effect quotas, distributed
  abuse controls, business-flow automation guards, route-alias and method-
  override policy, role-management constraint, deny-by-default, workflow
  sequence and idempotency, fetch-redirect revalidation, method/media
  hygiene, debug/CORS/schema-console controls, inventory/version/shadow-API
  programs, and consumed-API trust: validation, resilience, TLS, and
  credentials). GraphQL is 15/15 (per-transport baselines, mutation input
  authorization, cost analysis, alias counting, pagination bounds,
  subscription event-time authorization, error hygiene). Security headers
  are 24/24 and file handling 26/26 as of r19 (policy depth: CSP nonce
  quality and navigation constraints, XFO consistency, content-type
  strictness, COOP/COEP decisions, Clear-Site-Data, Content-Disposition,
  version/obsolete-header hygiene, route/status/origin consistency,
  malformed-header handling, report-only honesty; upload depth: acceptance
  contracts, filename normalization, isolated delivery origin, collision
  and overwrite, symlink escape, zip-bomb bounds, quotas, image dimension
  bombs, normalization, polyglot parsers, AV-as-depth, attachment
  authorization, traversal ladders, LFI/RFI/SSTI, disposition encoding,
  temp/quarantine access, privileged preview, generated-output validation).
  Client-side is 37/63 (DOM source-sink maps, eval removal, HTML/CSS
  injection impact, resource URL manipulation, CORS behavior, postMessage
  targets, storage trust, IndexedDB partitioning, service-worker cache
  privacy, worker/broadcast boundaries, prototype gadgets, DOM clobbering,
  window.name, tabnabbing, SRI, XSSI, source-map review, Web Crypto, XS
  leaks, bfcache). Business logic is 35/35 and race conditions 12/12 as of
  r20 (workflow state maps, step-skip and replay probes, token binding,
  numeric/currency validation, server-side recalculation, coupon and
  stored-value protection, payment binding, refund and cancellation
  limits, subscription lifecycle, usage limits and alias-reset evasion,
  inventory hoarding, invitation and maker-checker integrity, client
  integrity fields, tenant invariants, async callback binding and state
  sync, retry duplication; and the race program: last-byte redemption and
  inventory races, atomic balance and one-time-token consumption,
  authorization/state TOCTOU, workflow concurrency, idempotency binding,
  processing-vs-publish races, construction races, synchronized delivery,
  adjacent-path remediation). Wave-1 result: 354 of 623 catalog items
  (57%) carry named variants across 11 complete categories; remaining
  categories (authentication, injection, XSS, recon, CSRF, SSRF,
  smuggling, cloud, rate-limiting, info-disclosure, websocket, advanced,
  AI) are wave 2.
- **Why**: the hero feature of this console is pasteable procedures; today only
  static-page/login-era playbooks carry them. JWT, OAuth/OIDC, authorization, and
  sessions are where testers spend their time.
- **Sketch**: author 8–12 variants per category for the top 10 categories by usage
  (JWT, OAuth, authorization, session, API, headers, client-side, upload, GraphQL,
  business logic), following the existing playbook overlay schema and safety rules
  (safe payloads flagged, REVIEW-ONLY guarded, do-not-report boundaries).
- **Done when**: `audit-content.js` passes; each new variant carries Why / payload
  / CHECK FOR / VALIDATE; floors and reference audits stay green. **Size: L (content)**

### 7. ✅ Evidence attachments (local, capped) — shipped in r21
- **Why**: evidence packs are text-only; a redacted screenshot or request file is
  the artifact clients actually want attached.
- **Shipped (r21)**: attachments staged in the evidence form (redaction reminder shown before choosing files) and attachable to existing packs; stored as data URLs with type allowlist (PNG/JPEG/WebP/GIF/text/JSON), 3 files/pack, ~400 KB/file, 2 MB engagement-wide budget enforced at set-state time; rendered inline in pack cards (image thumbnails, text previews) and embedded in the HTML report; import keeps only well-formed attachments.
- **Done when**: caps enforced at set-state time; import rejects oversized state;
  redaction reminder shown before attach. **Size: M**

### 8. ✅ Engagement templates + scope diff — shipped in r22
- **Why**: repeat clients reuse scope; showing what changed between two checkpoints
  ("we added WebSocket after week 1") explains plan growth to the client.
- **Shipped (r22)**: "★ Template" in the header freezes the active scope (answers + target only — never progress, findings, or evidence; capped at 12, hostile portfolio documents keep only well-formed entries); the wizard lists saved templates as one-click starts that land straight on the dashboard plan; Shift+click manages/deletes templates. Scope history lives in the Edit-context editor: "＋ Snapshot current scope" checkpoints (ring of ten, label + date), and selecting any snapshot diffs it against the current scope — naming every added/removed/changed answer and every category that gained or lost applicable tests, computed with the same applicability engine the plan uses so the diff can never disagree with the plan.

### 9. ○ Attack-chain library growth
- **Why**: 5 chains seed the idea; chains are how juniors learn sequencing.
- **Sketch**: add 8–10 chains over the newly authored variants (token reuse →
  privilege escalation; upload → stored XSS → session theft; SSRF → cloud
  metadata → tenant keys).
- **Done when**: every node resolves to an applicable item; unlock hints verified
  against real statuses. **Size: M (content)**

---

## v2.0 — Later (platform moves)

### 10. ○ Offline-first PWA
- Service worker + installable shell; the app is already local-only, so caching
  is a natural fit. Cache-first assets, version-keyed by `cache_version`.

### 11. ○ Per-endpoint plans from definitions
- Extend scope import to enumerate endpoints and let the tester focus the plan on
  a route group (auth vs billing), reusing the existing focus view machinery.

### 12. ○ Portfolio view across engagements
- One dashboard over all local engagements: coverage, findings counts, retests
  pending — the freelancer's week at a glance. Pure local aggregation.

### 13. ○ CI upgrades
- Run the jsdom functional suite in CI (dependency install step), add Lighthouse
  budgets and Playwright screenshot diffs for the identity layer.

### 14. ○ Web-worker applicability at scale
- Move catalog applicability scoring off the main thread when the catalog passes
  ~1,500 items; the engine is already DOM-free by design.

---

## Non-goals (deliberate)

- **Cloud sync / accounts** — the local-only stance is a feature, not a limitation.
- **Telemetry of any kind** — including anonymized usage counters.
- **Automated exploitation** — the console validates and proves, never weaponizes.
- **Auto-generated fake procedures** — a catalog-only row says so honestly; no
  synthesized "Repeater requests" from titles.

---

## Contributing to this roadmap

Items move up when a real engagement blocks on them and move down when a workaround
is good enough. Content waves (6, 9) pair engineering with authoring review — see
`docs/CONTENT-GUIDE.md` for the authoring contract before writing variants.
