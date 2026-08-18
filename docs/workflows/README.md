# GitHub Actions workflow templates

The active workflows are installed at:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

The byte-matching source templates remain at:

- `docs/workflows/ci.yml`
- `docs/workflows/deploy.yml`

A repository maintainer installed the active copies on 2026-08-18 because the Arena GitHub App does not have GitHub's `workflows` permission. Keeping the source templates provides a reviewable recovery copy and documents the approved workflow content.

GitHub Pages uses **GitHub Actions** as its source. The deployment workflow runs the Node tests, schema validation, all 24 production category floors, reference validation, and content audit before publishing the static repository root. The CI workflow runs the same release gates on pushes and pull requests.

When a workflow changes, update both the active file and its source template in the same reviewed pull request. Do not weaken the test gate, Pages permissions, restrictive CSP, static-root architecture, or same-origin deployment model.
