<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { ptzControl, type PtzCommand } from '@/api/ptz'

const props = defineProps<{
  deviceId: string
  channelId: string
}>()

const speed = ref(50)
/** 防重复: 同一交互周期内只发一次方向命令,松开再发 stop(04 §4.5) */
const pressing = ref(false)

async function send(command: PtzCommand) {
  try {
    // speed 映射水平/垂直速度;zoomSpeed 固定 5(0-15,基线默认 16 会触发后端校验错误)
    await ptzControl(props.deviceId, props.channelId, command, speed.value, speed.value)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '云台控制失败')
  }
}

function start(command: PtzCommand) {
  if (pressing.value) return
  pressing.value = true
  void send(command)
}

/** 松开/失焦/销毁时必须发 stop,否则设备持续转动 */
function stop() {
  if (!pressing.value) return
  pressing.value = false
  void send('stop')
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="ptz-panel">
    <div class="grid">
      <button class="cell" title="左上" @pointerdown="start('upleft')" @pointerup="stop" @pointerleave="stop" @blur="stop">↖</button>
      <button class="cell" title="上" @pointerdown="start('up')" @pointerup="stop" @pointerleave="stop" @blur="stop">↑</button>
      <button class="cell" title="右上" @pointerdown="start('upright')" @pointerup="stop" @pointerleave="stop" @blur="stop">↗</button>
      <button class="cell" title="左" @pointerdown="start('left')" @pointerup="stop" @pointerleave="stop" @blur="stop">←</button>
      <button class="cell stop" title="停止" @click="stop">■</button>
      <button class="cell" title="右" @pointerdown="start('right')" @pointerup="stop" @pointerleave="stop" @blur="stop">→</button>
      <button class="cell" title="左下" @pointerdown="start('downleft')" @pointerup="stop" @pointerleave="stop" @blur="stop">↙</button>
      <button class="cell" title="下" @pointerdown="start('down')" @pointerup="stop" @pointerleave="stop" @blur="stop">↓</button>
      <button class="cell" title="右下" @pointerdown="start('downright')" @pointerup="stop" @pointerleave="stop" @blur="stop">↘</button>
    </div>
    <div class="zoom">
      <el-button title="放大" @pointerdown="start('zoomin')" @pointerup="stop" @pointerleave="stop" @blur="stop">＋</el-button>
      <el-button title="缩小" @pointerdown="start('zoomout')" @pointerup="stop" @pointerleave="stop" @blur="stop">－</el-button>
    </div>
    <div class="speed">
      <span class="label">速度</span>
      <el-slider v-model="speed" :min="0" :max="100" />
    </div>
  </div>
</template>

<style scoped>
.ptz-panel {
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 56px);
  gap: 4px;
  justify-content: center;
}

.cell {
  height: 44px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  font-size: 16px;
  user-select: none;
}

.cell:active {
  background: var(--el-color-primary-light-7);
}

.cell.stop {
  color: var(--el-color-danger);
}

.zoom {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.zoom .el-button {
  width: 56px;
}

.speed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
