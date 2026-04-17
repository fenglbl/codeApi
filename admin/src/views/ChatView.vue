<template>
  <AppLayout title="聊天" subtitle="像正常聊天页一样直接对话，也能顺手验证本地 Key、模型映射和上游响应。">
    <div ref="chatShellRef" class="chat-shell panel" :style="chatShellVars">
      <div class="chat-toolbar">
        <div class="chat-toolbar-main">
          <div class="chat-toolbar-head chat-toolbar-head-inline">
            <div class="chat-toolbar-heading">
              <div class="chat-toolbar-title">聊天调试台</div>
              <div class="chat-toolbar-desc">直接验证本地 Key、模型映射和上游响应，也能承接日志页带过来的问题上下文。</div>
            </div>

          <div class="chat-toolbar-controls chat-toolbar-controls-inline">
            <div class="chat-toolbar-left">
              <el-select v-model="selectedLocalKeyId" placeholder="选择本地 Key" filterable class="chat-toolbar-select">
                <el-option
                  v-for="item in enabledLocalKeys"
                  :key="item.id"
                  :label="`${item.name} (${item.keyPrefix || '未命名'})`"
                  :value="item.id"
                />
              </el-select>
              <el-select v-model="model" placeholder="选择模型" filterable allow-create default-first-option class="chat-toolbar-model-select">
                <el-option
                  v-for="item in suggestedModels"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
              <span class="state-chip">{{ streamMode ? '流式输出' : '非流输出' }}</span>
              <span v-if="sending" class="state-chip is-warning">生成中</span>
              <span v-if="hasExternalDraftContext" class="state-chip is-success">{{ draftSourceLabel }}</span>
            </div>

            <div class="chat-toolbar-right">
              <el-button v-if="sending" type="danger" plain class="toolbar-danger-btn" @click="stopGeneration">停止生成</el-button>
              <el-button class="toolbar-ghost-btn" @click="clearHistory" :disabled="sending || !history.length">清空历史</el-button>
              <el-button class="toolbar-ghost-btn chat-settings-btn" @click="settingsVisible = true">设置</el-button>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div ref="messagesRef" class="chat-messages" @click="handleMessageAreaClick">
        <template v-if="history.length">
          <div
            v-for="item in history"
            :key="item.id"
            class="chat-bubble-row"
            :class="item.role === 'user' ? 'is-user' : item.role === 'assistant' ? 'is-assistant' : 'is-system'"
          >
            <div class="chat-bubble-meta">
              <span class="chat-role">{{ getRoleLabel(item.role) }}</span>
              <span class="chat-time">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="chat-bubble" :class="`is-${item.role}`">
              <div v-if="showBubbleToolbar(item)" class="chat-bubble-toolbar">
                <button v-if="item.content" type="button" class="action-link chat-inline-action" @click="copyMessage(item.content)">复制</button>
                <button v-if="item.role === 'user'" type="button" class="action-link chat-inline-action" @click="retryFromUserMessage(item)">重新发送</button>
                <button v-if="canUseAsDraft(item)" type="button" class="action-link chat-inline-action" @click="useAsDraft(item)">放到输入框</button>
              </div>
              <div v-if="getMessageImages(item.content).length" class="chat-image-grid">
                <div v-for="image in getMessageImages(item.content)" :key="image.id || image.url" class="chat-image-card">
                  <img v-if="image.url" :src="image.url" :alt="image.name || '图片附件'" class="chat-image-preview" />
                  <div v-else class="chat-image-stub">图片未恢复</div>
                  <div class="chat-image-name">{{ image.name || '图片附件' }}</div>
                </div>
              </div>
              <div
                v-if="shouldRenderPendingPlain(item)"
                :key="`pending-${item.id}-${item.renderTick || 0}`"
                class="chat-bubble-text chat-bubble-text-live"
                :class="{ 'is-thinking': item.role === 'assistant' && item.pending && !getMessageText(item.content) }"
              >{{ getMessageText(item.content) || (item.role === 'assistant' && item.pending ? '正在生成...' : '...') }}</div>
              <div
                v-else-if="shouldRenderMarkdown(item)"
                class="chat-bubble-text chat-markdown"
                :class="{ 'is-thinking': item.role === 'assistant' && item.pending && !getMessageText(item.content) }"
                v-html="renderMarkdown(getMessageText(item.content) || (item.role === 'assistant' && item.pending ? '正在生成...' : '...'))"
              ></div>
              <div
                v-else-if="getMessageText(item.content)"
                class="chat-bubble-text"
                :class="{ 'is-thinking': item.role === 'assistant' && item.pending && !getMessageText(item.content) }"
              >{{ getMessageText(item.content) || (item.role === 'assistant' && item.pending ? '正在生成...' : '...') }}</div>
              <div v-if="item.statusCode || item.usage || item.role === 'assistant'" class="chat-bubble-foot">
                <span v-if="item.pending" class="mini-tag">生成中</span>
                <span v-if="item.statusCode" class="mini-tag">状态 {{ item.statusCode }}</span>
                <span v-if="item.usage?.promptTokens" class="mini-tag">输入 {{ item.usage.promptTokens }}</span>
                <span v-if="item.usage?.completionTokens" class="mini-tag">输出 {{ item.usage.completionTokens }}</span>
                <span v-if="item.usage?.totalTokens" class="mini-tag">总计 {{ item.usage.totalTokens }}</span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="chat-empty">
          <div class="chat-empty-badge">CodeAip Chat</div>
          <div class="chat-empty-title">还没有聊天记录</div>
          <div class="chat-empty-desc">选个 Key 和模型，直接开聊。这里现在就是聊天页，不再给你塞那些演示玩具按钮。</div>
          <div class="chat-empty-checklist">
            <span class="mini-tag" :class="selectedLocalKey ? 'is-ok' : ''">{{ selectedLocalKey ? '已选本地 Key' : '先选本地 Key' }}</span>
            <span class="mini-tag" :class="model ? 'is-ok' : ''">{{ model ? `模型：${model}` : '先选模型' }}</span>
            <span class="mini-tag" :class="draft.trim() ? 'is-ok' : ''">{{ draft.trim() ? '输入框已就绪' : '输入问题后可直接发送' }}</span>
          </div>
        </div>
      </div>

      <div v-if="errorState" class="chat-error-bar" :class="`is-${errorState.kind}`">
        <div class="chat-error-head">
          <div class="chat-error-summary">
            <span class="state-chip" :class="errorState.chipClass">{{ errorState.badge }}</span>
            <div>
              <div class="chat-error-title">{{ errorState.title }}</div>
              <div class="chat-error-desc">{{ errorState.desc }}</div>
            </div>
          </div>
          <div class="chat-error-actions">
            <button v-if="errorState.detail" class="action-link chat-inline-action" type="button" @click="copyMessage(errorState.detail)">复制详情</button>
            <button v-if="errorState.suggestPrompt" class="action-link chat-inline-action" type="button" @click="applyStarter(errorState.suggestPrompt)">放到输入框</button>
          </div>
        </div>
        <details v-if="errorState.detail" class="chat-error-detail">
          <summary>查看原始错误</summary>
          <div class="chat-error-text">{{ errorState.detail }}</div>
        </details>
      </div>

      <div class="chat-composer">
        <input ref="imageInputRef" type="file" accept="image/*" multiple class="chat-file-input" @change="handleImageSelect" />
        <div v-if="pendingImages.length" class="chat-composer-images">
          <div v-for="image in pendingImages" :key="image.id" class="chat-composer-image-card">
            <img :src="image.dataUrl" :alt="image.name" class="chat-composer-image-preview" />
            <div class="chat-composer-image-meta">
              <span class="chat-composer-image-name">{{ image.name }}</span>
              <button type="button" class="action-link chat-inline-action" @click="removePendingImage(image.id)">移除</button>
            </div>
          </div>
        </div>
        <el-input
          v-model="draft"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          resize="none"
          class="chat-composer-input"
          :placeholder="composerPlaceholder"
          @keydown="handleComposerKeydown"
        />
        <div class="chat-composer-actions">
          <div class="chat-composer-left muted">
            <span>{{ composerHint }}</span>
            <span class="chat-composer-count">{{ draft.length }} 字</span>
            <span v-if="pendingImages.length" class="chat-composer-count">已附 {{ pendingImages.length }} 张图</span>
          </div>
          <div class="chat-composer-right">
            <el-button class="toolbar-ghost-btn" :disabled="sending" @click="openImagePicker">图片</el-button>
            <el-button v-if="sending" type="danger" plain class="toolbar-danger-btn" @click="stopGeneration">停止</el-button>
            <el-button type="primary" class="toolbar-primary-btn" :loading="sending" :disabled="!canSend" @click="sendMessage">发送</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="settingsVisible" title="聊天设置" width="680px" class="chat-settings-dialog">
      <div class="chat-settings-shell">
        <div class="chat-settings-intro">
          <div>
            <div class="chat-settings-title">把这页调成你顺手的工作状态</div>
            <div class="chat-settings-desc">这里管的是聊天行为，不影响后台其他页面。改完就保存在当前浏览器。</div>
          </div>
          <span class="state-chip">本地保存</span>
        </div>

        <div class="chat-settings-card">
          <div class="chat-settings-card-head">
            <div>
              <div class="chat-settings-card-title">系统提示词</div>
              <div class="chat-settings-card-desc">决定助手默认站在什么角色回答。适合写项目上下文、回答风格和排障偏好。</div>
            </div>
          </div>
          <el-input
            v-model="systemPrompt"
            type="textarea"
            :rows="8"
            class="chat-settings-prompt-input"
            placeholder="默认会使用 CodeAip 项目助理 / 工程师提示词，也可以自己改。"
          />
          <div class="cell-sub">保存后会参与后续对话，但不会自动插到可见聊天历史里。</div>
        </div>

        <div class="chat-settings-grid">
          <div class="chat-settings-card">
            <div class="chat-settings-card-head">
              <div>
                <div class="chat-settings-card-title">输出模式</div>
                <div class="chat-settings-card-desc">流式更像实时对话；非流式更稳定，适合对比完整结果。</div>
              </div>
              <el-switch v-model="streamMode" active-text="流式输出" inactive-text="非流输出" />
            </div>
          </div>

          <div class="chat-settings-card">
            <div class="chat-settings-card-head">
              <div>
                <div class="chat-settings-card-title">失败自动重试</div>
                <div class="chat-settings-card-desc">只在生成阶段接口报错时生效。填 0 就是不重试。</div>
              </div>
            </div>
            <div class="chat-settings-inline-control">
              <el-input-number v-model="retryCount" :min="0" :max="5" :step="1" />
              <span class="mini-tag">最多 5 次</span>
            </div>
          </div>
        </div>

      </div>
      <template #footer>
        <el-button class="toolbar-ghost-btn" @click="settingsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
defineOptions({ name: 'chat' })
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '../components/AppLayout.vue'
import { adminApi } from '../services/adminApi'

const route = useRoute()
const router = useRouter()

// 聊天页本地持久化：
// - CHAT_STORAGE_KEY: 可见聊天记录
// - CHAT_SETTINGS_KEY: 当前聊天设置（key/model/系统提示词/流式开关/重试次数）
// - CHAT_EXTERNAL_DRAFT_STORAGE_KEY: 从请求日志“问AI”跳过来时临时塞给聊天输入框的草稿
const CHAT_STORAGE_KEY = 'codeaip_chat_history_v1'
const CHAT_SETTINGS_KEY = 'codeaip_chat_settings_v1'
const CHAT_EXTERNAL_DRAFT_STORAGE_KEY = 'codeaip_chat_external_draft_v1'
const DEFAULT_SYSTEM_PROMPT = `你是 CodeAip 项目的内置 AI 助理，同时也是一个偏工程落地的高级工程师。

你的职责：
1. 帮用户分析和排查 CodeAip 里的报错、请求失败、模型映射问题、鉴权问题、上下游联调问题。
2. 帮用户设计或修改这个项目的后台功能、接口行为、管理台页面、交互细节和数据流。
3. 当用户贴出日志、错误内容、接口返回、代码片段时，优先做技术判断，不要空泛安慰。
4. 当问题和这个项目直接相关时，回答要尽量结合本项目场景：本地 Key、上游 provider、模型映射、OpenAI 兼容接口、聊天页、请求日志、流式输出、重试、管理后台。

回答风格要求：
- 默认用中文，直接、清楚、不绕弯。
- 先下判断，再讲原因，再给可执行方案。
- 尽量给出排查顺序、修改建议、影响范围。
- 如果信息不够，明确说缺什么，不要乱编。
- 如果有多个可能原因，按优先级列出来。
- 如果用户是在排障，优先给“先检查什么、再看什么、最后怎么改”。
- 如果用户是在做功能，优先给“怎么设计、改哪里、注意什么边界情况”。

输出偏好：
- 简洁为主，但别省掉关键结论。
- 能给步骤就给步骤。
- 能给代码改动点，就明确到模块、页面、接口或状态流。
- 不要假装已经执行了未执行的操作。

你的目标不是泛泛聊天，而是作为 CodeAip 这个项目的长期助理和工程搭子，帮助用户更快定位问题、推进实现、减少试错。`

const localKeys = ref([])
const selectedLocalKeyId = ref('')
const model = ref('')
const modelByLocalKey = ref({})
const systemPrompt = ref(DEFAULT_SYSTEM_PROMPT)
const draft = ref('')
const draftSourceLabel = ref('')
const streamMode = ref(true)
const retryCount = ref(3)
const settingsVisible = ref(false)
const sending = ref(false)
const errorState = ref(null)
const rawKeyCache = ref({})
const history = ref([])
const messagesRef = ref(null)
const chatShellRef = ref(null)
const imageInputRef = ref(null)
const pendingImages = ref([])
const activeAbortController = ref(null)
const stopRequested = ref(false)
const chatViewportHeight = ref(0)
const scrollFramePending = ref(false)

const enabledLocalKeys = computed(() => localKeys.value.filter(item => item.enabled))
const selectedLocalKey = computed(() => enabledLocalKeys.value.find(item => item.id === selectedLocalKeyId.value) || null)

const lastUserMessage = computed(() => {
  const rows = [...history.value].reverse()
  return rows.find(item => item.role === 'user' && item.content) || null
})

const suggestedModels = computed(() => {
  const key = selectedLocalKey.value
  if (!key) return []

  const mappedLocalModels = (key.modelMappings || []).map(item => item.localModel).filter(Boolean)
  const mappedUpstreamModels = (key.modelMappings || []).map(item => item.upstreamModel).filter(Boolean)
  const upstreamModels = [
    ...(key.defaultUpstreamId?.models || []),
    ...((key.upstreamBindings || []).flatMap(item => item?.models || []))
  ].filter(Boolean)

  return [...new Set([...mappedLocalModels, ...mappedUpstreamModels, ...upstreamModels])].slice(0, 16)
})

const hasExternalDraftContext = computed(() => Boolean(draftSourceLabel.value))

const composerPlaceholder = computed(() => {
  if (!selectedLocalKeyId.value) return '先选一个本地 Key，再开始聊天。'
  if (!model.value.trim()) return '先选一个模型，再输入消息。'
  return '输入消息，Enter 发送，Shift + Enter 换行。'
})

const composerHint = computed(() => {
  if (sending.value) return '正在生成中，可以继续看输出，也可以随时点停止。'
  if (!selectedLocalKeyId.value) return '先选本地 Key；系统提示词和重试次数在左上角设置里。'
  if (!model.value.trim()) return 'Key 已选好，再挑一个模型就能发。'
  return '系统提示词在左上角设置里；历史会保存在当前浏览器。'
})

const chatShellVars = computed(() => {
  const safeHeight = chatViewportHeight.value || 0
  if (!safeHeight) return {}
  return {
    '--chat-panel-height': `${safeHeight}px`,
    '--chat-messages-height': `${Math.max(260, safeHeight - 250)}px`
  }
})

// 切换本地 Key 时，记住上一个 Key 对应的模型选择；
// 再给新 Key 恢复上次用过的模型，或者退回默认建议模型。
watch(selectedLocalKeyId, async (newId, oldId) => {
  if (oldId) {
    modelByLocalKey.value = {
      ...modelByLocalKey.value,
      [oldId]: model.value
    }
  }

  await nextTick()
  const value = selectedLocalKey.value
  if (!newId) {
    model.value = ''
    return
  }

  const rememberedModel = modelByLocalKey.value[newId]
  const fallbackModel = value?.modelMappings?.[0]?.localModel || value?.defaultUpstreamId?.models?.[0] || value?.upstreamBindings?.[0]?.models?.[0] || ''
  model.value = rememberedModel || fallbackModel
})

watch(draft, (value) => {
  if (value.trim()) return
  clearDraftSource()
})

// 只要聊天记录、系统提示词、流式开关、key/model、重试次数变化，就写回 localStorage。
watch([history, systemPrompt, streamMode, selectedLocalKeyId, model, retryCount], () => {
  persistState()
}, { deep: true })

function simplifyMessageContentForStorage(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content
  return content.map(item => {
    if (item?.type === 'text') return { type: 'text', text: item.text || '' }
    if (item?.type === 'image_url') {
      return {
        type: 'image_stub',
        name: item.name || '图片附件',
        mimeType: item.mimeType || 'image/*'
      }
    }
    return item
  })
}

function restoreStoredMessageContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content
  return content
}

async function ensureRawKey(localKeyId) {
  if (rawKeyCache.value[localKeyId]) return rawKeyCache.value[localKeyId]
  const res = await adminApi.getLocalKeyRawKey(localKeyId)
  rawKeyCache.value = {
    ...rawKeyCache.value,
    [localKeyId]: res.rawKey
  }
  return res.rawKey
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

// 持久化时只写本地存储，不直接回写响应式源，
// 避免出现 watch -> persistState -> 再改源 -> 再触发 watch 的自循环。
function persistState() {
  const nextModelByLocalKey = selectedLocalKeyId.value
    ? {
        ...modelByLocalKey.value,
        [selectedLocalKeyId.value]: model.value
      }
    : modelByLocalKey.value

  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(
    history.value.slice(-80).map(item => ({
      ...item,
      content: simplifyMessageContentForStorage(item.content)
    }))
  ))
  localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify({
    selectedLocalKeyId: selectedLocalKeyId.value,
    model: model.value,
    modelByLocalKey: nextModelByLocalKey,
    systemPrompt: systemPrompt.value,
    streamMode: streamMode.value,
    retryCount: retryCount.value
  }))
}

// 页面首次进入时，从 localStorage 恢复聊天记录和设置。
// 如果没存过系统提示词，就退回 DEFAULT_SYSTEM_PROMPT。
function restoreState() {
  const savedHistory = safeJsonParse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]', [])
  const savedSettings = safeJsonParse(localStorage.getItem(CHAT_SETTINGS_KEY) || '{}', {})

  history.value = Array.isArray(savedHistory)
    ? savedHistory.map(item => ({
        ...item,
        content: restoreStoredMessageContent(item.content)
      }))
    : []
  selectedLocalKeyId.value = savedSettings.selectedLocalKeyId || ''
  modelByLocalKey.value = savedSettings.modelByLocalKey && typeof savedSettings.modelByLocalKey === 'object'
    ? savedSettings.modelByLocalKey
    : {}
  model.value = savedSettings.model || modelByLocalKey.value[selectedLocalKeyId.value] || ''
  systemPrompt.value = savedSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT
  streamMode.value = savedSettings.streamMode !== undefined ? !!savedSettings.streamMode : true
  retryCount.value = Number.isFinite(Number(savedSettings.retryCount)) ? Math.max(0, Math.min(5, Number(savedSettings.retryCount))) : 3
}

function createMessage(role, content, extra = {}) {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra
  }
}

function getVisibleConversationMessages() {
  const rows = history.value.filter(item => item.role === 'user' || item.role === 'assistant')
  return rows.map(item => ({ role: item.role, content: item.content }))
}

function getRoleLabel(role) {
  if (role === 'user') return '你'
  if (role === 'assistant') return '助手'
  return '系统'
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInlineMarkdown(value = '') {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
}

function renderMarkdown(content = '') {
  const escaped = escapeHtml(content || '')
  const lines = escaped.split(/\r?\n/)
  const blocks = []
  let listItems = []
  let inCodeBlock = false
  let codeBuffer = []

  const flushList = () => {
    if (!listItems.length) return
    blocks.push(`<ul>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  const flushCode = () => {
    if (!codeBuffer.length) return
    const codeContent = codeBuffer.join('\n')
    const encoded = encodeURIComponent(codeContent)
    blocks.push(`
      <div class="chat-code-block">
        <div class="chat-code-head">
          <span class="chat-code-label">代码块</span>
          <button type="button" class="chat-code-copy" data-copy-code="${encoded}">复制代码</button>
        </div>
        <pre><code>${codeContent}</code></pre>
      </div>
    `)
    codeBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine ?? ''
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushList()
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (!trimmed) {
      flushList()
      blocks.push('')
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ''))
      continue
    }

    flushList()

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = Math.min((trimmed.match(/^#+/) || ['#'])[0].length, 3)
      const text = trimmed.replace(/^#{1,3}\s+/, '')
      blocks.push(`<h${level}>${renderInlineMarkdown(text)}</h${level}>`)
      continue
    }

    blocks.push(`<p>${renderInlineMarkdown(trimmed)}</p>`)
  }

  flushList()
  flushCode()

  return blocks.filter((block, index, arr) => block !== '' || (index > 0 && arr[index - 1] !== '')).join('')
}

function getMessageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(item => item?.type === 'text')
    .map(item => String(item.text || ''))
    .join('\n')
}

function getMessageImages(content) {
  if (!Array.isArray(content)) return []
  return content
    .filter(item => item?.type === 'image_url' || item?.type === 'image_stub')
    .map((item, index) => ({
      id: item.id || `${index}_${item.name || 'image'}`,
      url: item?.image_url?.url || '',
      name: item?.name || '图片附件'
    }))
}

function shouldRenderPendingPlain(item) {
  return item?.role === 'assistant' && item?.pending
}

function shouldRenderMarkdown(item) {
  return item?.role === 'assistant' && Boolean(getMessageText(item?.content)) && !item?.pending
}

function canUseAsDraft(item) {
  return Boolean(getMessageText(item?.content))
}

function useAsDraft(item) {
  const text = getMessageText(item?.content)
  if (!text) return
  draft.value = text
  clearDraftSource()
}

function applyStarter(text) {
  draft.value = text
  clearDraftSource()
}

function consumeExternalDraft() {
  const raw = localStorage.getItem(CHAT_EXTERNAL_DRAFT_STORAGE_KEY)
  if (!raw) return false

  const payload = safeJsonParse(raw, null)
  if (!payload?.text) {
    localStorage.removeItem(CHAT_EXTERNAL_DRAFT_STORAGE_KEY)
    return false
  }

  draft.value = payload.text
  draftSourceLabel.value = payload.source === 'request-log-error' ? '来自请求日志问AI' : '外部草稿'
  localStorage.removeItem(CHAT_EXTERNAL_DRAFT_STORAGE_KEY)
  return true
}

function clearDraftSource() {
  draftSourceLabel.value = ''
}

function openImagePicker() {
  imageInputRef.value?.click()
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleImageSelect(event) {
  const files = Array.from(event?.target?.files || [])
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 5 * 1024 * 1024) {
      ElMessage.warning(`图片「${file.name}」超过 5MB，先压缩再试`)
      continue
    }
    const dataUrl = await fileToDataUrl(file)
    pendingImages.value.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: file.name,
      mimeType: file.type,
      dataUrl
    })
  }
  if (event?.target) event.target.value = ''
}

function removePendingImage(imageId) {
  pendingImages.value = pendingImages.value.filter(item => item.id !== imageId)
}

function buildUserMessageContent() {
  const parts = []
  if (draft.value.trim()) {
    parts.push({ type: 'text', text: draft.value.trim() })
  }
  for (const image of pendingImages.value) {
    parts.push({
      type: 'image_url',
      image_url: { url: image.dataUrl },
      name: image.name,
      mimeType: image.mimeType,
      id: image.id
    })
  }
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].text
  return parts
}

function retryFromUserMessage(item) {
  const text = getMessageText(item?.content)
  if (!text || sending.value) return
  draft.value = text
  clearDraftSource()
  sendMessage()
}

function showBubbleToolbar(item) {
  return (item?.role === 'assistant' || item?.role === 'user') && Boolean(item?.content)
}

// 等浏览器完成一帧绘制。流式渲染里会用到，
// 不只是等 Vue nextTick，还要等真正 paint 之后再做滚动之类的操作。
async function waitForPaint() {
  await new Promise(resolve => requestAnimationFrame(() => resolve()))
}

// 轻量滚动调度：把多次滚动请求合并到同一帧，
// 避免流式过程中“每来一点字就强制滚一次”带来的重排/重绘压力。
function scheduleScrollToBottom() {
  if (scrollFramePending.value) return
  scrollFramePending.value = true
  requestAnimationFrame(() => {
    scrollFramePending.value = false
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// 把消息列表滚到最底部。聊天页里很多地方会重复调用它，
// 因为消息内容、Markdown、高度恢复都可能在不同时间点改变 scrollHeight。
async function scrollToBottom() {
  await nextTick()
  const el = messagesRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function copyMessage(content) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制')
  } catch (_) {
    const textarea = document.createElement('textarea')
    textarea.value = content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制')
  }
}

async function handleMessageAreaClick(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-copy-code]') : null
  if (!target) return
  const encoded = target.getAttribute('data-copy-code') || ''
  if (!encoded) return
  await copyMessage(decodeURIComponent(encoded))
}

function clearHistory() {
  history.value = []
  errorState.value = null
  persistState()
}

// 根据当前视口动态计算聊天面板高度。
// 这里会影响消息列表可视区域；如果布局频繁变动，也可能间接影响流式时的重排节奏。
function updateChatViewportHeight() {
  if (typeof window === 'undefined') return
  const shellEl = chatShellRef.value
  if (!shellEl) return
  const rect = shellEl.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  chatViewportHeight.value = Math.max(520, viewportHeight - rect.top - 24)
}

function handleComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

function stopGeneration() {
  if (!sending.value) return
  stopRequested.value = true
  activeAbortController.value?.abort()
}

function extractAssistantText(data) {
  return data?.choices?.map(item => item?.message?.content || item?.text || '').filter(Boolean).join('\n\n') || ''
}

function extractUsage(data) {
  const usage = data?.usage || {}
  return {
    promptTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    completionTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0)
  }
}

// 自动重试判断：只针对更像“暂时性失败”的情况（5xx/429/408/超时/网络/TLS 等）。
// 手动停止、明显不该重试的错误，不会走这里。
function shouldRetryRequest(err) {
  if (!err || err?.name === 'AbortError' || stopRequested.value) return false
  const status = Number(err?.status || 0)
  if (status >= 500 || status === 429 || status === 408) return true

  const rawDetail = typeof err?.data === 'string'
    ? err.data
    : JSON.stringify(err?.data || { message: err?.message || '请求失败' }, null, 2)
  const lowered = String(rawDetail || '').toLowerCase()
  return ['timeout', 'socket', 'tls', 'network', 'overloaded', 'temporarily unavailable'].some(keyword => lowered.includes(keyword))
}

function buildErrorState(err, fallbackPrompt = '') {
  if (err?.name === 'AbortError' || stopRequested.value) {
    return {
      kind: 'muted',
      chipClass: 'is-warning',
      badge: '已停止',
      title: '本次生成已手动停止',
      desc: '你刚刚点了停止，所以这次回复被中断了。要继续的话，重新发送就行。',
      detail: '',
      suggestPrompt: fallbackPrompt
    }
  }

  const status = Number(err?.status || 0)
  const rawDetail = typeof err?.data === 'string'
    ? err.data
    : JSON.stringify(err?.data || { message: err?.message || '请求失败' }, null, 2)
  const lowered = String(rawDetail || '').toLowerCase()

  if (status === 401 || lowered.includes('unauthorized') || lowered.includes('invalid api key')) {
    return {
      kind: 'danger',
      chipClass: 'is-danger',
      badge: '鉴权失败',
      title: '本地 Key 或上游鉴权没过',
      desc: '先检查当前本地 Key 是否有效，或者它绑定的上游 Key 有没有填对。',
      detail: rawDetail,
      suggestPrompt: ''
    }
  }

  if (lowered.includes('context size has been exceeded') || lowered.includes('maximum context length') || lowered.includes('context_length_exceeded')) {
    return {
      kind: 'warning',
      chipClass: 'is-warning',
      badge: '上下文超限',
      title: '这轮对话太长了，模型塞不下',
      desc: '可以清空历史、缩短输入，或者换更能装上下文的模型。',
      detail: rawDetail,
      suggestPrompt: '请基于当前需求，先帮我压缩上下文，再继续回答。'
    }
  }

  if (status >= 500 || lowered.includes('overloaded') || lowered.includes('timeout') || lowered.includes('socket') || lowered.includes('tls')) {
    return {
      kind: 'danger',
      chipClass: 'is-danger',
      badge: '上游异常',
      title: '上游模型服务现在不太正常',
      desc: '可能是超时、过载或网络问题。你可以稍后重试，或者换一个上游/模型试试。',
      detail: rawDetail,
      suggestPrompt: fallbackPrompt
    }
  }

  return {
    kind: 'danger',
    chipClass: 'is-danger',
    badge: '请求失败',
    title: '这次请求没跑通',
    desc: '我把原始报错留在下面了，你可以复制去查，也可以直接改一下输入再试。',
    detail: rawDetail,
    suggestPrompt: fallbackPrompt
  }
}

// 非流式：等接口完整返回后，一次性把助手内容塞进 assistantMessage.content。
async function sendNonStream(rawKey, messages, assistantMessage, requestModel) {
  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rawKey}`,
      'Content-Type': 'application/json'
    },
    signal: activeAbortController.value?.signal,
    body: JSON.stringify({
      model: requestModel,
      stream: false,
      messages
    })
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw { status: res.status, data }
  }

  assistantMessage.content = extractAssistantText(data)
  assistantMessage.statusCode = res.status
  assistantMessage.usage = extractUsage(data)
}

// 流式显示的目标不是“单字打字机”，而是“像人在连续往外说短语”。
// 所以这里按片段类型控制停顿：
// - 普通短语更快
// - 逗号/顿号这类中停顿稍慢
// - 句号/换段这种强停顿更明显
function getStreamChunkDelay(piece = '', queueLength = 0) {
  if (!piece) return 28

  const trimmed = String(piece).trim()
  if (!trimmed) return queueLength > 16 ? 0 : 18
  if (/\n\s*$/.test(piece)) return queueLength > 16 ? 48 : 90
  if (/[。！？!?]$/.test(trimmed)) return queueLength > 16 ? 52 : 120
  if (/[；;：:]$/.test(trimmed)) return queueLength > 16 ? 42 : 84
  if (/[，、,]$/.test(trimmed)) return queueLength > 16 ? 32 : 62
  return queueLength > 16 ? 12 : 26
}

// 把上游 delta 拆成“更像人类阅读节奏”的短语片段：
// - 先保留换行/句号这类强边界
// - 再按逗号、顿号、分号切
// - 最后对过长片段兜底切短，避免一口气塞太多
function splitForDisplay(text = '') {
  const normalized = String(text || '')
  if (!normalized) return []

  const strongSegments = normalized
    .replace(/\r\n/g, '\n')
    .split(/(?<=[\n。！？!?])/u)
    .filter(Boolean)

  const pieces = []

  for (const segment of strongSegments) {
    const midSegments = segment.split(/(?<=[，、；：,;:])/u).filter(Boolean)
    for (const mid of midSegments) {
      if (mid.length <= 8) {
        pieces.push(mid)
        continue
      }

      const chars = Array.from(mid)
      let buffer = ''
      for (const char of chars) {
        buffer += char
        if (buffer.length >= 6) {
          pieces.push(buffer)
          buffer = ''
        }
      }
      if (buffer) pieces.push(buffer)
    }
  }

  return pieces.filter(Boolean)
}

function takeVisibleBatch(queue) {
  if (!queue.length) return ''

  let batch = queue.shift() || ''
  const next = queue[0] || ''
  if (!next) return batch

  const current = batch.trim()
  const lookahead = next.trim()
  const canMerge =
    batch.length + next.length <= 12 &&
    !/[\n。！？!?]$/.test(current) &&
    !/^[\n]/.test(next) &&
    !/[，、；：,;:]$/.test(current) &&
    !/^[，、；：,;:]/.test(lookahead)

  if (canMerge) {
    batch += queue.shift() || ''
  }

  return batch
}

// 真正把 queue 里的流式文本刷到 UI 的地方。
// 这里走的是“短语流”：每次吐一小段，不追求逐字，更强调自然阅读节奏。
async function pumpStreamQueue(assistantMessage, queue, state) {
  if (state.running) return
  state.running = true
  state.lastFlushAt = 0

  while (!stopRequested.value && (queue.length || !state.done)) {
    if (!queue.length) {
      await new Promise(resolve => setTimeout(resolve, 8))
      continue
    }

    const batch = takeVisibleBatch(queue)
    if (!batch) continue

    const now = Date.now()
    const delay = getStreamChunkDelay(batch, queue.length)
    const elapsed = state.lastFlushAt ? now - state.lastFlushAt : delay
    if (elapsed < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - elapsed))
    }

    assistantMessage.content += batch
    assistantMessage.renderTick = (assistantMessage.renderTick || 0) + 1
    state.renderCount = (state.renderCount || 0) + 1
    state.lastFlushAt = Date.now()

    await nextTick()
    scheduleScrollToBottom()
  }

  await scrollToBottom()
  state.running = false
}

// 流式主流程：
// 1. fetch 拿到 ReadableStream
// 2. reader.read() 持续读取原始字节
// 3. 用 decoder + buffer 拼接成字符串
// 4. flushBuffer 按 SSE 事件边界拆包
// 5. handlePayload 取出 delta，塞进 queue
// 6. pumpStreamQueue 再把 queue 渲染到页面
async function sendStream(rawKey, messages, assistantMessage, requestModel) {
  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rawKey}`,
      'Content-Type': 'application/json'
    },
    signal: activeAbortController.value?.signal,
    body: JSON.stringify({
      model: requestModel,
      stream: true,
      messages
    })
  })

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw { status: res.status, data }
  }

  assistantMessage.statusCode = res.status
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const queue = []
  const streamState = { running: false, done: false, renderCount: 0 }
  const pumpPromise = pumpStreamQueue(assistantMessage, queue, streamState)
  let buffer = ''
  let finalUsage = null

  // 处理单条 SSE data: 后面的 JSON 负载。
  // 这里只负责“解析 -> 把 delta 放进 queue”，不直接碰 DOM。
  const handlePayload = (payload) => {
    if (!payload || payload === '[DONE]') return

    try {
      const json = JSON.parse(payload)
      const delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.text || ''
      if (delta) {
        const pieces = splitForDisplay(delta)
        queue.push(...pieces)
      }
      if (json?.usage) {
        finalUsage = extractUsage(json)
      }
    } catch (_) {
      // ignore malformed chunk
    }
  }

  // 把 buffer 里累计的文本按 SSE 事件切开。
  // 当前逻辑是按 \n\n 分块，再从每块里找 data: 行。
  // 如果上游/代理层交付节奏和这里预期不一致，就可能出现：
  // 数据其实到了，但得等到攒够分隔符才会进入 handlePayload。
  const flushBuffer = (force = false) => {
    const normalized = force ? buffer : buffer.replace(/\r\n/g, '\n')
    const parts = normalized.split(/\n\n/)

    if (!force && parts.length <= 1) {
      buffer = normalized
      return
    }

    const completeParts = force ? parts : parts.slice(0, -1)
    for (const part of completeParts) {
      const lines = part.split(/\n/).map(line => line.trim()).filter(line => line.startsWith('data:'))
      for (const line of lines) {
        handlePayload(line.slice(5).trim())
      }
    }

    buffer = force ? '' : (parts.at(-1) || '')
  }

  // 这里是网络读取循环：只负责把字节流读进来并累积到 buffer。
  // 如果想判断“是不是后端压根没流”，这里最适合加时间戳日志。
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    flushBuffer(false)
  }

  buffer += decoder.decode()
  flushBuffer(true)

  streamState.done = true
  await pumpPromise

  if (finalUsage) assistantMessage.usage = finalUsage
}

// 发送消息总入口：
// - 先快照当前 key/model/draft，避免用户中途切换 UI 导致本次请求用到新值
// - 再根据 streamMode 走 sendStream 或 sendNonStream
// - 失败时按 retryCount 做有限重试
async function sendMessage() {
  await nextTick()

  const requestLocalKeyId = selectedLocalKeyId.value
  const requestModel = model.value.trim()
  const requestDraft = draft.value.trim()
  const requestContent = buildUserMessageContent()

  if (!requestLocalKeyId) return ElMessage.warning('先选一个本地 Key')
  if (!requestModel) return ElMessage.warning('先填模型')
  if (!requestDraft && !pendingImages.value.length) return ElMessage.warning('先输入消息或选择图片')

  sending.value = true
  errorState.value = null
  stopRequested.value = false
  activeAbortController.value = new AbortController()

  const userMessage = createMessage('user', requestContent, {
    requestModel,
    requestLocalKeyId
  })
  const assistantMessage = createMessage('assistant', '', {
    pending: true,
    requestModel,
    requestLocalKeyId,
    retryCount: 0,
    renderTick: 0
  })
  history.value.push(userMessage, assistantMessage)

  // 这里后续统一只操作 history 里的响应式 assistant 引用，
  // 避免继续拿 push 前的普通对象引用改字段，导致 Vue3 视图跟踪不稳定。
  const liveAssistantMessage = history.value[history.value.length - 1]

  const currentDraft = requestDraft
  draft.value = ''
  pendingImages.value = []
  await nextTick()
  await scrollToBottom()

  try {
    const rawKey = await ensureRawKey(requestLocalKeyId)
    const messages = []
    if (systemPrompt.value.trim()) messages.push({ role: 'system', content: systemPrompt.value.trim() })
    messages.push(...getVisibleConversationMessages().filter(item => item.content))

    let success = false
    let lastError = null
    // 自动重试发生在这里：一次发送请求里，最多走 retryCount + 1 轮尝试。
    for (let attempt = 0; attempt <= retryCount.value; attempt += 1) {
      liveAssistantMessage.retryCount = attempt
      liveAssistantMessage.pending = true
      liveAssistantMessage.content = ''
      liveAssistantMessage.usage = null
      liveAssistantMessage.statusCode = null
      liveAssistantMessage.renderTick = 0

      try {
        if (streamMode.value) {
          await sendStream(rawKey, messages, liveAssistantMessage, requestModel)
        } else {
          await sendNonStream(rawKey, messages, liveAssistantMessage, requestModel)
        }
        success = true
        break
      } catch (err) {
        lastError = err
        if (!shouldRetryRequest(err) || attempt >= retryCount.value) {
          throw err
        }
        await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)))
      }
    }

    if (!success && lastError) throw lastError

    if (!liveAssistantMessage.content) {
      liveAssistantMessage.content = '上游返回成功了，但没给出可展示文本。'
      errorState.value = {
        kind: 'warning',
        chipClass: 'is-warning',
        badge: '空响应',
        title: '接口成功了，但没吐出可展示内容',
        desc: '这通常是上游只返回了结构数据，或者流式内容被截断了。你可以换个问法再试一下。',
        detail: '',
        suggestPrompt: currentDraft
      }
    }

    liveAssistantMessage.pending = false
    await nextTick()
    persistState()
    await scrollToBottom()
    requestAnimationFrame(() => {
      scrollToBottom()
    })
  } catch (err) {
    history.value = history.value.filter(item => item.id !== liveAssistantMessage.id)
    draft.value = currentDraft
    errorState.value = buildErrorState(err, currentDraft)
    if (err?.name === 'AbortError' || stopRequested.value) {
      ElMessage.info('已停止生成')
    } else {
      ElMessage.error(errorState.value?.title || '请求失败')
    }
  } finally {
    sending.value = false
    activeAbortController.value = null
    stopRequested.value = false
  }
}

// 首次进入聊天页：恢复状态、拉本地 Key、计算高度、接收外部草稿、滚到底。
onMounted(async () => {
  restoreState()
  localKeys.value = await adminApi.getLocalKeys().catch(() => [])
  if (enabledLocalKeys.value.length && !selectedLocalKeyId.value) {
    selectedLocalKeyId.value = enabledLocalKeys.value[0].id
  }
  await nextTick()
  updateChatViewportHeight()
  window.addEventListener('resize', updateChatViewportHeight)
  if (route.query.autofill === 'error-log') {
    if (consumeExternalDraft()) {
      await nextTick()
      router.replace({ name: 'chat', query: {} }).catch(() => {})
    }
  }
  await scrollToBottom()
  requestAnimationFrame(() => {
    scrollToBottom()
  })
})

watch([errorState, draft], async () => {
  await nextTick()
  updateChatViewportHeight()
})

// keep-alive 下从其他菜单切回聊天页时，会走 onActivated。
// 这里会重新处理外部草稿、高度恢复、滚到底。
// 你之前观察到“切出去再回来会吐一部分流式文本”，
// 这说明重新激活/重绘很可能参与了当前流式显示异常。
onActivated(async () => {
  if (route.query.autofill === 'error-log') {
    if (consumeExternalDraft()) {
      await nextTick()
      router.replace({ name: 'chat', query: {} }).catch(() => {})
    }
  }
  updateChatViewportHeight()
  await nextTick()
  await scrollToBottom()
  requestAnimationFrame(() => {
    scrollToBottom()
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateChatViewportHeight)
  }
})
</script>
