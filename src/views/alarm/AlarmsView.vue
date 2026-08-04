<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  ALARM_TYPES,
  clearAlarms,
  deleteAlarms,
  fetchAlarmSnap,
  queryAlarms,
  type Alarm,
} from '@/api/alarm'

const loading = ref(false)
const list = ref<Alarm[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const alarmType = ref<string[]>([])
const range = ref<[string, string] | null>(null)
const selection = ref<Alarm[]>([])

function fmtTime(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function load() {
  loading.value = true
  try {
    const resp = await queryAlarms({
      page: page.value,
      count: count.value,
      alarmType: alarmType.value.length ? [...alarmType.value] : undefined,
      beginTime: range.value ? `${range.value[0]} 00:00:00` : undefined,
      endTime: range.value ? `${range.value[1]} 23:59:59` : undefined,
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

async function onDelete(rows: Alarm[]) {
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${rows.length} 条报警?`, '删除确认', {
      type: 'warning',
    })
    await deleteAlarms(rows.map((r) => r.id))
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

async function onClear() {
  try {
    await ElMessageBox.confirm(
      `确认按当前过滤条件清空报警?${alarmType.value.length || range.value ? ' (仅匹配的报警)' : ' (全部报警)'}`,
      '清空确认',
      { type: 'warning' },
    )
    await clearAlarms({
      alarmType: alarmType.value.length ? [...alarmType.value] : undefined,
      beginTime: range.value ? `${range.value[0]} 00:00:00` : undefined,
      endTime: range.value ? `${range.value[1]} 23:59:59` : undefined,
    })
    ElMessage.success('已清空')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '清空失败')
    }
  }
}

// 快照预览
const snapVisible = ref(false)
const snapLoading = ref(false)
const snapUrl = ref('')

async function onSnap(row: Alarm) {
  snapLoading.value = true
  snapVisible.value = true
  try {
    const url = await fetchAlarmSnap(row.id)
    snapUrl.value = url ?? ''
    if (!url) {
      ElMessage.info('该报警没有快照')
    }
  } catch (err) {
    snapUrl.value = ''
    ElMessage.error(err instanceof Error ? err.message : '快照获取失败')
  } finally {
    snapLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-form inline @submit.prevent="search">
      <el-form-item>
        <el-select
          v-model="alarmType"
          multiple
          collapse-tags
          placeholder="报警类型"
          class="type-filter"
          @change="search"
        >
          <el-option v-for="t in ALARM_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="danger" :disabled="!selection.length" @click="onDelete(selection)">
          删除所选({{ selection.length }})
        </el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="danger" plain @click="onClear">按条件清空</el-button>
      </el-form-item>
    </el-form>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      @selection-change="selection = $event"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column label="时间" min-width="160">
        <template #default="{ row }">{{ fmtTime(row.alarmTime) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="180">
        <template #default="{ row }">
          <el-tag>{{ row.alarmType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="channelName" label="通道名称" min-width="140" />
      <el-table-column prop="channelDeviceId" label="通道编号" min-width="170" />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onSnap(row)">快照</el-button>
          <el-button link type="danger" @click="onDelete([row])">删除</el-button>
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

    <el-dialog v-model="snapVisible" title="报警快照" width="640px">
      <div v-loading="snapLoading" class="snap-wrap">
        <img v-if="snapUrl" :src="snapUrl" class="snap" alt="报警快照" />
        <el-empty v-else-if="!snapLoading" description="无快照" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}

.type-filter {
  width: 260px;
}

.snap-wrap {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snap {
  max-width: 100%;
}
</style>
