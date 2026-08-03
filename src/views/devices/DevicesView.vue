<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { queryDevices } from '@/api/device'
import type { Device } from '@/api/types/wvp'

const router = useRouter()

const loading = ref(false)
const list = ref<Device[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')
const status = ref<'on' | 'off' | ''>('')

async function load() {
  loading.value = true
  try {
    const resp = await queryDevices({
      page: page.value,
      count: count.value,
      query: query.value || undefined,
      status: status.value === '' ? undefined : status.value === 'on',
    })
    list.value = resp.list
    total.value = resp.total
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function openChannels(row: Device) {
  router.push({ name: 'device-channels', params: { deviceId: row.deviceId } })
}

onMounted(load)
</script>

<template>
  <div>
    <el-form inline @submit.prevent="search">
      <el-form-item>
        <el-input
          v-model="query"
          placeholder="搜索设备名/国标编号"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-select v-model="status" placeholder="在线状态" clearable @change="search">
          <el-option label="在线" value="on" />
          <el-option label="离线" value="off" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="deviceId" label="设备国标编号" min-width="170" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="manufacturer" label="厂商" min-width="120" />
      <el-table-column label="地址" min-width="140">
        <template #default="{ row }">{{ row.ip }}:{{ row.port }}</template>
      </el-table-column>
      <el-table-column prop="transport" label="传输协议" width="100" />
      <el-table-column label="在线" width="80">
        <template #default="{ row }">
          <el-tag :type="row.onLine ? 'success' : 'info'">
            {{ row.onLine ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="channelCount" label="通道数" width="80" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openChannels(row)">通道</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="count"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pager"
      @change="load"
    />
  </div>
</template>

<style scoped>
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
