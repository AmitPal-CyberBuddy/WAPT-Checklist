# WAPT Checklist

A context-aware Web Application Penetration Testing methodology, checklist, and knowledge base for **authorized security assessments only**.

> **Project status:** Phase 1 architecture and taxonomy are ready for maintainer review. The application shell and production catalog have not been implemented yet.

## Phase 1 review package

- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [24-category taxonomy, 512-item floor, IDs, and context vocabulary](docs/TAXONOMY.md)
- [Content authoring and safety contract](docs/CONTENT-GUIDE.md)
- [Checklist item JSON Schema](schema/item.schema.json)
- [20 complete sample items](checklist/sample.json)
- [Zero-dependency semantic validator](tools/validate.js)
- [Schema/data contract tests](tests/schema.test.js)

Validate this phase with Node.js 18 or newer:

```bash
node tools/validate.js checklist/sample.json
node --test
```

The 20 sample items intentionally do not count toward production category floors. Floor enforcement becomes a release gate when production category files are authored.

## Planned product

The completed project will be a static GitHub Pages application with:

- an optional scoping wizard and editable quick-start presets;
- pure context, applicability, priority, and state engines;
- adaptive Active / Confirm / N/A decisions and blocked-roadmap guidance;
- full-text search, filters, per-item notes, status, findings, and retest tracking;
- local-only state, JSON portability, Markdown exports, and report generation;
- 24 validated methodology categories, attack chains, contextual payload references, and Burp workflows;
- no backend, telemetry, CDN, or runtime dependencies.

## Safety and privacy

Use this material only where you have explicit authorization. Prefer reversible test objects and the least-impacting proof. Coordinate techniques that can affect shared infrastructure. Redact credentials, tokens, personal data, and tenant identifiers from evidence.

The planned application sends no engagement information anywhere. Target URLs, answers, notes, and statuses remain in the browser's local storage unless the tester explicitly exports them.

## Standards and attribution

The methodology uses original wording and maps to authoritative material including the [OWASP Web Security Testing Guide 4.2](https://owasp.org/www-project-web-security-testing-guide/v42/), [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0), OWASP API Security Top 10, OWASP Top 10 (2021 and 2025), CWE, IETF specifications, WHATWG/W3C specifications, and PortSwigger Web Security Academy.

OWASP WSTG and ASVS are available under Creative Commons Attribution-ShareAlike licenses. Their names, identifiers, and links are used for attribution and traceability; checklist prose is independently authored. This repository's software and original project content are planned for Apache-2.0 licensing in Phase 2, with third-party attribution retained as required.

## Contributing

Contribution guidance, security policy, project license, and the working site shell are Phase 2 deliverables after this architecture review is accepted.
