<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { PersonBox } from '@/api/ai'
import { createJessibucaPlayer } from '@/player'

const props = withDefaults(
  defineProps<{
    url: string
    boxes?: PersonBox[]
    /** 已知视频宽高;播放器解析出 videoInfo 后自动覆盖 */
    videoWidth?: number | null
    videoHeight?: number | null
    /** 换流时传入新值,让播放器切换地址 */
    streamKey?: string | number
    hasAudio?: boolean
  }>(),
  {
    boxes: () => [],
    videoWidth: null,
    videoHeight: null,
    streamKey: 0,
    hasAudio: true,
  },
)

const containerRef = ref<HTMLDivElement>()
const playerError = ref('')
const videoSize = ref<{ width: number; height: number } | null>(null)
const renderRect = ref({ left: 0, top: 0, width: 0, height: 0 })

let player: ReturnType<typeof createJessibucaPlayer> | null = null
let resizeObserver: ResizeObserver | null = null

const videoWidth = computed(() => props.videoWidth ?? videoSize.value?.width ?? 0)
const videoHeight = computed(() => props.videoHeight ?? videoSize.value?.height ?? 0)

interface ProjectedBox {
  left: number
  top: number
  width: number
  height: number
  confidence?: number
}

const projectedBoxes = computed<ProjectedBox[]>(() => {
  const vw = videoWidth.value
  const vh = videoHeight.value
  if (!vw || !vh || renderRect.value.width <= 0) return []
  return props.boxes.map((box) => ({
    left:
      renderRect.value.left +
      (Math.min(box.x1, box.x2) / vw) * renderRect.value.width,
    top:
      renderRect.value.top +
      (Math.min(box.y1, box.y2) / vh) * renderRect.value.height,
    width: (Math.abs(box.x2 - box.x1) / vw) * renderRect.value.width,
    height: (Math.abs(box.y2 - box.y1) / vh) * renderRect.value.height,
    confidence: box.confidence,
  }))
})

function updateRenderRect() {
  const shell = containerRef.value
  if (!shell) return
  const media = shell.querySelector('canvas, video') as HTMLElement | null
  const rect = (media ?? shell).getBoundingClientRect()
  const vw = videoWidth.value
  const vh = videoHeight.value
  if (!vw || !vh || rect.width <= 0 || rect.height <= 0) {
    renderRect.value = { left: 0, top: 0, width: 0, height: 0 }
    return
  }
  const scale = Math.min(rect.width / vw, rect.height / vh)
  const width = vw * scale
  const height = vh * scale
  renderRect.value = {
    left: (rect.width - width) / 2,
    top: (rect.height - height) / 2,
    width,
    height,
  }
}

async function syncRenderRect() {
  await nextTick()
  updateRenderRect()
}

async function playCurrentUrl() {
  if (!player) return
  if (!props.url) {
    try {
      await player.pause()
    } catch {
      /* 未开始播放时忽略 */
    }
    playerError.value = ''
    await syncRenderRect()
    return
  }
  try {
    playerError.value = ''
    await player.play(props.url)
    await syncRenderRect()
  } catch (err) {
    playerError.value = err instanceof Error ? err.message : '播放失败'
  }
}

onMounted(async () => {
  if (!window.Jessibuca) {
    playerError.value = 'Jessibuca 资源未加载'
    return
  }
  updateRenderRect()
  if (window.ResizeObserver && containerRef.value) {
    resizeObserver = new ResizeObserver(updateRenderRect)
    resizeObserver.observe(containerRef.value)
  }
  player = createJessibucaPlayer({
    container: containerRef.value!,
    hasAudio: props.hasAudio,
  })
  player.on('videoInfo', (info) => {
    videoSize.value = info
    void syncRenderRect()
  })
  player.on('error', () => {
    playerError.value = '播放出错,请查看设备与媒体节点状态'
  })
  await playCurrentUrl()
})

watch(
  [() => props.url, () => props.streamKey],
  () => {
    void playCurrentUrl()
  },
)

watch([videoWidth, videoHeight], () => {
  void syncRenderRect()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  try {
    player?.destroy()
  } catch {
    /* 播放器已销毁时忽略 */
  }
  player = null
})
</script>

<template>
  <div ref="containerRef" class="player-shell">
    <div v-if="!url" class="placeholder">选择通道后开始监控</div>
    <div v-else-if="playerError" class="placeholder error">{{ playerError }}</div>
    <div class="overlay-layer">
      <div
        v-for="(box, index) in projectedBoxes"
        :key="index"
        class="overlay-box"
        :style="{
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
        }"
      >
        <span class="overlay-label">
          person{{
            box.confidence != null
              ? ` ${Math.round(box.confidence * 100)}%`
              : ''
          }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: #000;
  overflow: hidden;
}

.overlay-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.overlay-box {
  position: absolute;
  border: 2px solid rgba(248, 113, 113, 0.95);
  background: rgba(248, 113, 113, 0.08);
}

.overlay-label {
  position: absolute;
  left: 0;
  top: -24px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.95);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  z-index: 1;
}

.placeholder.error {
  color: #fca5a5;
}
</style>
