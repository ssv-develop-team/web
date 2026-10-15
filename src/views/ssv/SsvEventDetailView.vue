<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { fetchSsvEventDetail } from '@/api/ssv'
import {
  formatSsvConfidence,
  formatSsvTimestamp,
  ssvEvidenceStatusLabel,
  ssvSeverityTagType,
  ssvStatusLabel,
  ssvStatusTagType,
  ssvVerdictLabel,
} from '@/api/ssvPresentation'
import type {
  SsvEventDetail,
  SsvEvidenceRecord,
  SsvReviewRevision,
} from '@/api/types/ssv'
import SsvEvidenceImage from '@/components/SsvEvidenceImage.vue'
import SsvAnalysisTask from '@/components/SsvAnalysisTask.vue'

import {
  eventReviews as getEventReviews,
  registeredImageEvidence,
  resolveReviewEvidence,
  selectCurrentReview,
  type EvidenceReferenceState,
} from './detailState'
import { eventListQuery, parseEventListState } from './listState'

const route = useRoute()
const eventId = computed(() => String(route.params.eventId ?? ''))
const detail = ref<SsvEventDetail | null>(null)
const loading = ref(false)
const error = ref('')
const selectedRevision = ref<number | null>(null)
let activeRequest: AbortController | null = null

const backQuery = computed(() => eventListQuery(parseEventListState(route.query)))

const eventReviews = computed(() => {
  return detail.value ? getEventReviews(detail.value) : []
})

const selectedReview = computed<SsvReviewRevision | null>(() => {
  if (!detail.value || selectedRevision.value === null) return null
  return (
    eventReviews.value.find((review) => review.revision === selectedRevision.value) ?? null
  )
})

const currentRevisionUnmatched = computed(() => {
  if (!detail.value || detail.value.event.current_revision === null) return false
  return !eventReviews.value.some(
    (review) => review.revision === detail.value?.event.current_revision,
  )
})

const imageEvidence = computed(() => {
  return detail.value ? registeredImageEvidence(detail.value) : []
})

const resolvedReferences = computed(() => {
  const currentDetail = detail.value
  const review = selectedReview.value
  return currentDetail ? resolveReviewEvidence(currentDetail, review) : []
})

async function loadDetail() {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  loading.value = true
  error.value = ''
  detail.value = null
  selectedRevision.value = null

  try {
    const response = await fetchSsvEventDetail(eventId.value, controller.signal)
    if (controller.signal.aborted || activeRequest !== controller) return
    detail.value = response
    selectedRevision.value = selectCurrentReview(response)?.revision ?? null
  } catch (cause) {
    if (controller.signal.aborted || activeRequest !== controller) return
    if (cause instanceof Error && cause.name === 'AbortError') return
    error.value = cause instanceof Error ? cause.message : '暂时无法读取事件详情'
  } finally {
    if (activeRequest === controller) {
      activeRequest = null
      loading.value = false
    }
  }
}

function selectRevision(review: SsvReviewRevision) {
  if (!detail.value || review.event_id !== detail.value.event.event_id) return
  selectedRevision.value = review.revision
}

function referenceStateLabel(state: EvidenceReferenceState): string {
  switch (state) {
    case 'available':
      return '可用图片'
    case 'unavailable':
      return '已登记但不可用'
    case 'unsupported':
      return '视频暂不展示'
    default:
      return '未登记'
  }
}

function referenceTagType(
  state: EvidenceReferenceState,
): 'success' | 'warning' | 'info' | 'danger' {
  switch (state) {
    case 'available':
      return 'success'
    case 'unavailable':
      return 'warning'
    case 'unsupported':
      return 'info'
    default:
      return 'danger'
  }
}

function evidenceDescription(record: SsvEvidenceRecord | null): string {
  if (!record) return '服务端未返回匹配的登记记录'
  return [record.mime_type ?? 'MIME 类型未提供', record.coverage ?? '覆盖范围未提供'].join(' · ')
}

watch(eventId, () => {
  void loadDetail()
}, { immediate: true })

onBeforeUnmount(() => {
  activeRequest?.abort()
  activeRequest = null
  detail.value = null
  selectedRevision.value = null
  error.value = ''
})
</script>

<template>
  <div class="ssv-detail-page">
    <div class="detail-toolbar">
      <RouterLink :to="{ name: 'ssv-events', query: backQuery }">← 返回事件列表</RouterLink>
      <code>事件详情 / {{ eventId }}</code>
    </div>

    <div v-if="loading" class="detail-state">
      <span class="loading-dot" aria-hidden="true"></span>
      <strong>正在读取事件详情</strong>
      <span>事件、分析修订和登记证据按稳定 ID 关联。</span>
    </div>
    <el-result v-else-if="error" icon="error" title="事件详情暂不可用" :sub-title="error">
      <template #extra>
        <el-button type="primary" @click="loadDetail">重试</el-button>
      </template>
    </el-result>
    <template v-else-if="detail">
      <el-card shadow="never" class="summary-card">
        <div class="summary-heading">
          <div>
            <div class="summary-eyebrow">
              <el-tag size="small" :type="ssvSeverityTagType(detail.event.severity)">
                {{ detail.event.severity || '未标记' }}
              </el-tag>
              <span>{{ detail.event.source }}</span>
            </div>
            <h1>{{ detail.event.event_type || '事件类型未提供' }}</h1>
          </div>
          <div class="summary-status">
            <el-tag :type="ssvStatusTagType(detail.event.status)">
              {{ ssvStatusLabel(detail.event.status) }}
            </el-tag>
            <code>{{ detail.event.event_id }}</code>
          </div>
        </div>
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="发生时间">
            {{ formatSsvTimestamp(detail.event.timestamp_ms) }}
          </el-descriptions-item>
          <el-descriptions-item label="WVP 通道">
            <span v-if="detail.event.channel_id">{{ detail.event.channel_id }}</span>
            <span v-else class="unmapped">未关联通道</span>
          </el-descriptions-item>
          <el-descriptions-item label="当前判定">
            {{ ssvVerdictLabel(detail.event.verdict) }}
            <span class="muted">· 置信度 {{ formatSsvConfidence(detail.event.confidence) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="持久分析任务">
            <SsvAnalysisTask :task="detail.event.analysis_task" />
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <div class="detail-grid">
        <main class="detail-main">
          <el-card shadow="never" class="section-card">
            <template #header>
              <div class="section-heading">
                <div>
                  <strong>分析结论</strong>
                  <span>按 event_id + revision 精确匹配当前修订</span>
                </div>
                <span v-if="selectedReview" class="muted">
                  置信度 {{ formatSsvConfidence(selectedReview.confidence) }}
                </span>
              </div>
            </template>
            <el-alert
              v-if="currentRevisionUnmatched"
              type="warning"
              title="当前修订未匹配"
              :description="`当前 R${detail.event.current_revision} 没有属于此事件的登记修订，可手动选择历史修订。`"
              :closable="false"
              show-icon
              class="revision-warning"
            />
            <el-empty
              v-if="!eventReviews.length"
              :image-size="50"
              description="尚无分析结论修订"
            />
            <template v-else>
              <div class="revision-tabs" aria-label="分析结论修订">
                <el-button
                  v-for="review in eventReviews"
                  :key="`${review.event_id}-${review.revision}`"
                  size="small"
                  :type="selectedRevision === review.revision ? 'primary' : 'default'"
                  @click="selectRevision(review)"
                >
                  R{{ review.revision }}
                  <el-tag v-if="review.revision === detail.event.current_revision" size="small" effect="plain">
                    当前
                  </el-tag>
                </el-button>
              </div>
              <div v-if="selectedReview" class="conclusion-body">
                <div class="conclusion-title">
                  {{ ssvVerdictLabel(selectedReview.verdict) }}
                  <span>修订 R{{ selectedReview.revision }}</span>
                </div>
                <p>{{ selectedReview.explanation || '该修订未提供解释。' }}</p>
                <div class="conclusion-meta">
                  <span>修订时间：{{ formatSsvTimestamp(selectedReview.created_ms) }}</span>
                  <span>证据状态：{{ ssvEvidenceStatusLabel(selectedReview.evidence_status) }}</span>
                </div>
              </div>
              <el-empty
                v-else
                :image-size="50"
                description="尚无可匹配的分析结论修订"
              />
            </template>
          </el-card>

          <el-card shadow="never" class="section-card">
            <template #header>
              <div class="section-heading">
                <div>
                  <strong>本版本引用</strong>
                  <span>只按 event_id + evidence_id 查找登记记录</span>
                </div>
                <span class="muted">{{ selectedReview?.evidence_ids.length ?? 0 }} 个引用</span>
              </div>
            </template>
            <el-empty
              v-if="!selectedReview"
              :image-size="50"
              description="选择一个分析修订以查看证据引用"
            />
            <el-empty
              v-else-if="!resolvedReferences.length"
              :image-size="50"
              description="此修订没有引用证据"
            />
            <el-table v-else :data="resolvedReferences" size="small">
              <el-table-column label="状态" width="140">
                <template #default="{ row }">
                  <el-tag :type="referenceTagType(row.state)" size="small">
                    {{ referenceStateLabel(row.state) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="证据 ID" min-width="170">
                <template #default="{ row }"><code>{{ row.evidenceId }}</code></template>
              </el-table-column>
              <el-table-column label="登记信息" min-width="200">
                <template #default="{ row }">{{ evidenceDescription(row.record) }}</template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card shadow="never" class="section-card">
            <template #header>
              <div class="section-heading">
                <div>
                  <strong>登记图片</strong>
                  <span>当前事件全部已登记 frame，切换修订不会过滤图库</span>
                </div>
                <span class="muted">{{ imageEvidence.length }} 张图片</span>
              </div>
            </template>
            <div v-if="imageEvidence.length" class="evidence-grid">
              <SsvEvidenceImage
                v-for="record in imageEvidence"
                :key="`${record.event_id}-${record.evidence_id}`"
                :record="record"
              />
            </div>
            <el-empty v-else :image-size="60" description="没有登记图片" />
          </el-card>
        </main>

        <aside class="detail-side">
          <el-card shadow="never" class="section-card">
            <template #header>
              <div class="section-heading">
                <div>
                  <strong>检测摘要</strong>
                  <span>仅展示 API 返回字段，不从图片推断</span>
                </div>
              </div>
            </template>
            <el-empty
              v-if="!detail.detections.length"
              :image-size="50"
              description="事件未提供检测摘要"
            />
            <el-table v-else :data="detail.detections" size="small">
              <el-table-column label="类别" min-width="120">
                <template #default="{ row }">
                  {{ row.class_name }} <span class="muted">ID {{ row.class_id }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="track_id" label="轨迹" width="70" />
              <el-table-column label="置信度" width="90">
                <template #default="{ row }">{{ formatSsvConfidence(row.confidence) }}</template>
              </el-table-column>
              <el-table-column label="状态" min-width="110">
                <template #default="{ row }">
                  {{ row.track_state ?? '未提供' }} · {{ row.occluded ? '遮挡' : '未遮挡' }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>

        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ssv-detail-page {
  display: grid;
  gap: 14px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-toolbar a {
  color: var(--el-color-primary);
}

.detail-toolbar code {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-state {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
}

.loading-dot {
  width: 18px;
  height: 18px;
  border: 2px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: ssv-spin 0.8s linear infinite;
}

@keyframes ssv-spin {
  to {
    transform: rotate(360deg);
  }
}

.summary-card,
.section-card {
  min-width: 0;
}

.summary-heading,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.summary-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.summary-heading h1 {
  margin: 10px 0 18px;
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.summary-status {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.summary-status code,
.section-heading span,
.muted,
.conclusion-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.unmapped {
  color: var(--el-color-warning);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.48fr);
  align-items: start;
  gap: 14px;
}

.detail-main,
.detail-side {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.section-heading > div {
  display: grid;
  gap: 4px;
}

.section-heading strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.revision-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.revision-warning {
  margin-bottom: 16px;
}

.conclusion-body {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

.conclusion-title {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.conclusion-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}

.conclusion-body p {
  margin: 10px 0;
  color: var(--el-text-color-primary);
  line-height: 1.7;
  white-space: pre-wrap;
}

.conclusion-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1000px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .summary-heading,
  .detail-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-status {
    justify-items: start;
  }

  .summary-heading h1 {
    margin-bottom: 14px;
  }

  .evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>
