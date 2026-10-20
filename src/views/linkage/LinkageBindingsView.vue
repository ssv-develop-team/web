<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

import { queryChannels, queryDevices } from '@/api/device'
import {
  getLinkageGatewayApiBaseURL,
  listLinkageBindings,
  listLinkagePoints,
  replaceLinkageBindings,
  type LinkageBinding,
  type LinkageBindingInput,
  type LinkagePoint,
} from '@/api/linkageGateway'
import type { QueryPageParams } from '@/api/device'
import type { Device, DeviceChannel } from '@/api/types/wvp'
import { getWvpChannelId } from '@/api/types/wvp'

interface BindingFormRow {
  key: number
  deviceId: string
  channelId: string
  name: string
  enabled: boolean
}

interface DeviceOption {
  deviceId: string
  name?: string
  onLine?: boolean
}

const loading = ref(false)
const loadingDevices = ref(false)
const saving = ref(false)
const loadError = ref('')
const points = ref<LinkagePoint[]>([])
const bindings = ref<LinkageBinding[]>([])
const devices = ref<Device[]>([])
const devicesLoaded = ref(false)
const channelsByDevice = ref<Record<string, DeviceChannel[]>>({})
const loadingChannels = ref<Record<string, boolean>>({})
const searchText = ref('')
const page = ref(1)
const pageSize = ref(10)
const editorVisible = ref(false)
const selectedPoint = ref<LinkagePoint | null>(null)
const editRows = ref<BindingFormRow[]>([])
let nextRowKey = 1

const visiblePoints = computed(() => {
  const query = searchText.value.trim().toLocaleLowerCase()
  if (!query) return points.value
  return points.value.filter((point) =>
    [point.pointKey, point.deviceName, point.deviceType, point.physicalId]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(query)),
  )
})

const pagePoints = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return visiblePoints.value.slice(start, start + pageSize.value)
})

const bindingsByPoint = computed(() => {
  const result = new Map<string, LinkageBinding[]>()
  for (const binding of bindings.value) {
    const pointBindings = result.get(binding.pointKey) ?? []
    pointBindings.push(binding)
    result.set(binding.pointKey, pointBindings)
  }
  return result
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [pointList, bindingList] = await Promise.all([listLinkagePoints(), listLinkageBindings()])
    points.value = pointList
    bindings.value = bindingList
    if (page.value > Math.max(1, Math.ceil(visiblePoints.value.length / pageSize.value))) {
      page.value = 1
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '读取联动配置失败'
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
}

function pointBindings(pointKey: string): LinkageBinding[] {
  return bindingsByPoint.value.get(pointKey) ?? []
}

function newBindingRow(binding?: LinkageBinding): BindingFormRow {
  return {
    key: nextRowKey++,
    deviceId: binding?.deviceId ?? '',
    channelId: binding?.channelId ?? '',
    name: binding?.name ?? '',
    enabled: binding?.enabled ?? true,
  }
}

async function openEditor(point: LinkagePoint) {
  selectedPoint.value = point
  const currentBindings = pointBindings(point.pointKey)
  editRows.value = currentBindings.length
    ? currentBindings.map((binding) => newBindingRow(binding))
    : [newBindingRow()]
  editorVisible.value = true

  try {
    await loadDevices()
    await Promise.all(
      editRows.value
        .map((row) => row.deviceId)
        .filter(Boolean)
        .map((deviceId) => loadChannels(deviceId)),
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取 WVP 设备失败')
  }
}

async function loadDevices() {
  if (devicesLoaded.value) return
  loadingDevices.value = true
  try {
    devices.value = await loadAllPages((params) => queryDevices(params), 100)
    devicesLoaded.value = true
  } finally {
    loadingDevices.value = false
  }
}

async function loadChannels(deviceId: string) {
  if (!deviceId || channelsByDevice.value[deviceId]) return
  loadingChannels.value = { ...loadingChannels.value, [deviceId]: true }
  try {
    const channelList = await loadAllPages((params) => queryChannels(deviceId, params), 100)
    channelsByDevice.value = {
      ...channelsByDevice.value,
      [deviceId]: channelList.filter(
        (channel) => channel.channelType === 0 && getWvpChannelId(channel),
      ),
    }
  } finally {
    loadingChannels.value = { ...loadingChannels.value, [deviceId]: false }
  }
}

async function loadAllPages<T>(
  fetchPage: (params: QueryPageParams) => Promise<{ list: T[]; total: number }>,
  count: number,
): Promise<T[]> {
  const result: T[] = []
  let pageNumber = 1
  let total = Number.POSITIVE_INFINITY
  while (result.length < total) {
    const response = await fetchPage({ page: pageNumber, count })
    result.push(...response.list)
    total = response.total
    if (response.list.length === 0) break
    pageNumber += 1
  }
  return result
}

function deviceOptions(row: BindingFormRow): DeviceOption[] {
  if (!row.deviceId || devices.value.some((device) => device.deviceId === row.deviceId)) {
    return devices.value
  }
  return [...devices.value, { deviceId: row.deviceId, name: '（现有绑定，WVP 当前未返回）' }]
}

function deviceLabel(device: DeviceOption): string {
  const state = device.onLine === true ? '在线' : device.onLine === false ? '离线' : '状态未知'
  return `${device.name || device.deviceId} · ${device.deviceId} · ${state}`
}

function channelOptions(deviceId: string): DeviceChannel[] {
  return channelsByDevice.value[deviceId] ?? []
}

function channelId(channel: DeviceChannel): string {
  return getWvpChannelId(channel) ?? ''
}

function hasChannelOption(row: BindingFormRow): boolean {
  return channelOptions(row.deviceId).some((channel) => channelId(channel) === row.channelId)
}

async function changeDevice(row: BindingFormRow, deviceId: string) {
  row.deviceId = deviceId
  row.channelId = ''
  row.name = ''
  try {
    await loadChannels(deviceId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取 WVP 通道失败')
  }
}

function changeChannel(row: BindingFormRow, selectedChannelId: string) {
  row.channelId = selectedChannelId
  const channel = channelOptions(row.deviceId).find((item) => channelId(item) === selectedChannelId)
  row.name = channel?.name || selectedChannelId
}

function addBinding() {
  editRows.value.push(newBindingRow())
}

function removeBinding(index: number) {
  editRows.value.splice(index, 1)
}

async function saveBindings() {
  const point = selectedPoint.value
  if (!point) return
  const incomplete = editRows.value.some((row) => Boolean(row.deviceId) !== Boolean(row.channelId))
  if (incomplete) {
    ElMessage.warning('请补全每条绑定的设备和通道，或移除未完成的行')
    return
  }

  const payload: LinkageBindingInput[] = editRows.value
    .filter((row) => row.deviceId && row.channelId)
    .map((row, displayOrder) => ({
      deviceId: row.deviceId,
      channelId: row.channelId,
      name: row.name.trim() || row.channelId,
      enabled: row.enabled,
      displayOrder,
    }))
  const bindingKeys = new Set<string>()
  for (const binding of payload) {
    const key = `${binding.deviceId}\u0000${binding.channelId}`
    if (bindingKeys.has(key)) {
      ElMessage.warning('同一设备的同一视频通道不能重复绑定')
      return
    }
    bindingKeys.add(key)
  }

  saving.value = true
  try {
    const savedBindings = await replaceLinkageBindings(point.pointKey, payload)
    bindings.value = [
      ...bindings.value.filter((binding) => binding.pointKey !== point.pointKey),
      ...savedBindings,
    ]
    editorVisible.value = false
    ElMessage.success('视频联动绑定已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存视频联动绑定失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="linkage-bindings-page">
    <div class="page-heading">
      <div>
        <h2>视频联动配置</h2>
        <p>按站序号和监控索引维护点位到 WVP 设备及视频通道的显式绑定。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert
      title="点位索引与 GB28181 编号相互独立；变位触发时，网关按此绑定查找播放通道。"
      type="info"
      :closable="false"
      show-icon
      class="page-alert"
    />
    <el-alert
      v-if="loadError"
      :title="`读取失败：${loadError}`"
      type="error"
      :closable="false"
      show-icon
      class="page-alert"
    />

    <el-form inline class="filter-form" @submit.prevent="search">
      <el-form-item>
        <el-input
          v-model="searchText"
          placeholder="搜索点位索引、设备名称或实物 ID"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item class="gateway-url">网关 API：{{ getLinkageGatewayApiBaseURL() }}</el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="pagePoints" row-key="pointKey" stripe>
      <el-table-column label="点位索引" min-width="130" fixed>
        <template #default="{ row }">
          <strong>{{ row.pointKey }}</strong>
          <div class="secondary">站 {{ row.stationNo }} · 索引 {{ row.monitorIndex }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="deviceName" label="设备 / 点位语义" min-width="240" />
      <el-table-column prop="deviceType" label="类型" width="100" />
      <el-table-column prop="physicalId" label="实物 ID" min-width="130" />
      <el-table-column label="点表标记" width="130">
        <template #default="{ row }">
          <el-tag :type="row.linkageEnabled ? 'success' : 'info'">
            {{ row.linkageEnabled ? '联动信号' : '非联动信号' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="视频通道绑定" min-width="310">
        <template #default="{ row }">
          <div v-if="pointBindings(row.pointKey).length" class="binding-list">
            <div
              v-for="binding in pointBindings(row.pointKey)"
              :key="`${binding.deviceId}:${binding.channelId}`"
              class="binding-item"
            >
              <el-tag size="small" :type="binding.enabled ? 'success' : 'info'">
                {{ binding.enabled ? '启用' : '停用' }}
              </el-tag>
              <span>{{ binding.name || binding.channelId }}</span>
              <small>{{ binding.deviceId }} / {{ binding.channelId }}</small>
            </div>
          </div>
          <el-tag v-else type="warning">未绑定</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditor(row)">编辑绑定</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="尚未收到设备点表上传" />
      </template>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="visiblePoints.length"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="pager"
    />

    <el-dialog
      v-model="editorVisible"
      :title="selectedPoint ? `编辑点位 ${selectedPoint.pointKey} 的视频绑定` : '编辑视频绑定'"
      width="min(94vw, 1000px)"
      destroy-on-close
    >
      <template v-if="selectedPoint">
        <div class="point-summary">
          <strong>{{ selectedPoint.deviceName }}</strong>
          <span>{{ selectedPoint.pointKey }} · {{ selectedPoint.deviceType }}</span>
        </div>
        <el-alert
          v-if="!selectedPoint.linkageEnabled"
          title="当前点表将此点标记为非联动信号，保存绑定后变位仍不会触发视频弹窗。"
          type="warning"
          :closable="false"
          show-icon
          class="page-alert"
        />
        <div v-loading="loadingDevices" class="binding-editor">
          <div v-for="(row, index) in editRows" :key="row.key" class="binding-row">
            <el-select
              :model-value="row.deviceId"
              filterable
              placeholder="选择 WVP 国标设备"
              :loading="loadingDevices"
              @change="changeDevice(row, String($event))"
            >
              <el-option
                v-for="device in deviceOptions(row)"
                :key="device.deviceId"
                :label="deviceLabel(device)"
                :value="device.deviceId"
              />
            </el-select>
            <el-select
              :model-value="row.channelId"
              filterable
              placeholder="选择视频通道"
              :disabled="!row.deviceId"
              :loading="loadingChannels[row.deviceId]"
              @change="changeChannel(row, String($event))"
            >
              <el-option
                v-if="row.channelId && !hasChannelOption(row)"
                :label="`${row.channelId}（WVP 当前未返回）`"
                :value="row.channelId"
              />
              <el-option
                v-for="channel in channelOptions(row.deviceId)"
                :key="channelId(channel)"
                :label="`${channel.name || '未命名通道'} · ${channelId(channel)}`"
                :value="channelId(channel)"
              />
            </el-select>
            <el-input v-model="row.name" placeholder="弹窗显示名称" />
            <el-checkbox v-model="row.enabled">启用</el-checkbox>
            <el-button type="danger" plain @click="removeBinding(index)">移除</el-button>
          </div>
          <el-empty
            v-if="!editRows.length"
            description="没有绑定通道；保存后该点位不会触发视频播放"
          />
          <el-button plain @click="addBinding">添加通道绑定</el-button>
        </div>
      </template>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBindings">保存绑定</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.page-heading h2 {
  margin: 0;
}

.page-heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.page-alert {
  margin-bottom: 12px;
}

.filter-form {
  margin-top: 12px;
}

.gateway-url {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.secondary,
.binding-item small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.binding-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.binding-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.binding-item small {
  flex-basis: 100%;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
}

.point-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.point-summary span {
  color: var(--el-text-color-secondary);
}

.binding-editor {
  min-height: 100px;
}

.binding-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(220px, 1.2fr) minmax(160px, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

@media (max-width: 900px) {
  .binding-row {
    grid-template-columns: 1fr;
  }
}
</style>
