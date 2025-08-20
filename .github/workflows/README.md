# GitHub actions workflow

This directory contains the GitHub Actions workflow for automated testing and coverage checks.

## Workflow

### 🔍 `develop-pr.yml` - Develop PR checks
**Trigger:** Pull requests targeting the `develop` branch

**Purpose:** Ensures all tests pass and coverage is above 80% before merging

**Steps:**
- ✅ Install dependencies
- ✅ Run tests with coverage
- ✅ Coverage threshold enforced automatically (80% minimum)

**Configuration:** Coverage threshold is set in `vitest.config.ts` - the workflow will fail if coverage is below 80%

## Local testing
Test locally before creating a PR:

```bash
# Run tests with coverage
npm run test:coverage
```

The workflow will automatically fail if:
- Any test fails
- Coverage is below 80% (statements, branches, functions, or lines)