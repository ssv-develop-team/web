<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  addProxy,
  deleteProxy,
  queryFfmpegCmds,
  queryProxies,
  startProxy,
  stopProxy,
  updateProxy,
  type StreamProxyItem,
  type StreamProxyParam,
} from '@/api/proxy'
import { queryMediaServers } from '@/api/server'
import type { MediaServer } from '@/api/types/wvp'

const loading = ref(false)
const list = ref<StreamProxyItem[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')

const mediaServers = ref<MediaServer[]>([])
const ffmpegCmds = ref<Record<string, string>>({})

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref<StreamProxyParam & { id?: number }>(emptyForm())

function emptyForm(): StreamProxyParam {
  return {
    type: 'default',
    app: 'rtsp',
    stream: '',
    relatesMediaServerId: '',
    srcUrl: '',
    timeout: 10,
    rtspType: '0',
    enable: true,
    enableAudio: true,
    enableMp4: false,
    enableDisableNoneReader: false,
  }
}

const rules = {
  app: [{ required: true, message: '请输入应用名', trigger: 'blur' }],
  stream: [{ required: true, message: '请输入流 ID', trigger: 'blur' }],
  relatesMediaServerId: [{ required: true, message: '请选择媒体节点', trigger: 'change' }],
  srcUrl: [{ required: true, message: '请输入拉流地址', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const resp = await queryProxies({
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
  form.value.relatesMediaServerId = mediaServers.value[0]?.id ?? ''
  dialogVisible.value = true
}

async function openEdit(row: StreamProxyItem) {
  isEdit.value = true
  const { id, ...rest } = row
  form.value = { ...rest, id }
  if (!mediaServers.value.length) {
    mediaServers.value = await queryMediaServers()
  }
  await loadFfmpegCmds()
  dialogVisible.value = true
}

async function loadFfmpegCmds() {
  if (!form.value.relatesMediaServerId) return
  try {
    ffmpegCmds.value = await queryFfmpegCmds(form.value.relatesMediaServerId!)
  } catch {
    ffmpegCmds.value = {}
  }
}

function onMediaServerChange() {
  form.value.ffmpegCmdKey = undefined
  loadFfmpegCmds()
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
      await updateProxy(form.value as StreamProxyParam & { id: number })
    } else {
      await addProxy(form.value)
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

async function onToggle(row: StreamProxyItem) {
  try {
    if (row.pulling) {
      await stopProxy(row.id)
    } else {
      await startProxy(row.id)
    }
    ElMessage.success(row.pulling ? '已停止' : '已启动')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function onDelete(row: StreamProxyItem) {
  try {
    await ElMessageBox.confirm(`确认删除代理 ${row.gbName ?? row.stream}?`, '删除确认', {
      type: 'warning',
    })
    await deleteProxy(row.id)
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
          placeholder="搜索名称/流 ID/地址"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="openAdd">新增代理</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="名称" min-width="120">
        <template #default="{ row }">{{ row.gbName ?? row.stream }}</template>
      </el-table-column>
      <el-table-column label="流" min-width="150">
        <template #default="{ row }">{{ row.app }}/{{ row.stream }}</template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.type === 'ffmpeg' ? 'warning' : 'info'">
            {{ row.type ?? 'default' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="srcUrl" label="拉流地址" min-width="200" show-overflow-tooltip />
      <el-table-column label="拉流中" width="80">
        <template #default="{ row }">
          <el-tag :type="row.pulling ? 'success' : 'info'">
            {{ row.pulling ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="70">
        <template #default="{ row }">
          <el-tag :type="row.enable ? 'success' : 'danger'">
            {{ row.enable ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link :type="row.pulling ? 'warning' : 'success'" @click="onToggle(row)">
            {{ row.pulling ? '停止' : '启动' }}
          </el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑代理' : '新增代理'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="default(直接拉流)" value="default" />
            <el-option label="ffmpeg" value="ffmpeg" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.gbName" placeholder="可选,作为通道名" />
        </el-form-item>
        <el-form-item label="应用名" prop="app">
          <el-input v-model="form.app" />
        </el-form-item>
        <el-form-item label="流 ID" prop="stream">
          <el-input v-model="form.stream" />
        </el-form-item>
        <el-form-item label="媒体节点" prop="relatesMediaServerId">
          <el-select v-model="form.relatesMediaServerId" @change="onMediaServerChange">
            <el-option
              v-for="s in mediaServers"
              :key="s.id"
              :label="`${s.ip} (${s.type ?? 'zlm'})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="拉流地址" prop="srcUrl">
          <el-input v-model="form.srcUrl" placeholder="rtsp:// / rtmp:// / http://" />
        </el-form-item>
        <el-form-item label="超时(秒)">
          <el-input-number v-model="form.timeout" :min="1" />
        </el-form-item>
        <el-form-item label="拉流方式(RTSP)">
          <el-select v-model="form.rtspType">
            <el-option label="TCP" value="0" />
            <el-option label="UDP" value="1" />
            <el-option label="组播" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.type === 'ffmpeg'" label="FFmpeg 模板">
          <el-select v-model="form.ffmpegCmdKey" placeholder="选择命令模板">
            <el-option
              v-for="(content, key) in ffmpegCmds"
              :key="key"
              :label="key"
              :value="key"
            >
              <span>{{ key }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-divider content-position="left">开关</el-divider>
        <el-form-item label="启用">
          <el-switch v-model="form.enable" />
        </el-form-item>
        <el-form-item label="启用音频">
          <el-switch v-model="form.enableAudio" />
        </el-form-item>
        <el-form-item label="MP4 录制">
          <el-switch v-model="form.enableMp4" />
        </el-form-item>
        <el-form-item label="无人观看停用">
          <el-switch v-model="form.enableDisableNoneReader" />
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
