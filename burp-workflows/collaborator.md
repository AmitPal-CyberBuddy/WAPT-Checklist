# Burp Collaborator workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Correlate blind server-side interactions with unique per-request tokens.

## Safe workflow

1. Use one unique interaction ID for each SSRF, blind XSS, XML, mail, or asynchronous candidate.
2. Record DNS, HTTP, SMTP, timing, and source characteristics.
3. Exclude browser, extension, mail scanner, security gateway, and third-party preview traffic.
4. Stop after the least-impact proof and redact identifiers.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Never encode secrets, customer data, internal hostnames, or credentials into callbacks.
- Do not use callbacks to induce internal network or metadata access.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
