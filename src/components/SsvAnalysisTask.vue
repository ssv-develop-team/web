<script setup lang="ts">
import { computed } from 'vue'

import { ssvTaskStateLabel, ssvTaskTagType } from '@/api/ssvPresentation'
import type { AnalysisTask } from '@/api/types/ssv'

const props = defineProps<{ task: AnalysisTask }>()
const kindLabel = computed(() => {
  if (props.task.kind === 'review') return '复核任务'
  if (props.task.kind === 'evidence_extract') return '取证任务'
  return '未安排任务'
})

const description = computed(() => {
  switch (props.task.state) {
    case 'waiting':
      return '任务尚未到可领取时间，可能在等待取证窗口或重试退避。'
    case 'queued':
      return '任务已到可领取时间，等待领取。'
    case 'processing':
      return '任务记录持有未过期租约，不保证线程此刻正在运行。'
    case 'lease_expired':
      return '任务记录的处理租约已过期。'
    case 'completed':
      return '任务结果已持久化。'
    case 'failed':
      return '持久任务已失败。'
    default:
      return '账本中未安排匹配的任务。'
  }
})
</script>

<template>
  <div class="analysis-task">
    <el-tooltip :content="description" placement="top">
      <el-tag size="small" :type="ssvTaskTagType(task.state)">
        {{ ssvTaskStateLabel(task.state) }}
      </el-tag>
    </el-tooltip>
    <small>{{ kindLabel }}</small>
  </div>
</template>

<style scoped>
.analysis-task {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.analysis-task small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
