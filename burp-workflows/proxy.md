# Burp Proxy workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Capture the real application workflow, identity context, and request ordering before mutation.

## Safe workflow

1. Create separate browser profiles for each designated account or tenant.
2. Keep interception off during ordinary mapping; use HTTP history and scope filters to avoid accidental disruption.
3. Annotate login, object creation, state transitions, logout, and cleanup requests.
4. Send one stable baseline to Repeater before changing any input.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Do not retain unredacted passwords, cookies, bearer tokens, personal data, or customer object IDs.
- Do not treat a proxy-seen request as evidence that the server trusts every field.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
