<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { queryGBRecords, type RecordItem } from '@/api/record'

const route = useRoute()
const router = useRouter()
const deviceId = computed(() => String(route.params.deviceId))
const channelId = computed(() => String(route.params.channelId))

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const loading = ref(false)
const list = ref<RecordItem[]>([])
const range = ref<[string, string]>([todayStr(), todayStr()])
const queried = ref(false)

async function search() {
  loading.value = true
  try {
    const [d1, d2] = range.value
    list.value = await queryGBRecords(
      deviceId.value,
      channelId.value,
      `${d1} 00:00:00`,
      `${d2} 23:59:59`,
    )
    queried.value = true
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '录像查询失败')
  } finally {
    loading.value = false
  }
}

function openPlayback(row: RecordItem) {
  router.push({
    name: 'playback',
    params: { deviceId: deviceId.value, channelId: channelId.value },
    query: { startTime: row.startTime, endTime: row.endTime },
  })
}

function backToChannels() {
  router.push({ name: 'device-channels', params: { deviceId: deviceId.value } })
}
</script>

<template>
  <div>
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item>
        <el-link type="primary" @click="backToChannels">设备 {{ deviceId }}</el-link>
      </el-breadcrumb-item>
      <el-breadcrumb-item>{{ channelId }} 录像查询</el-breadcrumb-item>
    </el-breadcrumb>

    <el-form inline @submit.prevent="search">
      <el-form-item>
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="startTime" label="开始时间" min-width="170" />
      <el-table-column prop="endTime" label="结束时间" min-width="170" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'alarm' ? 'danger' : row.type === 'manual' ? 'warning' : 'info'">
            {{ row.type ?? 'time' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="fileSize" label="大小" width="110" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="primary" @click="openPlayback(row)">回放</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty
          v-if="queried && !loading"
          description="该时间段内没有录像片段"
        />
        <span v-else>选择日期范围后查询</span>
      </template>
    </el-table>
  </div>
</template>

<style scoped>
.crumb {
  margin-bottom: 16px;
}
</style>
