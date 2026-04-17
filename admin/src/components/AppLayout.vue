<template>
  <div class="page-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">CodeAip<div class="sidebar-sub">Local OpenAI Gateway</div></div>
      <el-menu router :default-active="$route.path" background-color="transparent">
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
          <div class="topbar-eyebrow">CodeAip Admin</div>
          <div class="topbar-title-row">
            <div class="topbar-title">{{ title }}</div>
            <span class="mini-tag topbar-user-tag">{{ auth.admin?.username || 'admin' }}</span>
          </div>
          <div class="topbar-subtitle">{{ subtitle }}</div>
        </div>
        <div class="topbar-actions">
          <el-select v-model="themePreference" class="theme-switcher" size="small" @change="setThemePreference">
            <el-option label="跟随系统" value="system" />
            <el-option label="浅色模式" value="light" />
            <el-option label="深色模式" value="dark" />
          </el-select>
          <span class="mini-tag topbar-theme-tag">{{ themeLabel }}</span>
          <el-button type="danger" plain class="toolbar-danger-btn" @click="logout">退出</el-button>
        </div>
      </div>
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../composables/useTheme'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})

const router = useRouter()
const auth = useAuthStore()
const { themePreference, themeLabel, setThemePreference } = useTheme()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
