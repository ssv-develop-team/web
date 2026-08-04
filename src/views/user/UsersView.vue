<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { addUser, deleteUser, queryRoles, queryUsers, type User } from '@/api/user'

const loading = ref(false)
const list = ref<User[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)

const roles = ref<{ id: number; name?: string }[]>([])

const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref({ username: '', password: '', roleId: 1 })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

async function load() {
  loading.value = true
  try {
    const resp = await queryUsers({ page: page.value, count: count.value })
    list.value = resp.list
    total.value = resp.total
  } finally {
    loading.value = false
  }
}

async function openAdd() {
  form.value = { username: '', password: '', roleId: 1 }
  if (!roles.value.length) {
    roles.value = await queryRoles()
  }
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
    await addUser(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(row: User) {
  try {
    await ElMessageBox.confirm(`确认删除用户 ${row.username}?`, '删除确认', {
      type: 'warning',
    })
    await deleteUser(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      // 管理员删除由后端强校验拦截(04 §4.1),错误提示直接展示
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
        <el-button type="primary" @click="openAdd">新增用户</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">{{ row.role?.name ?? row.role?.id }}</template>
      </el-table-column>
      <el-table-column prop="pushKey" label="pushKey" min-width="220" show-overflow-tooltip />
      <el-table-column prop="createTime" label="创建时间" min-width="160" />
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
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

    <el-dialog v-model="dialogVisible" title="新增用户" width="440px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="roleId">
          <el-select v-model="form.roleId">
            <el-option
              v-for="r in roles"
              :key="r.id"
              :label="r.name ?? `角色 ${r.id}`"
              :value="r.id"
            />
          </el-select>
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
