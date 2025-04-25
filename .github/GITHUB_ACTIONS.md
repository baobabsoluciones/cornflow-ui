# GitHub actions workflows

This document provides an overview of the GitHub Actions workflows in this repository.

## Tests workflow

The comprehensive testing workflow (`tests.yml`) runs both unit tests and end-to-end tests to ensure code quality and application functionality. This workflow is triggered when:
- A pull request is opened, synchronized, or reopened targeting the `develop` or `master` branches
- Code is pushed to the `develop` or `master` branches
- Manually triggered via the GitHub Actions interface

The workflow consists of two sequential jobs:

1. **Unit tests**: Runs Vitest unit tests first
2. **E2E tests**: Runs Playwright end-to-end tests after unit tests pass

### Required secrets

For the workflow to run successfully, you need to configure the following secrets in your GitHub repository:

1. **TEST_USERNAME**: A username for a valid test account
2. **TEST_PASSWORD**: The password for the test account
3. **BACKEND_URL**: The URL of the backend API server for testing

### How to configure secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" > "Actions"
4. Click on "New repository secret"
5. Add each of the required secrets:
   - Name: `TEST_USERNAME`
   - Value: *your test username*
   - Click "Add secret"
   - Repeat for each secret

### Unit tests job

The unit tests job:
1. Checks out the code
2. Sets up Node.js
3. Installs dependencies
4. Runs Vitest unit tests with `npm run test`
5. Uploads test coverage reports as artifacts

### E2E tests job

The E2E tests job:
1. Checks out the code
2. Sets up Node.js
3. Installs dependencies
4. Installs Playwright browsers
5. Creates necessary .env files with secrets
6. Detects hash mode configuration
7. Runs the Playwright tests
8. Uploads test results as artifacts (available even if tests fail)

### Viewing test results

If tests fail, you can view the detailed reports:

#### Unit test coverage report

1. Go to the workflow run
2. Scroll down to the "Artifacts" section
3. Download the "coverage-report" artifact
4. Extract the downloaded zip file
5. Open the HTML report in your browser

#### E2E test report

1. Go to the workflow run
2. Scroll down to the "Artifacts" section
3. Download the "playwright-report" artifact
4. Extract the downloaded zip file
5. Open the HTML report in your browser

## Adapting the workflow

If you need to modify the workflow:

1. Edit the `.github/workflows/tests.yml` file
2. For different testing environments, update the environment variables
3. For additional secrets, add them to GitHub and reference them in the workflow file as `${{ secrets.SECRET_NAME }}`

## Troubleshooting

If the workflow fails:

1. Check that all required secrets are properly configured
2. Check the workflow logs for detailed error information
3. Try running the tests locally to reproduce and debug issues
4. Ensure that the application URL is accessible from GitHub Actions runners 