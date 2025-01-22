// Composables
import { createRouter, RouteRecordRaw, createWebHistory } from 'vue-router'
import IndexView from '@/views/IndexView.vue'
import LoginView from '@/views/LoginView.vue'
import ProjectExecutionView from '@/views/ProjectExecutionView.vue'
import HistoryExecutionView from '@/views/HistoryExecutionView.vue'
import DashboardView from '@/views/DashboardView.vue'
import InputDataView from '@/views/InputDataView.vue'
import OutputDataView from '@/views/OutputDataView.vue'
import UserSettingsView from '@/views/UserSettingsView.vue'
import getAuthService from '@/services/AuthServiceFactory'
import config from '@/config'

const dashboardRoutes = config.dashboardRoutes || []

let authService = null

// Initialize auth service
const initAuthService = async () => {
  if (!authService) {
    authService = await getAuthService()
  }
  return authService
}

const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    component: LoginView,
  },
  {
    path: '/',
    redirect: '/project-execution',
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
      },
      {
        path: 'project-execution',
        name: 'Project execution',
        component: ProjectExecutionView,
      },
      {
        path: 'history-execution',
        name: 'Executions history',
        component: HistoryExecutionView,
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: DashboardView,
      },
      {
        path: 'input-data',
        name: 'Input Data',
        component: InputDataView,
      },
      {
        path: 'output-data',
        name: 'Output Data',
        component: OutputDataView,
      },
      ...dashboardRoutes,
    ],
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  try {
    const auth = await initAuthService()
    const isAuthenticated = auth.isAuthenticated()
    const isSignInPage = to.path === '/sign-in'
    const isTargetingAuthRequiredPage = to.path !== '/sign-in'
    const isExternalAuth = config.auth.type !== 'cornflow'

    // If we're already on sign-in page and it's external auth, just proceed
    if (isSignInPage && isExternalAuth) {
      next()
      return
    }

    // If not authenticated and trying to access protected route
    if (!isAuthenticated && isTargetingAuthRequiredPage) {
      if (isExternalAuth) {
        // For external auth, check if we're already in auth flow
        const isAuthInitiated = sessionStorage.getItem('externalAuthInitiated') === 'true'
        if (isAuthInitiated) {
          // If auth is already initiated, just go to sign-in page
          next('/sign-in')
        } else {
          // Start auth flow and go to sign-in page
          try {
            sessionStorage.setItem('externalAuthInitiated', 'true')
            await auth.login()
            // Always navigate to sign-in as login() will handle redirect
            next('/sign-in')
          } catch (error) {
            console.error('Login failed:', error)
            sessionStorage.removeItem('externalAuthInitiated')
            next('/sign-in')
          }
        }
      } else {
        // For non-external auth, just redirect to sign-in
        next('/sign-in')
      }
    } else if (isAuthenticated && isSignInPage) {
      // If authenticated and trying to access sign-in page, redirect to home
      next('/project-execution')
    } else if (to.path === '/' && isAuthenticated) {
      // If authenticated and accessing root, redirect to project execution
      next('/project-execution')
    } else {
      // In all other cases, proceed normally
      next()
    }
  } catch (error) {
    console.error('Router guard error:', error)
    next('/sign-in')
  }
})

export default router
