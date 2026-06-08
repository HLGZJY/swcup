# 管理端动物档案 CRUD 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理端补齐动物档案的新增、编辑、软删（归档）能力。前端内嵌编辑表单,后端支持 `include_archived` 查询参数。

**Architecture:** 后端微改 1 个 service 方法加 query 参数。前端抽 `<AnimalForm>` 组件支持 read/edit/new 三模式,详情页用 mode 切换,列表页加 FAB 新建按钮和归档 toggle。

**Tech Stack:** NestJS + TypeORM (后端) / uni-app + Vue 3 Composition API (前端)

**Spec:** `docs/superpowers/specs/2026-06-08-admin-animal-crud-design.md`

**测试约定:** 本项目无单测基建,以手测 checklist 替代。改完用 curl 或 HBuilderX 验证。

---

## File Map

| 文件 | 操作 | 职责 |
|---|---|---|
| `backend/src/animals/animals.service.ts` | 改 | `findAll` 加 `include_archived` 参数 |
| `miniapp-admin/src/pages/animals/components/AnimalForm.vue` | 新建 | 通用动物表单(read/edit/new 三模式) |
| `miniapp-admin/src/pages/animals/detail/index.vue` | 改 | 集成 AnimalForm + mode 切换 + 编辑/归档按钮 |
| `miniapp-admin/src/pages/animals/index.vue` | 改 | 加 FAB "+" + 归档 toggle |

---

## Task 1: 后端 `findAll` 加 `include_archived` 参数

**Files:**
- Modify: `backend/src/animals/animals.service.ts:12-22`

- [ ] **Step 1: 修改 `findAll` 方法签名**

打开 `backend/src/animals/animals.service.ts`,找到 `findAll` 方法(第 12-22 行),把签名改为:

```ts
async findAll(query: { page?: number; limit?: number; species?: string; status?: string; keyword?: string; include_archived?: boolean | string }) {
  const { page = 1, limit = 20, species, status, keyword, include_archived } = query;
  const qb = this.animalRepo.createQueryBuilder('a');
  if (species) qb.andWhere('a.species = :species', { species });
  if (status) qb.andWhere('a.status = :status', { status });
  if (!include_archived || include_archived === 'false') {
    qb.andWhere('a.status != :archived', { archived: 'archived' });
  }
  if (keyword) {
    qb.andWhere('(a.breed LIKE :kw OR a.color LIKE :kw OR a.address LIKE :kw)', { kw: `%${keyword}%` });
  }
  const [list, total] = await qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
  return { total, list };
}
```

要点:
- `include_archived` 类型是 `boolean | string`,因为 query 参数序列化后是字符串
- 默认 `false`(或 'false' / undefined)= 默认隐藏 archived
- 注意:`status` 和 `include_archived` 共存时,`status=archived` 应该能查到(因为不再加 `!= archived` 过滤)

- [ ] **Step 2: 验证编译**

```bash
cd F:/swcup2026/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "animals\.service|error TS" | head -5
```

预期:无输出(无错误)。

- [ ] **Step 3: 提交**

```bash
cd F:/swcup2026
git add backend/src/animals/animals.service.ts
git commit -m "feat(animals): add include_archived query param to findAll

管理端动物列表需要支持'显示归档'开关。后端默认隐藏
archived 动物,前端传 include_archived=true 时显示。"
```

---

## Task 2: 创建 `<AnimalForm>` 组件(只读模式)

**Files:**
- Create: `miniapp-admin/src/pages/animals/components/AnimalForm.vue`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p F:/swcup2026/miniapp-admin/src/pages/animals/components
```

- [ ] **Step 2: 写入组件(只读 + edit/new 占位)**

新建 `miniapp-admin/src/pages/animals/components/AnimalForm.vue`:

```vue
<template>
  <view class="animal-form">
    <!-- 基本信息 -->
    <view class="form-card">
      <view class="form-row">
        <text class="form-label">状态</text>
        <text v-if="mode === 'read'" class="form-value">{{ statusMap[form.status] || form.status }}</text>
        <picker v-else mode="selector" :range="statusOptions" range-key="label" :value="statusIndex" @change="onStatusChange">
          <text class="form-picker">{{ statusOptions[statusIndex]?.label || '请选择' }}</text>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">物种</text>
        <text v-if="mode === 'read'" class="form-value">{{ form.species === 'cat' ? '猫' : form.species === 'dog' ? '狗' : '其他' }}</text>
        <picker v-else mode="selector" :range="speciesOptions" range-key="label" :value="speciesIndex" @change="onSpeciesChange">
          <text class="form-picker">{{ speciesOptions[speciesIndex]?.label || '请选择' }}</text>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">品种</text>
        <text v-if="mode === 'read'" class="form-value">{{ form.breed || '—' }}</text>
        <input v-else class="form-input" v-model="form.breed" placeholder="如:柴犬" maxlength="50" />
      </view>

      <view class="form-row">
        <text class="form-label">颜色</text>
        <text v-if="mode === 'read'" class="form-value">{{ form.color || '—' }}</text>
        <input v-else class="form-input" v-model="form.color" placeholder="如:白色" maxlength="50" />
      </view>

      <view class="form-row">
        <text class="form-label">性别</text>
        <text v-if="mode === 'read'" class="form-value">{{ genderMap[form.gender] || form.gender || '—' }}</text>
        <picker v-else mode="selector" :range="genderOptions" range-key="label" :value="genderIndex" @change="onGenderChange">
          <text class="form-picker">{{ genderOptions[genderIndex]?.label || '请选择' }}</text>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">年龄</text>
        <text v-if="mode === 'read'" class="form-value">{{ ageMap[form.age_estimate] || form.age_estimate || '—' }}</text>
        <picker v-else-if="mode === 'edit' || mode === 'new'" mode="selector" :range="ageOptions" range-key="label" :value="ageIndex" @change="onAgeChange">
          <text class="form-picker">{{ ageOptions[ageIndex]?.label || '不限' }}</text>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">健康状况</text>
        <text v-if="mode === 'read'" class="form-value">{{ healthMap[form.health_status] || form.health_status || '—' }}</text>
        <picker v-else mode="selector" :range="healthOptions" range-key="label" :value="healthIndex" @change="onHealthChange">
          <text class="form-picker">{{ healthOptions[healthIndex]?.label || '请选择' }}</text>
        </picker>
      </view>

      <view class="form-row form-row-switch">
        <text class="form-label">是否绝育</text>
        <text v-if="mode === 'read'" class="form-value">{{ form.sterilized ? '已绝育' : '未绝育' }}</text>
        <switch v-else :checked="!!form.sterilized" @change="(e: any) => form.sterilized = e.detail.value" color="#0FBF9F" />
      </view>
    </view>

    <!-- 位置与备注 -->
    <view class="form-card">
      <view class="form-row form-row-vertical">
        <text class="form-label">发现地址</text>
        <text v-if="mode === 'read'" class="form-value">{{ form.address || '—' }}</text>
        <input v-else class="form-input" v-model="form.address" placeholder="如:北京市朝阳区xx路" maxlength="255" />
      </view>

      <view class="form-row form-row-vertical">
        <text class="form-label">备注</text>
        <text v-if="mode === 'read'" class="form-value form-value-multi">{{ form.notes || '—' }}</text>
        <textarea v-else class="form-textarea" v-model="form.notes" placeholder="附加信息..." maxlength="-1" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface AnimalFormData {
  status: string
  species: string
  breed: string
  color: string
  gender: string
  age_estimate: string
  health_status: string
  sterilized: boolean
  address: string
  notes: string
}

const props = defineProps<{
  mode: 'read' | 'edit' | 'new'
  initialValue?: Partial<AnimalFormData>
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'submit', data: AnimalFormData): void
  (e: 'delete'): void
}>()

// 表单内部状态(深拷贝初值,避免修改 props)
const form = ref<AnimalFormData>({
  status: 'lost',
  species: 'dog',
  breed: '',
  color: '',
  gender: 'unknown',
  age_estimate: '',
  health_status: 'unknown',
  sterilized: false,
  address: '',
  notes: '',
})

watch(
  () => props.initialValue,
  (val) => {
    if (val) Object.assign(form.value, val)
  },
  { immediate: true, deep: true }
)

const statusMap: Record<string, string> = { lost: '走失', found: '发现', claimed: '待认领', archived: '归档' }
const genderMap: Record<string, string> = { male: '公', female: '母', unknown: '未知' }
const ageMap: Record<string, string> = { puppy: '幼年', adult: '成年', senior: '老年' }
const healthMap: Record<string, string> = { healthy: '健康', injured: '受伤', ill: '生病', unknown: '未知' }

const statusOptions = [
  { value: 'lost', label: '走失' },
  { value: 'found', label: '发现' },
  { value: 'claimed', label: '待认领' },
  { value: 'archived', label: '归档' },
]
const speciesOptions = [
  { value: 'cat', label: '猫' },
  { value: 'dog', label: '狗' },
  { value: 'other', label: '其他' },
]
const genderOptions = [
  { value: 'male', label: '公' },
  { value: 'female', label: '母' },
  { value: 'unknown', label: '未知' },
]
const ageOptions = [
  { value: '', label: '不限' },
  { value: 'puppy', label: '幼年' },
  { value: 'adult', label: '成年' },
  { value: 'senior', label: '老年' },
]
const healthOptions = [
  { value: 'healthy', label: '健康' },
  { value: 'injured', label: '受伤' },
  { value: 'ill', label: '生病' },
  { value: 'unknown', label: '未知' },
]

const statusIndex = computed(() => statusOptions.findIndex((o) => o.value === form.value.status))
const speciesIndex = computed(() => speciesOptions.findIndex((o) => o.value === form.value.species))
const genderIndex = computed(() => genderOptions.findIndex((o) => o.value === form.value.gender))
const ageIndex = computed(() => {
  const idx = ageOptions.findIndex((o) => o.value === form.value.age_estimate)
  return idx === -1 ? 0 : idx
})
const healthIndex = computed(() => healthOptions.findIndex((o) => o.value === form.value.health_status))

function onStatusChange(e: any) { form.value.status = statusOptions[e.detail.value]?.value || 'lost' }
function onSpeciesChange(e: any) { form.value.species = speciesOptions[e.detail.value]?.value || 'dog' }
function onGenderChange(e: any) { form.value.gender = genderOptions[e.detail.value]?.value || 'unknown' }
function onAgeChange(e: any) { form.value.age_estimate = ageOptions[e.detail.value]?.value || '' }
function onHealthChange(e: any) { form.value.health_status = healthOptions[e.detail.value]?.value || 'unknown' }

// 对外暴露的方法,供父组件触发提交
defineExpose({
  submit() {
    emit('submit', { ...form.value })
  },
  cancel() {
    emit('cancel')
  },
  archive() {
    emit('delete')
  },
})
</script>

<style scoped lang="scss">
.animal-form { padding-bottom: 200rpx; }
.form-card { background: #FFF; margin: 24rpx; border-radius: 16rpx; padding: 0 24rpx; }
.form-row { display: flex; align-items: center; padding: 28rpx 0; border-bottom: 1rpx solid #F5F5F5; min-height: 80rpx; }
.form-row:last-child { border-bottom: none; }
.form-row-vertical { flex-direction: column; align-items: stretch; }
.form-row-switch { justify-content: space-between; }
.form-label { width: 160rpx; font-size: 26rpx; color: #666; flex-shrink: 0; }
.form-value { flex: 1; font-size: 28rpx; color: #1A1A1A; }
.form-value-multi { white-space: pre-wrap; line-height: 1.6; padding-top: 8rpx; }
.form-input { flex: 1; font-size: 28rpx; color: #1A1A1A; }
.form-picker { flex: 1; font-size: 28rpx; color: #1A1A1A; }
.form-textarea { width: 100%; height: 160rpx; font-size: 26rpx; color: #1A1A1A; padding: 16rpx 0; box-sizing: border-box; }
</style>
```

要点:
- `mode='read'` 时所有字段只渲染 text,不渲染 input/picker
- 用 `defineExpose` 暴露 `submit/cancel/archive` 方法给父组件调用
- 状态完全在组件内部,父组件只通过 emit 接收

- [ ] **Step 3: 验证编译**

HBuilderX 会自动重载,无需手动编译。检查步骤:在编辑器打开此文件,确认无红色波浪线。

- [ ] **Step 4: 提交**

```bash
cd F:/swcup2026
git add miniapp-admin/src/pages/animals/components/AnimalForm.vue
git commit -m "feat(admin-animals): add AnimalForm component

通用动物档案表单组件,支持 read/edit/new 三模式。
只读模式渲染 text,编辑/新建模式渲染 picker/input。
通过 defineExpose 暴露 submit/cancel/archive 给父组件。"
```

---

## Task 3: 详情页加 mode 切换与 AnimalForm 集成

**Files:**
- Modify: `miniapp-admin/src/pages/animals/detail/index.vue`

- [ ] **Step 1: 修改 `<template>` 区域**

把当前 `<template>` 全部替换为:

```vue
<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading && mode === 'read'">
      <text>加载中...</text>
    </view>

    <!-- 新建模式无 animal_id,直接渲染空表单 -->
    <template v-else-if="mode === 'new'">
      <view class="page-header">
        <text class="page-title">新建动物档案</text>
      </view>
      <AnimalForm
        ref="formRef"
        mode="new"
        @submit="onCreate"
        @cancel="onCancel"
      />
      <view class="action-bar">
        <button class="btn-secondary" @click="onCancel">取消</button>
        <button class="btn-primary" :disabled="submitting" @click="formRef?.submit()">
          {{ submitting ? '创建中...' : '创建' }}
        </button>
      </view>
    </template>

    <!-- 详情/编辑模式:有 animal_id -->
    <template v-else-if="animal">
      <view class="page-header">
        <text class="page-title">{{ mode === 'edit' ? '编辑档案' : '档案详情' }}</text>
        <view v-if="mode === 'read'" class="header-actions">
          <text class="action-link" @click="onEdit">编辑</text>
          <text class="action-link action-danger" @click="onArchiveClick">归档</text>
        </view>
      </view>

      <!-- 照片区(只读) -->
      <view v-if="mode === 'read'" class="photo-section">
        <image class="main-photo" :src="resolveImageUrl(animal.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
      </view>

      <AnimalForm
        v-if="mode !== 'new'"
        ref="formRef"
        :mode="mode"
        :initialValue="animal"
        :submitting="submitting"
        @submit="onSave"
        @cancel="onCancelEdit"
        @delete="onArchiveClick"
      />

      <view v-if="mode === 'edit'" class="action-bar">
        <button class="btn-secondary" @click="onCancelEdit">取消</button>
        <button class="btn-primary" :disabled="submitting" @click="formRef?.submit()">
          {{ submitting ? '保存中...' : '保存' }}
        </button>
      </view>
    </template>

    <!-- 找不到档案 -->
    <view class="empty-state" v-else>
      <image class="empty-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
      <text class="empty-text">未找到该动物档案</text>
    </view>
  </view>
</template>
```

要点:
- 顶层根据 `mode` 分支:`new` / `animal` (read/edit) / 空
- 只读模式下还显示照片(AnimalForm 不管照片)
- 编辑模式下"取消"和"保存"按钮在 action-bar
- 只读模式顶部有"编辑"和"归档"链接

- [ ] **Step 2: 修改 `<script setup>` 区域**

把整个 `<script setup lang="ts">` 块替换为:

```ts
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminAnimalDetail, apiCreateAnimal, apiUpdateAnimal, resolveImageUrl } from '@/services/api'
import AnimalForm from '../components/AnimalForm.vue'

const animal = ref<any>(null)
const loading = ref(false)
const submitting = ref(false)
const mode = ref<'read' | 'edit' | 'new'>('read')
const formRef = ref<InstanceType<typeof AnimalForm> | null>(null)
const editingSnapshot = ref<any>(null)

function extractErrorMessage(e: any): string {
  const data = e?.data
  const msg = data?.message ?? data?.data?.message
  if (Array.isArray(msg)) return msg.filter(Boolean).map(String).join('；')
  if (typeof msg === 'string') return msg
  if (typeof data?.message === 'string') return data.message
  return e?.errMsg || e?.message || '未知错误'
}

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const animalId = currentPage?.options?.animal_id
  const queryMode = currentPage?.options?.mode

  if (queryMode === 'new' || !animalId) {
    mode.value = 'new'
    return
  }

  loading.value = true
  try {
    const res: any = await apiGetAdminAnimalDetail(animalId)
    if (res.code === 0) {
      animal.value = res.data
    }
  } catch (e) {
    // 错误由 api.js 拦截器处理
  } finally {
    loading.value = false
  }
})

function onEdit() {
  if (!animal.value) return
  editingSnapshot.value = JSON.parse(JSON.stringify(animal.value))
  mode.value = 'edit'
}

function onCancelEdit() {
  if (editingSnapshot.value) {
    animal.value = editingSnapshot.value
  }
  mode.value = 'read'
}

function onCancel() {
  uni.navigateBack()
}

async function onSave(data: any) {
  if (!animal.value) return
  submitting.value = true
  try {
    const res: any = await apiUpdateAnimal(animal.value.animal_id, data)
    if (res.code === 0) {
      animal.value = { ...animal.value, ...data }
      editingSnapshot.value = null
      mode.value = 'read'
      uni.showToast({ title: '保存成功', icon: 'success' })
    } else {
      uni.showModal({ title: '保存失败', content: res.message || '未知错误', showCancel: false, confirmText: '我知道了' })
    }
  } catch (e) {
    uni.showModal({ title: '保存失败', content: extractErrorMessage(e), showCancel: false, confirmText: '我知道了' })
  } finally {
    submitting.value = false
  }
}

async function onCreate(data: any) {
  submitting.value = true
  try {
    const res: any = await apiCreateAnimal(data)
    if (res.code === 0) {
      const newId = res.data?.animal_id
      uni.showToast({ title: '创建成功', icon: 'success' })
      if (newId) {
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/animals/detail/index?animal_id=${newId}` })
        }, 600)
      } else {
        setTimeout(() => uni.navigateBack(), 600)
      }
    } else {
      uni.showModal({ title: '创建失败', content: res.message || '未知错误', showCancel: false, confirmText: '我知道了' })
    }
  } catch (e) {
    uni.showModal({ title: '创建失败', content: extractErrorMessage(e), showCancel: false, confirmText: '我知道了' })
  } finally {
    submitting.value = false
  }
}

function onArchiveClick() {
  if (!animal.value) return
  uni.showModal({
    title: '归档动物档案',
    content: `确认将「${animal.value.breed || '该动物'}」归档吗?归档后默认不在列表显示,可在归档筛选中查看。`,
    cancelText: '取消',
    confirmText: '确认归档',
    success: async (res) => {
      if (!res.confirm) return
      submitting.value = true
      try {
        const r: any = await apiUpdateAnimal(animal.value.animal_id, { status: 'archived' })
        if (r.code === 0) {
          animal.value = { ...animal.value, status: 'archived' }
          editingSnapshot.value = null
          mode.value = 'read'
          uni.showToast({ title: '已归档', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 800)
        } else {
          uni.showModal({ title: '归档失败', content: r.message || '未知错误', showCancel: false, confirmText: '我知道了' })
        }
      } catch (e) {
        uni.showModal({ title: '归档失败', content: extractErrorMessage(e), showCancel: false, confirmText: '我知道了' })
      } finally {
        submitting.value = false
      }
    },
  })
}
</script>
```

要点:
- `mode='new'` 时不调 `apiGetAdminAnimalDetail`,直接渲染空表单
- 编辑前用 `editingSnapshot` 备份,取消时回滚
- 创建成功后用 `redirectTo` 跳到新档案的详情页(read 模式)
- 归档成功后回退到列表页(让用户看到列表已隐藏)
- 软删走 `apiUpdateAnimal(..., { status: 'archived' })` 而非 `apiDeleteAnimal`

- [ ] **Step 3: 在 `<style>` 中追加新样式**

在 `</style>` 之前(201 行 `</style>` 标签前)插入:

```scss
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: #FFF;
  border-bottom: 1rpx solid #F5F5F5;
}
.page-title { font-size: 32rpx; font-weight: 700; color: #1A1A1A; }
.header-actions { display: flex; gap: 24rpx; }
.action-link { font-size: 26rpx; color: #0FBF9F; padding: 8rpx 12rpx; }
.action-danger { color: #FF6B6B; }
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  background: #FFF;
  border-top: 1rpx solid #F5F5F5;
  z-index: 10;
}
.btn-primary, .btn-secondary {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.btn-primary { background: #0FBF9F; color: #FFF; }
.btn-primary[disabled] { background: #BFE9DF; color: #FFF; }
.btn-secondary { background: #F5F5F5; color: #666; }
```

- [ ] **Step 4: 在 HBuilderX 中手动验证**

按 spec 手测 checklist B/C/D 走一遍:
- 列表点击行 → 详情只读(头部有"编辑""归档")
- 点"编辑" → 字段切可编辑,底部出现"取消/保存"
- 改字段点"保存" → 弹"保存成功",回到只读,字段是新的
- 改字段点"取消" → 回到只读,字段是原值
- 列表点"+" → 跳到 `detail?mode=new`,表单空白,底部"取消/创建"
- 留空必填点"创建" → 弹"创建失败"+ 后端 message
- 填齐点"创建" → 跳到新档案详情
- 详情点"归档" → 弹确认 → 确认后回列表,列表无该动物

- [ ] **Step 5: 提交**

```bash
cd F:/swcup2026
git add miniapp-admin/src/pages/animals/detail/index.vue
git commit -m "feat(admin-animals): integrate AnimalForm with mode switching in detail page

详情页支持 read/edit/new 三模式:
- read: 只读 AnimalForm,头部加"编辑"和"归档"链接
- edit: 可编辑 AnimalForm + 底部"取消/保存",快照支持取消回滚
- new: 空白 AnimalForm + 底部"取消/创建",成功后跳新档案
归档走 PUT status=archived 软删除,弹窗二次确认。"
```

---

## Task 4: 列表页加 FAB "+" 和归档 toggle

**Files:**
- Modify: `miniapp-admin/src/pages/animals/index.vue`

- [ ] **Step 1: 修改 `<template>` 区域**

把"动物列表" `<scroll-view>` 之后(在 `</view>` 闭合整个 `.list-area` 之后,`</view>` 闭合 `.page` 之前)插入 FAB 按钮。同时把"状态筛选" `<view class="filter-tabs">` 末尾追加归档 toggle。

具体:在原文件第 54 行 `</scroll-view>` 之后,插入:

```vue
      <!-- 浮动新建按钮 -->
      <view class="fab-add" @click="onCreateNew">
        <text class="fab-icon">+</text>
      </view>
    </view>
  </view>
</template>
```

(注意:原模板结构是 `<view class="page">` → `search-bar` → `filter-tabs` → `list-area` 包裹 scroll-view → 关闭。我要在 scroll-view 之后加 fab,但 fab 不在 scroll-view 内。让我看原结构再调整:)

实际原模板结构(从前面读取):
```
<view class="page">
  <view class="search-bar">...</view>
  <view class="filter-tabs">...</view>
  <scroll-view class="list-area">...</scroll-view>
</view>
```

fab 应该是 page 的直接子元素,放在 `</scroll-view>` 之后但在 `</view>` (page 关闭) 之前。修改后:

```
<view class="page">
  <view class="search-bar">...</view>
  <view class="filter-tabs">
    [原 4 个 tab]
    [新增归档 toggle]
  </view>
  <scroll-view class="list-area">...</scroll-view>
  <view class="fab-add" @click="onCreateNew">+</view>
</view>
```

完整修改后的模板区域(替换原 1-56 行):

```vue
<template>
  <view class="page">
    <!-- 搜索筛选 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
        <input class="search-input" placeholder="搜索动物档案" v-model="keyword" @confirm="onSearch" />
      </view>
    </view>

    <!-- 状态筛选 + 归档 toggle -->
    <view class="filter-bar">
      <view class="filter-tabs">
        <view
          v-for="tab in statusTabs"
          :key="tab.value"
          :class="['filter-tab', { active: currentStatus === tab.value }]"
          @click="onFilter(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>
      <view class="archive-toggle">
        <switch :checked="showArchived" @change="onToggleArchive" color="#0FBF9F" style="transform: scale(0.8);" />
        <text class="archive-label">显示归档</text>
      </view>
    </view>

    <!-- 动物列表 -->
    <scroll-view class="list-area" scroll-y @scrolltolower="onLoadMore">
      <view class="empty-state" v-if="animals.length === 0 && !loading">
        <image class="empty-icon-img" src="/static/icons/icon-image.png" mode="aspectFit" />
        <text class="empty-text">{{ showArchived ? '暂无归档档案' : '暂无动物档案' }}</text>
      </view>

      <view
        v-for="animal in animals"
        :key="animal.animal_id"
        class="animal-row"
        @click="showAnimalDetail(animal)"
      >
        <image class="animal-photo" :src="resolveImageUrl(animal.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
        <view class="animal-info">
          <view class="info-header">
            <text class="breed">{{ animal.breed }}</text>
            <view :class="['status-tag', 'status-' + animal.status]">{{ statusMap[animal.status] }}</view>
          </view>
          <text class="color">{{ animal.color }} · {{ animal.gender === 'male' ? '♂️' : '♀️' }}</text>
          <view class="address-wrap">
            <image class="address-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
            <text class="address">{{ animal.address }}</text>
          </view>
        </view>
        <text class="arrow">›</text>
      </view>

      <view class="no-more" v-if="!hasMore && animals.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>

    <!-- 浮动新建按钮 -->
    <view class="fab-add" @click="onCreateNew">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>
```

要点:
- 把 `filter-tabs` 包到外层 `filter-bar`,并列放 `archive-toggle`
- 空状态文案根据 `showArchived` 切换

- [ ] **Step 2: 修改 `<script setup>` 区域**

在 `const currentStatus = ref('all')` 之后插入 `showArchived` ref 和 toggle 函数。在 `onFilter` 函数之后插入 `onCreateNew` 函数。在 `loadAnimals` 函数中加 `include_archived` 参数。

完整修改后的 script(替换原 58-137 行):

```ts
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiGetAdminAnimals, resolveImageUrl } from '@/services/api'

const keyword = ref('')
const currentStatus = ref('all')
const showArchived = ref(false)
const animals = ref<any[]>([])
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 10

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '走失', value: 'lost' },
  { label: '发现', value: 'found' },
  { label: '待认领', value: 'claimed' },
  { label: '归档', value: 'archived' },
]

const statusMap: Record<string, string> = {
  lost: '走失', found: '发现', claimed: '待认领', archived: '归档'
}

onMounted(() => {
  loadAnimals()
})

async function loadAnimals(append = false) {
  if (loading.value) return
  loading.value = true

  if (!append) {
    page.value = 1
    animals.value = []
  }

  const params: any = { page: page.value, limit: pageSize }
  if (currentStatus.value !== 'all') params.status = currentStatus.value
  if (keyword.value) params.keyword = keyword.value
  params.include_archived = showArchived.value

  try {
    const res: any = await apiGetAdminAnimals(params)
    if (res.code === 0) {
      if (append) {
        animals.value.push(...res.data?.list || [])
      } else {
        animals.value = res.data?.list || []
      }
      hasMore.value = (res.data?.total || 0) > animals.value.length
      if (hasMore.value) page.value++
    }
  } catch (e) {
    console.error('加载动物列表失败', e)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
  loading.value = false
}

function onSearch() {
  animals.value = []
  loadAnimals()
}

function onFilter(status: string) {
  currentStatus.value = status
  animals.value = []
  loadAnimals()
}

function onToggleArchive(e: any) {
  showArchived.value = e.detail.value
  // 切到"归档"tab 时,后端 include_archived 已无效(因为 status=archived 自身就显示归档)
  if (e.detail.value && currentStatus.value !== 'archived') {
    currentStatus.value = 'all'
  }
  loadAnimals()
}

function onLoadMore() {
  if (!hasMore.value) return
  loadAnimals(true)
}

function showAnimalDetail(animal: any) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animal.animal_id}` })
}

function onCreateNew() {
  uni.navigateTo({ url: '/pages/animals/detail/index?mode=new' })
}
</script>
```

要点:
- `params.include_archived = showArchived.value` 把 toggle 状态传给后端
- 开启"显示归档"时,自动切到"全部"tab(因为 status=archived 是单独的 tab)
- statusTabs 加了"归档"项,让用户能直接筛归档

- [ ] **Step 3: 在 `<style>` 中追加新样式**

在 `</style>` 之前(311 行 `</style>` 之前)插入:

```scss
.filter-bar {
  display: flex;
  align-items: center;
  background: #FFF;
  border-bottom: 1rpx solid #F5F5F5;
}
.filter-bar .filter-tabs { flex: 1; padding: 0 24rpx; }
.filter-tabs { display: flex; }
.archive-toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 24rpx;
  flex-shrink: 0;
}
.archive-label { font-size: 24rpx; color: #666; }
.fab-add {
  position: fixed;
  right: 32rpx;
  bottom: 48rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #0FBF9F;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(15, 191, 159, 0.4);
  z-index: 100;
}
.fab-icon { color: #FFF; font-size: 56rpx; font-weight: 300; line-height: 1; }
```

要点:
- 把原 `.filter-tabs` 的 `padding: 0 36rpx` 改成 `padding: 0 24rpx`(因为外层 filter-bar 给左右 padding)
- 实际可保留原 padding,把 filter-bar 改成不设 padding;或者在内部 override。简单起见,直接覆盖。

- [ ] **Step 4: 在 HBuilderX 中手动验证**

按 spec 手测 checklist A 走一遍:
- 列表默认显示"全部"tab + 5 个 tab + "显示归档"开关
- "显示归档"关闭:archived 动物不出现
- "显示归档"开启:archived 动物出现
- 点"归档"tab:只显示归档动物
- 点右下角"+":跳转到 `detail?mode=new`
- 搜索框输入关键字点搜索:列表刷新

- [ ] **Step 5: 提交**

```bash
cd F:/swcup2026
git add miniapp-admin/src/pages/animals/index.vue
git commit -m "feat(admin-animals): add FAB new button and archive toggle to list page

列表页头部加'显示归档'switch(传 include_archived 给后端),
状态 tab 加'归档'项;右下角浮动按钮 '+' 跳 detail?mode=new。
开启归档 toggle 时自动切到'全部'tab,避免双重过滤。"
```

---

## Task 5: 集成手测与回归

**Files:** 无(纯手测)

- [ ] **Step 1: 完整跑一遍 spec 第 7 节的手测 checklist**

打开 HBuilderX,运行 admin 小程序到微信开发者工具。逐项验证:

**A. 列表页**
- [ ] 空列表(没数据时):显示"暂无动物档案"
- [ ] 5 个状态 tab + "显示归档"开关
- [ ] 点"+":跳 `detail?mode=new`
- [ ] "显示归档"关闭:archived 动物不出现
- [ ] "显示归档"开启:archived 动物出现
- [ ] 点"归档"tab:只显示 archived
- [ ] 搜索:列表刷新
- [ ] 滚动到底:加载下一页

**B. 新建模式**
- [ ] 进入:表单字段为空,无"归档"按钮
- [ ] 必填留空点"创建":弹错误,不调 API
- [ ] 填齐必填点"创建":成功后跳 detail?animal_id={新 ID}
- [ ] 取消:返回列表

**C. 编辑模式**
- [ ] 点"编辑":字段切换为可输入
- [ ] 改字段点"取消":回到只读,字段恢复
- [ ] 改字段点"保存":PUT 200,字段为新值
- [ ] breed 超过 50 字:maxlength 截断

**D. 软删**
- [ ] 点"归档":弹确认
- [ ] 确认:状态变"归档",列表"全部"不显示、"归档"tab 显示
- [ ] 归档后编辑:可改,保存后状态保持 archived

**E. 错误处理**
- [ ] 后端关闭:弹"网络异常"
- [ ] 后端 4xx:弹后端 message
- [ ] 后端 5xx:弹"服务器异常"

- [ ] **Step 2: 回归验证现有功能未坏**

- [ ] 详情页"鼻纹 ID"卡片仍显示(若之前有)
- [ ] 详情页"标签"卡片仍显示(若 animal 有 tags)
- [ ] 详情页地图预览仍可点
- [ ] 列表搜索/筛选/分页仍工作

- [ ] **Step 3: 修复发现的问题**

任何不符合预期的现象,立即修。**不放过已知的明显 bug**。

- [ ] **Step 4: 提交(如有修复)**

```bash
cd F:/swcup2026
git add -A
git commit -m "fix(admin-animals): regression fixes from integration test

手测 checklist 过程中发现的问题修复。"
```

(若无修复,跳过此步)

---

## 完成标志

- ✅ 后端 `findAll` 接受 `include_archived` 参数
- ✅ `<AnimalForm>` 组件支持 read/edit/new 三模式
- ✅ 详情页支持 mode 切换 + 内嵌编辑 + 软删
- ✅ 列表页支持新建 FAB + 归档 toggle
- ✅ 软删走 `status=archived`,默认隐藏
- ✅ 5 类手测 checklist 全部通过
