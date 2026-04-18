<template>
  <AppLayout title="请求日志" subtitle="查看最近请求走了哪个本地 Key、哪个上游、状态码、耗时和错误内容。">
    <div class="log-overview-grid">
      <div class="overview-card">
        <div class="overview-label">当前结果</div>
        <div class="overview-value">{{ formatNumber(total) }}</div>
        <div class="overview-sub">按当前筛选条件统计的日志总数</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">当前页条目</div>
        <div class="overview-value">{{ formatNumber(rows.length) }}</div>
        <div class="overview-sub">本页已加载的日志条数</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">失败占比</div>
        <div class="overview-value">{{ errorRatio }}</div>
        <div class="overview-sub">当前页里状态码 ≥ 400 的请求比例</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">流式请求</div>
        <div class="overview-value">{{ formatNumber(streamCount) }}</div>
        <div class="overview-sub">当前页中走流式返回的请求条数</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body">
        <div class="log-filters-panel">
          <div class="page-section-head page-section-head-tight">
            <div>
              <div class="section-title section-title-sm">条件筛选</div>
              <!-- <div class="section-desc">先按路径、状态码、本地 Key、上游缩小范围，再往下看错误和耗时。</div> -->
            </div>
          </div>

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
            <el-button type="primary" class="toolbar-primary-btn" @click="load" :loading="loading">查询</el-button>
            <el-button class="toolbar-ghost-btn" @click="resetFilters">重置</el-button>
          </div>
        </div>
        </div>

        <div class="table-toolbar log-view-toolbar">
          <div class="muted">支持按页查看请求日志。已支持 token、缓存、字数统计和流式标记。</div>
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
            <template #default="scope">
              <div class="log-request-cell">
                <div class="primary-cell">{{ formatTime(scope.row.createdAt) }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="路径" prop="path" min-width="180">
            <template #default="scope">
              <div class="log-request-cell">
                <div class="primary-cell">{{ scope.row.path || '--' }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="模型" min-width="160">
            <template #default="scope">
              <div class="log-request-cell">
                <div class="primary-cell">{{ scope.row.model || '--' }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="本地 Key" min-width="180">
            <template #default="scope">
              <div class="log-route-cell">
                <div class="primary-cell">{{ scope.row.localKey?.name || '--' }}</div>
                <div class="cell-sub" v-if="scope.row.localKey?.keyPrefix">{{ scope.row.localKey.keyPrefix }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="上游" min-width="160">
            <template #default="scope">
              <div class="log-route-cell">
                <div class="primary-cell">{{ scope.row.upstream?.name || '--' }}</div>
              </div>
            </template>
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
              <div class="log-metric-cell">
                <div class="metric-pair metric-pair-mono">{{ formatTokenPair(scope.row) }}</div>
                <div class="log-metric-meta">
                  <span class="metric-badge">缓存读 {{ formatNumber(scope.row.cacheReadTokens) }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="字数" min-width="150">
            <template #default="scope">
              <div class="log-metric-cell">
                <div class="metric-stack">
                  <div><span class="metric-label">入</span><span class="metric-value metric-pair-mono">{{ formatNumber(scope.row.inputChars) }}</span></div>
                  <div><span class="metric-label">出</span><span class="metric-value metric-pair-mono">{{ formatNumber(scope.row.outputChars) }}</span></div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="耗时 / 首字 / 模式" min-width="240">
            <template #default="scope">
              <div class="log-metric-cell">
                <div class="log-latency-line">
                  <span class="metric-pair metric-pair-mono">{{ formatLatency(scope.row) }}</span>
                  <span class="log-mode-chip" :class="scope.row.isStream ? 'is-stream' : 'is-non-stream'">
                    {{ scope.row.isStream ? '流' : '非流' }}
                  </span>
                </div>
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
                  <button class="log-expand-btn is-primary" type="button" @click="askAi(scope.row)">问AI</button>
                </div>
              </div>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
          </el-table>
        </div>

        <div v-if="rows.length" class="table-pagination-bar log-pagination-bar">
          <div class="log-pagination-meta">
            <div class="log-pagination-title">日志分页</div>
            <div class="muted">共 {{ formatNumber(total) }} 条，当前第 {{ page }} / {{ totalPages }} 页</div>
          </div>
          <el-pagination
            background
            layout="prev, pager, next, sizes"
            :current-page="page"
            :page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="total"
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>

        <div v-else-if="!loading" class="empty-state">
          <div class="empty-state-icon">🪵</div>
          <div class="empty-state-title">这会儿还没可看的日志</div>
          <div class="empty-state-desc">要么还没产生请求，要么你这轮筛选太狠了。点重置或者先打一条请求试试。</div>
          <div class="empty-state-actions">
            <el-button type="primary" class="toolbar-primary-btn" @click="resetFilters">重置筛选</el-button>
            <el-button class="toolbar-ghost-btn" @click="load">刷新</el-button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const router = useRouter()
const CHAT_DRAFT_STORAGE_KEY = 'codeaip_chat_external_draft_v1'
const REQUEST_LOGS_UI_STORAGE_KEY = 'codeaip_request_logs_ui_v1'

const rows = ref([])
const loading = ref(false)
const compactMode = ref(false)
const localKeys = ref([])
const upstreams = ref([])
const expandedErrors = ref({})
const quickMode = ref('all')
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const tableMaxHeight = 'calc(100vh - 312px)'
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

const totalPages = computed(() => Math.max(1, Math.ceil((total.value || 0) / pageSize.value)))
const currentPageErrorCount = computed(() => rows.value.filter(item => Number(item?.statusCode || 0) >= 400).length)
const streamCount = computed(() => rows.value.filter(item => item?.isStream).length)
const errorRatio = computed(() => {
  const totalRows = rows.value.length
  if (!totalRows) return '0%'
  return `${Math.round((currentPageErrorCount.value / totalRows) * 100)}%`
})

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function restoreUiState() {
  const saved = safeJsonParse(localStorage.getItem(REQUEST_LOGS_UI_STORAGE_KEY) || '{}', {})
  compactMode.value = saved.compactMode !== undefined ? !!saved.compactMode : false
}

function persistUiState() {
  localStorage.setItem(REQUEST_LOGS_UI_STORAGE_KEY, JSON.stringify({
    compactMode: compactMode.value
  }))
}

function formatTime(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatNumber(value) {
  const num = Number(value) || 0
  return num.toLocaleString('en-US')
}

function formatTokenPair(row) {
  const prompt = row?.promptTokens || 0
  const completion = row?.completionTokens || 0
  return `${formatNumber(prompt)} / ${formatNumber(completion)}`
}

function formatLatency(row) {
  const durationMs = Number(row?.durationMs || 0)
  const firstByteMs = Number(row?.firstByteMs || 0)
  const formatSeconds = value => `${(value / 1000).toFixed(2)} s`

  if (row?.isStream) {
    return `${formatSeconds(durationMs)} / ${firstByteMs > 0 ? formatSeconds(firstByteMs) : '--'}`
  }

  return `${formatSeconds(durationMs)} / --`
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
  page.value = 1
  load()
}

function handlePageChange(nextPage) {
  page.value = nextPage
  load()
}

function handlePageSizeChange(nextSize) {
  pageSize.value = nextSize
  page.value = 1
  load()
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

function buildAiQuestion(row) {
  const parts = [
    '帮我分析下面这个 CodeAip 请求错误，并给出排查思路、可能原因、修复建议。',
    '',
    `请求时间：${formatTime(row.createdAt)}`,
    `请求路径：${row.path || '--'}`,
    `模型：${row.model || '--'}`,
    `本地 Key：${row.localKey?.name || '--'}${row.localKey?.keyPrefix ? ` (${row.localKey.keyPrefix})` : ''}`,
    `上游：${row.upstream?.name || '--'}`,
    `状态码：${row.statusCode || '--'}`,
    `是否流式：${row.isStream ? '是' : '否'}`,
    `耗时：${formatLatency(row)}`,
    '',
    '错误内容：',
    row.errorMessage || '--',
    '',
    '请按这个格式回答：',
    '1. 问题判断',
    '2. 最可能原因（按优先级排序）',
    '3. 建议我先检查什么',
    '4. 如果要修代码，建议改哪里'
  ]

  return parts.join('\n')
}

async function askAi(row) {
  try {
    const prompt = buildAiQuestion(row)
    localStorage.setItem(CHAT_DRAFT_STORAGE_KEY, JSON.stringify({
      text: prompt,
      createdAt: Date.now(),
      source: 'request-log-error'
    }))
    await router.push({ name: 'chat', query: { autofill: 'error-log' } })
    ElMessage.success('已把错误带到聊天页')
  } catch (_) {
    ElMessage.error('跳转聊天页失败')
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
    const res = await adminApi.getRequestLogs({
      page: page.value,
      pageSize: pageSize.value,
      path: filters.path || undefined,
      statusCode: filters.statusCode || undefined,
      localKeyId: filters.localKeyId || undefined,
      upstreamId: filters.upstreamId || undefined
    })
    rows.value = Array.isArray(res?.rows) ? res.rows : []
    total.value = Number(res?.total || 0)
    page.value = Number(res?.page || page.value || 1)
    pageSize.value = Number(res?.pageSize || pageSize.value || 50)
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
  page.value = 1
  load()
}

watch(compactMode, () => {
  persistUiState()
})

onMounted(async () => {
  try {
    restoreUiState()
    await loadOptions()
    await load()
  } catch (err) {
    ElMessage.error(err.message || '初始化失败')
  }
})
</script>
