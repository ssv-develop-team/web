<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, ref } from 'vue'

import { startPlay, stopPlay } from '@/api/play'
import { createJessibucaPlayer } from '@/player'
import { selectFlvUrl } from '@/player/stream'
import type { LinkageEvent } from '@/linkage/gateway'

const props = defineProps<{ event: LinkageEvent }>()
const emit = defineEmits<{ closed: [] }>()

const visible = ref(true)
const loading = ref(false)
const error = ref('')
const playerContainer = ref<HTMLDivElement>()
const channel = computed(() => props.event.channels[0])
const additionalChannelCount = computed(() => Math.max(0, props.event.channels.length - 1))

let player: ReturnType<typeof createJessibucaPlayer> | null = null
let dialogClosed = false
let playbackRequested = false
let stopRequested = false

async function startPlayback() {
  if (!channel.value || loading.value || playbackRequested || dialogClosed) return
  loading.value = true
  error.value = ''
  try {
    const stream = await startPlay(channel.value.deviceId, channel.value.channelId)
    playbackRequested = true
    if (dialogClosed) {
      await releasePlayback()
      return
    }
    const url = selectFlvUrl(stream)
    if (!url) throw new Error('媒体节点未开启当前页面可用的 FLV 播放协议')
    if (!playerContainer.value) throw new Error('视频播放器容器尚未就绪')
    player = createJessibucaPlayer({ container: playerContainer.value })
    player.on('error', () => {
      error.value = '视频播放出错，请检查摄像机与媒体节点状态'
      destroyPlayer()
      void releasePlayback()
    })
    await player.play(url)
  } catch (playError) {
    if (!dialogClosed) {
      error.value =
        axios.isAxiosError(playError) && playError.code === 'ECONNABORTED'
          ? '点播超时：设备无响应或当前不可达'
          : playError instanceof Error
            ? playError.message
            : '视频点播失败'
    }
    destroyPlayer()
    await releasePlayback()
  } finally {
    loading.value = false
  }
}

function closeDialog() {
  visible.value = false
}

function onDialogClosed() {
  void cleanup()
  emit('closed')
}

async function cleanup() {
  dialogClosed = true
  destroyPlayer()
  await releasePlayback()
}

function destroyPlayer() {
  if (!player) return
  try {
    player?.destroy()
  } catch {}
  player = null
}

async function releasePlayback() {
  if (!playbackRequested || stopRequested || !channel.value) return
  stopRequested = true
  try {
    await stopPlay(channel.value.deviceId, channel.value.channelId)
  } catch {
    if (!dialogClosed) error.value ||= '停止视频点播失败，请检查 WVP 流状态'
  }
}

onBeforeUnmount(() => {
  void cleanup()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="设备变位视频联动"
    width="min(92vw, 960px)"
    destroy-on-close
    @opened="startPlayback"
    @closed="onDialogClosed"
  >
    <div class="linkage-event">
      <strong>{{ event.deviceName }}</strong>
      <span>{{ event.pointKey }} · {{ event.property }} → {{ event.value }}</span>
      <small>{{ event.eventTime }}</small>
    </div>
    <el-alert
      v-if="additionalChannelCount > 0"
      :title="`当前播放首个绑定通道，另有 ${additionalChannelCount} 个通道暂不自动播放`"
      type="info"
      :closable="false"
      show-icon
    />
    <div class="channel-name">{{ channel?.name || channel?.channelId }}</div>
    <div v-loading="loading" class="video-frame">
      <div ref="playerContainer" class="player-container" />
      <el-empty v-if="error && !loading" :description="error" class="video-error" />
    </div>
    <template #footer>
      <el-button @click="closeDialog">关闭并停止点播</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.linkage-event {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.linkage-event small {
  color: var(--el-text-color-secondary);
}

.channel-name {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.video-frame {
  position: relative;
  min-height: 240px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}

.player-container {
  width: 100%;
  height: 100%;
}

.video-error {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 85%);
}
</style>
