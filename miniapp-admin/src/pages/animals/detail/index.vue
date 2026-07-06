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
          <view class="action-chip action-chip--primary" @click="onEdit" aria-label="编辑档案">
            <image class="chip-icon" src="/static/icons/icon-edit.svg" mode="aspectFit" />
            <text class="chip-text">编辑</text>
          </view>
          <view class="action-chip action-chip--danger" @click="onArchiveClick" aria-label="归档档案">
            <image class="chip-icon" src="/static/icons/icon-archive.svg" mode="aspectFit" />
            <text class="chip-text">归档</text>
          </view>
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
      <image class="empty-icon-img" src="/static/icons/icon-paw.svg" mode="aspectFit" />
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
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 40rpx;
  /* 状态栏安全区，避免内容与微信胶囊重叠 */
  padding-top: env(safe-area-inset-top);
}
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 24rpx; color: #BBBBBB; }
.empty-text { font-size: 28rpx; color: #999; }
.photo-section {
  background: #000;
  position: relative;
  overflow: hidden;
}
.main-photo {
  width: 100%;
  height: 500rpx;
  display: block;
}
.info-card { background: #FFF; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.info-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.breed { font-size: 36rpx; font-weight: 700; color: #1A1A1A; }

/* 状态 tag — 删 !important 让三色生效；增加圆点 */
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 16rpx 4rpx 12rpx;
  border-radius: 10rpx;
  color: #FF6B6B;
  background: rgba(255, 107, 107, 0.1);
}

.status-tag::before {
  content: '';
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
}

.status-lost    { color: #FF6B6B; background: rgba(255, 107, 107, 0.1); }
.status-found   { color: #0FBF9F; background: rgba(15, 191, 159, 0.1); }
.status-claimed { color: #FF9F00; background: rgba(255, 159, 0, 0.1); }
.status-archived{ color: #888888; background: rgba(187, 187, 187, 0.18); }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.info-item { display: flex; flex-direction: column; }
.label { font-size: 22rpx; color: #999; }
.value { font-size: 26rpx; color: #1A1A1A; margin-top: 4rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 16rpx; }
.address { font-size: 26rpx; color: #666; display: block; margin-bottom: 16rpx; }
.address-wrap { display: flex; align-items: center; }
.address-icon { width: 22rpx; height: 22rpx; margin-right: 6rpx; flex-shrink: 0; color: #999; }
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
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #FFFFFF;
  border-bottom: 1rpx solid #F0F0F0;
  position: sticky;
  top: 0;
  z-index: 10;
}
.page-title { font-size: 32rpx; font-weight: 700; color: #1A1A1A; }

/* ====== 顶部"编辑/归档"chip 按钮（替代裸文字链接）====== */
.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  height: 56rpx;
  padding: 0 18rpx;
  border-radius: 28rpx;
  font-size: 24rpx;
  font-weight: 600;
  transition: transform 0.1s, opacity 0.2s, background 0.2s;
  min-width: 100rpx;          /* 触摸目标 ≥ 44px */
  justify-content: center;
}

.action-chip:active {
  transform: scale(0.95);
  opacity: 0.85;
}

.chip-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.chip-text {
  font-size: 24rpx;
  line-height: 1;
}

/* 主色 chip：编辑（绿） */
.action-chip--primary {
  background: rgba(15, 191, 159, 0.1);
  color: #0FBF9F;
}
.action-chip--primary .chip-icon { color: #0FBF9F; }
.action-chip--primary:active {
  background: rgba(15, 191, 159, 0.2);
}

/* 危险 chip：归档（红） */
.action-chip--danger {
  background: rgba(255, 107, 107, 0.1);
  color: #FF6B6B;
}
.action-chip--danger .chip-icon { color: #FF6B6B; }
.action-chip--danger:active {
  background: rgba(255, 107, 107, 0.2);
}

/* 保留原 .action-link 类但不再使用（兼容已编辑态可能保留的引用） */
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
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #FFFFFF;
  border-top: 1rpx solid #F0F0F0;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.04);
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
  transition: transform 0.1s, opacity 0.2s;
}

.btn-primary:active, .btn-secondary:active {
  transform: scale(0.99);
}

.btn-primary { background: #0FBF9F; color: #FFF; box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3); }
.btn-primary[disabled] { background: #BFE9DF; color: #FFF; box-shadow: none; opacity: 0.7; }
.btn-secondary { background: #F5F5F5; color: #666; }
.btn-secondary[disabled] { opacity: 0.5; color: #999; }
</style>
