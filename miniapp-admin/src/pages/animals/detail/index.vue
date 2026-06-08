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
        <button class="btn-secondary" :disabled="submitting" @click="onCancel">取消</button>
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
        <button class="btn-secondary" :disabled="submitting" @click="onCancelEdit">取消</button>
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
    }
    // 注: code !== 0 由 api.js 拦截器 reject,不会到达此处
  } catch (e) {
    // 错误已由 api.js 拦截器统一提示(短消息 toast / 长消息 modal),此处不重复弹窗
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
    }
    // 注: code !== 0 由 api.js 拦截器 reject,不会到达此处
  } catch (e) {
    // 错误已由 api.js 拦截器统一提示(短消息 toast / 长消息 modal),此处不重复弹窗
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
        }
        // 注: code !== 0 由 api.js 拦截器 reject,不会到达此处
      } catch (e) {
        // 错误已由 api.js 拦截器统一提示(短消息 toast / 长消息 modal),此处不重复弹窗
      } finally {
        submitting.value = false
      }
    },
  })
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 40rpx; }
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: #999; }
.photo-section { background: #000; }
.main-photo { width: 100%; height: 500rpx; }
.info-card { background: #FFF; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.info-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.breed { font-size: 36rpx; font-weight: 700; color: #1A1A1A; }
.status-tag { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; color: #FFF; background: #FF6B6B; }
.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.info-item { display: flex; flex-direction: column; }
.label { font-size: 22rpx; color: #999; }
.value { font-size: 26rpx; color: #1A1A1A; margin-top: 4rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 16rpx; }
.address { font-size: 26rpx; color: #666; display: block; margin-bottom: 16rpx; }
.address-wrap { display: flex; align-items: center; }
.address-icon { width: 22rpx; height: 22rpx; margin-right: 6rpx; flex-shrink: 0; }
.map-preview {
  height: 320rpx;
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 100%);
  border-radius: 24rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}

.map-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 12rpx;
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
}

.map-overlay text {
  font-size: 24rpx;
  color: #1A1A1A;
  background: rgba(255, 255, 255, 0.8);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
.time-item { display: flex; justify-content: space-between; padding: 8rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.time-item:last-child { border-bottom: none; }
.notes { font-size: 26rpx; color: #666; line-height: 1.6; }
.tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.tag { background: #E8FDF8; color: #0FBF9F; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.nose-id { font-size: 24rpx; color: #666; font-family: monospace; }
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
.btn-secondary[disabled] { opacity: 0.5; color: #999; }
</style>
