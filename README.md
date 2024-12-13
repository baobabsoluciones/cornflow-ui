# Cornflow-UI

Cornflow-UI is a Vue.js application that serves as the user interface for Cornflow. This is the base project, and it provides the general structure and functionalities for creating new applications.

## Creating a New Project

To create a new project based on this base project, follow these steps:

1. **Copy the Base Project**: Copy and paste all the code from this repository into your new repository.

2. **Configure the .env File**: Edit the `.env` file to set the following variables:

   - `VUE_APP_18N_LOCALE`: The main language of the application.
   - `VUE_APP_I18N_FALLBACK_LOCALE`: The fallback language of the application.
   - `VITE_APP_BACKEND_URL`: The backend base URL for the application endpoints.
   - `VITE_APP_AUTH_TYPE`: The authentication type for the application. Possible values are `cornflow`, `azure`, and `cognito`. More information about authentication can be found in the [Authentication](#authentication) section.
   - `VITE_APP_SCHEMA`: The schema name for the application (e.g., 'rostering').
   - `VITE_APP_NAME`: The display name of the application.

3. **Configure the Application**: Navigate to the `src/app` directory and configure the following files:

   - `config.ts`: This is the main configuration file for the application. Here, you should define an object that specifies the core functionalities, dashboard layout, dashboard pages, and dashboard routes for the application. The schema and name will be automatically read from environment variables. See the example below:

   ```typescript
   {
   core: {
       Experiment: ExperimentRostering,
       Instance: InstanceRostering,
       Solution: SolutionRostering,
       AppConfig: {
       isPilotVersion: false,
       showTimeLimit: true,
       schema: 'rostering',
       name: 'Rostering',
       logo: 'path/to',
       expandedLogo: 'path/to'
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

### 1. Cornflow Authentication (Default)
```env
VITE_APP_AUTH_TYPE=cornflow
```
- No additional configuration needed

### 2. Azure OpenID Authentication
```env
VITE_APP_AUTH_TYPE=azure
VITE_APP_AUTH_CLIENT_ID=your_azure_client_id
VITE_APP_AUTH_AUTHORITY=your_azure_authority
```

### 3. AWS Cognito Authentication
```env
VITE_APP_AUTH_TYPE=cognito
VITE_APP_AUTH_CLIENT_ID=your_cognito_client_id
VITE_APP_AUTH_REGION=your_cognito_region
VITE_APP_AUTH_USER_POOL_ID=your_cognito_user_pool_id
```

The authentication type can be changed by modifying the `VITE_APP_AUTH_TYPE` variable in the `.env` file.

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
