// Composables
import {
  createRouter,
  RouteRecordRaw,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import IndexView from '@/views/IndexView.vue'
import LoginView from '@/views/LoginView.vue'
import ProjectExecutionView from '@/views/ProjectExecutionView.vue'
import HistoryExecutionView from '@/views/HistoryExecutionView.vue'
import DashboardView from '@/views/DashboardView.vue'
import UserSettingsView from '@/views/UserSettingsView.vue'
import SectionView from '@/views/SectionView.vue'
import getAuthService from '@/services/AuthServiceFactory'
import config from '@/config'
import appConfig from '@/app/config'
import { useGeneralStore } from '@/stores/general'

const dashboardRoutes = appConfig.getDashboardRoutes() || []
const instanceDashboardRoutes = appConfig.getInstanceDashboardRoutes() || []

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
    if (!generalStore.getSchemaConfig || !generalStore.getSchemaConfig.name) {
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

const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    component: LoginView,
  },
  {
    path: '/',
    redirect: '/history-execution',
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
      {
        path: 'user-settings',
        name: 'User settings',
        component: UserSettingsView,
        keepAlive: true,
      },
      {
        path: 'project-execution',
        name: 'Project execution',
        component: ProjectExecutionView,
        keepAlive: true,
      },
      {
        path: 'history-execution',
        name: 'Executions history',
        component: HistoryExecutionView,
        keepAlive: true,
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: DashboardView,
        keepAlive: true,
      },
      {
        path: 'configuration/:tableKey',
        name: 'Master Data',
        component: SectionView,
        keepAlive: true,
      },
      {
        path: 'configuration/group/:groupName/:tableKey?',
        name: 'Master Data Group',
        component: SectionView,
        keepAlive: true,
      },
      {
        path: 'input-data/:tableKey',
        name: 'Input Data Table',
        component: SectionView,
        keepAlive: true,
      },
      {
        path: 'input-data/group/:groupName/:tableKey?',
        name: 'Input Data Group',
        component: SectionView,
        keepAlive: true,
      },
      {
        path: 'results/:tableKey',
        name: 'Results Table',
        component: SectionView,
        keepAlive: true,
      },
      {
        path: 'results/group/:groupName/:tableKey?',
        name: 'Results Group',
        component: SectionView,
        keepAlive: true,
      },
      ...dashboardRoutes,
      ...instanceDashboardRoutes,
    ],
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

    // If authenticated and going to the login page, redirect to history-execution
    if (isAuthenticated && isSignInPage) {
      next('/history-execution')
      return
    }

    // If authenticated and going to the root, redirect to history-execution
    if (isAuthenticated && to.path === '/') {
      next('/history-execution')
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
