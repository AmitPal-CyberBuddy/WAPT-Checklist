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
