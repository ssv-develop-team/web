<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  addPlatform,
  addPlatformChannels,
  deletePlatform,
  pushPlatformChannels,
  queryPlatformChannels,
  queryPlatforms,
  removePlatformChannels,
  updatePlatform,
} from '@/api/platform'
import { queryCommonChannels } from '@/api/channel'
import type { CommonGBChannel, Platform } from '@/api/types/wvp'

const loading = ref(false)
const list = ref<Platform[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref<Platform>(emptyForm())

function emptyForm(): Platform {
  return {
    enable: true,
    name: '',
    serverGBId: '',
    serverGBDomain: '',
    serverIp: '',
    serverPort: 5060,
    deviceGBId: '',
    deviceIp: '',
    devicePort: 5060,
    username: '',
    password: '',
    expires: 3600,
    keepTimeout: 60,
    transport: 'UDP',
    characterSet: 'GB2312',
    ptz: true,
    rtcp: true,
    catalogGroup: 1,
    asMessageChannel: false,
    autoPushChannel: true,
    catalogWithPlatform: 0,
    catalogWithGroup: 0,
    catalogWithRegion: 0,
    registerWay: 1,
    secrecy: 0,
  }
}

/** 国标通信配置,提交前必须专门校验(04 §4.9) */
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  serverGBId: [{ required: true, message: '请输入 SIP 服务国标编码', trigger: 'blur' }],
  serverGBDomain: [{ required: true, message: '请输入 SIP 服务国标域', trigger: 'blur' }],
  serverIp: [{ required: true, message: '请输入 SIP 服务 IP', trigger: 'blur' }],
  serverPort: [{ required: true, message: '请输入 SIP 服务端口', trigger: 'blur' }],
  deviceGBId: [{ required: true, message: '请输入设备国标编号', trigger: 'blur' }],
  deviceIp: [{ required: true, message: '请输入设备 IP', trigger: 'blur' }],
  devicePort: [{ required: true, message: '请输入设备端口', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const resp = await queryPlatforms({
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

function openAdd() {
  isEdit.value = false
  form.value = emptyForm()
  dialogVisible.value = true
}

function openEdit(row: Platform) {
  isEdit.value = true
  form.value = { ...row }
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
      await updatePlatform(form.value)
    } else {
      await addPlatform(form.value)
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

async function onDelete(row: Platform) {
  try {
    await ElMessageBox.confirm(`确认删除平台 ${row.name}?`, '删除确认', { type: 'warning' })
    await deletePlatform(row.id!)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

async function onPush(row: Platform) {
  try {
    await pushPlatformChannels(row.id!)
    ElMessage.success('已推送通道变化')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '推送失败')
  }
}

// ---- 通道分享 ----
const shareVisible = ref(false)
const sharePlatform = ref<Platform | null>(null)
const shareList = ref<CommonGBChannel[]>([])
const shareTotal = ref(0)
const sharePage = ref(1)
const shareCount = ref(10)
const shareLoading = ref(false)
const pickerVisible = ref(false)
const pickerList = ref<CommonGBChannel[]>([])
const pickerTotal = ref(0)
const pickerPage = ref(1)
const pickerCount = ref(10)
const pickerSelection = ref<CommonGBChannel[]>([])

async function openShare(row: Platform) {
  sharePlatform.value = row
  shareVisible.value = true
  await loadShareChannels()
}

async function loadShareChannels() {
  if (!sharePlatform.value) return
  shareLoading.value = true
  try {
    const resp = await queryPlatformChannels({
      page: sharePage.value,
      count: shareCount.value,
      platformId: sharePlatform.value.id!,
    })
    shareList.value = resp.list
    shareTotal.value = resp.total
  } finally {
    shareLoading.value = false
  }
}

async function openPicker() {
  pickerSelection.value = []
  pickerPage.value = 1
  await loadPickerChannels()
  pickerVisible.value = true
}

async function loadPickerChannels() {
  const resp = await queryCommonChannels({
    page: pickerPage.value,
    count: pickerCount.value,
  })
  pickerList.value = resp.list
  pickerTotal.value = resp.total
}

async function onAddPicked() {
  if (!sharePlatform.value || !pickerSelection.value.length) return
  try {
    await addPlatformChannels(
      sharePlatform.value.id!,
      pickerSelection.value.map((c) => c.gbId),
    )
    ElMessage.success('已添加')
    pickerVisible.value = false
    await loadShareChannels()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '添加失败')
  }
}

async function onShareAll() {
  if (!sharePlatform.value) return
  try {
    await addPlatformChannels(sharePlatform.value.id!, undefined, true)
    ElMessage.success('已分享全部通道')
    await loadShareChannels()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function onRemoveShared(row: CommonGBChannel) {
  if (!sharePlatform.value) return
  try {
    await removePlatformChannels(sharePlatform.value.id!, [row.gbId])
    ElMessage.success('已移除')
    await loadShareChannels()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '移除失败')
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
          placeholder="搜索平台名称/国标编号"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="openAdd">新增平台</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="deviceGBId" label="设备国标编号" min-width="170" />
      <el-table-column label="SIP 服务地址" min-width="150">
        <template #default="{ row }">{{ row.serverIp }}:{{ row.serverPort }}</template>
      </el-table-column>
      <el-table-column label="启用" width="70">
        <template #default="{ row }">
          <el-tag :type="row.enable ? 'success' : 'danger'">
            {{ row.enable ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在线" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'">
            {{ row.status ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="channelCount" label="通道数" width="80" />
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openShare(row)">通道分享</el-button>
          <el-button link type="success" @click="onPush(row)">推送</el-button>
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

    <!-- 平台编辑 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑平台' : '新增平台'" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px">
        <el-divider content-position="left">基本</el-divider>
        <el-form-item label="启用">
          <el-switch v-model="form.enable" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>

        <el-divider content-position="left">SIP 服务端(上级平台)</el-divider>
        <el-form-item label="服务国标编码" prop="serverGBId">
          <el-input v-model="form.serverGBId" />
        </el-form-item>
        <el-form-item label="服务国标域" prop="serverGBDomain">
          <el-input v-model="form.serverGBDomain" />
        </el-form-item>
        <el-form-item label="服务 IP" prop="serverIp">
          <el-input v-model="form.serverIp" />
        </el-form-item>
        <el-form-item label="服务端口" prop="serverPort">
          <el-input-number v-model="form.serverPort" :min="1" :max="65535" />
        </el-form-item>

        <el-divider content-position="left">设备端(本平台注册身份)</el-divider>
        <el-form-item label="设备国标编号" prop="deviceGBId">
          <el-input v-model="form.deviceGBId" />
        </el-form-item>
        <el-form-item label="设备 IP" prop="deviceIp">
          <el-input v-model="form.deviceIp" />
        </el-form-item>
        <el-form-item label="设备端口" prop="devicePort">
          <el-input-number v-model="form.devicePort" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="认证用户名">
          <el-input v-model="form.username" placeholder="留空用设备国标编号" />
        </el-form-item>
        <el-form-item label="认证密码">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>

        <el-divider content-position="left">注册与保活</el-divider>
        <el-form-item label="注册周期(秒)">
          <el-input-number v-model="form.expires" :min="0" />
        </el-form-item>
        <el-form-item label="心跳周期(秒)">
          <el-input-number v-model="form.keepTimeout" :min="0" />
        </el-form-item>
        <el-form-item label="传输协议">
          <el-select v-model="form.transport">
            <el-option label="UDP" value="UDP" />
            <el-option label="TCP" value="TCP" />
          </el-select>
        </el-form-item>
        <el-form-item label="字符集">
          <el-select v-model="form.characterSet">
            <el-option label="UTF-8" value="UTF-8" />
            <el-option label="GB2312" value="GB2312" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">功能开关</el-divider>
        <el-form-item label="允许云台">
          <el-switch v-model="form.ptz" />
        </el-form-item>
        <el-form-item label="RTCP 保活">
          <el-switch v-model="form.rtcp" />
        </el-form-item>
        <el-form-item label="目录分组(每包通道)">
          <el-select v-model="form.catalogGroup">
            <el-option :value="1" label="1" />
            <el-option :value="2" label="2" />
            <el-option :value="4" label="4" />
            <el-option :value="8" label="8" />
          </el-select>
        </el-form-item>
        <el-form-item label="自动推送通道">
          <el-switch v-model="form.autoPushChannel" />
        </el-form-item>
        <el-form-item label="作为消息通道">
          <el-switch v-model="form.asMessageChannel" />
        </el-form-item>
        <el-form-item label="回复 200OK IP">
          <el-input v-model="form.sendStreamIp" />
        </el-form-item>

        <el-divider content-position="left">目录属性</el-divider>
        <el-form-item label="目录含平台">
          <el-select v-model="form.catalogWithPlatform">
            <el-option :value="0" label="关闭" />
            <el-option :value="1" label="打开" />
          </el-select>
        </el-form-item>
        <el-form-item label="目录含分组">
          <el-select v-model="form.catalogWithGroup">
            <el-option :value="0" label="关闭" />
            <el-option :value="1" label="打开" />
          </el-select>
        </el-form-item>
        <el-form-item label="目录含区划">
          <el-select v-model="form.catalogWithRegion">
            <el-option :value="0" label="关闭" />
            <el-option :value="1" label="打开" />
          </el-select>
        </el-form-item>
        <el-form-item label="行政区划">
          <el-input v-model="form.civilCode" />
        </el-form-item>
        <el-form-item label="平台厂商">
          <el-input v-model="form.manufacturer" />
        </el-form-item>
        <el-form-item label="平台型号">
          <el-input v-model="form.model" />
        </el-form-item>
        <el-form-item label="安装地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="注册方式">
          <el-select v-model="form.registerWay">
            <el-option :value="1" label="1-标准认证" />
            <el-option :value="2" label="2-口令双向认证" />
            <el-option :value="3" label="3-证书双向认证" />
            <el-option :value="4" label="4-证书单向认证" />
          </el-select>
        </el-form-item>
        <el-form-item label="保密属性">
          <el-select v-model="form.secrecy">
            <el-option :value="0" label="0-不涉密" />
            <el-option :value="1" label="1-涉密" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 通道分享 -->
    <el-dialog v-model="shareVisible" :title="`通道分享 - ${sharePlatform?.name}`" width="720px">
      <el-form inline>
        <el-form-item>
          <el-button type="primary" @click="openPicker">添加通道</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="success" @click="onShareAll">分享全部通道</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="shareLoading" :data="shareList" stripe>
        <el-table-column prop="gbDeviceId" label="国标编号" min-width="170" />
        <el-table-column prop="gbName" label="名称" min-width="140" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="danger" @click="onRemoveShared(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="sharePage"
        v-model:page-size="shareCount"
        :total="shareTotal"
        :page-sizes="[10, 20]"
        layout="total, sizes, prev, pager, next"
        class="pager"
        @change="loadShareChannels"
      />
    </el-dialog>

    <!-- 通道选择 -->
    <el-dialog v-model="pickerVisible" title="选择通道" width="680px">
      <el-table
        :data="pickerList"
        stripe
        @selection-change="pickerSelection = $event"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column prop="gbDeviceId" label="国标编号" min-width="170" />
        <el-table-column prop="gbName" label="名称" min-width="140" />
      </el-table>
      <el-pagination
        v-model:current-page="pickerPage"
        v-model:page-size="pickerCount"
        :total="pickerTotal"
        layout="total, prev, pager, next"
        class="pager"
        @change="loadPickerChannels"
      />
      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!pickerSelection.length"
          @click="onAddPicked"
        >
          添加所选({{ pickerSelection.length }})
        </el-button>
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
