# Content guide

This guide defines the editorial contract for checklist items. The JSON Schema is in `schema/item.schema.json`; semantic rules that JSON Schema cannot express belong in `tools/validate.js`.

## Authoring principles

- Write original, imperative, concise methodology. Do not copy framework prose.
- One item proves one security objective through a repeatable decision procedure.
- Describe observable request/response behavior, a confirmation step, likely false positives, evidence, realistic impact, and root-cause remediation context.
- A scanner lead is not a finding. A missing defense is not a vulnerability without relevant exposure and impact.
- Use only authorized testing accounts/data and the least disruptive proof. Never put live secrets or credentials in examples.
- Use reserved domains (`example.com`, `.test`) and documentation IP ranges in examples.
- Redact session tokens, API keys, personal data, and tenant identifiers from retained evidence.

## Required fields

Every production item has all schema-required fields, even if an array is intentionally empty. Empty prose strings are invalid.

- `id`, `title`, `category`: stable identity and canonical owner.
- `severity`: default triage, adjusted after demonstrated impact.
- `difficulty`: expected tester effort, not exploit complexity scoring.
- `mode`: the primary execution mode; manual confirmation is still required for automated leads.
- `objective`: the proposition the tester is trying to prove.
- `prerequisites`: access, accounts, artifacts, or safe environment conditions.
- `steps`: ordered actions with comparison/control requests where relevant.
- `examples`: sanitized request/response pairs; either side may be omitted only when the technique is not HTTP-based.
- `manipulate`: the exact input, state, claim, header, object, timing, or configuration under test.
- `secure_behavior`, `vulnerable_behavior`: observable decision boundaries.
- `validation`: how to confirm exploitability and reject coincidence.
- `false_positives`: plausible benign explanations; use a meaningful entry rather than “none.”
- `impact`: realistic consequences, stated conditionally until verified.
- `evidence`: minimum reproducible and redacted artifacts.
- `tools`: aids, never substitutes for methodology.
- `references`: verified authoritative pages with descriptive titles.
- `mappings`: versioned traceability. Empty dimensions are honest and supported.
- `related`, `attack_chains`: IDs resolved by the full-catalog validator.
- `tags`: canonical discovery terms.
- `applies`: declarative context gate; omit only for genuinely universal tests.
- `variants`: conditional replacement/additional steps without duplicated items.

Optional fields:

- `safety`: required by policy for rate bursts, race concurrency, smuggling/desync, resource exhaustion, destructive state changes, cloud metadata access, or other production-impacting actions.
- `priority_when`: context boosts using the controlled condition vocabulary.
- `remediation`: root-cause direction; recommended for production content even though report recommendations may be engagement-specific.
- `do_not_report`: explicit reporting boundaries for false-positive-prone techniques. Required by the content audit for the entire `security-headers` and `rate-limiting` categories and for a pinned set of CORS, disclosure, token-storage, DNS, and client-code items. Entries must be item-specific (minimum 25 characters; verbatim reuse across items fails the audit). An entry must state what must be demonstrated before the observation becomes reportable, e.g. "Do not report ACAO reflection by itself; demonstrate that an attacker-controlled origin can read a sensitive, user-specific response…".
- `retest_guidance`: concrete re-verification steps for remediations that are easy to verify incompletely (policy deployment, CORS allowlists, throttling, token-storage migration). Minimum 40 characters and it must describe the re-test, not restate the remediation.

## Safety language

A useful `safety` note names the risk, a safe bound, approval/escalation need, and stop condition. Example:

> Coordinate a maintenance window and confirm the front-end/back-end path before desync probes. Send one paired control/probe at a time, do not target shared-user traffic, and stop on response queue anomalies.

Payload records that can destroy data, exhaust resources, or affect other users must use `review_only: true`. The UI will keep those collapsed and display the safety context before copy controls.

## Variants

Use a variant when the security objective stays the same but execution changes with context. Do not clone an item merely for cookie, JWT, HTML, attribute, JavaScript, or URL contexts.

```json
{
  "when": { "auth_mechanism": ["cookie"] },
  "steps": ["Reproduce the state-changing request from a cross-site form using the victim's ambient cookie."],
  "notes": "Verify the actual SameSite value and browser navigation behavior before drawing a conclusion."
}
```

## References and attribution

Allowed source families are OWASP, PortSwigger Web Security Academy, CWE/MITRE, IETF/RFC Editor, W3C/WHATWG, and official vendor documentation. Random blogs, payload aggregators, and SEO articles are not references.

WSTG and ASVS are CC BY-SA materials. Ideas and taxonomy may be mapped to them, but all checklist methodology must be independently worded. Attribution and license notices remain in README and generated documentation. WSTG links are pinned to 4.2; ASVS mappings are pinned to 5.0.0 for this content freeze.

Before merging an item:

1. open every URL and confirm title, authority, and relevance;
2. verify mapping IDs against the source edition, not memory;
3. check 2021 and 2025 Top 10 separately;
4. search the catalog by objective, synonyms, and tags for duplicates;
5. have a second reviewer assess safety and false-positive guidance.

## Definition of ready

An item is ready to count toward a floor only when it:

- passes structural and semantic validation;
- has a stable ID and canonical category;
- can be performed as written by an authorized tester;
- distinguishes secure, vulnerable, blocked, and inconclusive outcomes;
- cites a real authoritative source;
- avoids unsafe proof where a lower-impact proof exists;
- has no unresolved duplicate or contradictory item;
- uses original wording and includes no secrets or live-target data.

## Test families (`checklist/families.json`, schema 2.0.0)

A family is the unit a tester actually works: one attack surface, its checks, its quick procedure, and the variants that are easy to forget. Every production item belongs to exactly one family in its category, and the validator fails the build otherwise.

| Field | Rule |
|---|---|
| `id` | stable `[a-z0-9-]{4,80}` slug, never reused |
| `title` / `summary` | what the surface is, in the tester's vocabulary |
| `quick_test` | **authored**, 3–5 imperative lines, 12–90 characters each. Never generated from `steps`; a test asserts it never duplicates an item's step list verbatim. Write what the tester does at the keyboard: capture, swap, replay, compare, repeat. |
| `validate` | one 30–160 character line stating what proves the issue is real, not what the payload is |
| `items` | member item IDs, in the order a tester should work them |
| `dont_miss` | reminders (≥ 25 characters) that an experienced tester ticks off as coverage — methods, nested/bulk/export paths, alternate clients, legacy versions, tenant and field boundaries. Not tutorial content, not a restatement of the check titles. |

Changing a `dont_miss` string changes its coverage key, so previously recorded ticks for that reminder are released. Prefer adding a new reminder over rewording one mid-release.
