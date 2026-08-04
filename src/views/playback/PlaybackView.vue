<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import {
  pausePlayback,
  resumePlayback,
  seekPlayback,
  speedPlayback,
  startPlayback,
  stopPlayback,
} from '@/api/record'
import { createJessibucaPlayer } from '@/player'
import { selectFlvUrl } from '@/player/stream'

const route = useRoute()
const router = useRouter()
const deviceId = computed(() => String(route.params.deviceId))
const channelId = computed(() => String(route.params.channelId))
const startTime = computed(() => String(route.query.startTime ?? ''))
const endTime = computed(() => String(route.query.endTime ?? ''))

const containerRef = ref<HTMLDivElement>()
const loading = ref(true)
const error = ref('')
const paused = ref(false)
const speed = ref(1)
const seekSec = ref(0)
/** 回放总时长(秒),由查询时间段推算,仅用于 seek 滑杆范围 */
const totalSec = computed(() => {
  const s = new Date(startTime.value.replace(/-/g, '/')).getTime()
  const e = new Date(endTime.value.replace(/-/g, '/')).getTime()
  return Number.isFinite(s) && Number.isFinite(e) && e > s
    ? Math.round((e - s) / 1000)
    : 3600
})

let player: ReturnType<typeof createJessibucaPlayer> | null = null
let streamId = ''
let stopped = false

onMounted(async () => {
  try {
    const sc = await startPlayback(deviceId.value, channelId.value, startTime.value, endTime.value)
    // streamId 取启动接口返回字段,不自行拼接(04 §4.6)
    streamId = sc.stream
    const url = selectFlvUrl(sc)
    if (!url) {
      throw new Error('媒体节点未开启 ws-flv 播放协议')
    }
    player = createJessibucaPlayer({ container: containerRef.value! })
    await player.play(url)
  } catch (err) {
    error.value =
      axios.isAxiosError(err) && err.code === 'ECONNABORTED'
        ? '回放超时:设备无响应,请确认设备在线'
        : err instanceof Error
          ? err.message
          : '回放失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
})

function togglePause() {
  if (!streamId) return
  if (paused.value) {
    void resumePlayback(streamId)
    paused.value = false
  } else {
    void pausePlayback(streamId)
    paused.value = true
  }
}

function onSeek() {
  if (!streamId) return
  void seekPlayback(streamId, seekSec.value)
}

function onSpeedChange(value: number) {
  if (!streamId) return
  void speedPlayback(streamId, value)
}

/** 卸载/退出时无条件停止(04 §6.3) */
function stop() {
  if (stopped) return
  stopped = true
  try {
    player?.destroy()
  } catch {
    /* 播放器已销毁时忽略 */
  }
  player = null
  if (streamId) {
    void stopPlayback(deviceId.value, channelId.value, streamId)
  }
}

function stopAndBack() {
  stop()
  router.push({
    name: 'record-query',
    params: { deviceId: deviceId.value, channelId: channelId.value },
  })
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="playback-page">
    <div class="toolbar">
      <el-button
        @click="router.push({ name: 'record-query', params: { deviceId, channelId } })"
      >
        返回录像列表
      </el-button>
      <span class="title">{{ channelId }} {{ startTime }} ~ {{ endTime }}</span>
      <el-button type="danger" @click="stopAndBack">停止并退出</el-button>
    </div>
    <div class="body">
      <div v-loading="loading" class="player-wrap">
        <div ref="containerRef" class="player" />
        <el-empty v-if="error && !loading" :description="error" class="overlay" />
      </div>
      <aside class="controls">
        <el-button :type="paused ? 'success' : 'primary'" @click="togglePause">
          {{ paused ? '继续' : '暂停' }}
        </el-button>
        <div class="seek">
          <span class="label">跳转(秒)</span>
          <el-slider v-model="seekSec" :max="totalSec" />
          <el-button size="small" @click="onSeek">跳转</el-button>
        </div>
        <div class="speed">
          <span class="label">倍速</span>
          <el-select v-model="speed" @change="onSpeedChange">
            <el-option :value="0.25" label="0.25x" />
            <el-option :value="0.5" label="0.5x" />
            <el-option :value="1" label="1x" />
            <el-option :value="2" label="2x" />
            <el-option :value="4" label="4x" />
            <el-option :value="8" label="8x" />
          </el-select>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.playback-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.title {
  font-weight: 600;
  font-size: 13px;
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
  background: #000;
}

.player {
  width: 100%;
  height: 100%;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.controls {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.seek .label,
.speed .label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
