/**
 * This file is used to configure the core functionalities, pages, routes, and dashboard for the application.
 *
 * The `app` object is where you define the core functionalities, pages, routes, and dashboard for your application.
 *
 * The `core` property of the `app` object is used to define the core functionalities of your application.
 * Each core functionality is a class that extends the `BaseCore` class and implements the required methods.
 * Also, the core functionality can have additional properties in 'parameters' such as:
 * - `isPilotVersion`: Controls if pilot version features are enabled
 * - `showTimeLimit`: Controls if time limit is shown for executions
 * - `logStates`: Defines states and messages for execution logs
 * - `useConfigJson`: If true, gets config variables from values.json, if false from environment variables
 * - `enableSignup`: Enables or disables the sign-up functionality
 * - `showTablesWithoutSchema`: Controls if tables that are not defined in the schema should be shown. If false, only tables defined in the schema will be shown.
 * - `showExtraProjectExecutionColumns`: Controls visibility of additional columns in the project execution table
 *   - `showUserName`: Shows or hides the username column
 *   - `showEndCreationDate`: Shows or hides the end creation date column
 *   - `showTimeLimit`: Shows or hides the time limit column
 * - `solverConfig`: Controls solver selection step and default solver.
 *   - `showSolverStep`: boolean. If true, shows the solver selection step. If false, skips the step and uses `defaultSolver`.
 *   - `defaultSolver`: string. The solver to use if `showSolverStep` is false. Used in ProjectExecutionView.vue to set newExecution.config.solver.
 * - `configFieldsConfig`: Controls the config fields step and value loading.
 *   - `showConfigFieldsStep`: boolean. If true, shows the config fields step. If false, skips the step and loads values automatically.
 *   - `autoLoadValues`: boolean. If true, loads config field values from the instance (or default) when the step is skipped. Used in ProjectExecutionView.vue to call loadConfigFieldValues after instance is loaded or before steps that need config values.
 * - `configFields`: Array of configuration fields for execution parameters. Each field can have:
 *   - `key`: Unique identifier for the field
 *   - `title`: Translation key for the field title
 *   - `placeholder`: Translation key for the field placeholder
 *   - `suffix`: Translation key for the field suffix (e.g., units)
 *   - `icon`: Material Design icon name
 *   - `type`: Field type ('number' | 'float' | 'boolean' | 'text' | 'select')
 *   - `source`: Optional source for the parameter (table name in instance.data, e.g., 'eParametros')
 *   - `param`: Optional parameter name for the source (key or ID to look up in the source table/array)
 *   - `lookupType`: string (optional). How to look up the value in the source. Supported:
 *       - 'arrayByValue': Looks for an object in the array where [lookupParam] === param, returns [lookupValue].
 *       - If null or not set, searches directly as key[value] for source[param].
 *   - `lookupParam`: string (optional, for arrayByValue). The property to match in the array (e.g., 'ID').
 *   - `lookupValue`: string (optional, for arrayByValue). The property to return from the found object (e.g., 'VALOR').
 *   - `default`: Optional default value
 *   - `options`: Required for 'select' type, array of {label, value} pairs
 *   Each field type has specific validation and rendering:
 *   - `number`: Integer input with optional suffix
 *   - `float`: Decimal input with optional suffix
 *   - `boolean`: Switch component
 *   - `text`: Text input
 *   - `select`: Dropdown with predefined options
 * - `fileProcessors` (optional): Defines custom processors for files with specific prefixes before merging instances
 *   - Each key is a file prefix (e.g., 'mtrx')
 *   - Each value is the name of the processor method to use (e.g., 'processMatrix')
 *   - The actual processor methods must be implemented in the 'src/app/composables/useFileProcessors.ts' file
 *   - Each processor handles a specific part of the instance data, and all parts are merged after processing
 *   - This allows for handling files with special formats or structures before merging them into a single instance
 *   - If not provided or empty, files will be merged as-is without special processing
 *
 * The `dashboardPages` array is used to define the navigation menu items and their corresponding routes for dashboard subpages.
 * Each page is an object with `title`, `icon`, `to`, and `pos` properties.
 *
 * The `dashboardRoutes` array is used to define the dashboard subpages routes for your application and their corresponding components.
 * Each route is an object with `name`, `path`, and `component` properties.
 *
 * The `dashboardLayout` array is used to define the layout of your application's dashboard.
 * Each dashboard item is an object with `title`, `component`, `cols`, `bindings`, and `style` properties.
 *
 * The `Config` class is used to get the `core`, `pages`, `routes`, and `dashboard` from the `app` object.
 *
 * Example:
 *
 * const app = {
 *   core: {
 *     Experiment: Experiment,
 *     Instance: Instance,
 *     Solution: Solution,
 *     parameters: {
 *       isPilotVersion: false,
 *       schema: 'default',
 *       name: 'Default',
 *       useConfigJson: false,
 *       showExtraProjectExecutionColumns: {
 *         showUserName: false,
 *         showEndCreationDate: true,
 *         showTimeLimit: true,
 *       },
 *      logStates: {
 *       1: {
 *        message: 'Optimal',
 *       code: 'Optimal',
 *       },
 *      },
 *      fileProcessors: {
 *        'mtrx': 'processMatrix',
 *        'config': 'processConfig'
 *      },
 *      showExtraProjectExecutionColumns: {
 *        showUserName: false,
 *        showEndCreationDate: false,
 *        showTimeLimit: true,
 *     },
 *     solverConfig: {
 *         showSolverStep: false,
 *         defaultSolver: 'mip.gurobi',
 *     },
 *      configFieldsConfig: {
 *         showConfigFieldsStep: false,
 *         autoLoadValues: true,
 *      },
 *      configFields: [
 *        {
 *          key: 'timeLimit_3',
 *          title: 'projectExecution.steps.step6.timeLimit_3',
 *          placeholder: 'projectExecution.steps.step6.timeLimit_3Placeholder',
 *          suffix: 'projectExecution.steps.step6.minutesSuffix',
 *          icon: 'mdi-timer-sand',
 *          type: 'number',
 *        },
 *        {
 *          key: 'cornflow',
 *          title: 'projectExecution.steps.step6.cornflow',
 *          placeholder: 'projectExecution.steps.step6.cornflowPlaceholder',
 *          icon: 'mdi-cloud-check',
 *          type: 'boolean',
 *          default: true
 *        }
 *      ]
 *     },
 *   },
 *   dashboardPages: [
 *     {
 *       title: 'Page 1',
 *       icon: 'mdi-home',
 *       to: '/page1',
 *       pos: 1,
 *     },
 *   ],
 *   dashboardRoutes: [
 *     {
 *       name: 'Page1',
 *       path: 'page1',
 *       component: () => import('@/app/views/Page1'),
 *     },
 *   ],
 *   dashboardLayout: [
 *     {
 *       title: 'Dashboard Item 1',
 *       component: 'InfoCard',
 *       cols: 4,
 *       bindings: {
 *         title: 'dashboard-item-1',
 *         icon: 'mdi-information',
 *         content: 'This is dashboard item 1',
 *       },
 *       style: 'height: 150px;',
 *     },
 *   ],
 * }
 *
 * This class is accessible through the `appConfig` property of the `general` store. Here's how you can use it:
 *
 * 1. Import the `useGeneralStore` function from the `general` store file:
 *
 *    ```typescript
 *    import { useGeneralStore } from "@/store/general";
 *    ```
 *
 * 2. Call the `useGeneralStore` function to get the `general` store instance:
 *
 *    ```typescript
 *    const generalStore = useGeneralStore();
 *    ```
 *
 * 3. Use the `appConfig` property of the `general` store to access the `Config` class:
 *
 *    ```typescript
 *    const core = generalStore.appConfig.getCore();
 *    const dashboardPages = generalStore.appConfig.getDashboardPages();
 *    const dashboardRoutes = generalStore.appConfig.getDashboardRoutes();
 *    const dashboardLayout = generalStore.appConfig.getDashboardLayout();
 *    ```
 *
 * Notice that dashboard pages and routes are already implemented in the needed files to be used in the application, and that you should NOT need to implement them again.
 * Dashboard layout components are also already implemented in the `@/app/components/DashboardMain.vue` file, although this file can be edited as pleased to display custom dashboards.
 */

import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'
import i18n from '@/plugins/i18n'
import config from '@/config'

// Create a function to get the app configuration
const createAppConfig = () => ({
  core: {
    Experiment: Experiment,
    Instance: Instance,
    Solution: Solution,
    parameters: {
      isPilotVersion: false,
      showTimeLimit: true,
      enableSignup: false,
      useConfigJson: false,
      useHashMode: true,
      schema: config.schema,
      name: config.name,
      showTablesWithoutSchema: false,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: false,
        showTimeLimit: true,
      },
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'mip.gurobi',
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: false,
      },
      configFields: [
        {
          key: 'timeLimit',
          title: 'projectExecution.steps.step6.time',
          placeholder: 'projectExecution.steps.step6.timeLimitPlaceholder',
          suffix: 'projectExecution.steps.step6.secondsSuffix',
          icon: 'mdi-timer-sand',
          type: 'number',
        },
      ],
      fileProcessors: {
        // Define filename prefixes that need special processing and their corresponding processor methods
      },
      logStates: {
        1: {
          code: i18n.global.t('executionTable.optimal'),
          message: i18n.global.t('executionTable.optimalTooltip'),
        },
        5: {
          code: i18n.global.t('executionTable.timeLimit'),
          message: i18n.global.t('executionTable.timeLimitTooltip'),
        },
        '-1': {
          code: i18n.global.t('executionTable.infeasible'),
          message: i18n.global.t('executionTable.infeasibleTooltip'),
        },
        '-3': {
          code: i18n.global.t('executionTable.unknown'),
          message: i18n.global.t('executionTable.unknownTooltip'),
        },
        0: {
          code: i18n.global.t('executionTable.notSolved'),
          message: i18n.global.t('executionTable.notSolvedTooltip'),
        },
        '-2': {
          code: i18n.global.t('executionTable.unbounded'),
          message: i18n.global.t('executionTable.unboundedTooltip'),
        },
        2: {
          code: i18n.global.t('executionTable.feasible'),
          message: i18n.global.t('executionTable.feasibleTooltip'),
        },
        3: {
          code: i18n.global.t('executionTable.memoryLimit'),
          message: i18n.global.t('executionTable.memoryLimitTooltip'),
        },
        4: {
          code: i18n.global.t('executionTable.nodeLimit'),
          message: i18n.global.t('executionTable.nodeLimitTooltip'),
        },
        '-5': {
          code: i18n.global.t('executionTable.licensingProblem'),
          message: i18n.global.t('executionTable.licensingProblemTooltip'),
        },
      },
    },
  },
  dashboardPages: [],
  dashboardRoutes: [],
  dashboardLayout: [],
})

class Config {
  private config: ReturnType<typeof createAppConfig> | null = null

  constructor() {
    // Don't initialize in constructor
  }

  // Initialize or update config
  updateConfig() {
    this.config = createAppConfig()
  }

  private ensureConfig() {
    if (!this.config) {
      this.config = createAppConfig()
    }
    return this.config
  }

  getCore() {
    return this.ensureConfig().core
  }

  getDashboardPages() {
    return this.ensureConfig().dashboardPages
  }

  getDashboardRoutes() {
    return this.ensureConfig().dashboardRoutes
  }

  getDashboardLayout() {
    return this.ensureConfig().dashboardLayout
  }
}

const appConfig = new Config()
export default appConfig
