# Phase 7 — connected testing libraries

> Complete — 2026-08-18

Phase 7 connects the methodology without turning the project into an exploitation framework. Attack chains are hypotheses over stable test IDs, payloads are contextual reference values, and Burp documents explain when and why to use a tool.

## Attack chains

Five directed acyclic graphs cover:

- account enumeration → bounded guessing → MFA validation → session containment;
- stored XSS → browser-held authority → harmless victim impact;
- object-reference discovery → horizontal read/write → API-wide BOLA review;
- confirmed SSRF → metadata isolation → workload credential exposure → least privilege;
- trusted pricing/payment binding → idempotency → bounded transaction race.

Every node resolves to a production item and every item declares the same chain membership. Edge conditions are shown in the browser and feed the Suggested next chain-unlock boost when the immediate prerequisite is Passed or a Confirmed Finding.

## Payload/reference library

The initial library contains 40 entries across injection, XSS, CSRF, SSRF, GraphQL, JWT, file handling, and request smuggling. Every entry has:

- exact context;
- intended use;
- caveats;
- safety guidance;
- related checklist IDs;
- a `review_only` flag where additional approval or isolation is required.

REVIEW-ONLY entries remain collapsed in the UI. The smuggling library intentionally contains no ready-to-run ambiguous-framing payload. Metadata references prohibit real metadata/token retrieval; file references contain no malware, shell, macro, parser exploit, or decompression bomb; XSS proofs prohibit data collection.

## Burp workflows

Twelve Markdown workflows cover Proxy, Repeater, Intruder, Scanner, Comparer, Decoder, Sequencer, Logger, Param Miner, Autorize, Turbo Intruder, and Collaborator. Each document includes:

- when and why to use the tool;
- a bounded safe workflow;
- evidence to retain;
- operational and data-handling boundaries;
- what the tool does not prove.

## UI

The Chains view renders graph cards with linked checklist nodes, edge unlock conditions, and chain safety. Checklist cards link back to their chain IDs. The payload view provides full-text/category/safety filters, contextual cards, collapsed REVIEW-ONLY details, related item IDs, and links to every Burp workflow.

## Validation

`node tools/validate.js --floors` now also validates:

- chain manifest/document IDs, node and edge resolution, graph acyclicity, and bidirectional item membership;
- payload manifest counts, unique IDs, required context/use/caveat/safety fields, related item IDs, and REVIEW-ONLY tags;
- all twelve Burp files and their required workflow sections.
