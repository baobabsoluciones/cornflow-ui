// Composables
import { createRouter, RouteRecordRaw, createWebHashHistory } from 'vue-router'
import IndexView from '@/views/IndexView.vue'
import LoginView from '@/views/LoginView.vue'
import ProjectExecutionView from '@/views/ProjectExecutionView.vue'
import HistoryExecutionView from '@/views/HistoryExecutionView.vue'
import DashboardView from '@/views/DashboardView.vue'
import InputDataView from '@/views/InputDataView.vue'
import OutputDataView from '@/views/OutputDataView.vue'
import UserSettingsView from '@/views/UserSettingsView.vue'
import auth from '@/services/AuthServiceFactory'
import config from '@/config'

const dashboardRoutes = config.dashboardRoutes || []

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
    beforeEnter: (to, from, next) => {
      if (!auth.isAuthenticated() && to.name !== 'Sign In') {
        next('/sign-in')
      }
      next()
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
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const isAuthenticated = auth.isAuthenticated()
  const isSignInPage = to.path === '/sign-in'
  const isTargetingAuthRequiredPage = to.path !== '/sign-in'
  const isExternalAuth = config.auth.type !== 'cornflow'

  if (!isAuthenticated && isTargetingAuthRequiredPage) {
    if (isExternalAuth) {
      try {
        const loginResult = await auth.login()
        if (!loginResult) {
          next('/sign-in')
        }
        // Don't call next() here as we're being redirected
      } catch (error) {
        console.error('Login failed:', error)
        next('/sign-in')
      }
      return
    }
    next('/sign-in')
  } else if (isAuthenticated && isSignInPage) {
    next('/project-execution')
  } else if (to.path === '/' && isAuthenticated) {
    next('/project-execution')
  } else {
    next()
  }
})

export default router
