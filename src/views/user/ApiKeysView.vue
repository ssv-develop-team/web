<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  addApiKey,
  deleteApiKey,
  disableApiKey,
  enableApiKey,
  queryAllUsers,
  queryApiKeys,
  remarkApiKey,
  resetApiKey,
  type User,
  type UserApiKey,
} from '@/api/user'

const loading = ref(false)
const list = ref<UserApiKey[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)

const users = ref<User[]>([])

const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref({
  userId: 0,
  app: '',
  remark: '',
  expiresAt: '',
  enable: true,
})

const rules = {
  userId: [{ required: true, message: '请选择用户', trigger: 'change' }],
}

function fmtExpiredAt(ms?: number): string {
  if (!ms || ms <= 0) return '永不过期'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    const resp = await queryApiKeys({ page: page.value, count: count.value })
    list.value = resp.list
    total.value = resp.total
  } finally {
    loading.value = false
  }
}

async function openAdd() {
  form.value = { userId: 0, app: '', remark: '', expiresAt: '', enable: true }
  if (!users.value.length) {
    users.value = await queryAllUsers()
  }
  form.value.userId = users.value[0]?.id ?? 0
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
    await addApiKey({
      userId: form.value.userId,
      app: form.value.app || undefined,
      remark: form.value.remark || undefined,
      expiresAt: form.value.expiresAt || undefined,
      enable: form.value.enable,
    })
    ElMessage.success('创建成功')
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '创建失败')
  } finally {
    saving.value = false
  }
}

async function onToggle(row: UserApiKey) {
  try {
    if (row.enable) {
      await disableApiKey(row.id)
    } else {
      await enableApiKey(row.id)
    }
    ElMessage.success(row.enable ? '已停用' : '已启用')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function onReset(row: UserApiKey) {
  try {
    await ElMessageBox.confirm(`确认重置 ${row.app ?? row.id} 的密钥?`, '重置确认', {
      type: 'warning',
    })
    await resetApiKey(row.id)
    ElMessage.success('已重置,新密钥请查看列表 apiKey 列')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '重置失败')
    }
  }
}

async function onRemark(row: UserApiKey) {
  try {
    const { value } = await ElMessageBox.prompt('输入备注', '修改备注', {
      inputValue: row.remark ?? '',
    })
    await remarkApiKey(row.id, value)
    ElMessage.success('备注已更新')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '操作失败')
    }
  }
}

async function onDelete(row: UserApiKey) {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.app ?? row.id} 的 API Key?`, '删除确认', {
      type: 'warning',
    })
    await deleteApiKey(row.id)
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
    <el-form inline>
      <el-form-item>
        <el-button type="primary" @click="openAdd">创建 API Key</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="app" label="应用名" min-width="110" />
      <el-table-column prop="userId" label="用户 ID" width="80" />
      <el-table-column label="密钥" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.apiKey }}</template>
      </el-table-column>
      <el-table-column label="启用" width="70">
        <template #default="{ row }">
          <el-tag :type="row.enable ? 'success' : 'info'">
            {{ row.enable ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="过期时间" width="150">
        <template #default="{ row }">{{ fmtExpiredAt(row.expiredAt) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link :type="row.enable ? 'warning' : 'success'" @click="onToggle(row)">
            {{ row.enable ? '停用' : '启用' }}
          </el-button>
          <el-button link type="primary" @click="onReset(row)">重置</el-button>
          <el-button link type="primary" @click="onRemark(row)">备注</el-button>
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

    <el-dialog v-model="dialogVisible" title="创建 API Key" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户" prop="userId">
          <el-select v-model="form.userId">
            <el-option
              v-for="u in users"
              :key="u.id"
              :label="`${u.username} (${u.id})`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="应用名">
          <el-input v-model="form.app" placeholder="可选,如 ffmpeg" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="form.expiresAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="留空=永不过期"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enable" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">创建</el-button>
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
