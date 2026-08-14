<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import {
  getTask,
  selectDetectUrl,
  startTask,
  stopTask,
  type AIDetectionTask,
  type StartTaskPayload,
} from '@/api/ai'
import { queryChannels, queryDevices } from '@/api/device'
import { startPlay, stopPlay } from '@/api/play'
import type { Device, DeviceChannel } from '@/api/types/wvp'
import PeopleFlowPlayer from '@/components/PeopleFlowPlayer.vue'
import { selectFlvUrl } from '@/player/stream'

const route = useRoute()
const router = useRouter()

const devices = ref<Device[]>([])
const channels = ref<DeviceChannel[]>([])
const loadingDevices = ref(false)
const loadingChannels = ref(false)
const deviceId = ref('')
const selectedChannelId = ref('')
const starting = ref(false)
const task = ref<AIDetectionTask | null>(null)
const previewUrl = ref('')
const playerError = ref('')
const videoSize = ref<{ width: number; height: number } | null>(null)
const streamKey = ref(0)

const activeChannel = ref<DeviceChannel | null>(null)
let pollTimer: number | null = null

const channelOptions = computed(() =>
  channels.value.filter((channel) => channel.channelType === 0),
)

const selectedChannel = computed(
  () =>
    channelOptions.value.find(
      (channel) =>
        channel.deviceId === selectedChannelId.value ||
        String(channel.id) === selectedChannelId.value,
    ) ?? null,
)

const running = computed(() => task.value?.status === 'running')
const boxes = computed(() => task.value?.boxes ?? [])

const statusText = computed(() => {
  if (!task.value) return '未启动'
  const map: Record<string, string> = {
    idle: '已停止',
    starting: '启动中',
    running: '运行中',
    stopping: '停止中',
    failed: '失败',
  }
  return map[task.value.status] ?? task.value.status
})

const statusTagType = computed(() => {
  if (task.value?.status === 'running') return 'success'
  if (task.value?.status === 'failed') return 'danger'
  return 'info'
})

const avgConfidenceText = computed(() => {
  const avg = task.value?.avgConfidence
  return typeof avg === 'number' ? `${(avg * 100).toFixed(0)}%` : '—'
})

const chartPoints = computed(() => {
  const history = task.value?.countHistory ?? []
  if (history.length < 2) return ''
  const width = 320
  const height = 88
  const pad = 6
  const max = Math.max(1, ...history.map((item) => item.count))
  return history
    .map((item, index) => {
      const x = pad + (index / (history.length - 1)) * (width - pad * 2)
      const y = height - pad - (item.count / max) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

async function loadDevices() {
  loadingDevices.value = true
  try {
    const resp = await queryDevices({ page: 1, count: 100 })
    devices.value = resp.list
    const queryDeviceId = String(route.query.deviceId ?? '')
    if (queryDeviceId && devices.value.some((d) => d.deviceId === queryDeviceId)) {
      deviceId.value = queryDeviceId
      await loadChannels()
      const queryChannelId = String(route.query.channelId ?? '')
      const queryChannelPk = String(route.query.channelPk ?? '')
      const found =
        channelOptions.value.find((c) => c.deviceId === queryChannelId) ??
        channelOptions.value.find((c) => String(c.id) === queryChannelPk)
      if (found) {
        selectedChannelId.value = found.deviceId ?? String(found.id)
      }
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '设备列表加载失败')
  } finally {
    loadingDevices.value = false
  }
}

async function loadChannels() {
  if (!deviceId.value) return
  loadingChannels.value = true
  try {
    const resp = await queryChannels(deviceId.value, {
      page: 1,
      count: 200,
    })
    channels.value = resp.list
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '通道列表加载失败')
  } finally {
    loadingChannels.value = false
  }
}

async function onDeviceChange() {
  selectedChannelId.value = ''
  await stopMonitoring()
  channels.value = []
  await loadChannels()
}

async function onChannelChange() {
  await stopMonitoring()
}

async function startMonitoring() {
  const channel = selectedChannel.value
  if (!deviceId.value || !channel) {
    ElMessage.warning('请先选择设备和通道')
    return
  }
  if (running.value) return

  starting.value = true
  playerError.value = ''
  try {
    const stream = await startPlay(deviceId.value, channel.deviceId!)
    const preview = selectFlvUrl(stream)
    if (!preview) {
      throw new Error('媒体节点未开启 ws-flv 播放协议')
    }
    const detect = selectDetectUrl(stream)
    if (!detect) {
      throw new Error('媒体节点未提供 RTSP/RTMP/FLV 检测流地址')
    }

    const mediaInfo = (stream.mediaInfo ?? {}) as {
      width?: number
      height?: number
    }
    if (mediaInfo.width && mediaInfo.height) {
      videoSize.value = { width: mediaInfo.width, height: mediaInfo.height }
    }

    const payload: StartTaskPayload = {
      deviceId: deviceId.value,
      channelDeviceId: channel.deviceId!,
      channelId: channel.id,
      channelName: channel.name || channel.deviceId || '未命名通道',
      previewUrl: preview,
      detectStreamUrl: detect,
      wvpStreamInfo: stream as unknown as Record<string, unknown>,
    }
    const created = await startTask(payload)
    activeChannel.value = channel
    task.value = created
    previewUrl.value = preview
    streamKey.value += 1
    startPolling()
    ElMessage.success('人流监控已启动')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '启动人流监控失败'
    playerError.value = msg
    ElMessage.error(msg)
  } finally {
    starting.value = false
  }
}

async function stopMonitoring() {
  stopPolling()
  const current = task.value
  if (current) {
    try {
      task.value = await stopTask(current.taskId)
    } catch {
      /* 后端不可达时仍继续释放本地播放 */
    }
  }
  if (deviceId.value && activeChannel.value?.deviceId) {
    try {
      await stopPlay(deviceId.value, activeChannel.value.deviceId)
    } catch {
      /* 点播可能已自行结束 */
    }
  }
  activeChannel.value = null
  previewUrl.value = ''
  playerError.value = ''
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    if (!task.value) return
    try {
      task.value = await getTask(task.value.taskId)
    } catch {
      /* 单次轮询失败不打断,任务状态由下次轮询刷新 */
    }
  }, 1000)
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function goBack() {
  if (deviceId.value) {
    router.push({
      name: 'device-channels',
      params: { deviceId: deviceId.value },
    })
  } else {
    router.push({ name: 'devices' })
  }
}

onMounted(() => {
  void loadDevices()
})

onBeforeUnmount(() => {
  stopPolling()
  if (task.value) {
    void stopTask(task.value.taskId).catch(() => {})
  }
  if (deviceId.value && activeChannel.value?.deviceId) {
    void stopPlay(deviceId.value, activeChannel.value.deviceId).catch(() => {})
  }
})
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <el-button @click="goBack">返回</el-button>
      <span class="title">人流监控(YOLO)</span>

      <el-select
        v-model="deviceId"
        class="select"
        placeholder="选择设备"
        filterable
        :loading="loadingDevices"
        :disabled="running || starting"
        @change="onDeviceChange"
      >
        <el-option
          v-for="device in devices"
          :key="device.deviceId"
          :label="device.name || device.deviceId"
          :value="device.deviceId"
        >
          <div class="option">
            <span>{{ device.name || device.deviceId }}</span>
            <el-tag size="small" :type="device.onLine ? 'success' : 'info'">
              {{ device.onLine ? '在线' : '离线' }}
            </el-tag>
          </div>
        </el-option>
      </el-select>

      <el-select
        v-model="selectedChannelId"
        class="select wide"
        placeholder="选择通道"
        filterable
        :loading="loadingChannels"
        :disabled="!deviceId || running || starting"
        @change="onChannelChange"
      >
        <el-option
          v-for="channel in channelOptions"
          :key="channel.deviceId ?? channel.id"
          :label="channel.name || channel.deviceId"
          :value="channel.deviceId ?? String(channel.id)"
        />
      </el-select>

      <el-button
        type="primary"
        :loading="starting"
        :disabled="!selectedChannel || running"
        @click="startMonitoring"
      >
        开始监控
      </el-button>
      <el-button type="danger" :disabled="!task" @click="stopMonitoring">
        停止监控
      </el-button>
    </div>

    <div class="body">
      <div class="player-wrap">
        <PeopleFlowPlayer
          :url="previewUrl"
          :boxes="boxes"
          :video-width="videoSize?.width ?? null"
          :video-height="videoSize?.height ?? null"
          :stream-key="streamKey"
          :has-audio="activeChannel?.hasAudio ?? true"
        />
        <el-empty
          v-if="!previewUrl && !starting"
          description="选择通道后点击「开始监控」"
          class="overlay"
        />
      </div>

      <aside class="sidebar">
        <section class="panel">
          <header class="panel-header">
            <span class="panel-title">监控状态</span>
            <el-tag :type="statusTagType">{{ statusText }}</el-tag>
          </header>
          <div class="stats">
            <div class="stat">
              <span>当前人数</span>
              <strong>{{ task?.personCount ?? 0 }}</strong>
            </div>
            <div class="stat">
              <span>峰值人数</span>
              <strong>{{ task?.maxPersonCount ?? 0 }}</strong>
            </div>
            <div class="stat">
              <span>累计检出人次</span>
              <strong>{{ task?.totalPersonDetections ?? 0 }}</strong>
            </div>
            <div class="stat">
              <span>平均置信度</span>
              <strong>{{ avgConfidenceText }}</strong>
            </div>
            <div class="stat">
              <span>采样帧数</span>
              <strong>{{ task?.sampleCount ?? 0 }}</strong>
            </div>
            <div class="stat">
              <span>检出帧数</span>
              <strong>{{ task?.detectedSampleCount ?? 0 }}</strong>
            </div>
          </div>
          <p v-if="task?.lastError" class="error-text">
            任务异常:{{ task.lastError }}
          </p>
          <p v-if="task?.lastReportError" class="error-text">
            告警回写异常:{{ task.lastReportError }}
          </p>
        </section>

        <section class="panel">
          <header class="panel-header">
            <span class="panel-title">人数趋势</span>
            <span class="hint">最近 {{ task?.countHistory.length ?? 0 }} 帧</span>
          </header>
          <svg
            v-if="chartPoints"
            viewBox="0 0 320 88"
            class="chart"
            preserveAspectRatio="none"
          >
            <polyline
              :points="chartPoints"
              fill="none"
              stroke="#e65100"
              stroke-width="2"
            />
          </svg>
          <el-empty
            v-else
            description="暂无计数数据"
            :image-size="60"
          />
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.title {
  font-weight: 600;
  margin-right: 8px;
}

.select {
  width: 200px;
}

.select.wide {
  width: 240px;
}

.option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.player-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  background: #000;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.panel {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-bg-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title {
  font-weight: 600;
}

.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stat {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.stat span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}

.stat strong {
  font-size: 20px;
}

.error-text {
  margin-top: 10px;
  color: var(--el-color-danger);
  font-size: 12px;
  word-break: break-all;
}

.chart {
  width: 100%;
  height: 90px;
  background:
    linear-gradient(to bottom, transparent 24px, var(--el-border-color-lighter) 25px)
    repeat-y;
}
</style>
