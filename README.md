# Cornflow-UI

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
       parameters: {
       isPilotVersion: false,
       showTimeLimit: true,
       useHashMode: false,
       schema: config.schema,
       name: config.name,
       logo: 'path/to',
       expandedLogo: 'path/to',
       showTablesWithoutSchema: true,
       showExtraProjectExecutionColumns: {
         showUserName: false,     
         showEndCreationDate: false,
         showTimeLimit: true,
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
      solverConfig: {
        showSolverStep: false,
        defaultSolver: 'mip.gurobi',
      },
      configFieldsConfig: {
        showConfigFieldsStep: false,
        autoLoadValues: true,
      },
      configFields: [
        {
          key: 'timeLimit_3',
          title: 'projectExecution.steps.step6.timeLimit_3',
          placeholder: 'projectExecution.steps.step6.timeLimit_3Placeholder',
          suffix: 'projectExecution.steps.step6.minutesSuffix',
          icon: 'mdi-timer-sand',
          type: 'number',
          source: 'eParametros',
          param: 'minutos_modelo_3',
          lookupType: 'arrayByValue',
          lookupParam: 'ID',
          lookupValue: 'VALOR',
        },
        {
          key: 'timeLimit_4',
          title: 'projectExecution.steps.step6.timeLimit_4',
          placeholder: 'projectExecution.steps.step6.timeLimit_4Placeholder',
          suffix: 'projectExecution.steps.step6.minutesSuffix',
          icon: 'mdi-timer-sand-full',
          type: 'number',
          source: 'eParametros',
          param: 'minutos_modelo_4',
          lookupType: 'arrayByValue',
          lookupParam: 'ID',
          lookupValue: 'VALOR',
        },
        {
          key: 'gapRel',
          title: 'projectExecution.steps.step6.gapRel',
          placeholder: 'projectExecution.steps.step6.gapRelPlaceholder',
          suffix: 'projectExecution.steps.step6.percentageSuffix',
          icon: 'mdi-percent',
          type: 'float',
          source: 'eParametros',
          param: 'gap',
          lookupType: 'arrayByValue',
          lookupParam: 'ID',
          lookupValue: 'VALOR',
        },
        {
          key: 'cornflow',
          title: 'projectExecution.steps.step6.cornflow',
          placeholder: 'projectExecution.steps.step6.cornflowPlaceholder',
          icon: 'mdi-cloud-check',
          type: 'boolean',
          default: true
        }
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

## Custom File Processors

The application supports custom file processing for instances based on filename prefixes. This feature is useful when you need to handle files with special formats or structures before merging them with other files to create an instance.

### Configuration

Custom file processing is entirely optional. By default, the system will merge all uploaded files without any special processing. If you don't need custom file processing, you can leave the `fileProcessors` object empty or omit it entirely.

If you do need custom processing for specific file types, add a `fileProcessors` object to the core parameters in `src/app/config.ts`:

```typescript
parameters: {
  // other parameters
  fileProcessors: {
    // Single processor for a prefix
    'mtrx': 'processMatrix',
    
    // Multiple processors for a prefix (applied in sequence)
    'config': ['processConfig', 'processCleanData'],
    
    // Special 'all' prefix to process all files regardless of their names
    'all': ['processCleanData', 'processBooleansFromStrings']
  },
  // other parameters
}
```

Each key in the `fileProcessors` object is a filename prefix that triggers special processing, and each value is either:
- A string with the name of a single processor method to use
- An array of processor method names to apply in sequence

The special prefix `'all'` can be used to apply processors to all files regardless of their names.

### Implementation

The actual processing logic must be implemented in the `src/app/composables/useFileProcessors.ts` file. You need to add your processor methods to the `processors` object in this file. 

Each processor method should:
1. Accept parameters: file, fileContent, extension, and schemas
2. Parse the file content based on its format (JSON, XLSX, or CSV)
3. Transform the data into a format that represents a part of the complete instance data
4. Return a new Instance object with this partial data that will later be merged with other files

When multiple processors are specified for a prefix (or for the 'all' prefix), they are applied in sequence, with each processor receiving the output of the previous one.

Important: The processor methods don't create the final, complete instance. Instead, they each process a specific part of the data needed for the complete instance. After all files are processed, the system will automatically merge all the processed parts to create the complete instance.

For example, in a scheduling application, one file might contain employee data, another might contain shift requirements, and a third might contain constraints. Each file would be processed separately and then merged to create the complete instance.

The system automatically detects files that match the configured prefixes and processes them using the corresponding methods before merging all the processed parts into the final instance. Files that don't match any configured prefix are processed using the standard method.

## Create project execution steps customization

### Solver step: solverConfig
Controls the solver selection step and default solver for executions.
- `showSolverStep` (boolean):
  - If true, shows the solver selection step to the user.
  - If false, skips the step and uses the value in `defaultSolver` automatically.
- `defaultSolver` (string):
  - The solver to use if `showSolverStep` is false.
  - Used in the execution config as `newExecution.config.solver`.

### Configuration parameters step: configFieldsConfig
Controls the config fields step and value loading for execution parameters.
- `showConfigFieldsStep` (boolean):
  - If true, shows the config fields step to the user.
  - If false, skips the step and loads values automatically from the instance or defaults.
- `autoLoadValues` (boolean):
  - If true, loads config field values from the instance (or default) when the step is skipped.
  - Used in ProjectExecutionView.vue to call value loading after the instance is loaded or before steps that need config values.

### Configuration parameters step:configFields
Defines the configuration fields for execution parameters. Each field can have:
- `key` (string): Unique identifier for the field (used as config property).
- `title` (string): Translation key for the field label.
- `placeholder` (string): Translation key for the field placeholder.
- `suffix` (string): Translation key for the field suffix (e.g., units).
- `icon` (string): Material Design icon name.
- `type` ('number' | 'float' | 'boolean' | 'text' | 'select'): Field type.
- `source` (string, optional): Table name in instance.data to get the value from (e.g., 'eParametros').
- `param` (string, optional): Key or ID to look up in the source table/array.
- `lookupType` (string, optional): How to look up the value in the source. Supported:
  - 'arrayByValue': Looks for an object in the array where [lookupParam] === param, returns [lookupValue].
  - If null, searches directly as key[value] for source[param].
- `lookupParam` (string, optional, for arrayByValue): The property to match in the array (e.g., 'ID').
- `lookupValue` (string, optional, for arrayByValue): The property to return from the found object (e.g., 'VALOR').
- `default` (any, optional): Default value if not found in the instance.
- `options` (Array<{label: string, value: any}>, for select type): Options for select fields.

### Implementation in ProjectExecutionView.vue:
- `solverConfig` is used to determine if the solver step is shown and to set the default solver.
- `configFieldsConfig` is used to determine if the config fields step is shown and to auto-load values.
- `configFields` is used to render the config fields step, auto-load values from the instance, and display the config summary in the confirmation step.

- `assets/logo`: This directory should contain the logo images for the application. The name should be the same as the default ones (logo.png and full_logo.png)
- `assets/style/variables.css`: This file should define the main colors of the application. Mantain the variable names and only change the colors.
- `models`: This directory should define the instance, solution, experiment, and execution models for the application.
- `views`: This directory should contain all the custom views needed for the application.
- `components`: This directory should contain any additional components that are not in the core components.
- `store/app.ts`: This file should define any additional store-specific configurations for the application.
- `tests`: This file should contain all unit tests for additional components.
- `plugins/locales`: This folder contains three files (`en.ts`, `es.ts`, `fr.ts`) to add any text needed in the app views and components. Be careful not to duplicate the names with the original locales files (`src/plugins/locales`).

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
