/**
 * This file is used to configure the core functionalities, pages, routes, and dashboard for the application.
 *
 * The `app` object is where you define the core functionalities, pages, routes, and dashboard for your application.
 *
 * The `core` property of the `app` object is used to define the core functionalities of your application.
 * Each core functionality is a class that extends the `BaseCore` class and implements the required methods.
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
 *     AppConfig: {
 *       isPilotVersion: false,
 *       showTimeLimit: true,
 *       schema: 'default',
 *       name: 'Default',
 *       logo: 'path/to',
 *       expandedLogo: 'path/to'
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

const app = {
  core: {
    Experiment: Experiment,
    Instance: Instance,
    Solution: Solution,
    parameters: {
      isPilotVersion: false,
      showTimeLimit: true,
      schema: 'rostering',
      name: 'Rostering',
    },
  },
  dashboardPages: [],
  dashboardRoutes: [],
  dashboardLayout: [],
}

class Config {
  private config: typeof app

  constructor() {
    this.config = app
  }

  getCore() {
    return this.config.core
  }

  getDashboardPages() {
    return this.config.dashboardPages
  }

  getDashboardRoutes() {
    return this.config.dashboardRoutes
  }

  getDashboardLayout() {
    return this.config.dashboardLayout
  }
}

export default new Config()
