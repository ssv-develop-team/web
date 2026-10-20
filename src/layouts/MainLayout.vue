<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import LinkageGatewayBridge from '@/components/LinkageGatewayBridge.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => {
  if (route.path.startsWith('/dashboard')) return '/dashboard'
  if (route.path.startsWith('/devices')) return '/devices'
  if (route.path.startsWith('/media-servers')) return '/media-servers'
  if (route.path.startsWith('/proxies')) return '/proxies'
  if (route.path.startsWith('/pushes')) return '/pushes'
  if (route.path.startsWith('/platforms')) return '/platforms'
  if (route.path.startsWith('/record-plans')) return '/record-plans'
  if (route.path.startsWith('/users')) return '/users'
  if (route.path.startsWith('/api-keys')) return '/api-keys'
  if (route.path.startsWith('/alarms')) return '/alarms'
  if (route.path.startsWith('/positions')) return '/positions'
  if (route.path.startsWith('/logs')) return '/logs'
  if (route.path.startsWith('/events')) return '/events'
  if (route.path.startsWith('/linkage-bindings')) return '/linkage-bindings'
  return route.path
})

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="200px" class="aside">
      <div class="logo">WVP 管理平台</div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item index="/dashboard">首页</el-menu-item>
        <el-menu-item index="/devices">国标设备</el-menu-item>
        <el-menu-item index="/proxies">拉流代理</el-menu-item>
        <el-menu-item index="/pushes">推流通道</el-menu-item>
        <el-menu-item index="/platforms">上级平台</el-menu-item>
        <el-menu-item index="/record-plans">录制计划</el-menu-item>
        <el-menu-item index="/media-servers">媒体节点</el-menu-item>
        <el-menu-item index="/users">用户管理</el-menu-item>
        <el-menu-item index="/api-keys">API Key</el-menu-item>
        <el-menu-item index="/alarms">报警</el-menu-item>
        <el-menu-item index="/positions">位置</el-menu-item>
        <el-menu-item index="/logs">日志</el-menu-item>
        <el-menu-item index="/linkage-bindings">视频联动配置</el-menu-item>
        <el-menu-item index="/events">SSV 事件</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <LinkageGatewayBridge />
        <el-tag v-if="auth.username" class="user" type="info">{{ auth.username }}</el-tag>
        <el-button link type="danger" @click="onLogout">退出</el-button>
      </el-header>
      <el-main class="main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.aside {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color);
}

.header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid var(--el-border-color);
}

.user {
  margin-right: 12px;
}

.main {
  background: var(--el-fill-color-blank);
}
</style>
