<template>
  <div class="auth-shell">
    <div class="auth-layout">
      <div class="auth-side-panel">
        <div class="auth-side-eyebrow">CodeAip</div>
        <div class="auth-side-title">本地 OpenAI 网关的控制台</div>
        <div class="auth-side-desc">
          管理上游、分发本地 Key、维护模型映射、查看请求日志。少折腾环境，多看结果，排查也别瞎猜。
        </div>
        <div class="auth-side-points">
          <div class="auth-side-point"><span class="auth-side-dot"></span> 多上游统一接入</div>
          <div class="auth-side-point"><span class="auth-side-dot"></span> 本地 Key 绑定默认路由</div>
          <div class="auth-side-point"><span class="auth-side-dot"></span> 请求日志排查更直接</div>
          <div class="auth-side-point"><span class="auth-side-dot"></span> 聊天调试和日志联动</div>
        </div>
      </div>

      <div class="auth-card auth-card-strong">
        <div class="auth-title">登录后台</div>
        <div class="auth-desc">输入管理员账号后进入控制台。默认账号可以改，但别改完就忘。</div>

        <div class="auth-mini-info">
          <span class="mini-tag">JWT 后台鉴权</span>
          <span class="mini-tag">亮暗双主题</span>
          <span class="mini-tag">本地网关管理</span>
        </div>

        <el-form :model="form" @submit.prevent="handleLogin" label-position="top">
          <el-form-item label="用户名">
            <el-input v-model="form.username" placeholder="请输入管理员用户名" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
          </el-form-item>
          <el-button type="primary" :loading="loading" class="auth-submit-btn" @click="handleLogin">登录</el-button>
        </el-form>

        <div class="auth-footnote">登录后可管理上游、本地 Key、模型映射和日志页。</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { adminApi } from '../services/adminApi'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ username: 'admin', password: 'admin123456' })

async function handleLogin() {
  loading.value = true
  try {
    const res = await adminApi.login(form)
    auth.setAuth(res.token, res.admin)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>
