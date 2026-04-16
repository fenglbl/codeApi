<template>
  <AppLayout title="上游管理" subtitle="配置多个 OpenAI 兼容上游地址和密钥，统一由本地 API 代理转发。">
    <div class="panel">
      <div class="panel-body">
        <div class="page-section-head">
          <div>
            <div class="section-title">上游列表</div>
            <div class="section-desc">共 {{ rows.length }} 个上游，启用 {{ enabledCount }} 个，已有模型列表 {{ syncedProviderCount }} 个。Base URL 支持填根域名或 /v1。</div>
          </div>
          <el-button type="primary" @click="openCreate">新增上游</el-button>
        </div>

        <div v-if="rows.length" class="table-scroll-shell admin-table-shell compact-list-shell">
          <el-table :data="rows" width="100%" table-layout="fixed" class="compact-list-table">
            <el-table-column label="名称 / 说明" min-width="220">
              <template #default="scope">
                <div class="primary-cell">{{ scope.row.name }}</div>
                <div class="cell-sub">{{ scope.row.remark || '无备注' }}</div>
                <div class="key-meta-line">
                  <span class="mini-tag">创建于 {{ formatDate(scope.row.createdAt) }}</span>
                  <span class="mini-tag">更新于 {{ formatDate(scope.row.updatedAt) }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="连接信息" min-width="320">
              <template #default="scope">
                <div class="key-cell">
                  <code class="code-inline key-code">{{ scope.row.baseUrl }}</code>
                  <div class="cell-sub">支持根域名或 /v1，当前已识别 {{ scope.row.models?.length || 0 }} 个模型。</div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="状态 / 模型" min-width="240">
              <template #default="scope">
                <span class="state-chip" :class="scope.row.enabled ? 'is-on' : 'is-off'">{{ scope.row.enabled ? '启用' : '禁用' }}</span>
                <div class="key-meta-line">
                  <span class="metric-badge">{{ scope.row.models?.length || 0 }} 个模型</span>
                  <span v-if="scope.row.models?.length" class="mini-tag is-more">已同步</span>
                </div>
                <div v-if="scope.row.models?.length" class="mini-tags upstream-list-preview">
                  <span v-for="item in scope.row.models.slice(0, 3)" :key="item" class="mini-tag">{{ item }}</span>
                  <span v-if="scope.row.models.length > 3" class="mini-tag is-more">+{{ scope.row.models.length - 3 }}</span>
                </div>
                <div v-else class="cell-sub upstream-status-copy">还没同步模型列表</div>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <div class="row-actions">
                  <button class="action-link" type="button" @click="openEdit(scope.row)">编辑</button>
                  <button class="action-link is-success" type="button" @click="runQuickTest(scope.row)">测试</button>
                  <button class="action-link" type="button" @click="runQuickSync(scope.row)">同步模型</button>
                  <button class="action-link is-warning" type="button" @click="toggle(scope.row)">{{ scope.row.enabled ? '禁用' : '启用' }}</button>
                  <button class="action-link is-danger" type="button" @click="remove(scope.row)">删除</button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else class="empty-state">
          <div class="empty-state-icon">🔌</div>
          <div class="empty-state-title">还没有上游</div>
          <div class="empty-state-desc">先新增一个 OpenAI 兼容上游，然后给本地 Key 绑定默认路由。</div>
          <div class="empty-state-actions"><el-button type="primary" @click="openCreate">新增上游</el-button></div>
        </div>
      </div>
    </div>

    <el-dialog v-model="visible" :title="editingId ? '编辑上游' : '新增上游'" width="820px">
      <el-form :model="form" label-position="top">
        <div class="form-block">
          <div class="form-block-title">基础信息</div>
          <div class="form-block-desc">先把名称、Base URL 和密钥填对。Base URL 可以填根域名，也可以直接填到 /v1。</div>
          <div class="form-grid-2">
            <el-form-item label="名称"><el-input v-model="form.name" placeholder="例如：OpenAI / 9527 / 本地LM" /></el-form-item>
            <el-form-item label="Base URL"><el-input v-model="form.baseUrl" placeholder="https://api.openai.com 或 https://api.openai.com/v1" /></el-form-item>
          </div>
          <el-form-item label="API Key"><el-input v-model="form.apiKey" type="password" show-password placeholder="编辑时不填则不改" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" placeholder="写点你自己能看懂的说明，别难为明天的自己。" /></el-form-item>
        </div>

        <div class="form-block">
          <div class="form-block-title">探活与模型同步</div>
          <div class="form-block-desc">保存后可以直接测试连通性，或从上游拉一把模型列表回来，省得手填。</div>
          <div class="upstream-test-actions">
            <el-button :disabled="!canRunRemoteAction || remoteLoading" :loading="testLoading" @click="runTest">连接测试</el-button>
            <el-button type="primary" plain :disabled="!canRunRemoteAction || remoteLoading" :loading="modelsLoading" @click="syncModels">获取模型列表</el-button>
            <span v-if="editingId" class="mini-tag is-more">已保存后可直接探活 / 同步</span>
          </div>
          <div class="field-hint" v-if="!editingId">先保存这个上游，才能测试和获取模型列表。</div>

          <div v-if="testResult" class="result-card" :class="testResult.ok ? 'is-success' : 'is-danger'">
            <div class="result-card-title">{{ testResult.ok ? '连接正常' : '连接失败' }}</div>
            <div class="result-card-desc">{{ testResult.message }}</div>
            <div class="result-grid" v-if="testResult.ok">
              <div class="result-item"><span class="result-label">延迟</span><span class="result-value">{{ testResult.latencyMs }} ms</span></div>
              <div class="result-item"><span class="result-label">模型数</span><span class="result-value">{{ testResult.modelCount }}</span></div>
            </div>
            <div v-if="testResult.sampleModels?.length" class="mini-tags result-tags">
              <span v-for="item in testResult.sampleModels" :key="item" class="mini-tag">{{ item }}</span>
            </div>
          </div>

          <div v-if="modelsSyncResult" class="result-card is-info">
            <div class="result-card-title">模型列表已更新</div>
            <div class="result-card-desc">共同步 {{ modelsSyncResult.modelCount }} 个模型，你也可以继续手动微调。</div>
          </div>
        </div>

        <div class="form-block">
          <div class="mapping-head">
            <div>
              <div class="form-block-title">模型列表</div>
              <div class="form-block-desc">这里保存的是后台展示和本地映射时要用到的模型名。自动同步后还能继续微调，不用死磕逗号大文本。</div>
            </div>
            <div class="mapping-meta">
              <span class="metric-badge">{{ modelCount }} 个模型</span>
            </div>
          </div>

          <div class="model-editor-shell">
            <div class="model-editor-input-row">
              <el-input v-model="newModelName" placeholder="输入一个模型名后点添加，例如：gpt-4o-mini" @keyup.enter="addModel" />
              <el-button @click="addModel">添加</el-button>
            </div>

            <div v-if="modelRows.length" class="model-editor-tags">
              <div v-for="item in modelRows" :key="item" class="model-editor-tag">
                <span>{{ item }}</span>
                <button class="model-editor-remove" type="button" @click="removeModel(item)">×</button>
              </div>
            </div>
            <div v-else class="inline-empty-tip">还没有模型。你可以手动加，或者去上面点“获取模型列表”。</div>
          </div>
        </div>

        <div class="form-block form-block-inline">
          <div>
            <div class="form-block-title">启用状态</div>
            <div class="form-block-desc">禁用后这个上游不会再被路由选中。</div>
          </div>
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
        </div>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const rows = ref([])
const visible = ref(false)
const saving = ref(false)
const testLoading = ref(false)
const modelsLoading = ref(false)
const editingId = ref('')
const modelRows = ref([])
const newModelName = ref('')
const testResult = ref(null)
const modelsSyncResult = ref(null)
const form = reactive({ name: '', baseUrl: '', apiKey: '', enabled: true, remark: '' })

const enabledCount = computed(() => rows.value.filter(item => item.enabled).length)
const syncedProviderCount = computed(() => rows.value.filter(item => item.models?.length).length)
const remoteLoading = computed(() => testLoading.value || modelsLoading.value)
const canRunRemoteAction = computed(() => Boolean(editingId.value))
const modelCount = computed(() => modelRows.value.length)

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

function normalizeModels(list) {
  return [...new Set((list || []).map(item => String(item || '').trim()).filter(Boolean))]
}

function addModel() {
  const value = String(newModelName.value || '').trim()
  if (!value) return
  if (modelRows.value.includes(value)) {
    ElMessage.warning(`模型「${value}」已经有了`)
    return
  }
  modelRows.value.push(value)
  newModelName.value = ''
}

function removeModel(model) {
  modelRows.value = modelRows.value.filter(item => item !== model)
}

async function load() {
  rows.value = await adminApi.getUpstreams()
}

function resetForm() {
  editingId.value = ''
  form.name = ''
  form.baseUrl = ''
  form.apiKey = ''
  form.enabled = true
  form.remark = ''
  modelRows.value = []
  newModelName.value = ''
  testResult.value = null
  modelsSyncResult.value = null
}

function openCreate() {
  resetForm()
  visible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.name = row.name
  form.baseUrl = row.baseUrl
  form.apiKey = ''
  form.enabled = row.enabled
  form.remark = row.remark || ''
  modelRows.value = normalizeModels(row.models || [])
  newModelName.value = ''
  testResult.value = null
  modelsSyncResult.value = null
  visible.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form, models: normalizeModels(modelRows.value) }
    if (editingId.value) await adminApi.updateUpstream(editingId.value, payload)
    else await adminApi.createUpstream(payload)
    ElMessage.success('保存成功')
    visible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function runTest() {
  if (!editingId.value) return
  testLoading.value = true
  testResult.value = null
  try {
    const res = await adminApi.testUpstream(editingId.value)
    testResult.value = res
    ElMessage.success('连接测试完成')
  } catch (err) {
    testResult.value = { ok: false, message: err.message || '连接测试失败' }
    ElMessage.error(err.message || '连接测试失败')
  } finally {
    testLoading.value = false
  }
}

async function syncModels() {
  if (!editingId.value) return
  modelsLoading.value = true
  modelsSyncResult.value = null
  try {
    const res = await adminApi.fetchUpstreamModels(editingId.value)
    modelsSyncResult.value = res
    modelRows.value = normalizeModels(res.models || [])
    ElMessage.success(`已同步 ${res.modelCount || 0} 个模型`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || '获取模型列表失败')
  } finally {
    modelsLoading.value = false
  }
}

async function runQuickTest(row) {
  try {
    const res = await adminApi.testUpstream(row.id)
    ElMessage.success(`连接正常，延迟 ${res.latencyMs} ms`)
  } catch (err) {
    ElMessage.error(err.message || '连接测试失败')
  }
}

async function runQuickSync(row) {
  try {
    const res = await adminApi.fetchUpstreamModels(row.id)
    ElMessage.success(`已同步 ${res.modelCount || 0} 个模型`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || '同步失败')
  }
}

async function toggle(row) {
  await adminApi.toggleUpstream(row.id)
  ElMessage.success('状态已更新')
  await load()
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除上游「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await adminApi.deleteUpstream(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

onMounted(load)
</script>
