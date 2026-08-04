<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  checkMediaServer,
  deleteMediaServer,
  queryMediaServers,
  saveMediaServer,
} from '@/api/server'
import type { MediaServer } from '@/api/types/wvp'

const loading = ref(false)
const list = ref<MediaServer[]>([])

const dialogVisible = ref(false)
const saving = ref(false)
const checking = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const isEdit = ref(false)
const form = ref<MediaServer>(emptyForm())

function emptyForm(): MediaServer {
  return {
    ip: '',
    httpPort: 80,
    type: 'zlm',
    autoConfig: true,
    rtpEnable: false,
    rtpPortRange: '30000,30500',
    recordAssistPort: 0,
  }
}

const rules = {
  ip: [{ required: true, message: '请输入 IP', trigger: 'blur' }],
  httpPort: [{ required: true, message: '请输入 HTTP 端口', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    list.value = await queryMediaServers()
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isEdit.value = false
  form.value = emptyForm()
  dialogVisible.value = true
}

function openEdit(row: MediaServer) {
  isEdit.value = true
  form.value = { ...row }
  dialogVisible.value = true
}

async function onCheck() {
  checking.value = true
  try {
    await checkMediaServer({
      ip: form.value.ip,
      port: Number(form.value.httpPort),
      secret: form.value.secret ?? '',
      type: form.value.type ?? 'zlm',
    })
    ElMessage.success('连通性检查通过')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '检查失败')
  } finally {
    checking.value = false
  }
}

async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    await saveMediaServer(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(row: MediaServer) {
  try {
    await ElMessageBox.confirm(`确认删除媒体节点 ${row.ip}?`, '删除确认', { type: 'warning' })
    await deleteMediaServer(row.id!)
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
    <el-form inline class="filter">
      <el-form-item>
        <el-button type="primary" @click="openAdd">新增媒体节点</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="ip" label="IP" min-width="130" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === 'abl' ? 'warning' : 'info'">{{ row.type ?? 'zlm' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="httpPort" label="HTTP 端口" width="100" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'">
            {{ row.status ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="默认" width="80">
        <template #default="{ row }">{{ row.defaultServer ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="recordDay" label="录像天数" width="90" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑媒体节点' : '新增媒体节点'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-divider content-position="left">基础信息</el-divider>
        <el-form-item label="IP" prop="ip">
          <el-input v-model="form.ip" placeholder="媒体节点地址,浏览器可达" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="zlm" value="zlm" />
            <el-option label="abl" value="abl" />
          </el-select>
        </el-form-item>
        <el-form-item label="HTTP 端口" prop="httpPort">
          <el-input-number v-model="form.httpPort" :min="1" :max="65535" />
          <el-button class="check-btn" :loading="checking" @click="onCheck">连通性检查</el-button>
        </el-form-item>
        <el-form-item label="secret">
          <el-input v-model="form.secret" type="password" show-password placeholder="ZLM 鉴权参数" />
        </el-form-item>
        <el-form-item label="自动配置">
          <el-switch v-model="form.autoConfig" />
        </el-form-item>

        <el-divider content-position="left">地址</el-divider>
        <el-form-item label="SDP IP">
          <el-input v-model="form.sdpIp" placeholder="留空取 IP" />
        </el-form-item>
        <el-form-item label="流 IP">
          <el-input v-model="form.streamIp" placeholder="留空取 IP" />
        </el-form-item>
        <el-form-item label="Hook IP">
          <el-input v-model="form.hookIp" placeholder="ZLM 访问 WVP 的 IP" />
        </el-form-item>

        <el-divider content-position="left">端口(留空用默认)</el-divider>
        <el-form-item label="RTMP">
          <el-input-number v-model="form.rtmpPort" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="RTSP">
          <el-input-number v-model="form.rtspPort" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="WS-FLV">
          <el-input-number v-model="form.wsFlvPort" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="RTP 收流">
          <el-input-number v-model="form.rtpProxyPort" :min="1" :max="65535" />
        </el-form-item>

        <el-divider content-position="left">录制与多端口</el-divider>
        <el-form-item label="录像天数">
          <el-input-number v-model="form.recordDay" :min="0" />
        </el-form-item>
        <el-form-item label="录像路径">
          <el-input v-model="form.recordPath" placeholder="留空用默认" />
        </el-form-item>
        <el-form-item label="多端口模式">
          <el-switch v-model="form.rtpEnable" />
        </el-form-item>
        <el-form-item label="收流端口范围">
          <el-input v-model="form.rtpPortRange" placeholder="如 30000,30500" />
        </el-form-item>
        <el-form-item label="assist 端口">
          <el-input-number v-model="form.recordAssistPort" :min="0" :max="65535" />
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
.check-btn {
  margin-left: 8px;
}
</style>
