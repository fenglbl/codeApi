<template>
  <div class="page-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">CodeAip<div class="sidebar-sub">Local OpenAI Gateway</div></div>
      <el-menu router :default-active="$route.path" background-color="transparent" text-color="#cbd5e1" active-text-color="#60a5fa">
        <el-menu-item index="/dashboard">概览</el-menu-item>
        <el-menu-item index="/chat">聊天</el-menu-item>
        <el-menu-item index="/upstreams">上游管理</el-menu-item>
        <el-menu-item index="/local-keys">本地 Keys</el-menu-item>
        <el-menu-item index="/request-logs">请求日志</el-menu-item>
      </el-menu>
    </aside>
    <main class="main-area">
      <div class="topbar">
        <div class="topbar-main">
          <div class="topbar-title">{{ title }}</div>
          <div class="muted">{{ subtitle }}</div>
        </div>
        <div class="topbar-actions">
          <span class="muted">{{ auth.admin?.username || 'admin' }}</span>
          <el-button type="danger" plain @click="logout">退出</el-button>
        </div>
      </div>
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})

const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
