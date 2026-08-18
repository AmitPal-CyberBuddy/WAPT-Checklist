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

1. hard derivations such as static delivery and protocol-specific category gates;
2. known `excludes` matches;
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

Workflow weights preserve consulting order and context boosts are deliberately bounded. Item ID is the final tie-breaker. Relevant built-in boosts cover many-role authorization, multi-tenant isolation, payment/race workflows, cookie sessions, and API URL suggestions. `priority_when` remains the content-level extension mechanism.

A chain boost is granted only when every supplied prerequisite item has status `passed` or `confirmed_finding`. Chain data is an input; the priority module does not load files.

## `state.js`

`state.js` owns each engagement's versioned shape and immutable update rules. `portfolio.js` wraps multiple engagement records, preserves one active ID, and migrates the original single-engagement document. Browser storage remains in `js/ui/app.js`, using only `wapt.state.v1`.

Key guarantees:

- only controlled answers, item IDs, statuses, and bounded text survive normalization;
- status changes away from `confirmed_finding` clear the retest flag;
- retest cannot be enabled for another status;
- applicability overrides require a non-empty reason;
- import rejects malformed JSON, unknown schema versions, and input over 1 MB;
- JSON serialize/import round trips valid state without adding data.

The current functions are `createState`, `normalizeState`, `setEngagement`, `setAnswers`, `setItemStatus`, `setItemNote`, `setOverride`, `clearOverride`, `setRetestFlag`, `serializeState`, and `importState`.

## Test coverage

Run:

```bash
node --test
```

The Phase 3 suite covers:

- context normalization, confidence, every URL hint class, and deny-list behavior;
- applicability precedence, Active/Confirm/N/A, blocked credentials, `any_of`, and variants;
- deterministic workflow scoring, bounded boosts, and chain unlocks;
- state shape, immutable updates, override reasons, import/export, and retest invariants;
- each derivation row in the master plan;
- all eight quick-start presets through the engine, not only at the answer layer.
