<template>
  <AppLayout title="本地 API Keys" subtitle="创建给业务方使用的本地 Key，并绑定多个上游与默认路由。">
    <div class="panel">
      <div class="panel-body">
        <div class="page-section-head">
          <div>
            <div class="section-title">本地 Keys</div>
            <div class="section-desc">共 {{ rows.length }} 个 Key，启用 {{ enabledCount }} 个。明文只在需要时展示，别到处乱贴。</div>
          </div>
          <el-button type="primary" @click="openCreate">新增 Key</el-button>
        </div>

        <div v-if="rows.length" class="table-scroll-shell admin-table-shell compact-list-shell">
          <el-table :data="rows" width="100%" table-layout="fixed" class="compact-list-table">
            <el-table-column label="名称 / 说明" min-width="220">
              <template #default="scope">
                <div class="primary-cell">{{ scope.row.name }}</div>
                <div class="cell-sub">{{ scope.row.remark || '无备注' }}</div>
                <div class="key-meta-line">
                  <span class="mini-tag">创建于 {{ formatDate(scope.row.createdAt) }}</span>
                  <span v-if="scope.row.lastUsedAt" class="mini-tag">最近调用 {{ formatDate(scope.row.lastUsedAt) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Key" min-width="360">
              <template #default="scope">
                <div class="key-inline-row">
                  <code class="code-inline key-code key-code-single-line">{{ revealedKeys[scope.row.id] || scope.row.maskedKey || scope.row.keyPrefix }}</code>
                  <div class="row-actions row-actions-compact row-actions-nowrap key-inline-actions">
                    <button class="action-link" type="button" @click="toggleReveal(scope.row)">{{ revealedKeys[scope.row.id] ? '隐藏' : '显示' }}</button>
                    <button class="action-link is-success" type="button" @click="copyKey(scope.row)">复制</button>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="路由" min-width="240">
              <template #default="scope">
                <div v-if="scope.row.defaultUpstreamId?.name" class="primary-cell">{{ scope.row.defaultUpstreamId.name }}</div>
                <div v-else class="primary-cell muted">未设置默认上游</div>
                <div class="cell-sub">已绑定 {{ scope.row.upstreamBindings?.length || 0 }} 个上游</div>
                <div v-if="scope.row.upstreamBindings?.length" class="mini-tags key-meta-line">
                  <span v-for="item in scope.row.upstreamBindings.slice(0, 3)" :key="item.id || item._id || item.name" class="mini-tag">{{ item.name || item }}</span>
                  <span v-if="scope.row.upstreamBindings.length > 3" class="mini-tag is-more">+{{ scope.row.upstreamBindings.length - 3 }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="scope">
                <span class="state-chip" :class="scope.row.enabled ? 'is-on' : 'is-off'">{{ scope.row.enabled ? '启用' : '禁用' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="调用" width="110">
              <template #default="scope"><span class="metric-pair-mono">{{ formatNumber(scope.row.usageCount || 0) }}</span></template>
            </el-table-column>
            <el-table-column label="tokens(输入/输出)" min-width="190">
              <template #default="scope">
                <div class="metric-pair metric-pair-mono">{{ formatTokenPair(scope.row) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="模型映射" min-width="240">
              <template #default="scope">
                <span class="metric-badge">{{ scope.row.modelMappings?.length || 0 }} 条</span>
                <div v-if="scope.row.modelMappings?.length" class="mapping-preview-list">
                  <div v-for="item in scope.row.modelMappings.slice(0, 2)" :key="`${item.localModel}-${item.upstreamModel}`" class="mapping-preview-item">
                    <code class="code-inline mapping-code">{{ item.localModel }}</code>
                    <span class="mapping-preview-arrow">→</span>
                    <code class="code-inline mapping-code">{{ item.upstreamModel }}</code>
                  </div>
                  <div v-if="scope.row.modelMappings.length > 2" class="cell-sub">还有 {{ scope.row.modelMappings.length - 2 }} 条未展开</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="300" fixed="right">
              <template #default="scope">
                <div class="row-actions">
                  <button class="action-link" type="button" @click="openEdit(scope.row)">编辑</button>
                  <button class="action-link is-warning" type="button" @click="toggle(scope.row)">{{ scope.row.enabled ? '禁用' : '启用' }}</button>
                  <button class="action-link is-success" type="button" @click="regenerate(scope.row)">重置</button>
                  <button class="action-link is-danger" type="button" @click="removeKey(scope.row)">删除</button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else class="empty-state">
          <div class="empty-state-icon">🔑</div>
          <div class="empty-state-title">还没有本地 Key</div>
          <div class="empty-state-desc">创建一个本地 Key，绑定默认上游后，就可以给 OpenClaw 或业务服务用了。</div>
          <div class="empty-state-actions"><el-button type="primary" @click="openCreate">新增 Key</el-button></div>
        </div>
      </div>
    </div>

    <el-dialog v-model="visible" :title="editingId ? '编辑本地 Key' : '新增本地 Key'" width="860px">
      <el-form :model="form" label-position="top">
        <div class="form-block">
          <div class="form-block-title">基础信息</div>
          <div class="form-block-desc">给这个 Key 起个能看懂的名字，备注里写清楚用途，后面排查舒服很多。</div>
          <div class="form-grid-2">
            <el-form-item label="名称"><el-input v-model="form.name" placeholder="例如：openclaw-win / test-client" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="form.remark" placeholder="这个 Key 给谁用、走什么场景。" /></el-form-item>
          </div>
        </div>

        <div class="form-block">
          <div class="form-block-title">路由配置</div>
          <div class="form-block-desc">先绑定可用上游，再从已绑定的上游里挑一个默认上游。默认上游就是没写特殊规则时的兜底出口。</div>

          <el-form-item label="绑定上游">
            <el-select v-model="form.upstreamBindings" multiple filterable class="full-width-control" placeholder="选择这个 Key 可用的上游">
              <el-option v-for="item in upstreams" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
            <div class="field-hint">当前已绑定 {{ boundUpstreams.length }} 个上游。至少绑一个，默认上游才有意义。</div>
          </el-form-item>

          <div class="route-choice-shell">
            <div class="route-choice-head">
              <div>
                <div class="form-block-title">默认上游</div>
                <div class="form-block-desc route-choice-desc">从已绑定上游里选一个默认出口。点卡片比下拉框顺手点。</div>
              </div>
              <span v-if="form.defaultUpstreamId && defaultUpstreamName" class="mini-tag is-more">当前：{{ defaultUpstreamName }}</span>
            </div>

            <div v-if="boundUpstreams.length" class="route-choice-grid">
              <button
                v-for="item in boundUpstreams"
                :key="item.id"
                type="button"
                class="route-choice-card"
                :class="form.defaultUpstreamId === item.id ? 'is-active' : ''"
                @click="form.defaultUpstreamId = item.id"
              >
                <span class="route-choice-title">{{ item.name }}</span>
                <span class="route-choice-sub">{{ item.baseUrl }}</span>
              </button>
            </div>
            <div v-else class="inline-empty-tip">先选绑定上游，默认上游才有得选。</div>
          </div>
        </div>

        <div class="form-block">
          <div class="mapping-head">
            <div>
              <div class="form-block-title">模型映射</div>
              <div class="form-block-desc">左边写本地模型名，右边写真正发给上游的模型名。下面会按当前默认上游和已绑定上游给你建议。</div>
            </div>
            <div class="mapping-meta">
              <span class="metric-badge">{{ mappingCount }} 条</span>
              <el-button size="small" @click="addMapping">新增映射</el-button>
            </div>
          </div>

          <div class="mapping-suggest-shell">
            <div class="mapping-suggest-head">
              <div class="form-block-title no-margin">可用模型建议</div>
              <div class="cell-sub">优先显示默认上游模型，没设默认时就汇总已绑定上游。</div>
            </div>
            <div v-if="suggestedModels.length" class="mapping-suggest-list">
              <button
                v-for="model in suggestedModels"
                :key="model"
                type="button"
                class="mapping-suggest-chip"
                @click="addSuggestedModel(model)"
              >
                {{ model }}
              </button>
            </div>
            <div v-if="defaultUpstreamName" class="field-hint">当前建议优先来自默认上游：{{ defaultUpstreamName }}</div>
            <div v-else class="field-hint">还没设默认上游时，会汇总所有已绑定上游模型给建议。</div>
            <div v-if="!suggestedModels.length" class="inline-empty-tip">当前绑定上游还没有可用模型列表。你可以先去上游管理里同步模型，再回来点这里。</div>
          </div>

          <div v-if="mappingRows.length" class="mapping-list">
            <div v-for="item in mappingRows" :key="item.uid" class="mapping-row-card">
              <div class="mapping-row-grid">
                <el-input v-model="item.localModel" placeholder="本地模型名，例如：chat-model" />
                <div class="mapping-arrow">→</div>
                <el-input v-model="item.upstreamModel" placeholder="上游模型名，例如：gpt-4o-mini / qwen3.5-9b" />
                <button class="action-link is-danger" type="button" @click="removeMapping(item.uid)">删除</button>
              </div>
              <div class="mapping-row-note">留空不会保存；常见做法是先一比一映射，再按需改成本地别名。</div>
            </div>
          </div>
          <div v-else class="inline-empty-tip">还没加映射。没有特殊别名需求也可以直接留空。</div>

          <div class="mapping-quick-actions">
            <button class="action-link" type="button" @click="addPresetMapping('chat-model', 'gpt-4o-mini')">+ chat-model</button>
            <button class="action-link" type="button" @click="addPresetMapping('gpt-local', 'gpt-4o-mini')">+ gpt-local</button>
            <button class="action-link" type="button" @click="addPresetMapping('qwen-local', 'qwen3.5-9b')">+ qwen-local</button>
            <button v-if="mappingRows.length" class="action-link is-danger" type="button" @click="clearMappings">清空映射</button>
          </div>
          <div class="field-hint">只有本地模型名和上游模型名都填了，保存时才会记进去。</div>
        </div>

        <div class="form-block form-block-inline">
          <div>
            <div class="form-block-title">启用状态</div>
            <div class="form-block-desc">禁用后这个 Key 会立即不可用。</div>
          </div>
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
        </div>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rawKeyVisible" title="Key 已生成" width="620px" class="key-delivery-dialog">
      <div class="result-card is-success no-top-margin key-delivery-card">
        <div class="key-delivery-head">
          <div>
            <div class="result-card-title">这个 Key 的明文只建议你现在处理掉</div>
            <div class="result-card-desc">适合立刻复制到密码库、环境变量或安全备忘里。关掉弹窗后，不建议再到处翻明文。</div>
          </div>
          <span class="state-chip is-on">敏感信息</span>
        </div>

        <div class="key-delivery-summary">
          <div class="key-delivery-item">
            <span class="key-delivery-label">Key 名称</span>
            <span class="key-delivery-value">{{ latestRawKeyName || '未命名 Key' }}</span>
          </div>
          <div class="key-delivery-item">
            <span class="key-delivery-label">本次操作</span>
            <span class="key-delivery-value">{{ latestRawKeyAction }}</span>
          </div>
        </div>

        <div class="key-delivery-code-shell">
          <div class="key-delivery-code-head">
            <span class="key-delivery-code-label">Key 明文</span>
            <button class="action-link" type="button" @click="copyLatestRawKey">复制</button>
          </div>
          <div class="raw-key-box">{{ latestRawKey }}</div>
        </div>

        <div class="key-delivery-tips">
          <span class="mini-tag">建议立即复制到安全位置</span>
          <span class="mini-tag">不要直接贴群里</span>
          <span class="mini-tag">如果是重置，旧 Key 已失效</span>
        </div>

        <div class="key-delivery-notice">
          <div class="key-delivery-notice-title">建议你现在就做一件事</div>
          <div class="key-delivery-notice-desc">复制后，马上放进密码管理器、部署面板或 `.env`，别只靠脑子记。</div>
        </div>

        <div class="raw-key-actions">
          <el-button type="primary" @click="copyLatestRawKey">复制并关闭</el-button>
          <el-button @click="rawKeyVisible = false">稍后处理</el-button>
        </div>
      </div>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const rows = ref([])
const upstreams = ref([])
const revealedKeys = ref({})
const visible = ref(false)
const saving = ref(false)
const editingId = ref('')
const mappingRows = ref([])
const rawKeyVisible = ref(false)
const latestRawKey = ref('')
const latestRawKeyName = ref('')
const latestRawKeyAction = ref('新建 Key')
const form = reactive({ name: '', remark: '', enabled: true, upstreamBindings: [], defaultUpstreamId: '' })

const enabledCount = computed(() => rows.value.filter(item => item.enabled).length)
const boundUpstreams = computed(() => upstreams.value.filter(item => form.upstreamBindings.includes(item.id)))
const defaultUpstreamName = computed(() => boundUpstreams.value.find(item => item.id === form.defaultUpstreamId)?.name || '')
const mappingCount = computed(() => getCleanMappings().length)
const suggestedModels = computed(() => {
  const sourceUpstreams = form.defaultUpstreamId
    ? boundUpstreams.value.filter(item => item.id === form.defaultUpstreamId)
    : boundUpstreams.value

  const models = sourceUpstreams.flatMap(item => Array.isArray(item.models) ? item.models : [])
  return [...new Set(models.filter(Boolean))].slice(0, 16)
})

watch(() => form.upstreamBindings.slice(), (list) => {
  if (!list.includes(form.defaultUpstreamId)) {
    form.defaultUpstreamId = list[0] || ''
  }
})

function createMappingRow(localModel = '', upstreamModel = '') {
  return {
    uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    localModel,
    upstreamModel
  }
}

function getCleanMappings() {
  return mappingRows.value
    .map(item => ({
      localModel: String(item.localModel || '').trim(),
      upstreamModel: String(item.upstreamModel || '').trim()
    }))
    .filter(item => item.localModel && item.upstreamModel)
}

function addMapping() {
  mappingRows.value.push(createMappingRow())
}

function removeMapping(uid) {
  mappingRows.value = mappingRows.value.filter(item => item.uid !== uid)
}

function clearMappings() {
  mappingRows.value = []
}

function addPresetMapping(localModel, upstreamModel) {
  const exists = mappingRows.value.some(item => String(item.localModel || '').trim() === localModel)
  if (exists) {
    ElMessage.warning(`映射「${localModel}」已经有了`)
    return
  }
  mappingRows.value.push(createMappingRow(localModel, upstreamModel))
}

function addSuggestedModel(model) {
  const exists = mappingRows.value.some(item => String(item.localModel || '').trim() === model)
  if (exists) {
    ElMessage.warning(`映射「${model}」已经有了`)
    return
  }
  mappingRows.value.push(createMappingRow(model, model))
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
  return ok
}

async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  return fallbackCopyText(text)
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function formatNumber(value) {
  const num = Number(value) || 0
  return num.toLocaleString('en-US')
}

function formatTokenPair(row) {
  return `${formatNumber(row?.promptTokens || 0)} / ${formatNumber(row?.completionTokens || 0)}`
}

async function load() {
  const [keys, ups] = await Promise.all([adminApi.getLocalKeys(), adminApi.getUpstreams()])
  rows.value = keys
  upstreams.value = ups
}

function resetForm() {
  editingId.value = ''
  form.name = ''
  form.remark = ''
  form.enabled = true
  form.upstreamBindings = []
  form.defaultUpstreamId = ''
  mappingRows.value = []
}

function openCreate() {
  resetForm()
  visible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.name = row.name
  form.remark = row.remark || ''
  form.enabled = row.enabled
  form.upstreamBindings = (row.upstreamBindings || []).map(x => x.id || x._id || x)
  form.defaultUpstreamId = row.defaultUpstreamId?.id || row.defaultUpstreamId?._id || row.defaultUpstreamId || ''
  mappingRows.value = (row.modelMappings || []).map(x => createMappingRow(x.localModel, x.upstreamModel))
  visible.value = true
}

function validateForm() {
  const name = String(form.name || '').trim()
  if (!name) {
    ElMessage.warning('先填 Key 名称')
    return false
  }

  if (!Array.isArray(form.upstreamBindings) || !form.upstreamBindings.length) {
    ElMessage.warning('至少绑定一个上游')
    return false
  }

  if (!form.defaultUpstreamId) {
    ElMessage.warning('选一个默认上游')
    return false
  }

  const invalidMapping = mappingRows.value.find(item => {
    const localModel = String(item.localModel || '').trim()
    const upstreamModel = String(item.upstreamModel || '').trim()
    return (localModel && !upstreamModel) || (!localModel && upstreamModel)
  })

  if (invalidMapping) {
    ElMessage.warning('模型映射不要只填一半，本地模型名和上游模型名要成对出现')
    return false
  }

  return true
}

async function save() {
  if (!validateForm()) return

  saving.value = true
  try {
    const payload = { ...form, name: String(form.name || '').trim(), remark: String(form.remark || '').trim(), modelMappings: getCleanMappings() }
    const res = editingId.value ? await adminApi.updateLocalKey(editingId.value, payload) : await adminApi.createLocalKey(payload)
    if (res.rawKey) {
      revealedKeys.value[res.id] = res.rawKey
      latestRawKey.value = res.rawKey
      latestRawKeyName.value = payload.name || res.name || '未命名 Key'
      latestRawKeyAction.value = editingId.value ? '更新并返回明文' : '新建 Key'
      rawKeyVisible.value = true
    }
    ElMessage.success('保存成功')
    visible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function copyLatestRawKey() {
  const copied = await copyText(latestRawKey.value)
  if (!copied) throw new Error('复制失败，请手动复制')
  ElMessage.success('Key 已复制')
  rawKeyVisible.value = false
}

async function toggle(row) {
  await adminApi.toggleLocalKey(row.id)
  ElMessage.success('状态已更新')
  await load()
}

async function regenerate(row) {
  const res = await adminApi.regenerateLocalKey(row.id)
  revealedKeys.value[row.id] = res.rawKey
  latestRawKey.value = res.rawKey
  latestRawKeyName.value = row.name || '未命名 Key'
  latestRawKeyAction.value = '重置 Key'
  rawKeyVisible.value = true
  ElMessage.success('Key 已重置')
  await load()
}

async function toggleReveal(row) {
  if (revealedKeys.value[row.id]) {
    delete revealedKeys.value[row.id]
    revealedKeys.value = { ...revealedKeys.value }
    return
  }
  const res = await adminApi.getLocalKeyRawKey(row.id)
  revealedKeys.value[row.id] = res.rawKey
}

async function copyKey(row) {
  let rawKey = revealedKeys.value[row.id]
  if (!rawKey) {
    const res = await adminApi.getLocalKeyRawKey(row.id)
    rawKey = res.rawKey
    revealedKeys.value[row.id] = rawKey
  }
  const copied = await copyText(rawKey)
  if (!copied) throw new Error('复制失败，请手动复制')
  ElMessage.success('Key 已复制')
}

async function removeKey(row) {
  await ElMessageBox.confirm(`确认删除本地 Key「${row.name}」？删除后将立即失效。`, '提示', { type: 'warning' })
  await adminApi.deleteLocalKey(row.id)
  delete revealedKeys.value[row.id]
  revealedKeys.value = { ...revealedKeys.value }
  ElMessage.success('已删除')
  await load()
}

onMounted(load)
</script>
