// Composables
import { createRouter, RouteRecordRaw, createWebHistory } from 'vue-router'
import IndexView from '@/views/IndexView.vue';
import LoginView from '@/views/LoginView.vue';
import AuthService from '@/services/AuthService';

const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    component: LoginView,
  },
  {
    path: '/',
    component: IndexView,
    beforeEnter: (to, from, next) => {
      if (!AuthService.isAuthenticated() && to.name !== 'Sign In') {
        console.log(to.name);
        console.log('No está autenticado, al sign in');
        next('/sign-in');
      }
      next();
    },
    children: [
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router