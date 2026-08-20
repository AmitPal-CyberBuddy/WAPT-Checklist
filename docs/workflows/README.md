# GitHub Actions workflow templates

The active workflows are installed at:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

Maintainer-ready source templates remain at:

- `docs/workflows/ci.yml`
- `docs/workflows/deploy.yml`

The active workflows still use `actions/checkout@v4` and `actions/setup-node@v4`. GitHub now runs those Node 20 actions through a Node 24 compatibility path and emits a deprecation annotation. The templates use `@v5`, which removes that annotation. The Arena GitHub App cannot update `.github/workflows/**` without GitHub's `workflows` permission, so a repository maintainer must copy the two reviewed templates into the active paths. Keeping them here provides the exact approved upgrade without weakening any release gate.

GitHub Pages uses **GitHub Actions** as its source. The deployment workflow runs the Node tests, schema validation, all production category floors, reference validation, and content audit before publishing the static repository root. The CI workflow runs the same release gates on pushes and pull requests.

When applying the upgrade, copy each template to its matching active path in one maintainer-reviewed pull request. Do not weaken the test gate, Pages permissions, restrictive CSP, static-root architecture, or same-origin deployment model.
