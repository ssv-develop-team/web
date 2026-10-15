<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import { querySsvWvpChannelDirectory, type SsvWvpChannelOption } from '@/api/ssvChannelDirectory'
import { fetchSsvEvents, type SsvEventListParams } from '@/api/ssv'
import {
  formatSsvConfidence,
  formatSsvTimestamp,
  ssvSeverityTagType,
  ssvStatusLabel,
  ssvStatusTagType,
  ssvVerdictLabel,
} from '@/api/ssvPresentation'
import type { SsvEventListResponse, SsvEventSummary } from '@/api/types/ssv'
import SsvAnalysisTask from '@/components/SsvAnalysisTask.vue'

import { eventListQuery, parseEventListState } from './listState'

const route = useRoute()
const router = useRouter()

const page = ref(1)
const pageSize = ref(20)
const searchInput = ref('')
const appliedQuery = ref('')
const statusFilter = ref('')
const channelFilter = ref('')
const result = ref<SsvEventListResponse | null>(null)
const loading = ref(false)
const error = ref('')
const channels = ref<SsvWvpChannelOption[]>([])
const channelsLoading = ref(false)
const channelsError = ref('')

let activeRequest: AbortController | null = null
let channelRequest: AbortController | null = null

const firstVisible = computed(() =>
  result.value?.total ? (page.value - 1) * pageSize.value + 1 : 0,
)

const lastVisible = computed(() => Math.min(page.value * pageSize.value, result.value?.total ?? 0))

const channelById = computed(
  () => new Map(channels.value.map((channel) => [channel.gbDeviceId, channel])),
)

function syncFromRoute() {
  const state = parseEventListState(route.query)
  page.value = state.page
  pageSize.value = state.pageSize
  appliedQuery.value = state.query
  searchInput.value = appliedQuery.value
  statusFilter.value = state.status
  channelFilter.value = state.channelId
}

function listQuery(overrides: Partial<SsvEventListParams> = {}) {
  return eventListQuery({
    page: page.value,
    pageSize: pageSize.value,
    query: appliedQuery.value,
    status: statusFilter.value,
    channelId: channelFilter.value,
    ...overrides,
  })
}

async function updateRouteAndLoad(next: LocationQueryRaw) {
  if (router.resolve({ name: 'ssv-events', query: next }).fullPath === route.fullPath) {
    await loadEvents()
    return
  }
  await router.replace({ name: 'ssv-events', query: next })
}

async function loadEvents() {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  loading.value = true
  error.value = ''
  result.value = null

  const params: SsvEventListParams = {
    page: page.value,
    pageSize: pageSize.value,
    query: appliedQuery.value,
    status: statusFilter.value,
    channelId: channelFilter.value,
  }
  try {
    const response = await fetchSsvEvents(params, controller.signal)
    if (controller.signal.aborted || activeRequest !== controller) return
    result.value = response
  } catch (cause) {
    if (controller.signal.aborted || activeRequest !== controller) return
    if (cause instanceof Error && cause.name === 'AbortError') return
    result.value = null
    error.value = cause instanceof Error ? cause.message : '暂时无法读取 SSV 事件列表'
  } finally {
    if (activeRequest === controller) {
      loading.value = false
      activeRequest = null
    }
  }
}

async function loadChannels() {
  channelRequest?.abort()
  const controller = new AbortController()
  channelRequest = controller
  channelsLoading.value = true
  channelsError.value = ''
  try {
    const all = await querySsvWvpChannelDirectory(controller.signal)
    if (controller.signal.aborted || channelRequest !== controller) return
    channels.value = all
  } catch (cause) {
    if (controller.signal.aborted || channelRequest !== controller) return
    channelsError.value = cause instanceof Error ? cause.message : 'WVP 通道目录加载失败'
  } finally {
    if (channelRequest === controller) {
      channelsLoading.value = false
      channelRequest = null
    }
  }
}

function channelLabel(channelId: string | null): string {
  if (!channelId) return '未关联通道'
  const channel = channelById.value.get(channelId)
  if (!channel) return `已关联通道 · ${channelId}`
  return `${channel.gbName || '未命名通道'} · ${channelId}`
}

function search() {
  void updateRouteAndLoad(listQuery({ page: 1, query: searchInput.value.trim() }))
}

function changeStatus() {
  void updateRouteAndLoad(listQuery({ page: 1, status: statusFilter.value }))
}

function changeChannel() {
  void updateRouteAndLoad(listQuery({ page: 1, channelId: channelFilter.value }))
}

function changePage(nextPage: number) {
  void updateRouteAndLoad(listQuery({ page: nextPage }))
}

function changePageSize(nextPageSize: number) {
  void updateRouteAndLoad(listQuery({ page: 1, pageSize: nextPageSize }))
}

function detailQuery() {
  return listQuery()
}

watch(
  () => route.query,
  () => {
    syncFromRoute()
    void loadEvents()
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  void loadChannels()
})

onBeforeUnmount(() => {
  activeRequest?.abort()
  channelRequest?.abort()
  activeRequest = null
  channelRequest = null
  result.value = null
  error.value = ''
})
</script>

<template>
  <div class="ssv-page">
    <div class="page-header">
      <div>
        <h1>SSV 事件</h1>
        <p>浏览 SSV Agent 持久化的事件、分析结论与任务状态。</p>
      </div>
      <el-tag type="info" effect="plain">只读事件账本</el-tag>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent="search">
        <el-form-item label="文本查询">
          <el-input
            v-model="searchInput"
            clearable
            placeholder="事件 ID、来源或类型"
            @keyup.enter="search"
            @clear="search"
          />
        </el-form-item>
        <el-form-item label="事件状态">
          <el-select v-model="statusFilter" clearable placeholder="全部状态" @change="changeStatus">
            <el-option label="待处理" value="pending" />
            <el-option label="需人工复核" value="manual_review" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="WVP 通道">
          <el-select
            v-model="channelFilter"
            clearable
            filterable
            :loading="channelsLoading"
            placeholder="全部通道"
            @change="changeChannel"
          >
            <el-option
              v-for="channel in channels"
              :key="channel.gbDeviceId"
              :label="`${channel.gbName || '未命名通道'} · ${channel.gbDeviceId}`"
              :value="channel.gbDeviceId"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">查询</el-button>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="channelsError"
        class="channel-alert"
        type="warning"
        :closable="false"
        show-icon
        :title="`WVP 通道目录暂不可用：${channelsError}`"
      >
        <el-button link type="primary" @click="loadChannels">重试通道目录</el-button>
      </el-alert>
    </el-card>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-heading">
          <div>
            <strong>事件列表</strong>
            <span>服务端按发生时间倒序返回</span>
          </div>
          <span v-if="result">共 {{ result.total }} 条</span>
        </div>
      </template>

      <div v-if="loading" class="state-panel">
        <span class="loading-dot" aria-hidden="true"></span>
        <span>正在读取事件列表</span>
      </div>
      <el-result v-else-if="error" icon="error" title="事件列表暂不可用" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="loadEvents">重试</el-button>
        </template>
      </el-result>
      <el-empty v-else-if="!result?.items.length" description="没有匹配的事件" />
      <el-table v-else :data="result.items" stripe>
        <el-table-column label="事件" min-width="220">
          <template #default="{ row }: { row: SsvEventSummary }">
            <div class="event-cell">
              <el-tag size="small" :type="ssvSeverityTagType(row.severity)">
                {{ row.severity || '未标记' }}
              </el-tag>
              <div>
                <RouterLink
                  class="event-link"
                  :to="{
                    name: 'ssv-event-detail',
                    params: { eventId: row.event_id },
                    query: detailQuery(),
                  }"
                >
                  {{ row.event_type || '事件类型未提供' }}
                </RouterLink>
                <code>{{ row.event_id }}</code>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatSsvTimestamp(row.timestamp_ms) }}</template>
        </el-table-column>
        <el-table-column label="来源 / 通道" min-width="220">
          <template #default="{ row }">
            <div class="source-cell">
              <strong>{{ row.source }}</strong>
              <span :class="{ 'unmapped-channel': !row.channel_id }">{{
                channelLabel(row.channel_id)
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工作流状态" min-width="120">
          <template #default="{ row }">
            <el-tag :type="ssvStatusTagType(row.status)">{{ ssvStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分析结论" min-width="160">
          <template #default="{ row }">
            <div class="verdict-cell">
              <span>{{ ssvVerdictLabel(row.verdict) }}</span>
              <small>置信度 {{ formatSsvConfidence(row.confidence) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="持久分析任务" min-width="160">
          <template #default="{ row }">
            <SsvAnalysisTask :task="row.analysis_task" />
          </template>
        </el-table-column>
        <el-table-column label="修订" width="80">
          <template #default="{ row }">{{
            row.current_revision === null ? '—' : `R${row.current_revision}`
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <RouterLink
              :to="{
                name: 'ssv-event-detail',
                params: { eventId: row.event_id },
                query: detailQuery(),
              }"
              >查看详情</RouterLink
            >
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && !error && result?.total" class="table-footer">
        <span>显示 {{ firstVisible }}–{{ lastVisible }} 条，共 {{ result.total }} 条</span>
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[...new Set([10, 20, 50, 100, pageSize])].sort((a, b) => a - b)"
          :total="result.total"
          layout="sizes, prev, pager, next"
          background
          @current-change="changePage"
          @size-change="changePageSize"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.ssv-page {
  display: grid;
  gap: 14px;
}

.page-header,
.table-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 22px;
}

.page-header p,
.table-heading span {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.filter-card :deep(.el-form) {
  margin-bottom: -18px;
}

.channel-alert {
  margin-top: 4px;
}

.table-heading > div {
  display: grid;
  gap: 3px;
}

.state-panel {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--el-text-color-secondary);
}

.loading-dot {
  width: 16px;
  height: 16px;
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

.event-cell,
.source-cell,
.verdict-cell,
.task-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.event-cell {
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
}

.event-cell > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.event-link {
  color: var(--el-color-primary);
  font-weight: 600;
}

.event-cell code,
.source-cell span,
.verdict-cell small,
.task-cell small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.event-cell code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-cell strong {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.unmapped-channel {
  color: var(--el-color-warning) !important;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .page-header,
  .table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
