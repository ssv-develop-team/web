<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <el-container class="page">
    <el-header class="header">
      <span>WVP 管理平台</span>
      <el-tag v-if="auth.username" class="user">{{ auth.username }}</el-tag>
      <el-button link type="danger" @click="auth.logout()">退出</el-button>
    </el-header>
    <el-main>
      <el-empty description="设备列表页面在 M1-4 实现" />
    </el-main>
  </el-container>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color);
}

.user {
  margin: 0 12px 0 auto;
}
</style>
