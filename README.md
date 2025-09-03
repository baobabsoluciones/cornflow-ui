# Cornflow-UI

Cornflow-UI is a Vue.js application that serves as the user interface for Cornflow. This is the base project, and it provides the general structure and functionalities for creating new applications.

# Creating a new project

To create a new project based on this base project, follow these steps:

## 1. Copy the base project
Copy and paste all the code from this repository into your new repository.

## 2. Configuration guide

### Quick start
1. **Choose your setup method**: Environment variables (recommended for production) or JSON file (good for development)
2. **Set core values**: Backend URL, schema name, and authentication type
3. **Customize app settings**: Modify `src/app/config.ts` for UI preferences and features
4. **Test your setup**: Run `npm run dev` to verify configuration

### Configuration types (core concept)

The application uses a **two-layer configuration system** with clear separation of concerns:

#### External configuration (`src/config.ts`)
- **Purpose**: Values that must be configured externally without changing code
- **Source**: Environment variables or `values.json` (automatically detected)
- **Use for**: Backend URLs, authentication credentials, deployment settings
- **Contains**: Core application values, authentication settings, behavior flags

#### Internal configuration (`src/app/config.ts`)
- **Purpose**: Application-specific settings that are part of the codebase
- **Source**: Always defined in source code
- **Use for**: UI preferences, feature flags, dashboard layout, custom logic
- **Contains**: Component settings, execution steps, file processors, styling options

**Key principle**: External config is "what must be changed without touching code", internal config is "what is part of the application logic".

### Setup methods

#### Method 1: Environment variables (recommended)
Create a `.env` file (for local development only) or set environment variables on your server. The application automatically uses this method when `VITE_APP_SCHEMA` or `VITE_APP_BACKEND_URL` are detected.

```env
# Core configuration
VITE_APP_BACKEND_URL=https://your-backend-url
VITE_APP_SCHEMA=rostering
VITE_APP_NAME=Rostering

# Application behavior
VITE_APP_EXTERNAL_APP=true                 # true/false (also accepts 1/0)
VITE_APP_IS_STAGING_ENVIRONMENT=false      # true/false (also accepts 1/0)
VITE_APP_USE_HASH_MODE=false               # true/false (also accepts 1/0)
VITE_APP_DEFAULT_LANGUAGE=en               # en, es, fr
VITE_APP_IS_DEVELOPER_MODE=false           # true/false (also accepts 1/0)
VITE_APP_ENABLE_SIGNUP=false               # true/false (also accepts 1/0)

# Authentication configuration
VITE_APP_AUTH_TYPE=cornflow                # Options: cornflow, azure, cognito
VITE_APP_AUTH_CLIENT_ID=your-client-id
VITE_APP_AUTH_AUTHORITY=your-authority
VITE_APP_AUTH_REDIRECT_URI=your-redirect-uri
VITE_APP_AUTH_REGION=your-region
VITE_APP_AUTH_USER_POOL_ID=your-user-pool-id
VITE_APP_AUTH_DOMAIN=your-domain
VITE_APP_AUTH_PROVIDERS=google,microsoft   # For Cognito: comma-separated list
```

#### Method 2: JSON configuration
Copy `public/values.template.json` to `public/values.json` and configure your values (for local development only). For production, configure this json in an accesible path. Defined path by default is `/values.json` but this can be overwritten in `app/config.ts` with `valuesJsonPath`. Used automatically when no environment variables are detected.

```json
{
    "backend_url": "https://your-backend-url",
    "schema": "rostering",
    "name": "Rostering",
    "hasExternalApp": false,
    "isStagingEnvironment": false,
    "useHashMode": false,
    "defaultLanguage": "en",
    "isDeveloperMode": false,
    "enableSignup": false,
    "auth_type": "cornflow",
    "cognito": {
      "region": "your-region",
      "user_pool_id": "your-user-pool-id",
      "client_id": "your-client-id",
      "domain": "your-domain",
      "providers": ["google", "microsoft"]
    },
    "azure": {
      "client_id": "your-client-id",
      "authority": "your-authority",
      "redirect_uri": "your-redirect-uri"
    }
}
```

#### Auto-detection logic
The application automatically chooses the configuration method:
1. **Environment variables detected** → Uses environment variables, ignores `values.json`
2. **No environment variables** → Loads from `values.json` or defined path

**For production**: Recomended environment variables for security and flexibility, but accepts json
**For development**: Hardcode values in your .env or values.json file. This can't be uploaded

### Configuration access in code
```typescript
// External configuration (from env/json)
import config from '@/config'
config.schema          // ✅ Schema name
config.backend         // ✅ Backend URL
config.isDeveloperMode // ✅ Developer mode flag
config.auth.type       // ✅ Authentication type

// Internal configuration (from source code)
import internalConfig from '@/app/config'
internalConfig.getCore().parameters.showUserFullname  // ✅ UI preferences
internalConfig.getCore().parameters.solverConfig     // ✅ App logic
```

### Internal app configuration (`src/app/config.ts`)
This file contains **internal application-specific configuration** that is part of the codebase and not configurable externally:

```typescript
{
  core: {
    // Core application components
    Experiment: ExperimentRostering,
    Instance: InstanceRostering,
    Solution: SolutionRostering,
    
    parameters: {
      // Json path
      valuesJsonPath: '/values.json',
      
      // Project execution table configuration
      showUserFullname: true,
      showTablesWithoutSchema: true,
      showExtraProjectExecutionColumns: {
        showUserName: false,     
        showEndCreationDate: false,
        showTimeLimit: true,
        showUserFullName: false,
      },
      
      // Dashboard configuration
      showDashboardMainView: false,
      dashboardLayout: [...],
      dashboardPages: [...],
      dashboardRoutes: [...],
      
      // Create execution steps configuration
      executionSolvers: ['mip-gurobi'],
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
        '1': { color: 'green', message: 'Success execution', code: 'Success' }
      },
      solutionStates: {
         '1': { color: 'green', message: 'Success solution', code: 'Success' }
      },
    }
  }
}
```

## 2.2. App folder configuration
Inside the app folder, there are several changes that can be done to configurate your client project. This folder is meant to be for all customizations done for the client.
   - `assets/logo`: This directory should contain the logo images for the application. The name should be the same as the default ones (logo.png and full_logo.png)
   - `app/assets/style/variables.css`: This file should define the main colors of the application. Mantain the variable names and only change the colors.
   - `models`: This directory should define the instance, solution, experiment, and execution models for the application. It always extends the main classes but methods can be overwritten.
   - `views`: This directory should contain all the custom views needed for the application.
   - `components`: This directory should contain any additional components that are not in the core components.
   - `store/app.ts`: This file should define any additional store-specific configurations for the application.
   - `plugins/locales`: This folder contains three files (`en.ts`, `es.ts`, `fr.ts`) to add any text needed in the app views and components. Be careful not to duplicate the names with the original locales files (`src/plugins/locales`).

* Additionally, favicon can be replaced by a new one in public/favicon.png

5. **User manuals**: Place your user manual PDF files in the `public/manual` directory with the following naming convention:
   - `user_manual_en.pdf` for English
   - `user_manual_es.pdf` for Spanish
   - `user_manual_fr.pdf` for French

## 3. Important disclaimer
It's important not to edit any other file or folders. Only the folders, files and images just mentioned can be edited.


## Configuration reference

### Core parameters

| Parameter | Description | Environment Variable | JSON Key | Values |
|-----------|-------------|---------------------|----------|---------|
| **Backend URL** | API server endpoint | `VITE_APP_BACKEND_URL` | `backend_url` | URL string |
| **Schema** | Application schema name | `VITE_APP_SCHEMA` | `schema` | String identifier |
| **App Name** | Application display name | `VITE_APP_NAME` | `name` | String |
| **Hash Mode** | Router mode (hash vs history) | `VITE_APP_USE_HASH_MODE` | `useHashMode` | `true`/`false` (accepts `1`/`0`) |
| **Default Language** | UI language | `VITE_APP_DEFAULT_LANGUAGE` | `defaultLanguage` | `en`, `es`, `fr` |
| **Developer Mode** | Enable dev features | `VITE_APP_IS_DEVELOPER_MODE` | `isDeveloperMode` | `true`/`false` (accepts `1`/`0`) |
| **Enable Signup** | Show registration option | `VITE_APP_ENABLE_SIGNUP` | `enableSignup` | `true`/`false` (accepts `1`/`0`) |
| **External App** | API URL prefix mode | `VITE_APP_EXTERNAL_APP` | `hasExternalApp` | `true`/`false` (accepts `1`/`0`) |
| **Staging Environment** | Show staging banner | `VITE_APP_IS_STAGING_ENVIRONMENT` | `isStagingEnvironment` | `true`/`false` (accepts `1`/`0`) |

### Authentication parameters

| Parameter | Description | Environment Variable | JSON Key | Values |
|-----------|-------------|---------------------|----------|---------|
| **Auth Type** | Authentication method | `VITE_APP_AUTH_TYPE` | `auth_type` | `cornflow`, `azure`, `cognito` |
| **Client ID** | OAuth client identifier | `VITE_APP_AUTH_CLIENT_ID` | `client_id` | String |
| **Authority** | Azure authority URL | `VITE_APP_AUTH_AUTHORITY` | `authority` | URL string |
| **Redirect URI** | OAuth redirect URL | `VITE_APP_AUTH_REDIRECT_URI` | `redirect_uri` | URL string |
| **Region** | AWS Cognito region | `VITE_APP_AUTH_REGION` | `region` | AWS region code |
| **User Pool ID** | Cognito user pool | `VITE_APP_AUTH_USER_POOL_ID` | `user_pool_id` | Pool identifier |
| **Domain** | Cognito domain | `VITE_APP_AUTH_DOMAIN` | `domain` | Domain string |
| **OAuth Providers** | Enabled OAuth providers | `VITE_APP_AUTH_PROVIDERS` | `providers` | Comma-separated / Array |

### Parameter details

#### Boolean values
All boolean parameters accept multiple formats for flexibility:
- **Recommended**: `true` or `false` (case-insensitive)
- **Legacy support**: `1` (true) or `0` (false)
- **Environment variables**: String values like `"true"`, `"false"`, `"1"`, `"0"`
- **JSON files**: Boolean values `true`/`false` or numbers `1`/`0`

The application automatically converts these formats to proper boolean values.

#### useHashMode
- **Purpose**: Controls routing mode
- **`true`**: Hash mode routing (URLs include `#`)
- **`false`**: HTML5 history mode (clean URLs)
- **Note**: Use hash mode if you can't configure server routing

#### isDeveloperMode  
- **Purpose**: Enables developer features
- **`true`**: Shows solution upload in execution creation
- **`false`**: Standard user experience

#### hasExternalApp
- **Purpose**: Controls API request URLs
- **`true`**: Prefixes requests with `/cornflow`
- **`false`**: Direct API requests

#### OAuth providers (Cognito only)
- **Supported**: `google`, `microsoft`, `facebook`
- **Format**: Comma-separated string or array
- **Behavior**: Only configured providers will work; others show error messages

## Advanced features

### Authentication

The application supports three authentication methods. The server must be properly configured for the chosen method.

#### Cornflow authentication (default)
```env
VITE_APP_AUTH_TYPE=cornflow
```

#### Azure OpenID authentication
```env
VITE_APP_AUTH_TYPE=azure
VITE_APP_AUTH_CLIENT_ID=your_azure_client_id
VITE_APP_AUTH_AUTHORITY=your_azure_authority
VITE_APP_AUTH_REDIRECT_URI=your-redirect-uri
```

#### AWS Cognito authentication
```env
VITE_APP_AUTH_TYPE=cognito
VITE_APP_AUTH_CLIENT_ID=your_cognito_client_id
VITE_APP_AUTH_REGION=your_cognito_region
VITE_APP_AUTH_USER_POOL_ID=your_cognito_user_pool_id
VITE_APP_AUTH_DOMAIN=your_cognito_domain
VITE_APP_AUTH_PROVIDERS=google,microsoft
```

### Dashboard preferences
To save dashboard preferences for a single execution, including filters, checks, and date ranges, utilize the `setDashboardPreference` method from the `LoadedExecution.ts` class. Subsequently, retrieve these preferences using the `getDashboardPreference` method. The data type is custom, allowing for flexible usage as needed.


### Custom file processors
The application supports custom file processing for instances based on filename prefixes. This feature is useful when you need to handle files with special formats or structures before merging them with other files to create an instance.

#### Configuration
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

#### Implementation
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

### Create project execution steps customization
#### Solver step: solverConfig
Controls the solver selection step and default solver for executions.
- `showSolverStep` (boolean):
  - If true, shows the solver selection step to the user.
  - If false, skips the step and uses the value in `defaultSolver` automatically.
- `defaultSolver` (string):
  - The solver to use if `showSolverStep` is false.
  - Used in the execution config as `newExecution.config.solver`.

#### Configuration parameters step: configFieldsConfig
Controls the config fields step and value loading for execution parameters.
- `showConfigFieldsStep` (boolean):
  - If true, shows the config fields step to the user.
  - If false, skips the step and loads values automatically from the instance or defaults.
- `autoLoadValues` (boolean):
  - If true, loads config field values from the instance (or default) when the step is skipped.
  - Used in ProjectExecutionView.vue to call value loading after the instance is loaded or before steps that need config values.

#### Configuration parameters step: configFields
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

#### Implementation in ProjectExecutionView.vue:
- `solverConfig` is used to determine if the solver step is shown and to set the default solver.
- `configFieldsConfig` is used to determine if the config fields step is shown and to auto-load values.
- `configFields` is used to render the config fields step, auto-load values from the instance, and display the config summary in the confirmation step.

## Router configuration
The application supports two routing modes controlled by the `useHashMode` configuration parameter:

### HTML5 history mode (default)
This is the default routing mode that creates clean URLs without the hash (#). It requires proper server configuration to handle the URLs correctly.

### Hash mode
If you're deploying in an environment where you don't have control over the server configuration or are experiencing issues with route handling, you can enable hash mode:

**Environment variable**: `VITE_APP_USE_HASH_MODE=1`
**JSON**: `"useHashMode": true`

When hash mode is enabled, all routes will include a hash (#) in the URL (e.g., `http://example.com/#/project-execution` instead of `http://example.com/project-execution`).

## Internationalization configuration
The application supports multiple languages (English, Spanish, and French). You can configure the default language:

**Environment variable**: `VITE_APP_DEFAULT_LANGUAGE=es`
**JSON**: `"defaultLanguage": "es"`

Available language codes:
- `'en'` - English
- `'es'` - Spanish
- `'fr'` - French

## Values.json path configuration
When using JSON configuration (when no environment variables are detected), you can customize the path where the application looks for the `values.json` file:

**Environment variable**: `VITE_APP_VALUES_JSON_PATH=/config/values.json`

The default value is `/values.json`. The application will:
- For localhost: Use the path as-is (e.g., `/config/values.json`)
- For production: Prepend the hostname (e.g., `https://example.com/config/values.json`)

This is useful when you need to place the configuration file in a different location than the root of your domain.


# Unit testing

The application includes a comprehensive unit testing setup using Vitest and Vue Test Utils. Tests are organized in a specific structure to separate core functionality from application-specific tests.

## Test structure

Unit tests are located in the `tests/unit/` directory, which is organized as follows:

```
tests/unit/
├── core/           # Core tests (DO NOT MODIFY)
│   ├── components/ # Tests for core Vue components
│   ├── services/   # Tests for core services
│   ├── stores/     # Tests for Pinia stores
│   ├── repositories/ # Tests for data repositories
│   ├── views/      # Tests for core views
│   ├── setup.ts    # Test setup configuration
│   └── vuetify-setup.ts # Vuetify test configuration
└── app/            # Application-specific tests
    └── (your custom tests go here)
```

### Core tests (`tests/unit/core/`)
- **DO NOT MODIFY** these tests as they are part of the core framework
- Contains tests for all core functionality including:
  - Components (authentication, navigation, etc.)
  - Services (auth services, API clients, etc.)
  - Stores (Pinia state management)
  - Repositories (data access layer)
  - Views (core application views)

### App tests (`tests/unit/app/`)
- This is where you should add **your application-specific tests**
- Tests for custom components, services, and functionality specific to your client application
- Follow the same structure as core tests for consistency

## Running tests

The following npm scripts are available for testing:

```bash
# Run all tests
npm run test

# Run tests with coverage report
npm run test:coverage

# Run tests with UI interface
npm run test:ui

# Run tests in watch mode (development)
npm run test -- --watch
```

## Coverage reports

The test coverage is configured with the following thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Coverage reports are generated in multiple formats:
- **Text**: Console output
- **JSON**: Machine-readable format
- **HTML**: Visual report in `coverage/` directory

## Writing tests

When writing new tests for your application:

1. **Place tests in the correct location**:
   - Core functionality tests: `tests/unit/core/` (DO NOT MODIFY)
   - Your app tests: `tests/unit/app/`

2. **Follow naming conventions**:
   - Test files should end with `.spec.ts`
   - Use descriptive test names
   - Group related tests using `describe` blocks

3. **Use the provided setup**:
   - Tests automatically use the core setup files
   - Vuetify components are pre-configured
   - Common mocks and utilities are available

4. **Example test structure**:
```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import YourComponent from '@/app/components/YourComponent.vue'
import vuetify from '../../core/vuetify-setup'

describe('YourComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders correctly', () => {
    const wrapper = mount(YourComponent, {
      global: {
        plugins: [vuetify]
      }
    })
    
    expect(wrapper.exists()).toBe(true)
  })
})
```

## Testing best practices

- **Isolation**: Each test should be independent and not rely on other tests
- **Mocking**: Mock external dependencies and API calls
- **Coverage**: Aim for high test coverage, especially for critical functionality
- **Clarity**: Write clear, descriptive test names and assertions
- **Maintenance**: Keep tests up to date with code changes

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
