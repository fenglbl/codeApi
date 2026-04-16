# keng.md

## 已记录坑位

### 1. 聊天页流式输出看起来像“整段一起出来”
- 状态：已定位并修复
- 现象：CodeAip 管理端聊天页里，助手回复虽然启用了流式模式，但用户侧观感仍然像最后整段一次性渲染出来，而不是真正逐步输出。
- 已排除：
  - 后端链路大概率不是主因，因为同一后端接入 OpenClaw 时可以正常流式输出。
  - 单纯的前端节奏参数、拆包粒度、`<pre>{{ item.content }}</pre>` 这种最简显示方式，也不是根因。
- 最终根因：
  - 聊天页里先创建普通 `assistantMessage` 对象，再 `push` 到 `history`。
  - 后续流式渲染期间一直改的是这个 push 前的原始对象引用：`assistantMessage.content += chunk`。
  - 在 Vue3 里，这种“把普通对象 push 进响应式数组后，再异步修改原始对象引用”的写法，可能导致数据虽然在变，但 DOM 不按预期实时更新。
- 正确修法：
  - `history.value.push(userMessage, assistantMessage)` 之后，立即改为只操作 `history` 里的响应式 assistant 引用。
  - 当前实现：
    - `const liveAssistantMessage = history.value[history.value.length - 1]`
    - 后续流式渲染、重试、状态重置、成功/失败收尾，都统一改 `liveAssistantMessage`，不要再改 push 前的 `assistantMessage`。
- 结论：
  - 这个坑的主因不是 SSE 没到，不是后端没流，也不是 Markdown/样式本身。
  - 主因是 Vue3 下对象引用与响应式跟踪链没对齐，导致“数据在变，但页面像最后才一起出来”。
- 备注：
  - 以后如果聊天页、日志页或其他列表页里有“先 push 普通对象，再异步改这个对象字段”的写法，优先检查是不是也该切到数组里的响应式引用再改。
