import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import UpstreamsView from '../views/UpstreamsView.vue'
import LocalKeysView from '../views/LocalKeysView.vue'
import RequestLogsView from '../views/RequestLogsView.vue'
import ChatView from '../views/ChatView.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/chat', name: 'chat', component: ChatView, meta: { requiresAuth: true, keepAlive: true } },
  { path: '/upstreams', name: 'upstreams', component: UpstreamsView, meta: { requiresAuth: true } },
  { path: '/local-keys', name: 'localKeys', component: LocalKeysView, meta: { requiresAuth: true } },
  { path: '/request-logs', name: 'requestLogs', component: RequestLogsView, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) return { name: 'login' }
  if (to.meta.guestOnly && auth.token) return { name: 'dashboard' }
  return true
})

export default router
