<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import LinkageVideoDialog from '@/components/LinkageVideoDialog.vue'
import {
  createLinkageGatewayConnection,
  type LinkageConnectionState,
  type LinkageEvent,
} from '@/linkage/gateway'

const connectionState = ref<LinkageConnectionState>('connecting')
const activeEvent = ref<LinkageEvent | null>(null)
const stateLabel = computed(() => {
  if (connectionState.value === 'connected') return '视频联动在线'
  if (connectionState.value === 'connecting') return '视频联动连接中'
  return '视频联动离线'
})
const stateType = computed<'success' | 'warning' | 'info'>(() => {
  if (connectionState.value === 'connected') return 'success'
  if (connectionState.value === 'connecting') return 'warning'
  return 'info'
})

let connection: ReturnType<typeof createLinkageGatewayConnection> | null = null

onMounted(() => {
  connection = createLinkageGatewayConnection(
    (event) => {
      activeEvent.value = event
    },
    (state) => {
      connectionState.value = state
    },
  )
})

onBeforeUnmount(() => {
  connection?.close()
  connection = null
})

function closeEvent() {
  activeEvent.value = null
}
</script>

<template>
  <el-tag :type="stateType" size="small" effect="plain" class="connection-state">
    {{ stateLabel }}
  </el-tag>
  <LinkageVideoDialog
    v-if="activeEvent"
    :key="activeEvent.eventId"
    :event="activeEvent"
    @closed="closeEvent"
  />
</template>

<style scoped>
.connection-state {
  margin-right: 12px;
}
</style>
