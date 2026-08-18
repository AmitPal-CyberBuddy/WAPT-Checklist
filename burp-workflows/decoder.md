# Burp Decoder workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Inspect encodings and token structure locally without confusing decoding with validation.

## Safe workflow

1. Work only with synthetic or fully redacted values.
2. Record each transformation and preserve original byte boundaries.
3. Use Decoder for URL/base64/hex inspection and then verify server behavior in Repeater.
4. For JWTs, separate readable claims from signature, issuer, audience, type, and lifecycle validation.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Decoding is not decryption, authenticity, or exploitability.
- Never paste real credentials or tokens into external websites or third-party tools.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
