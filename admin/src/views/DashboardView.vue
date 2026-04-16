<template>
  <AppLayout title="控制台概览" subtitle="服务状态、资源数量、最近请求走势和当前运行概况。">
    <div class="stat-grid dashboard-stat-grid">
      <div class="stat-card">
        <div class="stat-label">服务状态</div>
        <div class="stat-value">{{ health.status || '--' }}</div>
        <div class="overview-sub">数据库：{{ health.db || '--' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">上游</div>
        <div class="stat-value">{{ formatNumber(upstreamCount) }}</div>
        <div class="overview-sub">启用 {{ formatNumber(enabledUpstreamCount) }} / 已同步模型 {{ formatNumber(syncedUpstreamCount) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本地 Keys</div>
        <div class="stat-value">{{ formatNumber(localKeyCount) }}</div>
        <div class="overview-sub">启用 {{ formatNumber(enabledLocalKeyCount) }} / 映射 {{ formatNumber(totalMappings) }} 条</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">当前范围请求</div>
        <div class="stat-value">{{ formatNumber(totalRequests) }}</div>
        <div class="overview-sub">成功 {{ formatNumber(successRequests) }} / 异常 {{ formatNumber(failedRequests) }}</div>
      </div>
    </div>

    <div class="panel quick-filter-panel">
      <div class="panel-body dashboard-range-bar">
        <div>
          <div class="section-title">时间范围</div>
          <div class="section-desc">24h 按小时，7天 / 30天按天聚合，别再盯死一个时间窗。</div>
        </div>
        <div class="quick-filter-chips">
          <button v-for="item in rangeOptions" :key="item.value" class="quick-chip" :class="selectedRange === item.value ? 'is-active' : ''" @click="changeRange(item.value)">{{ item.label }}</button>
        </div>
      </div>
    </div>

    <div class="dashboard-grid dashboard-chart-grid-2">
      <div class="panel dashboard-chart-panel">
        <div class="panel-body">
          <div class="dashboard-panel-head">
            <div>
              <div class="section-title">请求走势</div>
              <div class="section-desc">{{ rangeDesc }}，顺手把成功 / 异常也分层标出来。</div>
            </div>
          </div>
          <div ref="requestChartRef" class="echarts-shell"></div>
        </div>
      </div>

      <div class="panel dashboard-chart-panel">
        <div class="panel-body">
          <div class="dashboard-panel-head">
            <div>
              <div class="section-title">Token 统计</div>
              <div class="section-desc">{{ tokenRangeDesc }}，柱状图看输入 / 输出更直给。</div>
            </div>
          </div>
          <div ref="tokenChartRef" class="echarts-shell"></div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid dashboard-bottom-grid">
      <div class="panel">
        <div class="panel-body">
          <div class="dashboard-panel-head compact">
            <div>
              <div class="section-title">最近状态</div>
              <div class="section-desc">拿当前范围日志算一眼，不搞花架子。</div>
            </div>
          </div>
          <div class="dashboard-kpi-list">
            <div class="dashboard-kpi-item">
              <span class="dashboard-kpi-label">成功率</span>
              <span class="dashboard-kpi-value">{{ successRate }}%</span>
            </div>
            <div class="dashboard-kpi-item">
              <span class="dashboard-kpi-label">流式请求</span>
              <span class="dashboard-kpi-value">{{ formatNumber(streamRequests) }}</span>
            </div>
            <div class="dashboard-kpi-item">
              <span class="dashboard-kpi-label">总 Token</span>
              <span class="dashboard-kpi-value">{{ formatNumber(totalTokens) }}</span>
            </div>
            <div class="dashboard-kpi-item">
              <span class="dashboard-kpi-label">总输入字符</span>
              <span class="dashboard-kpi-value">{{ formatNumber(totalInputChars) }}</span>
            </div>
            <div class="dashboard-kpi-item">
              <span class="dashboard-kpi-label">总输出字符</span>
              <span class="dashboard-kpi-value">{{ formatNumber(totalOutputChars) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-body">
          <div class="dashboard-panel-head compact">
            <div>
              <div class="section-title">高频上游</div>
              <div class="section-desc">按当前范围日志粗看谁最常被打到。</div>
            </div>
          </div>
          <div v-if="topUpstreams.length" class="dashboard-rank-list">
            <div v-for="item in topUpstreams" :key="item.name + item.baseUrl" class="dashboard-rank-item">
              <div>
                <div class="primary-cell">{{ item.name }}</div>
                <div class="cell-sub">{{ item.baseUrl || '--' }}</div>
              </div>
              <span class="metric-badge">{{ formatNumber(item.count) }} 次</span>
            </div>
          </div>
          <div v-else class="inline-empty-tip">还没有足够的日志数据。</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-body">
          <div class="dashboard-panel-head compact">
            <div>
              <div class="section-title">高频本地 Key</div>
              <div class="section-desc">当前范围里，谁用得最勤快一眼看出来。</div>
            </div>
          </div>
          <div v-if="topLocalKeys.length" class="dashboard-rank-list">
            <div v-for="item in topLocalKeys" :key="item.name + item.keyPrefix" class="dashboard-rank-item">
              <div>
                <div class="primary-cell">{{ item.name }}</div>
                <div class="cell-sub">{{ item.keyPrefix || '--' }}</div>
              </div>
              <span class="metric-badge">{{ formatNumber(item.count) }} 次</span>
            </div>
          </div>
          <div v-else class="inline-empty-tip">还没有足够的日志数据。</div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const health = ref({})
const upstreams = ref([])
const localKeys = ref([])
const logs = ref([])
const requestChartRef = ref(null)
const tokenChartRef = ref(null)
const selectedRange = ref('24h')

let requestChart = null
let tokenChart = null
let resizeHandler = null

const rangeOptions = [
  { label: '24h', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' }
]

const upstreamCount = computed(() => upstreams.value.length)
const enabledUpstreamCount = computed(() => upstreams.value.filter(item => item.enabled).length)
const syncedUpstreamCount = computed(() => upstreams.value.filter(item => item.models?.length).length)
const localKeyCount = computed(() => localKeys.value.length)
const enabledLocalKeyCount = computed(() => localKeys.value.filter(item => item.enabled).length)
const totalMappings = computed(() => localKeys.value.reduce((sum, item) => sum + (item.modelMappings?.length || 0), 0))
const totalRequests = computed(() => logs.value.length)
const successRequests = computed(() => logs.value.filter(item => Number(item.statusCode) >= 200 && Number(item.statusCode) < 400).length)
const failedRequests = computed(() => logs.value.filter(item => Number(item.statusCode) >= 400).length)
const streamRequests = computed(() => logs.value.filter(item => item.isStream).length)
const totalTokens = computed(() => logs.value.reduce((sum, item) => sum + (Number(item.totalTokens) || 0), 0))
const totalInputChars = computed(() => logs.value.reduce((sum, item) => sum + (Number(item.inputChars) || 0), 0))
const totalOutputChars = computed(() => logs.value.reduce((sum, item) => sum + (Number(item.outputChars) || 0), 0))
const successRate = computed(() => totalRequests.value ? ((successRequests.value / totalRequests.value) * 100).toFixed(1) : '0.0')
const rangeDesc = computed(() => selectedRange.value === '24h' ? '按小时看最近 24 小时请求量' : `按天看最近 ${selectedRange.value === '7d' ? '7' : '30'} 天请求量`)
const tokenRangeDesc = computed(() => selectedRange.value === '24h' ? '最近 24 小时按小时统计输入 / 输出 token' : `最近 ${selectedRange.value === '7d' ? '7' : '30'} 天按天统计输入 / 输出 token`)

function getRangeConfig() {
  if (selectedRange.value === '7d') return { days: 7, unit: 'day', limit: 2000 }
  if (selectedRange.value === '30d') return { days: 30, unit: 'day', limit: 5000 }
  return { days: 1, unit: 'hour', limit: 1000 }
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatBucketKey(date, unit) {
  if (unit === 'day') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}`
}

function formatBucketLabel(date, unit) {
  if (unit === 'day') return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${pad(date.getHours())}:00`
}

function formatNumber(value) {
  const num = Number(value) || 0
  return num.toLocaleString('en-US')
}

function formatCompactNumber(value) {
  const num = Number(value) || 0
  if (num >= 1000000) return `${(num / 1000000).toFixed(num >= 10000000 ? 0 : 1)}m`
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`
  return String(num)
}

const timeBuckets = computed(() => {
  const { days, unit } = getRangeConfig()
  const now = new Date()
  const count = unit === 'day' ? days : 24
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now)
    if (unit === 'day') {
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (count - 1 - index))
    } else {
      date.setMinutes(0, 0, 0)
      date.setHours(date.getHours() - (count - 1 - index))
    }
    return {
      key: formatBucketKey(date, unit),
      label: formatBucketLabel(date, unit),
      total: 0,
      success: 0,
      failed: 0,
      promptTokens: 0,
      completionTokens: 0
    }
  })
})

const aggregatedBuckets = computed(() => {
  const { unit } = getRangeConfig()
  const buckets = timeBuckets.value.map(item => ({ ...item }))
  const map = new Map(buckets.map(item => [item.key, item]))

  logs.value.forEach(item => {
    const date = new Date(item.createdAt)
    if (Number.isNaN(date.getTime())) return
    const key = formatBucketKey(date, unit)
    const bucket = map.get(key)
    if (!bucket) return
    bucket.total += 1
    bucket.promptTokens += Number(item.promptTokens) || 0
    bucket.completionTokens += Number(item.completionTokens) || 0
    if (Number(item.statusCode) >= 200 && Number(item.statusCode) < 400) bucket.success += 1
    if (Number(item.statusCode) >= 400) bucket.failed += 1
  })

  return buckets
})

const topUpstreams = computed(() => {
  const counter = new Map()
  logs.value.forEach(item => {
    const name = item.upstream?.name || '未知上游'
    const baseUrl = item.upstream?.baseUrl || ''
    const key = `${name}@@${baseUrl}`
    const current = counter.get(key) || { name, baseUrl, count: 0 }
    current.count += 1
    counter.set(key, current)
  })
  return [...counter.values()].sort((a, b) => b.count - a.count).slice(0, 5)
})

const topLocalKeys = computed(() => {
  const counter = new Map()
  logs.value.forEach(item => {
    const name = item.localKey?.name || '未知 Key'
    const keyPrefix = item.localKey?.keyPrefix || ''
    const key = `${name}@@${keyPrefix}`
    const current = counter.get(key) || { name, keyPrefix, count: 0 }
    current.count += 1
    counter.set(key, current)
  })
  return [...counter.values()].sort((a, b) => b.count - a.count).slice(0, 5)
})

async function loadLogs() {
  const { days, limit } = getRangeConfig()
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - days)

  const res = await adminApi.getRequestLogs({
    page: 1,
    pageSize: limit,
    from: from.toISOString(),
    to: now.toISOString()
  }).catch(() => ({ rows: [] }))

  logs.value = Array.isArray(res?.rows) ? res.rows : []
}

function buildRequestChart() {
  if (!requestChartRef.value) return
  if (!requestChart) requestChart = echarts.init(requestChartRef.value)

  requestChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderColor: 'rgba(148, 163, 184, 0.18)',
      textStyle: { color: '#e5e7eb' },
      valueFormatter: value => `${Number(value) || 0}`
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: '#94a3b8' },
      itemWidth: 12,
      itemHeight: 8
    },
    grid: { left: 64, right: 18, top: 40, bottom: 28, containLabel: true },
    xAxis: {
      type: 'category',
      data: aggregatedBuckets.value.map(item => item.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)' } },
      axisLabel: { color: '#94a3b8', hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.10)' } },
      axisLabel: {
        color: '#94a3b8',
        formatter: value => formatCompactNumber(value)
      }
    },
    series: [
      {
        name: '总请求',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#60a5fa' },
        itemStyle: { color: '#60a5fa' },
        areaStyle: { color: 'rgba(96, 165, 250, 0.10)' },
        data: aggregatedBuckets.value.map(item => item.total)
      },
      {
        name: '成功',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#4ade80' },
        itemStyle: { color: '#4ade80' },
        data: aggregatedBuckets.value.map(item => item.success)
      },
      {
        name: '异常',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#f87171' },
        itemStyle: { color: '#f87171' },
        data: aggregatedBuckets.value.map(item => item.failed)
      }
    ]
  })
}

function buildTokenChart() {
  if (!tokenChartRef.value) return
  if (!tokenChart) tokenChart = echarts.init(tokenChartRef.value)

  tokenChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderColor: 'rgba(148, 163, 184, 0.18)',
      textStyle: { color: '#e5e7eb' },
      valueFormatter: value => `${Number(value) || 0}`
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: '#94a3b8' },
      itemWidth: 12,
      itemHeight: 8
    },
    grid: { left: 64, right: 18, top: 40, bottom: 28, containLabel: true },
    xAxis: {
      type: 'category',
      data: aggregatedBuckets.value.map(item => item.label),
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)' } },
      axisLabel: { color: '#94a3b8', hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.10)' } },
      axisLabel: {
        color: '#94a3b8',
        formatter: value => formatCompactNumber(value)
      }
    },
    series: [
      {
        name: '输入 Token',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: '#60a5fa', borderRadius: [6, 6, 0, 0] },
        data: aggregatedBuckets.value.map(item => item.promptTokens)
      },
      {
        name: '输出 Token',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: '#a78bfa', borderRadius: [6, 6, 0, 0] },
        data: aggregatedBuckets.value.map(item => item.completionTokens)
      }
    ]
  })
}

function resizeCharts() {
  requestChart?.resize()
  tokenChart?.resize()
}

async function changeRange(value) {
  if (selectedRange.value === value) return
  selectedRange.value = value
  await loadLogs()
  await nextTick()
  buildRequestChart()
  buildTokenChart()
}

watch(aggregatedBuckets, async () => {
  await nextTick()
  buildRequestChart()
  buildTokenChart()
}, { deep: true })

onMounted(async () => {
  const [healthRes, upstreamRows, localKeyRows] = await Promise.all([
    axios.get('/health').then(r => r.data).catch(() => ({})),
    adminApi.getUpstreams().catch(() => []),
    adminApi.getLocalKeys().catch(() => [])
  ])

  health.value = healthRes
  upstreams.value = upstreamRows || []
  localKeys.value = localKeyRows || []
  await loadLogs()

  await nextTick()
  buildRequestChart()
  buildTokenChart()

  resizeHandler = () => resizeCharts()
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  requestChart?.dispose()
  tokenChart?.dispose()
  requestChart = null
  tokenChart = null
})
</script>
