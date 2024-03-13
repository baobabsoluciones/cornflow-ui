/**
 * This file is used to configure the core functionalities, pages, routes, and dashboard for the application.
 * 
 * The `app` object is where you define the core functionalities, pages, routes, and dashboard for your application.
 * 
 * The `core` property of the `app` object is used to define the core functionalities of your application.
 * Each core functionality is a class that extends the `BaseCore` class and implements the required methods.
 * 
 * The `pages` array is used to define the navigation menu items and their corresponding routes.
 * Each page is an object with `title`, `icon`, `to`, and `pos` properties.
 * 
 * The `routes` array is used to define the routes for your application and their corresponding components.
 * Each route is an object with `name`, `path`, and `component` properties.
 * 
 * The `dashboard` array is used to define the layout of your application's dashboard.
 * Each dashboard item is an object with `title`, `component`, `cols`, `bindings`, and `style` properties.
 * 
 * The `Config` class is used to get the `core`, `pages`, `routes`, and `dashboard` from the `app` object.
 * 
 * Example:
 * 
 * const app = {
 *   core: {
 *     Experiment: ExperimentCore,
 *     Instance: InstanceCore,
 *     Solution: SolutionCore,
 *     AppConfig: {
 *       isPilotVersion: false,
 *       showTimeLimit: true,
 *       schema: 'default',
 *       name: 'Default',
 *       logo: 'path/to',
 *       expandedLogo: 'path/to'
 *     },
 *   },
 *   pages: [
 *     {
 *       title: 'Page 1',
 *       icon: 'mdi-home',
 *       to: '/page1',
 *       pos: 1,
 *     },
 *   ],
 *   routes: [
 *     {
 *       name: 'Page1',
 *       path: 'page1',
 *       component: () => import('@/app/views/Page1'),
 *     },
 *   ],
 *   dashboard: [
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
 *    const pages = generalStore.appConfig.getPages();
 *    const routes = generalStore.appConfig.getRoutes();
 *    const dashboard = generalStore.appConfig.getDashboard();
 *    ```
 */

// import { ExperimentCore } from '@/models/Experiment.ts'
import { Instance } from '@/models/Instance.ts'
import { Solution } from '@/models/Solution.ts'

const app = {
  core: {
    Experiment: '',
    Instance: Instance,
    Solution: Solution,
    parameters: {
      isPilotVersion: false,
      showTimeLimit: true,
      schema: 'rostering',
      name: 'Rostering',
    },
  },
  pages: [],
  routes: [],
  dashboard: [],
}

class Config {
  private config: typeof app;

  constructor() {
    this.config = app;
  }

  getCore() {
    return this.config.core;
  }

  getPages() {
    return this.config.pages;
  }

  getRoutes() {
    return this.config.routes;
  }

  getDashboard() {
    return this.config.dashboard;
  }
}

export default new Config();


