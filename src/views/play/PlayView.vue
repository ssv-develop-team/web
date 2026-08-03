<script setup lang="ts">
import axios from 'axios'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { startPlay, stopPlay } from '@/api/play'
import { createJessibucaPlayer } from '@/player'
import { selectFlvUrl } from '@/player/stream'

const route = useRoute()
const router = useRouter()
const deviceId = String(route.params.deviceId)
const channelId = String(route.params.channelId)

const containerRef = ref<HTMLDivElement>()
const loading = ref(true)
const error = ref('')
let player: ReturnType<typeof createJessibucaPlayer> | null = null
let stopped = false

onMounted(async () => {
  try {
    const sc = await startPlay(deviceId, channelId)
    const url = selectFlvUrl(sc)
    if (!url) {
      throw new Error('媒体节点未开启 ws-flv 播放协议')
    }
    player = createJessibucaPlayer({ container: containerRef.value! })
    player.on('error', () => {
      error.value = '播放出错,请查看设备与媒体节点状态'
    })
    await player.play(url)
    error.value = ''
  } catch (err) {
    error.value =
      axios.isAxiosError(err) && err.code === 'ECONNABORTED'
        ? '点播超时:设备无响应,请确认设备在线'
        : err instanceof Error
          ? err.message
          : '点播失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
})

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
  void stopPlay(deviceId, channelId)
}

function stopAndBack() {
  stop()
  router.push({ name: 'device-channels', params: { deviceId } })
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="play-page">
    <div class="toolbar">
      <el-button @click="router.push({ name: 'device-channels', params: { deviceId } })">
        返回
      </el-button>
      <span class="title">{{ deviceId }} / {{ channelId }}</span>
      <el-button type="danger" @click="stopAndBack">停止并退出</el-button>
    </div>
    <div v-loading="loading" class="player-wrap">
      <div ref="containerRef" class="player" />
      <el-empty v-if="error && !loading" :description="error" class="overlay" />
    </div>
  </div>
</template>

<style scoped>
.play-page {
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
</style>
