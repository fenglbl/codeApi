<template>
  <AppLayout title="请求日志" subtitle="查看最近请求走了哪个本地 Key、哪个上游、状态码、耗时和错误内容。">
    <div class="panel quick-filter-panel">
      <div class="panel-body">
        <div class="table-toolbar log-toolbar-tight">
          <div>
            <div class="quick-filter-title">快速筛选</div>
            <div class="muted">常用视角一把切，少点几下。</div>
          </div>
          <el-button @click="load" :loading="loading">刷新</el-button>
        </div>
        <div class="quick-filter-chips">
          <button class="quick-chip" :class="quickMode === 'all' ? 'is-active' : ''" type="button" @click="applyQuickFilter('all')">全部</button>
          <button class="quick-chip" :class="quickMode === 'errors' ? 'is-active' : ''" type="button" @click="applyQuickFilter('errors')">只看失败</button>
          <button class="quick-chip" :class="quickMode === 'stream' ? 'is-active' : ''" type="button" @click="applyQuickFilter('stream')">只看流式</button>
          <button class="quick-chip" :class="quickMode === 'nonStream' ? 'is-active' : ''" type="button" @click="applyQuickFilter('nonStream')">只看非流</button>
          <button class="quick-chip" :class="quickMode === 'contextExceeded' ? 'is-active' : ''" type="button" @click="applyQuickFilter('contextExceeded')">上下文超限</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body">
        <div class="log-filters">
          <el-input v-model="filters.path" placeholder="按路径筛选，如 /v1/chat/completions" clearable />
          <el-select v-model="filters.statusCode" placeholder="状态码" clearable>
            <el-option label="200" :value="200" />
            <el-option label="400" :value="400" />
            <el-option label="401" :value="401" />
            <el-option label="404" :value="404" />
            <el-option label="409" :value="409" />
            <el-option label="500" :value="500" />
            <el-option label="502" :value="502" />
          </el-select>
          <el-select v-model="filters.localKeyId" placeholder="本地 Key" clearable filterable>
            <el-option v-for="item in localKeys" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select v-model="filters.upstreamId" placeholder="上游" clearable filterable>
            <el-option v-for="item in upstreams" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <div class="log-filter-actions">
            <el-button type="primary" @click="load" :loading="loading">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </div>
        </div>

        <div class="table-toolbar">
          <div class="muted">最近 50 条请求日志。已支持 token、缓存、字数统计和流式标记。</div>
          <div class="table-toolbar-actions">
            <el-switch v-model="compactMode" inline-prompt active-text="紧凑" inactive-text="舒展" />
          </div>
        </div>

        <div v-if="rows.length" class="table-scroll-shell log-table-shell">
          <el-table
            :data="displayRows"
            width="100%"
            v-loading="loading"
            row-key="id"
            :row-class-name="tableRowClassName"
            :size="compactMode ? 'small' : 'default'"
            :max-height="tableMaxHeight"
          >
          <el-table-column label="时间" min-width="180">
            <template #default="scope">{{ formatTime(scope.row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="路径" prop="path" min-width="180" />
          <el-table-column label="模型" min-width="160">
            <template #default="scope">{{ scope.row.model || '--' }}</template>
          </el-table-column>
          <el-table-column label="本地 Key" min-width="180">
            <template #default="scope">{{ scope.row.localKey?.name || '--' }}<span class="muted" v-if="scope.row.localKey?.keyPrefix"> ({{ scope.row.localKey.keyPrefix }})</span></template>
          </el-table-column>
          <el-table-column label="上游" min-width="160">
            <template #default="scope">{{ scope.row.upstream?.name || '--' }}</template>
          </el-table-column>
          <el-table-column label="状态码" width="108">
            <template #default="scope">
              <span class="status-chip" :class="statusChipClass(scope.row.statusCode)">
                <span class="status-chip-dot"></span>
                <span class="metric-pair-mono">{{ scope.row.statusCode }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="错误类型" min-width="150">
            <template #default="scope">
              <span v-if="getErrorType(scope.row)" class="error-type-chip" :class="`is-${getErrorType(scope.row).key}`">
                {{ getErrorType(scope.row).label }}
              </span>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
          <el-table-column label="token(输入/输出)" min-width="220">
            <template #default="scope">
              <div class="metric-pair metric-pair-mono">{{ formatTokenPair(scope.row) }}</div>
              <div class="log-metric-meta">
                <span class="metric-badge">缓存读 {{ scope.row.cacheReadTokens || 0 }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="字数" min-width="150">
            <template #default="scope">
              <div class="metric-stack">
                <div><span class="metric-label">入</span><span class="metric-value metric-pair-mono">{{ scope.row.inputChars || 0 }}</span></div>
                <div><span class="metric-label">出</span><span class="metric-value metric-pair-mono">{{ scope.row.outputChars || 0 }}</span></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="耗时/首字" min-width="190">
            <template #default="scope">
              <div class="metric-pair metric-pair-mono">{{ formatLatency(scope.row) }}</div>
              <div class="log-mode-wrap">
                <span class="log-mode-chip" :class="scope.row.isStream ? 'is-stream' : 'is-non-stream'">
                  {{ scope.row.isStream ? '流' : '非流' }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="错误内容" min-width="360">
            <template #default="scope">
              <div v-if="scope.row.errorMessage">
                <div class="log-error-text" :class="{ 'is-collapsed': !expandedErrors[scope.row.id] }">
                  {{ scope.row.errorMessage }}
                </div>
                <div class="log-error-actions">
                  <button
                    v-if="shouldShowErrorToggle(scope.row.errorMessage)"
                    class="log-expand-btn"
                    type="button"
                    @click="toggleError(scope.row.id)"
                  >
                    {{ expandedErrors[scope.row.id] ? '收起' : '展开' }}
                  </button>
                  <button class="log-expand-btn" type="button" @click="copyText(scope.row.errorMessage)">复制</button>
                </div>
              </div>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
          </el-table>
        </div>

        <div v-else-if="!loading" class="empty-state">
          <div class="empty-state-icon">🪵</div>
          <div class="empty-state-title">这会儿还没可看的日志</div>
          <div class="empty-state-desc">要么还没产生请求，要么你这轮筛选太狠了。点重置或者先打一条请求试试。</div>
          <div class="empty-state-actions">
            <el-button type="primary" @click="resetFilters">重置筛选</el-button>
            <el-button @click="load">刷新</el-button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const rows = ref([])
const loading = ref(false)
const compactMode = ref(false)
const localKeys = ref([])
const upstreams = ref([])
const expandedErrors = ref({})
const quickMode = ref('all')
const tableMaxHeight = 'calc(100vh - 360px)'
const filters = reactive({
  path: '',
  statusCode: '',
  localKeyId: '',
  upstreamId: ''
})

const displayRows = computed(() => {
  if (quickMode.value === 'errors') return rows.value.filter(item => item.statusCode >= 400)
  if (quickMode.value === 'stream') return rows.value.filter(item => item.isStream)
  if (quickMode.value === 'nonStream') return rows.value.filter(item => !item.isStream)
  if (quickMode.value === 'contextExceeded') return rows.value.filter(item => String(item.errorMessage || '').toLowerCase().includes('context size has been exceeded'))
  return rows.value
})

function formatTime(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatTokenPair(row) {
  const prompt = row?.promptTokens || 0
  const completion = row?.completionTokens || 0
  return `${prompt} / ${completion}`
}

function formatLatency(row) {
  const duration = row?.durationMs || 0
  if (row?.isStream) {
    const firstByte = row?.firstByteMs || 0
    return `${duration} ms / ${firstByte > 0 ? `${firstByte} ms` : '--'}`
  }
  return `${duration} ms`
}

function statusChipClass(code) {
  if (code >= 200 && code < 300) return 'is-success'
  if (code >= 400 && code < 500) return 'is-warning'
  if (code >= 500) return 'is-danger'
  return 'is-default'
}

function getErrorType(row) {
  const message = String(row?.errorMessage || '').toLowerCase()
  const statusCode = Number(row?.statusCode || 0)

  if (!message && statusCode < 400) return null
  if (message.includes('context size has been exceeded') || message.includes('maximum context length') || message.includes('context_length_exceeded')) {
    return { key: 'context', label: '上下文超限' }
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return { key: 'timeout', label: '请求超时' }
  }
  if (message.includes('tls') || message.includes('secure tls connection') || message.includes('certificate') || message.includes('ssl')) {
    return { key: 'tls', label: 'TLS失败' }
  }
  if (message.includes('socket hang up') || message.includes('disconnected') || message.includes('econnreset') || message.includes('socket')) {
    return { key: 'socket', label: '连接断开' }
  }
  if (message.includes('unauthorized') || statusCode === 401) {
    return { key: 'auth', label: '认证失败' }
  }
  if (statusCode >= 500) {
    return { key: 'upstream', label: '上游异常' }
  }
  if (statusCode >= 400) {
    return { key: 'request', label: '请求错误' }
  }
  return null
}

function shouldShowErrorToggle(message) {
  return String(message || '').length > 140
}

function toggleError(id) {
  expandedErrors.value = {
    ...expandedErrors.value,
    [id]: !expandedErrors.value[id]
  }
}

function applyQuickFilter(mode) {
  quickMode.value = mode
}

async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success('已复制错误内容')
  } catch (_) {
    ElMessage.error('复制失败')
  }
}

function tableRowClassName({ row }) {
  if (row.statusCode >= 500) return 'log-row-danger'
  if (row.statusCode >= 400) return 'log-row-warning'
  return ''
}

async function loadOptions() {
  const [keys, ups] = await Promise.all([adminApi.getLocalKeys(), adminApi.getUpstreams()])
  localKeys.value = keys
  upstreams.value = ups
}

async function load() {
  loading.value = true
  try {
    rows.value = await adminApi.getRequestLogs({
      limit: 50,
      path: filters.path || undefined,
      statusCode: filters.statusCode || undefined,
      localKeyId: filters.localKeyId || undefined,
      upstreamId: filters.upstreamId || undefined
    })
  } catch (err) {
    ElMessage.error(err.message || '加载日志失败')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.path = ''
  filters.statusCode = ''
  filters.localKeyId = ''
  filters.upstreamId = ''
  quickMode.value = 'all'
  load()
}

onMounted(async () => {
  try {
    await loadOptions()
    await load()
  } catch (err) {
    ElMessage.error(err.message || '初始化失败')
  }
})
</script>
