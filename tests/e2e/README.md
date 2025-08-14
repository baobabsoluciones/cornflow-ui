# End-to-End testing with Playwright

This directory contains end-to-end tests for the Cornflow UI application using Playwright.

## Setup

The project is configured to use Playwright for E2E testing. The configuration is defined in `playwright.config.ts` at the root of the project.

## Running tests

You can run the E2E tests using these npm scripts:

```bash
# Run all E2E tests headlessly (default)
npm run test:e2e

# Run E2E tests with a visible browser
npm run test:e2e:headed

# Run E2E tests with the Playwright UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Generate tests using Playwright's codegen tool
npm run test:e2e:codegen
```

### Important: Running the development server

The current configuration requires you to **manually start the development server before running the tests**:

1. Start the development server in one terminal:
   ```bash
   npm run dev
   ```

2. Run the tests in another terminal:
   ```bash
   npm run test:e2e
   ```

This approach avoids timeout issues that may occur when Playwright tries to start the server automatically.

If you want to enable automatic server startup, uncomment the `webServer` section in `playwright.config.ts`.

### Testing modes explained

#### Headless testing (`test:e2e`)

Headless testing runs browsers in the background without a visible UI. This is ideal for:
- CI/CD pipelines
- Fast test execution
- Running tests in environments without a display
- Running a full test suite without interrupting your workflow

This is the default mode and the fastest way to run tests.

#### Headed testing (`test:e2e:headed`)

Headed testing runs browsers with visible windows, showing the actual browser UI during test execution. This is useful for:
- Watching the test execute in real-time
- Visually observing interactions with the application
- Identifying UI rendering issues that might not be caught in headless mode
- Demonstrating test execution to stakeholders

Use this mode when you need to see what's happening during your tests.

#### UI mode (`test:e2e:ui`)

Playwright's UI mode provides an interactive dashboard for test execution with features like:
- Visual test explorer with filtering options
- Test rerunning and watch mode
- Live test results and stats
- Advanced debugging tools
- Trace viewer integration

This mode is particularly helpful for:
- Test development and maintenance
- Exploratory debugging
- Understanding test failures
- Sharing test results with team members

The UI opens in a dedicated browser tab and offers a more user-friendly way to work with tests.

#### Debug mode (`test:e2e:debug`)

Debug mode runs tests with the Playwright Inspector enabled, pausing execution at the start of the test. This mode:
- Allows step-by-step execution
- Shows detailed information about each step
- Provides a DOM explorer
- Lets you inspect network requests
- Enables you to run JavaScript in the browser context

Use debug mode when you need to troubleshoot complex test failures or when developing new tests.

#### Codegen (`test:e2e:codegen`)

The codegen tool opens a browser and records your actions to generate test code automatically. This is useful for:
- Quickly prototyping tests
- Learning Playwright's API
- Generating selectors for complex elements
- Creating initial test scaffolding that you can refine later

As you interact with your application, Playwright generates the corresponding test code that you can copy and adapt.

## Test structure

- **login.spec.ts**: Tests for authentication flows
- **auth-utils.ts**: Helper functions for authentication in tests
- **global-setup.ts**: Global setup that runs before all tests
- **pages/login-page.ts**: Page Object Model for the login page

## Authentication testing

The application supports three authentication methods:
1. **Cornflow Authentication**: Username/password built into the app
2. **Azure AD Authentication**: Single sign-on with MSAL
3. **AWS Cognito Authentication**: Login using AWS Cognito

The tests automatically detect which authentication method is being used and adjust accordingly.

### Mocking authentication

For tests that don't focus on the login flow itself but require an authenticated user, you can use the helper functions in `auth-utils.ts`:

```typescript
import { setupSessionAuth } from './auth-utils';

test('authenticated user test', async ({ page }) => {
  // Set up authentication without going through login flow
  await setupSessionAuth(page);
  
  // Now you can test authenticated functionality
  await page.goto('/profile');
  // ...rest of your test
});
```

## Page object model

The tests use the Page Object Model pattern to encapsulate page elements and interactions:

```typescript
import { LoginPage } from './pages/login-page';

test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('username', 'password');
  
  // Assert on the result
});
```

This approach:
- Improves test maintainability
- Reduces code duplication
- Creates a clear separation between test logic and page interactions
- Makes tests more readable

## Test fixtures

Playwright tests use fixtures (`test.beforeEach()`) to set up the test environment. This ensures each test starts from a clean state:

```typescript
test.beforeEach(async ({ page, context }) => {
  // Clear session storage and cookies between tests
  await context.clearCookies();
  
  // Set up the test environment
  // ...
});
```

## Best practices

1. **Use auth-utils for bypassing auth**: When the login flow is not what you're testing, use the helper functions to set up an authenticated session quickly.

2. **Prefer data-test attributes**: Add specific test attributes to your components to make selectors more robust:
   ```html
   <button data-test="submit-button">Submit</button>
   ```
   ```typescript
   await page.locator('[data-test="submit-button"]').click();
   ```

3. **Test isolation**: Each test should clean up after itself and not depend on the state of other tests.

4. **Mock API calls**: Use Playwright's network interception to mock API responses:
   ```typescript
   await page.route('/api/data', async route => {
     await route.fulfill({
       status: 200,
       body: JSON.stringify({ success: true })
     });
   });
   ```

5. **Focus tests on features**: Keep tests focused on a single feature or functionality rather than creating long end-to-end scenarios.

6. **Use Playwright assertions**: Leverage Playwright's built-in assertions which are designed to handle the asynchronous nature of web pages:
   ```typescript
   await expect(page.locator('.message')).toBeVisible();
   await expect(page.locator('.counter')).toHaveText('1');
   ```

7. **Visual testing**: Consider using Playwright's snapshot testing for visual regression testing:
   ```typescript
   await expect(page).toHaveScreenshot('homepage.png');
   ```

## Managing test credentials securely

The E2E tests require valid login credentials to test authentication flows. To prevent exposing real credentials in the codebase, we use environment variables:

### Setting up test credentials

1. Copy the example environment file to create your local test environment:
   ```bash
   cp tests/e2e/.env.example tests/e2e/.env
   ```

2. Edit the `tests/e2e/.env` file to add your test credentials:
   ```
   TEST_USERNAME=your_test_username
   TEST_PASSWORD=your_test_password
   ```

3. Make sure that your `.env` file is never committed to the repository.

### CI environment setup

In a CI/CD environment, you should set the test credentials as secure environment variables instead of using files:

1. Add `TEST_USERNAME` and `TEST_PASSWORD` as secure environment variables in your CI system.

2. The tests will automatically skip credential-dependent tests if running in a CI environment (`CI=true`) without proper credentials.

3. To run tests in CI, make sure both environment variables are set:
   ```yaml
   # Example GitHub Actions workflow
   env:
     TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
     TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
   ```

### Mocking authentication

For tests that don't focus specifically on the login flow, consider using the helper functions in `auth-utils.ts` to set up authentication state directly:

```typescript
import { setupSessionAuth } from './auth-utils';

test('authenticated user test', async ({ page }) => {
  // This bypasses the actual login flow
  await setupSessionAuth(page);
  
  // Test authenticated functionality
  await page.goto('/project-execution');
  // ...
});
```

## Continuous Integration with GitHub Actions

This project is configured with GitHub Actions workflows to run the E2E tests automatically on pull requests and pushes to specific branches.

### Integrated Testing Pipeline

The `tests.yml` workflow in GitHub Actions runs a complete testing pipeline:

1. **Unit Tests**: First runs all unit tests with test coverage reports
2. **E2E Tests**: Then runs the Playwright E2E tests if unit tests pass

This ensures both code-level quality (unit tests) and user-level functionality (E2E tests) are maintained.

### Automated E2E Testing

The E2E tests portion of the workflow is triggered when:
- A pull request is opened, synchronized, or reopened targeting the `develop` or `master` branches
- Code is pushed to the `develop` or `master` branches
- Manually triggered via the GitHub Actions interface

### Required Repository Secrets

To run the E2E tests in GitHub Actions, you need to configure these repository secrets:

1. **TEST_USERNAME**: The username for a test account
2. **TEST_PASSWORD**: The password for the test account
3. **BACKEND_URL**: The URL of the backend API server for testing

### Setting Up GitHub Actions

For detailed instructions on setting up GitHub Actions for this project, see:
- The main [GitHub Actions documentation](../../.github/GITHUB_ACTIONS.md)
- The workflow file [tests.yml](../../.github/workflows/tests.yml)

### Viewing Test Results

The workflow is configured to upload both unit test coverage and E2E test reports as artifacts:

1. **Unit Test Coverage**: Available as a downloadable artifact named "coverage-report"
2. **E2E Test Reports**: Available as a downloadable artifact named "playwright-report"

These reports are available even if the tests fail, which helps with diagnosing issues.

## Troubleshooting

- **Tests failing intermittently**: Increase the timeout value or add explicit waits for elements to be ready.
- **Selectors not working**: Use Playwright's Inspector to identify more reliable selectors.
- **Network issues**: Mock API responses or set up a test environment that doesn't require external services.
- **Authentication problems**: Verify that the auth helpers correctly set up the required state for your specific auth method.
- **WebServer timeout issues**: If you encounter errors like `Error: Timed out waiting XXXms from config.webServer`, try the following:
  1. Comment out the `webServer` section in `playwright.config.ts`
  2. Start the development server manually with `npm run dev` in a separate terminal
  3. Then run the tests with `npm run test:e2e` in another terminal
  4. Use the `npm run test:e2e:manual-server` script which includes a reminder to start the server first

### Connection Refused Errors

If you encounter errors like `net::ERR_CONNECTION_REFUSED` or `NS_ERROR_CONNECTION_REFUSED`:

1. **Verify the development server is running**:
   ```bash
   npm run dev
   ```
   Make sure it starts successfully without any errors.

2. **Check the port number**:
   - The development server should be running on port 3000 by default
   - If it's using a different port (shown in the console output), set the PORT environment variable:
     ```bash
     # On Windows:
     set PORT=3000
     npm run test:e2e

     # On Linux/Mac:
     PORT=3000 npm run test:e2e
     ```

3. **Try accessing the development server directly in your browser**:
   - Open http://localhost:3000 (or the actual port) in your browser
   - If you can't access it, the server might not be running correctly

4. **Check for firewall or antivirus software** that might be blocking the connection

5. **Only run one browser at a time** for testing if you're experiencing connection issues:
   ```bash
   npx playwright test --project=chromium
   ```

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright) 