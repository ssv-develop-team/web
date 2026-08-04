<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  addPush,
  batchRemovePushes,
  forceClosePush,
  queryPushes,
  removePush,
  updatePush,
  type StreamPushItem,
  type StreamPushParam,
} from '@/api/push'
import { queryMediaServers } from '@/api/server'
import type { MediaServer } from '@/api/types/wvp'

const loading = ref(false)
const list = ref<StreamPushItem[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')
const selection = ref<StreamPushItem[]>([])

const mediaServers = ref<MediaServer[]>([])

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref<StreamPushParam>(emptyForm())

function emptyForm(): StreamPushParam {
  return {
    app: 'live',
    stream: '',
    mediaServerId: '',
    startOfflinePush: false,
    gbName: '',
  }
}

const rules = {
  app: [{ required: true, message: '请输入应用名', trigger: 'blur' }],
  stream: [{ required: true, message: '请输入流 ID', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const resp = await queryPushes({
      page: page.value,
      count: count.value,
      query: query.value || undefined,
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

async function openAdd() {
  isEdit.value = false
  form.value = emptyForm()
  if (!mediaServers.value.length) {
    mediaServers.value = await queryMediaServers()
  }
  form.value.mediaServerId = mediaServers.value[0]?.id ?? ''
  dialogVisible.value = true
}

function openEdit(row: StreamPushItem) {
  isEdit.value = true
  const { id, ...rest } = row
  form.value = { ...rest, id }
  dialogVisible.value = true
}

async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (isEdit.value) {
      await updatePush(form.value as StreamPushParam & { id: number })
    } else {
      await addPush(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function onForceClose(row: StreamPushItem) {
  try {
    await forceClosePush(row.id)
    ElMessage.success('已强制关闭')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function onRemove(row: StreamPushItem) {
  try {
    await ElMessageBox.confirm(`确认删除推流 ${row.gbName ?? row.stream}?`, '删除确认', {
      type: 'warning',
    })
    await removePush(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

async function onBatchRemove() {
  if (!selection.value.length) return
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selection.value.length} 个推流?`,
      '批量删除确认',
      { type: 'warning' },
    )
    await batchRemovePushes(selection.value.map((s) => s.id))
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-form inline @submit.prevent="search">
      <el-form-item>
        <el-input
          v-model="query"
          placeholder="搜索名称/流 ID"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="openAdd">新增推流</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="danger" :disabled="!selection.length" @click="onBatchRemove">
          批量删除({{ selection.length }})
        </el-button>
      </el-form-item>
    </el-form>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      @selection-change="selection = $event"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column label="名称" min-width="120">
        <template #default="{ row }">{{ row.gbName ?? row.stream }}</template>
      </el-table-column>
      <el-table-column label="流" min-width="140">
        <template #default="{ row }">{{ row.app }}/{{ row.stream }}</template>
      </el-table-column>
      <el-table-column label="推流中" width="80">
        <template #default="{ row }">
          <el-tag :type="row.pushing ? 'success' : 'info'">
            {{ row.pushing ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="离线拉起" width="90">
        <template #default="{ row }">
          {{ row.startOfflinePush ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column prop="pushTime" label="推流时间" min-width="160" />
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.pushing" link type="warning" @click="onForceClose(row)">
            强制关闭
          </el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onRemove(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑推流' : '新增推流'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="form.gbName" placeholder="可选" />
        </el-form-item>
        <el-form-item label="应用名" prop="app">
          <el-input v-model="form.app" />
        </el-form-item>
        <el-form-item label="流 ID" prop="stream">
          <el-input v-model="form.stream" />
        </el-form-item>
        <el-form-item label="媒体节点">
          <el-select v-model="form.mediaServerId">
            <el-option
              v-for="s in mediaServers"
              :key="s.id"
              :label="`${s.ip} (${s.type ?? 'zlm'})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="离线拉起">
          <el-switch v-model="form.startOfflinePush" />
        </el-form-item>
        <el-form-item label="国标编号">
          <el-input v-model="form.gbDeviceId" placeholder="可选,用于国标映射" />
        </el-form-item>
        <el-form-item label="安装地址">
          <el-input v-model="form.gbAddress" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
