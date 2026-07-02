// Composables
import {
  createRouter,
  RouteRecordRaw,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import IndexView from '@cornflow-ui/core/views/IndexView.vue'
import LoginView from '@cornflow-ui/core/views/LoginView.vue'
import ProjectExecutionView from '@cornflow-ui/core/views/ProjectExecutionView.vue'
import HistoryExecutionView from '@cornflow-ui/core/views/HistoryExecutionView.vue'
import DashboardView from '@cornflow-ui/core/views/DashboardView.vue'
import UserSettingsView from '@cornflow-ui/core/views/UserSettingsView.vue'
import SectionView from '@cornflow-ui/core/views/SectionView.vue'
import ConfigurationSectionSubsectionView from '@cornflow-ui/core/views/ConfigurationSectionSubsectionView.vue'
import RolesManagementView from '@cornflow-ui/core/views/RolesManagementView.vue'
import NotFoundView from '@cornflow-ui/core/views/NotFoundView.vue'
import getAuthService from '@cornflow-ui/core/services/AuthServiceFactory'
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { isViewAllowed, getRoleDefaultView } from '@/app/rolesConfig'

const dashboardRoutes = appConfig.getDashboardRoutes() || []
const instanceDashboardRoutes = appConfig.getInstanceDashboardRoutes() || []
const appSectionRoutes = appConfig.getAppSectionRoutes() || []

let authService = null

// Initialize auth service
const initAuthService = async () => {
  if (!authService) {
    authService = await getAuthService()
  }
  return authService
}

// Helper function to check if a route needs configurations
const isConfigurationRoute = (path: string): boolean => {
  return (
    path.startsWith('/configuration') ||
    path.startsWith('/input-data') ||
    path.startsWith('/results')
  )
}

// Helper function to ensure configurations are loaded
const ensureConfigurationsLoaded = async () => {
  const generalStore = useGeneralStore()

  // Check if configurations are already loaded
  if (generalStore.getConfigurations) {
    return true
  }

  // If not loaded, initialize the required store data
  try {
    // Load schema first (required by configurations)
    if (!generalStore.getSchemaConfig?.name) {
      await generalStore.setSchema()
    }

    // Then load configurations
    await generalStore.setConfigurations()
    return true
  } catch (error) {
    console.error('Failed to load configurations:', error)
    return false
  }
}

// Helper function to get the default view from app config
const getDefaultView = (): string => {
  try {
    return appConfig.getCore()?.parameters?.defaultView || 'history-execution'
  } catch {
    return 'history-execution'
  }
}

// Returns the first view the user's role is allowed to access, falling back to user-settings.
// Agent view id is only considered when the Agent feature is enabled; otherwise the route guard
// would redirect away and default-view resolution could loop.
const getFirstAllowedView = (roleNames: string[]): string => {
  const candidates = [
    'history-execution',
    'project-execution',
    'configuration',
    'input-data',
    'results',
  ]
  candidates.push('user-settings')
  for (const view of candidates) {
    if (isViewAllowed(roleNames, view)) return view
  }
  return 'user-settings'
}

// Extracts the top-level path segment used as viewId in rolesConfig (e.g. '/history-execution' → 'history-execution').
const routeViewId = (path: string): string => path.replace(/^\//, '').split('/')[0]

// Returns the user's role names. If the store has them, use it directly. Otherwise fall back to sessionStorage.
// If neither is available yet (right after login), waits until initializeData completes.
const getRoleNames = async (): Promise<string[]> => {
  const store = useGeneralStore()

  // Store already has roles — best source
  const storeRoles = store.getUser?.roles?.map((r: { name: string }) => r.name) ?? []
  if (storeRoles.length > 0) return storeRoles

  // sessionStorage populated by fetchUser — available even before the store reactive state propagates
  try {
    const stored = sessionStorage.getItem('userRoles')
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }

  // Neither available yet — wait for initializeData to finish (covers fresh login timing gap)
  if (store.initialDataLoading) {
    await new Promise<void>((resolve) => {
      const stop = store.$subscribe(() => {
        if (!store.initialDataLoading) {
          stop()
          resolve()
        }
      })
    })
    return store.getUser?.roles?.map((r: { name: string }) => r.name) ?? []
  }

  return []
}

// Resolve default view respecting role restrictions:
// 1. Use the app-configured default if the role allows it
// 2. Otherwise use the role's own defaultView (from rolesConfig) if defined and allowed
// 3. Fall back to the first allowed view from the priority list
const resolveDefaultView = (roleNames: string[]): string => {
  const configuredDefault = getDefaultView()
  if (isViewAllowed(roleNames, configuredDefault)) return `/${configuredDefault}`
  const roleDefault = getRoleDefaultView(roleNames)
  if (roleDefault && isViewAllowed(roleNames, roleDefault)) return `/${roleDefault}`
  return `/${getFirstAllowedView(roleNames)}`
}

// Returns true if the role forbids the target view (forbidden/not-found case).
const isViewForbidden = (to: { path: string }, isAuthenticated: boolean, roleNames: string[]): boolean => {
  if (!isAuthenticated || roleNames.length === 0 || to.path === '/not-found') return false
  const viewId = routeViewId(to.path)
  return Boolean(viewId) && !isViewAllowed(roleNames, viewId)
}

// Factory for the repeated keep-alive child route shape (path + name + component + keepAlive,
// with an optional meta). Keeps the route table DRY while producing identical records.
const keepAliveRoute = (
  path: string,
  name: string,
  component: RouteRecordRaw['component'],
  meta?: RouteRecordRaw['meta'],
): RouteRecordRaw =>
  ({
    path,
    name,
    component,
    keepAlive: true,
    ...(meta ? { meta } : {}),
  }) as RouteRecordRaw

const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    component: LoginView,
  },
  {
    path: '/',
    name: 'Home',
    component: IndexView,
    beforeEnter: async (to, from, next) => {
      try {
        const auth = await initAuthService()
        if (!auth.isAuthenticated() && to.name !== 'Sign In') {
          next('/sign-in')
        } else {
          next()
        }
      } catch (error) {
        console.error('Route guard error:', error)
        next('/sign-in')
      }
    },
    children: [
      keepAliveRoute('user-settings', 'User settings', UserSettingsView),
      keepAliveRoute('roles-management', 'Roles management', RolesManagementView, {
        requiresAdmin: true,
      }),
      keepAliveRoute('project-execution', 'Project execution', ProjectExecutionView),
      keepAliveRoute('history-execution', 'Executions history', HistoryExecutionView),
      keepAliveRoute('dashboard', 'Dashboard', DashboardView),
      ...appSectionRoutes,
      keepAliveRoute(
        'configuration/section/:sectionId/:subsectionKey',
        'Configuration section subsection',
        ConfigurationSectionSubsectionView,
      ),
      keepAliveRoute('configuration/:tableKey', 'Master Data', SectionView),
      keepAliveRoute('configuration/group/:groupName/:tableKey?', 'Master Data Group', SectionView),
      keepAliveRoute('input-data/:tableKey', 'Input Data Table', SectionView),
      keepAliveRoute('input-data/group/:groupName/:tableKey?', 'Input Data Group', SectionView),
      keepAliveRoute('results/:tableKey', 'Results Table', SectionView),
      keepAliveRoute('results/group/:groupName/:tableKey?', 'Results Group', SectionView),
      ...dashboardRoutes,
      ...instanceDashboardRoutes,
      // Premium routes (enterprise) are injected after module registration via
      // `applyPremiumRoutes` (router.addRoute), not here at build time.
      {
        path: 'not-found',
        name: 'Not Found',
        component: NotFoundView,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/not-found',
  },
]

const router = createRouter({
  history: config.useHashMode ? createWebHashHistory() : createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  try {
    const auth = await initAuthService()
    const isAuthenticated = auth.isAuthenticated()
    const isSignInPage = to.path === '/sign-in'
    const isTargetingAuthRequiredPage = to.path !== '/sign-in'

    // If not authenticated and going to a protected page
    if (!isAuthenticated && isTargetingAuthRequiredPage) {
      next('/sign-in')
      return
    }

    // Resolve current user's role names — waits for initializeData if roles aren't available yet.
    const roleNames = await getRoleNames()

    const defaultView = resolveDefaultView(roleNames)

    // Redirect to default view when:
    // - authenticated and going to the login page
    // - authenticated and going to the root
    // - target requires admin and the user is not admin
    // - target requires admin but the feature is disabled
    const requiresAdmin = Boolean(to.meta?.requiresAdmin)
    const redirectToDefault =
      (isAuthenticated && isSignInPage) ||
      (isAuthenticated && to.path === '/') ||
      (requiresAdmin && sessionStorage.getItem('isAdmin') !== 'true') ||
      (requiresAdmin && !appConfig.getCore().parameters.enableRolesManagement)
    if (redirectToDefault) {
      next(defaultView)
      return
    }

    // If the role forbids this view, show the forbidden/not-found page
    if (isViewForbidden(to, isAuthenticated, roleNames)) {
      next({ path: '/not-found', query: { reason: 'forbidden' } })
      return
    }

    // If authenticated and going to a configuration route, ensure configurations are loaded
    if (isAuthenticated && isConfigurationRoute(to.path)) {
      const configurationsLoaded = await ensureConfigurationsLoaded()
      if (!configurationsLoaded) {
        console.error('Failed to load configurations for route:', to.path)
        // Optionally redirect to a safe page if configurations fail to load
        // next('/history-execution')
        // return
      }
    }

    // In any other case, allow navigation
    next()
  } catch (error) {
    console.error('Router guard error:', error)
    next('/sign-in')
  }
})

export default router
