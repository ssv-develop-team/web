<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { queryCommonChannels } from '@/api/channel'
import {
  addRecordPlan,
  deleteRecordPlan,
  getRecordPlan,
  linkRecordPlan,
  queryRecordPlans,
  updateRecordPlan,
  type RecordPlan,
} from '@/api/recordPlan'
import type { CommonGBChannel } from '@/api/types/wvp'

/** 半小时序号 → HH:MM 显示(0-47) */
function slotLabel(idx: number): string {
  const h = Math.floor(idx / 2)
  const m = idx % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
}

const SLOTS = Array.from({ length: 48 }, (_, i) => ({ value: i, label: slotLabel(i) }))
const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const loading = ref(false)
const list = ref<RecordPlan[]>([])
const total = ref(0)
const page = ref(1)
const count = ref(10)
const query = ref('')

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const formRef = ref<{ validate: () => Promise<void> }>()
const form = ref<RecordPlan>(emptyForm())

function emptyForm(): RecordPlan {
  return { name: '', snap: false, planItemList: [] }
}

const rules = {
  name: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const resp = await queryRecordPlans({
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

/** query 接口不返回 planItemList,编辑时用 get 取完整时间段(04 §4.9) */
async function openEdit(row: RecordPlan) {
  isEdit.value = true
  form.value = { ...row, planItemList: [] }
  try {
    const detail = await getRecordPlan(row.id!)
    form.value = {
      ...detail,
      planItemList: (detail.planItemList ?? []).map((it) => ({ ...it })),
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '获取计划详情失败')
  }
  dialogVisible.value = true
}

function addPlanItem() {
  form.value.planItemList = [
    ...(form.value.planItemList ?? []),
    { start: 0, stop: 1, weekDay: 1 },
  ]
}

function removePlanItem(index: number) {
  form.value.planItemList = (form.value.planItemList ?? []).filter((_, i) => i !== index)
}

async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!form.value.planItemList?.length) {
    ElMessage.warning('请至少添加一个计划时间段')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      planItemList: form.value.planItemList.map(({ start, stop, weekDay }) => ({
        start,
        stop,
        weekDay,
      })),
    }
    if (isEdit.value) {
      await updateRecordPlan({ id: form.value.id!, ...payload })
    } else {
      await addRecordPlan(payload)
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

async function onDelete(row: RecordPlan) {
  try {
    await ElMessageBox.confirm(`确认删除录制计划 ${row.name}?`, '删除确认', {
      type: 'warning',
    })
    await deleteRecordPlan(row.id!)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

// ---- 关联通道 ----
const linkVisible = ref(false)
const linkPlan = ref<RecordPlan | null>(null)
const linkAll = ref(false)
const pickerList = ref<CommonGBChannel[]>([])
const pickerTotal = ref(0)
const pickerPage = ref(1)
const pickerCount = ref(10)
const pickerSelection = ref<CommonGBChannel[]>([])

async function openLink(row: RecordPlan) {
  linkPlan.value = row
  linkAll.value = false
  pickerSelection.value = []
  pickerPage.value = 1
  await loadLinkChannels()
  linkVisible.value = true
}

async function loadLinkChannels() {
  const resp = await queryCommonChannels({
    page: pickerPage.value,
    count: pickerCount.value,
  })
  pickerList.value = resp.list
  pickerTotal.value = resp.total
}

async function onLink() {
  if (!linkPlan.value) return
  try {
    await linkRecordPlan({
      planId: linkPlan.value.id!,
      channelIds: linkAll.value ? undefined : pickerSelection.value.map((c) => c.gbId),
      allLink: linkAll.value || undefined,
    })
    ElMessage.success('关联成功')
    linkVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '关联失败')
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
          placeholder="搜索计划名称"
          clearable
          @clear="search"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="openAdd">新增计划</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="channelCount" label="关联通道数" width="110" />
      <el-table-column label="定时截图" width="90">
        <template #default="{ row }">
          <el-tag :type="row.snap ? 'success' : 'info'">
            {{ row.snap ? '开启' : '关闭' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间段" min-width="220">
        <template #default="{ row }">
          <el-tag
            v-for="(it, i) in (row.planItemList ?? []).slice(0, 3)"
            :key="i"
            class="slot-tag"
          >
            周{{ it.weekDay }} {{ slotLabel(it.start) }}-{{ slotLabel(it.stop) }}
          </el-tag>
          <span v-if="(row.planItemList ?? []).length > 3" class="more">
            等 {{ (row.planItemList ?? []).length }} 段
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openLink(row)">关联通道</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑录制计划' : '新增录制计划'" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="计划名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="定时截图">
          <el-switch v-model="form.snap" />
        </el-form-item>
        <el-divider content-position="left">时间段(半小时粒度)</el-divider>
        <div v-for="(item, i) in form.planItemList" :key="i" class="plan-item">
          <el-select v-model="item.weekDay" class="week">
            <el-option v-for="d in WEEKDAYS" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
          <el-select v-model="item.start" class="slot">
            <el-option v-for="s in SLOTS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <span class="dash">至</span>
          <el-select v-model="item.stop" class="slot">
            <el-option v-for="s in SLOTS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-button link type="danger" @click="removePlanItem(i)">移除</el-button>
        </div>
        <el-button class="add-item" @click="addPlanItem">+ 添加时间段</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="linkVisible" :title="`关联通道 - ${linkPlan?.name}`" width="680px">
      <el-form inline>
        <el-form-item>
          <el-checkbox v-model="linkAll">关联全部通道</el-checkbox>
        </el-form-item>
      </el-form>
      <el-table
        v-if="!linkAll"
        :data="pickerList"
        stripe
        @selection-change="pickerSelection = $event"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column prop="gbDeviceId" label="国标编号" min-width="170" />
        <el-table-column prop="gbName" label="名称" min-width="140" />
      </el-table>
      <el-pagination
        v-if="!linkAll"
        v-model:current-page="pickerPage"
        v-model:page-size="pickerCount"
        :total="pickerTotal"
        layout="total, prev, pager, next"
        class="pager"
        @change="loadLinkChannels"
      />
      <template #footer>
        <el-button @click="linkVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!linkAll && !pickerSelection.length"
          @click="onLink"
        >
          关联{{ linkAll ? '全部' : `所选(${pickerSelection.length})` }}
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

.slot-tag {
  margin: 2px 4px 2px 0;
}

.more {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.week {
  width: 110px;
}

.slot {
  width: 100px;
}

.dash {
  color: var(--el-text-color-secondary);
}

.add-item {
  margin-left: 100px;
}
</style>
