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
import AuthService from '@/services/AuthService'
import config from '@/app/config'

const dashboardRoutes = config.getDashboardRoutes()

const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    component: LoginView,
  },
  {
    path: '/',
    redirect: '/project-execution',
    name: 'Project execution',
    component: IndexView,
    beforeEnter: (to, from, next) => {
      if (!AuthService.isAuthenticated() && to.name !== 'Sign In') {
        console.log(to.name)
        console.log('No está autenticado, al sign in')
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
  },
]

const router = createRouter({
  history: createWebHashHistory(), // This enables hash mode
  routes,
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = AuthService.isAuthenticated()
  const isSignInPage = to.path === '/sign-in'
  const isTargetingAuthRequiredPage = to.path !== '/sign-in'

  if (!isAuthenticated && isTargetingAuthRequiredPage) {
    // If the user is not authenticated and trying to access a page that requires authentication, redirect to sign-in
    next('/sign-in')
  } else if (isAuthenticated && isSignInPage) {
    // If the user is authenticated but trying to access the sign-in page, redirect to the project execution page
    next('/project-execution')
  } else if (to.path === '/' && isAuthenticated) {
    // If the user is authenticated and trying to access the root path, redirect to the project execution page
    next('/project-execution')
  } else {
    // In all other cases, proceed as normal
    next()
  }
})

export default router
