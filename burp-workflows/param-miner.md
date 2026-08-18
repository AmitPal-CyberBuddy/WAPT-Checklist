# Burp Param Miner workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Discover hidden request inputs and cache behavior using a bounded, evidence-driven word set.

## Safe workflow

1. Start from parameters, headers, cookies, and route vocabulary observed in first-party code or documentation.
2. Run on harmless idempotent routes with low concurrency.
3. Confirm discovered inputs manually and determine whether they affect response or trusted behavior.
4. For cache leads, use isolated keys and inert markers, then purge.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Do not brute-force massive dictionaries or poison public cache keys.
- A reflected/discovered header is not security-relevant until its downstream use is proven.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
