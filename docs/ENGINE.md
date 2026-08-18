# Adaptive engine

> Phase 3 implementation contract — 2026-08-17

The adaptive engine is implemented as four pure ES modules in `js/engine/`. A scoped `package.json` marks only that directory as ESM, so the browser imports the same source exercised by Node's standard test runner. Engine modules do not read the DOM, localStorage, network, time (except when an update helper is invoked without a supplied timestamp), or mutable application globals.

## `context.js`

### Inputs

- the wizard's plain `answers` object;
- the optional target URL string.

### Outputs

`deriveContext()` returns every controlled attribute as `{ value, confidence }`. Invalid and absent answers normalize to explicit `unknown`; a multi-select can never contain `unknown` alongside asserted values.

`deriveUrlHints()` accepts only HTTP(S), rejects credentials/control characters/local/private/link-local destinations, and recognizes only the reviewed hint set. It does not fetch or resolve the target. Positive hints carry `url_hint` confidence and evidence; an absent pattern remains unknown rather than becoming a negative fact.

## `applicability.js`

`evaluateApplicability(item, context)` returns:

```js
{
  state: 'active' | 'confirm' | 'na_context',
  blocked: boolean,
  reasons: [{ code, ...evidence }]
}
```

Evaluation order is:

1. hard derivations such as static delivery and protocol-specific category gates (`jwt`, `oauth-sso-saml`, `graphql`, `websocket`, and `ssrf` — the SSRF category gates on confirmed `outbound_fetch` of `webhooks` or `import`);
3. every `requires` token;
4. the OR branches in `any_of`;
5. uncertainty resolution.

A positive URL hint produces **Confirm**, never Active. In black-box mode, `creds:none` does not hide a test requiring `creds:low|high`; it stays visible with `blocked: true` and a `needs_credentials` reason. Blocked work is omitted from Suggested next.

`selectVariants()` returns matching conditional methodology additions. Variant maps use AND across attribute keys; values within an attribute are alternatives.

## `priorities.js`

Suggested next considers only Not Tested, Active/Confirm, unblocked items. The deterministic score is exposed as a breakdown:

```text
workflow category weight
+ severity weight
+ bounded met-prerequisite weight
+ context / priority_when boosts
+ unlocked attack-chain weight
- small Confirm uncertainty penalty
```

On top of that base, a bounded **tester-proximity** layer decides what to do *next* once work has started: focus family (the family in view, or the family of the last recorded check) `+1500`, adjacent family from `relatedFamilies` `+420`, part-finished family `+700`, explicitly related test `+500`, same attack surface `+150`. These deliberately outrank the workflow spread, because after recording BOLA-read the useful answer is BOLA-write, not the workflow-earliest reconnaissance item. With no recent work and no focus family the ordering is exactly the previous workflow ordering. Every suggestion carries plain-language `reasons`.

Workflow weights preserve consulting order and context boosts are deliberately bounded. Item ID is the final tie-breaker. Relevant built-in boosts cover many-role authorization, multi-tenant isolation, payment/race workflows, cookie sessions, API URL suggestions, and intermediary-hop desynchronization planning. `priority_when` remains the content-level extension mechanism.

A chain boost is granted only when every supplied prerequisite item has status `passed` or `confirmed_finding`. Chain data is an input; the priority module does not load files.

## `rationale.js` and `coverage.js`

`rationale.js` explains why a gated or boosted category is relevant: active signals confirm applicability, unknown signals produce a confirmation prompt, and boost signals explain priority.

`coverage.js` classifies every check into exactly one bucket and never blurs them:

| Bucket | Meaning | In the denominator? | Counted as tested? |
|---|---|---|---|
| `tested` | executed — not vulnerable, potential, or confirmed | yes | yes |
| `active` | `in_progress`, started but not finished | yes | no |
| `blocked` | tester marked blocked, or credential-blocked by context | yes | no |
| `na` | context-N/A (`na_context`) or tester-marked N/A (`na_user`) | no | no |
| `not_tested` | nothing recorded | yes | no |

`coverage = tested / executable`, where `executable = total − na`. Blocked work stays in the denominator because it is still owed to the engagement. `coverageOfRecords()` applies the same math to any bucket of records, which is how family coverage is computed.

## `families.js`

`families.js` indexes `checklist/families.json` (by id, item, category, and authored order) and provides the tester-first derivations:

- `familyCoverage()` — checks by bucket, don't-miss variant ticks, and confirmed findings as **three separate numbers**;
- `variantKey()` / `familyVariants()` — stable `<family-id>#<fnv1a>` keys so a tick stays attached to its reminder;
- `nextInFamily()` — the next unexecuted check, walking forward from the current one;
- `relatedFamilies()` — "what else should I check?" derived only from existing relationships: `item.related` links (6), attack-chain successors after this family (4), same-surface siblings (2), and workflow adjacency (3/2/1 by closeness), capped at three families per own surface and two per other surface so the answer stays varied;
- `familyGaps()` — families with executable work left, part-finished first, which is the dashboard's "what have I missed?" list.

## `reportability.js`

`reportability.js` implements the finding-decision gate: **observation → weakness → exploitability demonstrated → reportable**. It classifies what the tester recorded (test request, observed behavior, exploitability, reportable flag), never the target itself, and surfaces the item's `do_not_report` boundary before a finding is finalized. Retest verdicts (`pending`, `pass`, `partial`, `fail`) carry residual-risk guidance and variant suggestions for re-verification.

## `state.js`

`state.js` owns each engagement's versioned shape and immutable update rules. State is schema version 3: don't-miss variant coverage (`variants`) and the tester's last position (`position`) join structured evidence packs (`findings`), statuses, notes, overrides, and retest flags. Schema version 1 and 2 records migrate transparently on load and on strict import, preserving engagement data. `portfolio.js` wraps multiple engagement records, preserves one active ID, and migrates the original single-engagement document. Browser storage remains in `js/ui/app.js`, using only `wapt.state.v1`.

Key guarantees:

- only controlled answers, item IDs, statuses, and bounded text survive normalization;
- status changes away from `confirmed_finding` clear the retest flag;
- retest cannot be enabled for another status;
- applicability overrides require a non-empty reason;
- import rejects malformed JSON, unknown schema versions, and input over 5 MB (raised from 1 MB when evidence packs joined the state);
- JSON serialize/import round trips valid state without adding data.

The current functions are `createState`, `normalizeState`, `setEngagement`, `setAnswers`, `setItemStatus`, `setItemNote`, `setOverride`, `clearOverride`, `setRetestFlag`, `setVariantCovered`, `setPosition`, `addFinding`, `updateFinding`, `setRetestVerdict`, `removeFinding`, `serializeState`, and `importState`. Variant keys and position values are validated and sanitized like every other input; hostile keys are dropped rather than trusted.

## Test coverage

Run:

```bash
node --test
```

The test suite covers:

- context normalization, confidence, every URL hint class, and deny-list behavior;
- applicability precedence, Active/Confirm/N/A, blocked credentials, `any_of`, and variants;
- deterministic workflow scoring, bounded boosts, and chain unlocks;
- state shape, immutable updates, override reasons, import/export, and retest invariants;
- each derivation row in the master plan;
- all eight quick-start presets through the engine, not only at the answer layer;
- evidence-pack invariants, schema v1 → v2 migration, reportability stages, coverage math, and retest verdicts.
