<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { queryDevices } from '@/api/device'
import { queryProxies } from '@/api/proxy'
import { queryPushes } from '@/api/push'
import {
  queryMediaServerLoad,
  queryMediaServers,
  queryServerInfo,
  querySystemInfo,
  type MediaServerLoad,
  type ServerInfo,
  type SystemInfo,
} from '@/api/server'

const loading = ref(false)
const stats = ref({ devices: 0, onlineDevices: 0, proxies: 0, pushes: 0, mediaServers: 0 })
const serverInfo = ref<ServerInfo>({})
const systemInfo = ref<SystemInfo | null>(null)
const loads = ref<MediaServerLoad[]>([])
const serverStatus = ref<Record<string, boolean>>({})

async function load() {
  loading.value = true
  try {
    const [devices, online, proxies, pushes, servers, info, sys, loadResp] =
      await Promise.all([
        queryDevices({ page: 1, count: 1 }),
        queryDevices({ page: 1, count: 1, status: true }),
        queryProxies({ page: 1, count: 1 }),
        queryPushes({ page: 1, count: 1 }),
        queryMediaServers(),
        queryServerInfo(),
        querySystemInfo(),
        queryMediaServerLoad(),
      ])
    stats.value = {
      devices: devices.total,
      onlineDevices: online.total,
      proxies: proxies.total,
      pushes: pushes.total,
      mediaServers: servers.length,
    }
    serverInfo.value = info
    systemInfo.value = sys
    loads.value = loadResp
    serverStatus.value = Object.fromEntries(servers.map((s) => [s.id!, !!s.status]))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <el-row :gutter="12" class="stat-row">
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num">{{ stats.devices }}</div>
          <div class="stat-label">设备总数</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num success">{{ stats.onlineDevices }}</div>
          <div class="stat-label">在线设备</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num">{{ stats.proxies }}</div>
          <div class="stat-label">拉流代理</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num">{{ stats.pushes }}</div>
          <div class="stat-label">推流通道</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num">{{ stats.mediaServers }}</div>
          <div class="stat-label">媒体节点</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <div class="stat-num">{{ systemInfo?.netTotal ?? 0 }}</div>
          <div class="stat-label">网络流量(KB)</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="info-row">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>平台信息</template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item v-for="(v, k) in serverInfo['平台信息']" :key="k" :label="k">
              {{ v }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>硬件信息</template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item
              v-for="(v, k) in serverInfo['硬件信息']"
              :key="k"
              :label="k"
            >
              {{ v }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="load-card">
      <template #header>媒体节点负载</template>
      <el-table :data="loads" stripe>
        <el-table-column prop="id" label="节点 ID" min-width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="serverStatus[row.id] ? 'success' : 'info'">
              {{ serverStatus[row.id] ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="push" label="推流数" width="90" />
        <el-table-column prop="proxy" label="代理数" width="90" />
        <el-table-column prop="gbReceive" label="国标接收" width="100" />
        <el-table-column prop="gbSend" label="国标发送" width="100" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.stat-row {
  margin-bottom: 12px;
}

.stat-num {
  font-size: 26px;
  font-weight: 600;
  text-align: center;
}

.stat-num.success {
  color: var(--el-color-success);
}

.stat-label {
  margin-top: 6px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.info-row {
  margin-bottom: 12px;
}

.load-card {
  margin-bottom: 12px;
}
</style>
