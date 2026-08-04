<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { createLogWebSocket, fetchLogFileText, queryLogFiles, type LogFile } from '@/api/log'
import { TOKEN_KEY } from '@/api/request'

// ---- 实时日志 ----
const lines = ref<string[]>([])
const wsState = ref<'connecting' | 'open' | 'closed'>('closed')
const paused = ref(false)
const autoScroll = ref(true)
const logArea = ref<HTMLDivElement>()
let ws: WebSocket | null = null

function connectWs() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    ElMessage.warning('未登录,无法连接日志通道')
    return
  }
  disconnectWs()
  wsState.value = 'connecting'
  try {
    ws = createLogWebSocket(token)
    ws.onopen = () => {
      wsState.value = 'open'
    }
    ws.onmessage = (e) => {
      const text = String(e.data)
      if (paused.value) return
      lines.value = [...lines.value.slice(-499), text]
      void scrollToBottom()
    }
    ws.onclose = () => {
      wsState.value = 'closed'
      ws = null
    }
    ws.onerror = () => {
      wsState.value = 'closed'
      ElMessage.error('日志连接失败')
    }
  } catch {
    wsState.value = 'closed'
  }
}

function disconnectWs() {
  ws?.close()
  ws = null
}

async function scrollToBottom() {
  if (!autoScroll.value) return
  await nextTick()
  if (logArea.value) {
    logArea.value.scrollTop = logArea.value.scrollHeight
  }
}

function clearLines() {
  lines.value = []
}

// ---- 历史日志 ----
const files = ref<LogFile[]>([])
const fileLoading = ref(false)
const query = ref('')
const range = ref<[string, string] | null>(null)

const viewVisible = ref(false)
const viewTitle = ref('')
const viewText = ref('')
const viewLoading = ref(false)

async function loadFiles() {
  fileLoading.value = true
  try {
    files.value = await queryLogFiles({
      query: query.value || undefined,
      startTime: range.value ? `${range.value[0]} 00:00:00` : undefined,
      endTime: range.value ? `${range.value[1]} 23:59:59` : undefined,
    })
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '获取日志列表失败')
  } finally {
    fileLoading.value = false
  }
}

async function viewFile(file: LogFile) {
  viewTitle.value = file.fileName
  viewText.value = ''
  viewVisible.value = true
  viewLoading.value = true
  try {
    viewText.value = await fetchLogFileText(file.fileName)
  } catch (err) {
    viewText.value = ''
    ElMessage.error(err instanceof Error ? err.message : '读取日志失败')
  } finally {
    viewLoading.value = false
  }
}

/** startTime 为毫秒时间戳(实测),格式化展示 */
function fmtTime(ms?: number): string {
  if (!ms) return '-'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function downloadFile(file: LogFile) {
  // 文本下载走带 token 的旁路: 用 a 标签 + fetch blob
  void (async () => {
    try {
      const resp = await fetchLogFileText(file.fileName)
      const blob = new Blob([resp], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : '下载失败')
    }
  })()
}

onMounted(() => {
  connectWs()
  loadFiles()
})

onBeforeUnmount(disconnectWs)
</script>

<template>
  <el-tabs>
    <el-tab-pane label="实时日志">
      <div class="ws-toolbar">
        <el-tag :type="wsState === 'open' ? 'success' : wsState === 'connecting' ? 'warning' : 'info'">
          {{ wsState === 'open' ? '已连接' : wsState === 'connecting' ? '连接中' : '未连接' }}
        </el-tag>
        <el-button size="small" @click="connectWs">重连</el-button>
        <el-button size="small" @click="paused = !paused">
          {{ paused ? '继续' : '暂停' }}
        </el-button>
        <el-checkbox v-model="autoScroll" size="small">自动滚动</el-checkbox>
        <el-button size="small" type="danger" plain @click="clearLines">清空</el-button>
      </div>
      <div ref="logArea" class="log-area">
        <div v-for="(line, i) in lines" :key="i" class="log-line">{{ line }}</div>
        <el-empty
          v-if="!lines.length && wsState !== 'open'"
          description="未连接,点击重连"
          :image-size="60"
        />
      </div>
    </el-tab-pane>

    <el-tab-pane label="历史日志">
      <el-form inline @submit.prevent="loadFiles">
        <el-form-item>
          <el-input
            v-model="query"
            placeholder="搜索关键字"
            clearable
            @keyup.enter="loadFiles"
          />
        </el-form-item>
        <el-form-item>
          <el-date-picker
            v-model="range"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadFiles">查询</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="fileLoading" :data="files" stripe>
        <el-table-column prop="fileName" label="文件名" min-width="220" />
        <el-table-column label="大小" width="110">
          <template #default="{ row }">
            {{ row.fileSize ? `${(row.fileSize / 1024).toFixed(1)} KB` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="开始时间" min-width="160">
          <template #default="{ row }">{{ fmtTime(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewFile(row)">查看</el-button>
            <el-button link type="primary" @click="downloadFile(row)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="viewVisible" :title="viewTitle" width="760px" top="5vh">
    <pre v-loading="viewLoading" class="log-view">{{ viewText || (viewLoading ? '' : '无内容') }}</pre>
  </el-dialog>
</template>

<style scoped>
.ws-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.log-area {
  height: calc(100vh - 260px);
  overflow-y: auto;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  padding: 8px;
  border-radius: 4px;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.log-view {
  max-height: 70vh;
  overflow: auto;
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
