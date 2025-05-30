# Cornflow-UI

Cornflow-UI is a Vue.js application that serves as the user interface for Cornflow. This is the base project, and it provides the general structure and functionalities for creating new applications.

# Creating a new project

To create a new project based on this base project, follow these steps:

## 1. Copy the base project
Copy and paste all the code from this repository into your new repository.

## 2. Configure the core values

The application can be configured in three different ways:

### 1. Environment variables (.env)
Used when `useConfigJson: false` in `src/app/config.ts`. All configuration values should be prefixed with `VITE_APP_`:

```env
# Core Configuration
VITE_APP_BACKEND_URL=https://your-backend-url
VITE_APP_SCHEMA=rostering
VITE_APP_NAME=Rostering
VITE_APP_EXTERNAL_APP=false

# Authentication Configuration
VITE_APP_AUTH_TYPE=cornflow  # Options: cornflow, azure, cognito
VITE_APP_AUTH_CLIENT_ID=your-client-id
VITE_APP_AUTH_AUTHORITY=your-authority
VITE_APP_AUTH_REDIRECT_URI=your-redirect-uri
VITE_APP_AUTH_REGION=your-region
VITE_APP_AUTH_USER_POOL_ID=your-user-pool-id
VITE_APP_AUTH_DOMAIN=your-domain
```

### 2. JSON configuration (values.json)
Used when `useConfigJson: true` in `src/app/config.ts`. Create this file based on `values.template.json`:

```json
{
    "backend_url": "https://your-backend-url",
    "schema": "rostering",
    "name": "Rostering",
    "hasExternalApp": false,
    "auth_type": "cornflow",
    "cognito": {
      "region": "your-region",
      "user_pool_id": "your-user-pool-id",
      "client_id": "your-client-id",
      "domain": "your-domain"
    },
    "azure": {
      "client_id": "your-client-id",
      "authority": "your-authority",
      "redirect_uri": "your-redirect-uri"
    }
}
```

### 3. Application configuration (src/app/config.ts)
This file contains application-specific configuration that cannot be changed through environment variables or values.json:

```typescript
{
  core: {
    // Core application components
    Experiment: ExperimentRostering,
    Instance: InstanceRostering,
    Solution: SolutionRostering,
    
    parameters: {
      // Application behavior
      useHashMode: false, // Controls whether route has /#/ in the url or not
      useConfigJson: false,  // Controls whether to use values.json or env vars
      enableSignup: false, // Enables or disables the functionality for users to sign-up from login view
      isDeveloperMode: false // Enables or disables developer mode to upload solution
      
      // Schema and branding
      schema: config.schema,  // Read from env/values.json
      name: config.name,      // Read from env/values.json
      logo: 'path/to',
      expandedLogo: 'path/to',
      
      // Project execution table configuration
      showTablesWithoutSchema: true, // Controls whether user wants to show tables that don't appear in the schema or not
      showExtraProjectExecutionColumns: {
        showUserName: false,     
        showEndCreationDate: false,
        showTimeLimit: true,
      },
      
      // Dashboard Configuration
      dashboardLayout: [...],
      dashboardPages: [...],
      dashboardRoutes: [...],
      
      // Create execution steps configuration
      executionSolvers: ['mip-gurobi'] // Fallback for showing solvers if it's not coming from backend
      solverConfig: {
        showSolverStep: false,
        defaultSolver: 'mip.gurobi',
      },
      configFieldsConfig: {
        showConfigFieldsStep: false,
        autoLoadValues: true,
      },
      configFields: [...],
      
      // Instance file processing
      fileProcessors: {
        'mtrx': 'processMatrix',
        'config': ['processConfig', 'processCleanData'],
        'all': ['processCleanData', 'processBooleansFromStrings']
      },

      // States for execution and solution
      executionStates: {
        '1': {
          color: 'green',
          message: 'Success execution',
          code: 'Success'
        }
      },
      solutionStates: {
         '1': {
          color: 'green',
          message: 'Success solution',
          code: 'Success'
        }
      }
    }
  }
}
```

### Configuration priority

1. If `useConfigJson: true` in `src/app/config.ts`:
   - The application will use `values.json` for configuration
   - Environment variables will be ignored
   - For local development, copy `public/values.template.json` to `public/values.json`
   - For production, place `values.json` in your domain root

2. If `useConfigJson: false` in `src/app/config.ts`:
   - The application will use environment variables
   - Create a `.env` file with the required variables for local development
   - Define environment variables on the server for production
   - `values.json` will be ignored

3. Application configuration in `src/app/config.ts`:
   - Always used regardless of `useConfigJson` setting
   - Cannot be overridden by environment variables or `values.json`
   - Contains application-specific logic and UI configuration

## 3. App folder configuration
Inside the app folder, there are several changes that can be done to configurate your client project. This folder is meant to be for all customizations done for the client.
   - `assets/logo`: This directory should contain the logo images for the application. The name should be the same as the default ones (logo.png and full_logo.png)
   - `assets/manual`: This directory should contain the user manual for the application. The names should be mantained, and if another language is added it should match with the name declared on i18n (Example: user_manual_fr for french)
   - `app/assets/style/variables.css`: This file should define the main colors of the application. Mantain the variable names and only change the colors.
   - `models`: This directory should define the instance, solution, experiment, and execution models for the application. It always extends the main classes but methods can be overwritten.
   - `views`: This directory should contain all the custom views needed for the application.
   - `components`: This directory should contain any additional components that are not in the core components.
   - `store/app.ts`: This file should define any additional store-specific configurations for the application.
   - `tests`: This file should contain all unit tests for additional components.
   - `plugins/locales`: This folder contains three files (`en.ts`, `es.ts`, `fr.ts`) to add any text needed in the app views and components. Be careful not to duplicate the names with the original locales files (`src/plugins/locales`).

* Additionally, favicon can be replaced by a new one in public/favicon.png

## 4. Important disclaimer
It's important not to edit any other file or folders. Only the folders, files and images just mentioned can be edited.


# More information about config parameters

### External application mode (hasExternalApp)
The `hasExternalApp` parameter controls whether the application is running as an external application or as part of the main Cornflow system. This affects how API requests are handled:

- When `hasExternalApp: true`:
  - API requests will be prefixed with `/cornflow` in the URL
  - This is useful when the application is deployed as a standalone service that needs to communicate with the main Cornflow backend
  - Example URL: `https://your-backend-url/cornflow/api/endpoint`

- When `hasExternalApp: false` (default):
  - API requests will be made directly to the backend URL
  - This is the standard mode when the application is part of the main Cornflow system
  - Example URL: `https://your-backend-url/api/endpoint`

This parameter can be set in either the environment variables or values.json:

```env
# Environment variables
VITE_APP_EXTERNAL_APP=true
```

```json
// values.json
{
  "hasExternalApp": true
}
```

### Developer mode (isDeveloperMode)
The `isDeveloperMode` parameter enables additional development and testing features in the application. When enabled, it provides special functionality for handling solutions:

- When `isDeveloperMode: true`:
  - Adds a solution upload feature in the execution creation process
  - Allows developers to test solutions by uploading them directly instead of running the solver
  - Supports uploading solutions in JSON, XLSX, or CSV formats
  - Validates uploaded solutions against the solution schema
  - Useful for testing and debugging solution formats without running actual solvers

- When `isDeveloperMode: false` (default):
  - Disables the solution upload feature
  - Only allows normal execution through solvers
  - Provides a standard user experience

This parameter is configured directly in `src/app/config.ts` and the idea is only to be used during local development:

```typescript
// src/app/config.ts
const createAppConfig = () => ({
  core: {
    parameters: {
      isDeveloperMode: true,
      // ... other parameters
    }
  }
})
```

## Dashboard
To save dashboard preferences for a single execution, including filters, checks, and date ranges, utilize the `setDashboardPreference` method from the `LoadedExecution.ts` class. Subsequently, retrieve these preferences using the `getDashboardPreference` method. The data type is custom, allowing for flexible usage as needed.


## Custom file processors
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


# Run the application in local
## Installing
- Install or update npm
- Install Nodejs
- Open your terminal
- Navigate to the project
- Run `npm install`

## Running
- Edit the `.env` file or `values.json` to add necessary configuration
- Run `npm run dev` to start a local development server
- A new tab will be opened in your browser
