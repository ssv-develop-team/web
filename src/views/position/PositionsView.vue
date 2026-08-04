<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { queryDevices } from '@/api/device'
import {
  historyPositions,
  latestPosition,
  realtimePosition,
  type MobilePosition,
} from '@/api/position'
import type { Device } from '@/api/types/wvp'

const devices = ref<Device[]>([])
const deviceId = ref('')

const latestLoading = ref(false)
const latest = ref<MobilePosition | null>(null)

const realtimeLoading = ref(false)

const historyLoading = ref(false)
const history = ref<MobilePosition[]>([])
const range = ref<[string, string] | null>(null)

async function loadDevices() {
  const resp = await queryDevices({ page: 1, count: 100 })
  devices.value = resp.list
  if (resp.list.length && !deviceId.value) {
    deviceId.value = resp.list[0]!.deviceId
  }
}

async function onDeviceChange() {
  latest.value = null
  history.value = []
  if (!deviceId.value) return
  await Promise.all([loadLatest(), loadHistory()])
}

async function loadLatest() {
  if (!deviceId.value) return
  latestLoading.value = true
  try {
    latest.value = await latestPosition(deviceId.value)
  } catch (err) {
    latest.value = null
    ElMessage.error(err instanceof Error ? err.message : '获取最新位置失败')
  } finally {
    latestLoading.value = false
  }
}

async function loadHistory() {
  if (!deviceId.value) return
  historyLoading.value = true
  try {
    history.value = await historyPositions(deviceId.value, {
      start: range.value ? `${range.value[0]} 00:00:00` : undefined,
      end: range.value ? `${range.value[1]} 23:59:59` : undefined,
    })
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '获取历史轨迹失败')
  } finally {
    historyLoading.value = false
  }
}

async function onRealtime() {
  if (!deviceId.value) return
  realtimeLoading.value = true
  try {
    const pos = await realtimePosition(deviceId.value)
    if (pos) {
      latest.value = pos
      ElMessage.success('已获取实时位置')
    } else {
      ElMessage.info('设备未返回位置信息')
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '实时位置查询失败')
  } finally {
    realtimeLoading.value = false
  }
}

onMounted(loadDevices)
</script>

<template>
  <div>
    <el-form inline>
      <el-form-item>
        <el-select
          v-model="deviceId"
          placeholder="选择设备"
          class="device-select"
          @change="onDeviceChange"
        >
          <el-option
            v-for="d in devices"
            :key="d.deviceId"
            :label="`${d.name ?? d.deviceId} (${d.deviceId})`"
            :value="d.deviceId"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button :loading="realtimeLoading" @click="onRealtime">主动查询位置</el-button>
      </el-form-item>
    </el-form>

    <el-card v-loading="latestLoading" shadow="never" class="latest-card">
      <template #header>最近位置</template>
      <el-descriptions v-if="latest" :column="4" size="small" border>
        <el-descriptions-item label="设备">{{ latest.deviceName ?? latest.deviceId }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ latest.time ?? latest.createTime }}</el-descriptions-item>
        <el-descriptions-item label="经度">{{ latest.longitude }}</el-descriptions-item>
        <el-descriptions-item label="纬度">{{ latest.latitude }}</el-descriptions-item>
        <el-descriptions-item label="高度(m)">{{ latest.altitude ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="速度(km/h)">{{ latest.speed ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="方向(°)">{{ latest.direction ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ latest.reportSource ?? '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else-if="!latestLoading" description="暂无位置记录" :image-size="60" />
    </el-card>

    <el-card shadow="never" class="history-card">
      <template #header>
        <div class="history-header">
          <span>历史轨迹</span>
          <el-date-picker
            v-model="range"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="small"
            @change="loadHistory"
          />
        </div>
      </template>
      <el-table v-loading="historyLoading" :data="history" stripe>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ row.time ?? row.createTime }}</template>
        </el-table-column>
        <el-table-column prop="longitude" label="经度" min-width="110" />
        <el-table-column prop="latitude" label="纬度" min-width="110" />
        <el-table-column prop="altitude" label="高度(m)" width="100" />
        <el-table-column prop="speed" label="速度(km/h)" width="110" />
        <el-table-column prop="direction" label="方向(°)" width="100" />
        <el-table-column prop="reportSource" label="来源" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.device-select {
  width: 320px;
}

.latest-card {
  margin-bottom: 12px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
