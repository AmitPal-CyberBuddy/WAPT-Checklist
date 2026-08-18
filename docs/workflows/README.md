# GitHub Actions workflow templates

The Arena GitHub App used for this development session does not have GitHub's `workflows` permission. GitHub therefore rejected a push containing `.github/workflows/**`.

A repository maintainer must copy these reviewed templates after merging:

```bash
mkdir -p .github/workflows
cp docs/workflows/ci.yml .github/workflows/ci.yml
cp docs/workflows/deploy.yml .github/workflows/deploy.yml
```

Commit the copied files to the default branch, then in repository **Settings → Pages**, select **GitHub Actions** as the source. The deployment workflow tests the project before publishing the repository root. The CI workflow runs the Node test suite and Phase 1 content validator on pushes and pull requests.

Do not delete the templates immediately after copying them; keeping a reviewable fallback documents the expected workflow when an integration cannot update workflow files.
