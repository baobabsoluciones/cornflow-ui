# Cornflow-UI

![Tests](https://github.com/HelenaCanana/cornflow-ui/actions/workflows/tests.yml/badge.svg)

Cornflow-UI is a Vue.js application that serves as the user interface for Cornflow. This is the base project, and it provides the general structure and functionalities for creating new applications.

## Creating a new project

To create a new project based on this base project, follow these steps:

1. **Copy the base project**: Copy and paste all the code from this repository into your new repository.

2. **Configure the core values**: 
The application can be configured in two ways, controlled by the `useConfigJson` parameter in `src/app/config.ts`:

- Using environment variables (.env)
Set `useConfigJson: false` in `src/app/config.ts` and configure using environment variables in the `.env` file:
```env
VUE_APP_18N_LOCALE=en
VUE_APP_I18N_FALLBACK_LOCALE=en
VITE_APP_BACKEND_URL=https://your-backend-url
VITE_APP_AUTH_TYPE=cornflow
VITE_APP_SCHEMA=rostering
VITE_APP_NAME=Rostering
```

- Using JSON configuration (values.json)
Set `useConfigJson: true` in `src/app/config.ts` and provide configuration through a `values.json` file:

```json
{
  "backend_url": "https://your-backend-url",
  "auth_type": "cornflow",
  "schema": "rostering",
  "name": "Rostering",
  "cognito": {
    "region": "your-region",
    "user_pool_id": "your-user-pool-id",
    "client_id": "your-client-id",
    "domain": "your-domain"
  }
}
```

For local development with JSON configuration:
1. Copy `public/values.template.json` to `public/values.json`
2. Edit `public/values.json` with your specific configuration values
3. Set `useConfigJson: true` in `src/app/config.ts`

For production with JSON configuration:
1. Copy `values.template.json` to your domain root as `values.json`
2. Edit with your production configuration values
3. Set `useConfigJson: true` in `src/app/config.ts`

When `useConfigJson` is true in `src/app/config.ts`, the application will load configuration from the JSON file and ignore any environment variables.

3. **Configure the application**: Navigate to the `src/app` directory and configure the following files:

   - `config.ts`: This is the main configuration file for the application. Here, you should define an object that specifies the core functionalities, dashboard layout, dashboard pages, and dashboard routes for the application. The schema and name will be automatically read from the main config file. See the example below:

   ```typescript
   {
   core: {
       Experiment: ExperimentRostering,
       Instance: InstanceRostering,
       Solution: SolutionRostering,
       AppConfig: {
       isPilotVersion: false,
       showTimeLimit: true,
       useHashMode: false,
       schema: config.schema,
       name: config.name,
       logo: 'path/to',
       expandedLogo: 'path/to',
       showExtraProjectExecutionColumns: {
         showUserName: false,     
         showEndCreationDate: false 
       }
       },
       dashboardLayout: [
       {
           title: 'Number of workers',
           component: 'InfoCard',
           cols: 4,
           bindings: {
           title: 'rostering-number-of-workers',
           icon: 'people',
           content: experiment().instance.numberEmployees,
           },
           style: 'height: 150px;',
       },
       {
           title: 'Max. demand',
           component: 'InfoCard',
           cols: 4,
           bindings: {
           title: 'rostering-max-demand',
           icon: 'add',
           content: experiment().instance.maxDemand,
           },
           style: 'height: 150px;',
       },
       {
           title: 'Min. demand',
           component: 'InfoCard',
           cols: 4,
           bindings: {
           title: 'rostering-min-demand',
           icon: 'remove',
           content: experiment().instance.minDemand,
           },
           style: 'height: 150px;',
       },
       {
           title: 'Demand',
           component: 'RosteringDemandView',
           cols: 8,
           bindings: {
           preview: true,
           },
           style: 'height: 375px;',
       },
       {
           title: 'Resources',
           component: 'RosteringMainView',
           cols: 4,
           bindings: {
           preview: true,
           },
           style: 'height: 375px;',
       },
       {
           title: 'Skill demand',
           component: 'RosteringSkillDemandView',
           cols: 12,
           bindings: {
           preview: true,
           },
           style: 'height: 420px;',
       },
       {
           title: 'Calendar',
           component: 'RosteringCalendarView',
           cols: 12,
           bindings: {
           preview: true,
           },
           style: 'height:600px;',
       },
       ],
   dashboardPages: [
       {
           title: 'Calendar',
           icon: 'mdi-calendar',
           to: '/rostering',
           pos: 13,
       },
       {
           title: 'rostering-resources-chart',
           icon: 'mdi-chart-gantt',
           to: '/rostering-gantt',
           pos: 14,
       },
       {
           title: 'rostering-demand',
           icon: 'mdi-chart-timeline-variant',
           to: '/rostering-demand',
           pos: 11,
       },
       {
           title: 'rostering-skill-demand',
           icon: 'mdi-chart-bar',
           to: '/rostering-skill-demand',
           pos: 12,
       },
       ],
   dashboardRoutes: [
       {
           name: 'Calendar',
           path: 'rostering',
           component: () => import('@/app/views/RosteringCalendarView'),
       },
       {
           name: 'rostering-resources-chart',
           path: 'rostering-gantt',
           component: () => import('@/app/views/RosteringMainView'),
       },
       {
           name: 'rostering-demand',
           path: 'rostering-demand',
           component: () => import('@/app/views/RosteringDemandView'),
       },
       {
           name: 'rostering-skill-demand',
           path: 'rostering-skill-demand',
           component: () => import('@/app/views/RosteringSkillDemandView'),
       },
       ],
   },
   }
   ```

   - `assets/logo`: This directory should contain the logo images for the application. The name should be the same as the default ones (logo.png and full_logo.png)
   - `assets/style/variables.css`: This file should define the main colors of the application. Mantain the variable names and only change the colors.
   - `models`: This directory should define the instance, solution, experiment, and execution models for the application.
   - `views`: This directory should contain all the custom views needed for the application.
   - `components`: This directory should contain any additional components that are not in the core components.
   - `store/app.ts`: This file should define any additional store-specific configurations for the application.
   - `tests`: This file should contain all unit tests for additional components.
   - `plugins/locales`: This folder contains three files (`en.ts`, `es.ts`, `fr.ts`) to add any text needed in the app views and components. Be careful not to duplicate the names with the original locales files (`src/plugins/locales`).

4. Additionally, favicon can be replaced by a new one in public/favicon.png

It's important not to edit any other file or folders. Only the folders, files and images just mentioned can be edited.

\*\*Note: To save dashboard preferences for a single execution, including filters, checks, and date ranges, utilize the `setDashboardPreference` method from the `LoadedExecution.ts` class. Subsequently, retrieve these preferences using the `getDashboardPreference` method. The data type is custom, allowing for flexible usage as needed.

## Authentication

The application supports three authentication methods. Note that for any of these methods to work, the server must be properly configured to accept the corresponding authentication type.

### 1. Cornflow authentication (Default)
Using environment variables (when useConfigJson: false):
```env
VITE_APP_AUTH_TYPE=cornflow
```

Using values.json (when useConfigJson: true):
```json
{
  "auth_type": "cornflow"
}
```

### 2. Azure OpenID authentication
Using environment variables (when useConfigJson: false):
```env
VITE_APP_AUTH_TYPE=azure
VITE_APP_AUTH_CLIENT_ID=your_azure_client_id
VITE_APP_AUTH_AUTHORITY=your_azure_authority
```

Using values.json (when useConfigJson: true):
```json
{
  "auth_type": "azure",
  "azure": {
    "client_id": "your_azure_client_id",
    "authority": "your_azure_authority"
  }
}
```

### 3. AWS Cognito authentication
Using environment variables (when useConfigJson: false):
```env
VITE_APP_AUTH_TYPE=cognito
VITE_APP_AUTH_CLIENT_ID=your_cognito_client_id
VITE_APP_AUTH_REGION=your_cognito_region
VITE_APP_AUTH_USER_POOL_ID=your_cognito_user_pool_id
```

Using values.json (when useConfigJson: true):
```json
{
  "auth_type": "cognito",
  "cognito": {
    "client_id": "your_cognito_client_id",
    "region": "your_cognito_region",
    "user_pool_id": "your_cognito_user_pool_id"
  }
}
```

The authentication type is configured either through environment variables or the values.json file, depending on the `useConfigJson` setting in `src/app/config.ts`.

## Router Configuration

The application supports two routing modes:

### 1. HTML5 History Mode (Default)
This is the default routing mode that creates clean URLs without the hash (#). It requires proper server configuration to handle the URLs correctly.

### 2. Hash Mode
If you're deploying in an environment where you don't have control over the server configuration or are experiencing issues with route handling, you can enable hash mode by setting `useHashMode: true` in the core parameters in `src/app/config.ts`:

```typescript
parameters: {
  // other parameters
  useHashMode: true,
  // other parameters
}
```

When hash mode is enabled, all routes will include a hash (#) in the URL (e.g., `http://example.com/#/project-execution` instead of `http://example.com/project-execution`).

## Installing

- Install or update npm
- Install Nodejs
- Open your terminal
- Navigate to the project
- Run `npm install`

## Running

- Edit the `.env` file to put the URL of the Cornflow server
- Run `npm run dev` to start a local development server
- A new tab will be opened in your browser

## Testing

The project includes both unit tests with Vitest and end-to-end (E2E) tests with Playwright.

### Unit testing

Run unit tests with:

```bash
npm run test
```

### End-to-end testing with Playwright

The project is configured with Playwright for comprehensive E2E testing. Playwright allows you to automate browser interactions and verify your application's behavior from a user's perspective.

#### Setup

Playwright is already configured in the project. The tests and configuration files are located in:
- `playwright.config.ts` - Main configuration file
- `tests/e2e/` - E2E test files
- `tests/e2e/pages/` - Page Object Models
- `tests/e2e/auth-utils.ts` - Authentication utilities

#### Setting up test credentials

For tests involving authentication, you need to set up test credentials:

1. Copy the example environment file:
   ```bash
   cp tests/e2e/.env.example tests/e2e/.env
   ```

2. Edit the `.env` file with valid test credentials:
   ```
   TEST_USERNAME=your_test_username
   TEST_PASSWORD=your_test_password
   ```

3. **IMPORTANT**: Never commit the `.env` file with real credentials to version control.

#### Running E2E tests

You can run the E2E tests using these npm scripts:

```bash
# The easiest way - start the server and run tests in one command:
npm run test:e2e:with-server

# Or manually:
# First, start the development server in a separate terminal
npm run dev

# Then, in another terminal, run your tests:
# Run all E2E tests headlessly (default)
npm run test:e2e

# Run E2E tests with visible browsers
npm run test:e2e:headed

# Run E2E tests with the Playwright UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Generate tests using Playwright's codegen tool
npm run test:e2e:codegen

# For clarity, use this script which reminds you to start the server first
npm run test:e2e:manual-server
```

For more detailed information about E2E testing, see the [E2E Testing README](tests/e2e/README.md).

## Continuous Integration

The project is configured with GitHub Actions for continuous integration. The workflow automatically runs both unit tests and E2E tests on pull requests and pushes to the `master` and `develop` branches.

### GitHub Actions Workflows

- **Tests Workflow**: Runs both unit and E2E tests to ensure the application works as expected.
  - Unit tests verify that individual components and functions work correctly in isolation
  - E2E tests ensure the application works as expected from an end-user perspective

### Setting Up CI

To use the GitHub Actions workflows, you need to configure repository secrets for test credentials and environment variables:

1. **TEST_USERNAME**: Test account username
2. **TEST_PASSWORD**: Test account password
3. **BACKEND_URL**: URL of the backend API server

For detailed setup instructions and troubleshooting, see the [GitHub Actions documentation](.github/GITHUB_ACTIONS.md).
