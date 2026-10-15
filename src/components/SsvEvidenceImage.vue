<script setup lang="ts">
import { ref, watch } from 'vue'

import { ssvEvidenceImageUrl } from '@/api/ssv'
import { formatSsvSize } from '@/api/ssvPresentation'
import type { SsvEvidenceRecord } from '@/api/types/ssv'

const props = defineProps<{ record: SsvEvidenceRecord }>()
const loadError = ref(false)

function resetError() {
  loadError.value = false
}

watch(() => [props.record.event_id, props.record.evidence_id, props.record.status], resetError)
</script>

<template>
  <el-card shadow="never" class="evidence-card">
    <template #header>
      <div class="evidence-header">
        <div>
          <strong>登记图片</strong>
          <span>{{ record.mime_type ?? '图片类型未提供' }} · {{ formatSsvSize(record.size) }}</span>
        </div>
        <el-tag size="small" type="info">事件帧</el-tag>
      </div>
    </template>

    <div v-if="record.status === 'unavailable'" class="evidence-placeholder">
      <strong>图片不可用</strong>
      <span>服务端已登记该证据，但当前无法读取图片内容。</span>
    </div>
    <div v-else-if="loadError" class="evidence-placeholder evidence-placeholder--error">
      <strong>图片读取失败</strong>
      <span>登记信息存在，图片接口未能返回可显示的内容。</span>
    </div>
    <div v-else class="evidence-image-wrap">
      <img
        :src="ssvEvidenceImageUrl(record.event_id, record.evidence_id)"
        :alt="`登记图片（${record.evidence_id}）`"
        loading="lazy"
        @error="loadError = true"
      />
    </div>

    <div class="evidence-footer">
      <code>{{ record.evidence_id }}</code>
      <span>{{ record.coverage ?? '覆盖范围未提供' }}</span>
    </div>
  </el-card>
</template>

<style scoped>
.evidence-card {
  min-width: 0;
}

.evidence-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.evidence-header > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.evidence-header strong {
  color: var(--el-text-color-primary);
}

.evidence-header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.evidence-image-wrap {
  min-height: 140px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
}

.evidence-image-wrap img {
  display: block;
  width: 100%;
  height: auto;
}

.evidence-placeholder {
  min-height: 140px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-light);
}

.evidence-placeholder strong {
  color: var(--el-text-color-primary);
}

.evidence-placeholder--error strong {
  color: var(--el-color-danger);
}

.evidence-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.evidence-footer code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
