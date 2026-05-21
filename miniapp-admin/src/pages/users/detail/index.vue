<template>
  <view class="page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-back" @tap="goBack">
        <text class="back-arrow">←</text>
      </view>
      <text class="nav-title">用户详情</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!userInfo">
      <image class="empty-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
      <text class="empty-text">未找到该用户</text>
    </view>

    <template v-else>
      <!-- 用户基本信息卡片 -->
      <view class="info-card user-card">
        <view class="user-header">
          <image class="avatar" :src="userInfo.avatar || '/static/mock/avatar-default.png'" mode="aspectFill" />
          <view class="user-base">
            <view class="name-row">
              <text class="nickname">{{ userInfo.nickname }}</text>
              <view :class="['role-tag', 'role-' + userInfo.role]">{{ roleMap[userInfo.role] }}</view>
            </view>
            <text class="phone">{{ maskPhone(userInfo.phone) }}</text>
          </view>
        </view>
        <view class="info-row">
          <text class="label">注册时间</text>
          <text class="value">{{ formatDate(userInfo.created_at) }}</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-bar">
        <view class="btn-edit" @tap="openEditModal">
          <text>编辑信息</text>
        </view>
        <view :class="['btn-block', { 'btn-unblock': userInfo.role === 'blocked' }]" @tap="toggleBlock">
          <text>{{ userInfo.role === 'blocked' ? '启用用户' : '禁用用户' }}</text>
        </view>
      </view>

      <!-- Tab切换 -->
      <view class="tab-bar">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-item', { active: currentTab === tab.key }]"
          @tap="switchTab(tab.key)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <!-- 列表内容 -->
      <scroll-view class="list-area" scroll-y @scrolltolower="loadMore">
        <!-- 上报事件 -->
        <template v-if="currentTab === 'events'">
          <view class="empty-list" v-if="events.length === 0 && !loadingMore">
            <text>暂无上报事件</text>
          </view>
          <view
            v-for="ev in events"
            :key="ev.event_id"
            class="list-card"
            @tap="goToEvent(ev.event_id)"
          >
            <view class="card-header">
              <text class="card-title">{{ ev.title || '事件 #' + ev.event_id }}</text>
              <view :class="['status-badge', 'status-' + ev.status]">{{ ev.status }}</view>
            </view>
            <text class="card-desc">{{ ev.description || '' }}</text>
            <text class="card-time">{{ formatDateTime(ev.created_at) }}</text>
          </view>
        </template>

        <!-- 认领记录 -->
        <template v-if="currentTab === 'claims'">
          <view class="empty-list" v-if="claims.length === 0 && !loadingMore">
            <text>暂无认领记录</text>
          </view>
          <view
            v-for="cl in claims"
            :key="cl.claim_id"
            class="list-card"
          >
            <view class="card-header">
              <text class="card-title">认领 #{{ cl.claim_id }}</text>
              <view :class="['status-badge', 'status-' + cl.status]">{{ statusMap[cl.status] }}</view>
            </view>
            <text class="card-desc">{{ cl.notes || '' }}</text>
            <text class="card-time">{{ formatDateTime(cl.created_at) }}</text>
          </view>
        </template>

        <!-- 关联动物 -->
        <template v-if="currentTab === 'animals'">
          <view class="empty-list" v-if="animals.length === 0 && !loadingMore">
            <text>暂无关联动物</text>
          </view>
          <view
            v-for="an in animals"
            :key="an.animal_id"
            class="list-card"
            @tap="goToAnimal(an.animal_id)"
          >
            <view class="card-header">
              <image class="animal-thumb" :src="an.photos?.[0] || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
              <view class="animal-info">
                <text class="card-title">{{ an.breed || '动物 #' + an.animal_id }}</text>
                <text class="card-desc">{{ an.color || '' }} · {{ genderMap[an.gender] || '' }}</text>
              </view>
              <view :class="['status-badge', 'status-' + an.status]">{{ an.status }}</view>
            </view>
          </view>
        </template>

        <view class="no-more" v-if="!hasMore && listData.length > 0">
          <text>— 没有更多了 —</text>
        </view>
        <view class="loading-more" v-if="loadingMore">
          <text>加载中...</text>
        </view>
      </scroll-view>
    </template>

    <!-- 编辑 Modal -->
    <view class="modal-mask" v-if="showEditModal" @tap="closeEditModal">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">编辑用户信息</text>
        <view class="form-item">
          <text class="form-label">昵称</text>
          <input class="form-input" v-model="editForm.nickname" placeholder="请输入昵称" />
        </view>
        <view class="form-item">
          <text class="form-label">手机号</text>
          <input class="form-input" type="number" v-model="editForm.phone" placeholder="请输入手机号" maxlength="11" />
        </view>
        <view class="form-item">
          <text class="form-label">角色</text>
          <picker :value="roleOptions.indexOf(editForm.role)" :range="roleOptions" @change="onRoleChange">
            <view class="form-picker">
              <text>{{ roleMap[editForm.role] }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
        </view>
        <view class="modal-actions">
          <view class="btn-cancel" @tap="closeEditModal">
            <text>取消</text>
          </view>
          <view class="btn-confirm" @tap="submitEdit">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetUserDetail, apiGetUserEvents, apiGetUserClaims, apiGetUserAnimals, apiUpdateUser, resolveImageUrl } from '@/services/api'

const userId = ref<string>('')
const userInfo = ref<any>(null)
const loading = ref(false)
const currentTab = ref('events')
const events = ref<any[]>([])
const claims = ref<any[]>([])
const animals = ref<any[]>([])
const page = ref(1)
const limit = ref(20)
const hasMore = ref(true)
const loadingMore = ref(false)
const showEditModal = ref(false)
const editForm = ref({ nickname: '', phone: '', role: 'user' })

const tabs = [
  { key: 'events', label: '上报事件' },
  { key: 'claims', label: '认领记录' },
  { key: 'animals', label: '关联动物' }
]

const roleMap: Record<string, string> = {
  user: '普通用户', admin: '管理员', org: '机构', blocked: '已禁用'
}

const roleOptions = ['user', 'admin', 'org', 'blocked']

const statusMap: Record<string, string> = {
  pending: '待处理', approved: '已批准', rejected: '已拒绝'
}

const genderMap: Record<string, string> = { male: '公', female: '母', unknown: '未知' }

const listData = computed(() => {
  if (currentTab.value === 'events') return events.value
  if (currentTab.value === 'claims') return claims.value
  return animals.value
})

// 获取当前登录用户ID，用于禁止禁用自己
const currentUserId = ref<number | null>(null)

onMounted(async () => {
  // 获取当前登录用户
  const stored = uni.getStorageSync('user_info')
  if (stored && typeof stored === 'string' && stored.trim()) {
    try {
      currentUserId.value = JSON.parse(stored).user_id
    } catch (e) {
      console.error('解析用户信息失败', e)
    }
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  userId.value = currentPage?.options?.user_id || ''
  if (!userId.value) return

  loading.value = true
  try {
    await Promise.all([loadUserDetail(), loadEvents()])
  } finally {
    loading.value = false
  }
})

async function loadUserDetail() {
  try {
    const res: any = await apiGetUserDetail(userId.value)
    if (res.code === 0) {
      userInfo.value = res.data
    }
  } catch (e) {
    console.error('加载用户详情失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

async function loadEvents() {
  try {
    const res: any = await apiGetUserEvents(userId.value, { page: 1, limit: limit.value })
    if (res.code === 0) {
      events.value = res.data?.list || []
      hasMore.value = events.value.length >= limit.value
      page.value = 1
    }
  } catch (e) {
      console.error('加载用户事件列表失败', e)
    }
}

async function loadClaims() {
  try {
    const res: any = await apiGetUserClaims(userId.value, { page: 1, limit: limit.value })
    if (res.code === 0) {
      claims.value = res.data?.list || []
      hasMore.value = claims.value.length >= limit.value
      page.value = 1
    }
  } catch (e) {
      console.error('加载用户认领列表失败', e)
    }
}

async function loadAnimals() {
  try {
    const res: any = await apiGetUserAnimals(userId.value, { page: 1, limit: limit.value })
    if (res.code === 0) {
      animals.value = res.data?.list || []
      hasMore.value = animals.value.length >= limit.value
      page.value = 1
    }
  } catch (e) {
    console.error('加载用户动物列表失败', e)
  }
}

function switchTab(key: string) {
  currentTab.value = key
  page.value = 1
  hasMore.value = true
  if (key === 'events') loadEvents()
  else if (key === 'claims') loadClaims()
  else if (key === 'animals') loadAnimals()
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  page.value++
  try {
    let res: any
    if (currentTab.value === 'events') {
      res = await apiGetUserEvents(userId.value, { page: page.value, limit: limit.value })
      if (res.code === 0) {
        events.value = [...events.value, ...(res.data?.list || [])]
      }
    } else if (currentTab.value === 'claims') {
      res = await apiGetUserClaims(userId.value, { page: page.value, limit: limit.value })
      if (res.code === 0) {
        claims.value = [...claims.value, ...(res.data?.list || [])]
      }
    } else {
      res = await apiGetUserAnimals(userId.value, { page: page.value, limit: limit.value })
      if (res.code === 0) {
        animals.value = [...animals.value, ...(res.data?.list || [])]
      }
    }
    if (res.code === 0) {
      hasMore.value = (res.data?.list || []).length >= limit.value
    }
  } catch (e) {
    console.error('加载更多失败', e)
  }
  loadingMore.value = false
}

function openEditModal() {
  editForm.value = {
    nickname: userInfo.value?.nickname || '',
    phone: userInfo.value?.phone || '',
    role: userInfo.value?.role || 'user'
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

function onRoleChange(e: any) {
  editForm.value.role = roleOptions[e.detail.value]
}

async function submitEdit() {
  if (!editForm.value.nickname.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (!/^1\d{10}$/.test(editForm.value.phone)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' })
    return
  }
  try {
    const res: any = await apiUpdateUser(userId.value, {
      nickname: editForm.value.nickname,
      phone: editForm.value.phone,
      role: editForm.value.role
    })
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      showEditModal.value = false
      loadUserDetail()
    }
  } catch (e) {
    console.error('保存用户信息失败', e)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

const toggleBlock = async () => {
  if (userInfo.value.role === 'blocked') {
    await apiUpdateUser(userId.value, { role: 'user' })
    uni.showToast({ title: '已启用', icon: 'success' })
  } else {
    if (currentUserId.value && Number(userId.value) === currentUserId.value) {
      uni.showToast({ title: '不能禁用自己', icon: 'none' })
      return
    }
    await apiUpdateUser(userId.value, { role: 'blocked' })
    uni.showToast({ title: '已禁用', icon: 'success' })
  }
  loadUserDetail()
}

function goBack() {
  uni.navigateBack()
}

function maskPhone(phone: string) {
  if (!phone) return '-'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function formatDate(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goToEvent(eventId: number) {
  uni.navigateTo({ url: `/pages/events/detail/index?event_id=${eventId}` })
}

function goToAnimal(animalId: number) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animalId}` })
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; display: flex; flex-direction: column; }

/* 导航栏 */
.nav-bar { display: flex; align-items: center; background: #FFFFFF; padding: 24rpx 24rpx; border-bottom: 1rpx solid #EEEEEE; }
.nav-back { width: 60rpx; }
.back-arrow { font-size: 36rpx; color: #1A1A1A; }
.nav-title { flex: 1; text-align: center; font-size: 32rpx; font-weight: 600; color: #1A1A1A; }
.nav-placeholder { width: 60rpx; }

/* 加载/空状态 */
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: #999; }
.empty-list { display: flex; justify-content: center; align-items: center; padding: 60rpx 0; font-size: 26rpx; color: #999; }

/* 用户卡片 */
.info-card { background: #FFF; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.user-card { margin-bottom: 0; }
.user-header { display: flex; align-items: center; margin-bottom: 20rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; margin-right: 20rpx; background: #F5F5F5; flex-shrink: 0; }
.user-base { flex: 1; }
.name-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.nickname { font-size: 32rpx; font-weight: 600; color: #1A1A1A; }
.phone { font-size: 26rpx; color: #666; }
.info-row { display: flex; justify-content: space-between; padding: 8rpx 0; border-top: 1rpx solid #F5F5F5; margin-top: 8rpx; }
.label { font-size: 24rpx; color: #999; }
.value { font-size: 24rpx; color: #1A1A1A; }

/* 角色标签 */
.role-tag { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 8rpx; color: #FFFFFF; }
.role-user { background: #0FBF9F; }
.role-admin { background: #FF6B6B; }
.role-org { background: #FF9F00; }
.role-blocked { background: #999999; }

/* 操作按钮 */
.action-bar { display: flex; gap: 16rpx; padding: 0 24rpx 24rpx; background: #FFF; }
.btn-edit, .btn-block, .btn-unblock { flex: 1; height: 80rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 500; }
.btn-edit { background: #0FBF9F; color: #FFFFFF; }
.btn-block { background: #FF6B6B; color: #FFFFFF; }
.btn-unblock { background: #0FBF9F; color: #FFFFFF; }

/* Tab栏 */
.tab-bar { display: flex; background: #FFFFFF; border-bottom: 1rpx solid #EEEEEE; margin-top: 16rpx; }
.tab-item { flex: 1; text-align: center; padding: 24rpx 0; font-size: 28rpx; color: #666; }
.tab-item.active { color: #0FBF9F; font-weight: 600; border-bottom: 4rpx solid #0FBF9F; }

/* 列表区 */
.list-area { flex: 1; padding: 24rpx; }
.list-card { background: #FFFFFF; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.card-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; }
.card-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; flex: 1; }
.card-desc { font-size: 24rpx; color: #666; display: block; margin-bottom: 8rpx; }
.card-time { font-size: 22rpx; color: #999; }

/* 动物卡片特有 */
.animal-thumb { width: 80rpx; height: 80rpx; border-radius: 12rpx; background: #F5F5F5; flex-shrink: 0; }
.animal-info { flex: 1; }

/* 状态标签 */
.status-badge { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 8rpx; color: #FFF; flex-shrink: 0; }
.status-pending { background: #FF9F00; }
.status-approved { background: #0FBF9F; }
.status-rejected { background: #999999; }
.status-lost { background: #FF6B6B; }
.status-found { background: #0FBF9F; }
.status-claimed { background: #FF9F00; }

/* 分页加载 */
.no-more { text-align: center; padding: 24rpx; font-size: 24rpx; color: #999; }
.loading-more { text-align: center; padding: 24rpx; font-size: 24rpx; color: #0FBF9F; }

/* Modal */
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-content { background: #FFFFFF; border-radius: 24rpx; padding: 40rpx; width: 600rpx; max-width: 90vw; }
.modal-title { font-size: 32rpx; font-weight: 600; color: #1A1A1A; display: block; text-align: center; margin-bottom: 40rpx; }
.form-item { margin-bottom: 32rpx; }
.form-label { font-size: 26rpx; color: #666; display: block; margin-bottom: 12rpx; }
.form-input { background: #F5F5F5; border-radius: 12rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #1A1A1A; }
.form-picker { background: #F5F5F5; border-radius: 12rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #1A1A1A; display: flex; justify-content: space-between; align-items: center; }
.picker-arrow { font-size: 20rpx; color: #999; }
.modal-actions { display: flex; gap: 16rpx; margin-top: 40rpx; }
.btn-cancel, .btn-confirm { flex: 1; height: 88rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 500; }
.btn-cancel { background: #F5F5F5; color: #666; }
.btn-confirm { background: #0FBF9F; color: #FFFFFF; }
</style>
