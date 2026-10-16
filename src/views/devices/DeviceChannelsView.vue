<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { queryChannels, querySubChannels } from '@/api/device'
import { getWvpChannelId } from '@/api/types/wvp'
import type { DeviceChannel } from '@/api/types/wvp'

const route = useRoute()
const router = useRouter()

const deviceId = computed(() => String(route.params.deviceId))
const loading = ref(false)
const list = ref<DeviceChannel[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')
const onlyOnline = ref(false)
/** 目录路径栈: 空=设备一级通道, 末尾元素为当前所在目录 */
const pathStack = ref<DeviceChannel[]>([])

async function load() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      count: count.value,
      query: query.value || undefined,
      online: onlyOnline.value || undefined,
    }
    const parent = pathStack.value[pathStack.value.length - 1]
    const parentChannelId = parent ? getWvpChannelId(parent) : undefined
    if (parent && !parentChannelId) {
      ElMessage.error('通道响应缺少通道国标编号')
      return
    }
    const resp = parent
      ? await querySubChannels(deviceId.value, parentChannelId!, params)
      : await queryChannels(deviceId.value, params)
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

/** 目录行: 1=行政区划, 2=业务分组/虚拟组织(DeviceChannel.channelType,与查询参数布尔不同) */
function isCatalog(row: DeviceChannel): boolean {
  return row.channelType === 1 || row.channelType === 2
}

function enterCatalog(row: DeviceChannel) {
  pathStack.value = [...pathStack.value, row]
  page.value = 1
  load()
}

function backTo(index: number) {
  pathStack.value = pathStack.value.slice(0, index)
  page.value = 1
  load()
}

function backToDevices() {
  router.push({ name: 'devices' })
}

function channelIdOf(row: DeviceChannel): string | undefined {
  return getWvpChannelId(row)
}

function openPlay(row: DeviceChannel) {
  const channelId = channelIdOf(row)
  if (!channelId) {
    ElMessage.error('通道响应缺少通道国标编号')
    return
  }
  router.push({
    name: 'play',
    params: { deviceId: deviceId.value, channelId },
  })
}

function openRecord(row: DeviceChannel) {
  const channelId = channelIdOf(row)
  if (!channelId) {
    ElMessage.error('通道响应缺少通道国标编号')
    return
  }
  router.push({
    name: 'record-query',
    params: { deviceId: deviceId.value, channelId },
  })
}

function isOnline(row: DeviceChannel): boolean {
  return row.status === true || row.status === 'ON'
}

onMounted(load)
</script>

<template>
  <div>
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item>
        <el-link type="primary" @click="backToDevices">设备 {{ deviceId }}</el-link>
      </el-breadcrumb-item>
      <el-breadcrumb-item v-for="(dir, i) in pathStack" :key="channelIdOf(dir) ?? dir.id">
        <el-link v-if="i < pathStack.length - 1" type="primary" @click="backTo(i + 1)">
          {{ dir.name }}
        </el-link>
        <span v-else>{{ dir.name }}</span>
      </el-breadcrumb-item>
    </el-breadcrumb>

    <el-form inline class="filter" @submit.prevent="search">
      <el-form-item>
        <el-input
          v-model="query"
          placeholder="搜索通道名称/编号"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="onlyOnline" @change="search">仅在线</el-checkbox>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="通道国标编号" min-width="170">
        <template #default="{ row }">{{ channelIdOf(row) ?? '未知' }}</template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag v-if="isCatalog(row)" type="warning">目录</el-tag>
          <span v-else>通道</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.status !== undefined" :type="isOnline(row) ? 'success' : 'info'">
            {{ isOnline(row) ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ptzTypeText" label="云台类型" width="140" />
      <el-table-column label="音频" width="70">
        <template #default="{ row }">{{ row.hasAudio ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button v-if="isCatalog(row)" link type="primary" @click="enterCatalog(row)">
            进入
          </el-button>
          <el-button v-if="!isCatalog(row)" link type="primary" @click="openPlay(row)"
            >播放</el-button
          >
          <el-button v-if="!isCatalog(row)" link type="primary" @click="openRecord(row)"
            >录像</el-button
          >
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
.crumb {
  margin-bottom: 16px;
}

.filter {
  margin-top: 12px;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
