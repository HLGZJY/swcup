<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!userInfo">
      <view class="empty-icon-bg">
        <image class="empty-icon-img" src="/static/icons/icon-user.svg" mode="aspectFit" />
      </view>
      <text class="empty-title">未找到该用户</text>
      <text class="empty-sub">可能已被删除或链接失效</text>
    </view>

    <template v-else>
      <!-- 用户基本信息卡片 -->
      <view class="info-card user-card" :class="'card-accent-' + userInfo.role">
        <view class="user-header">
          <view class="user-base">
            <view class="name-row">
              <text class="nickname">{{ userInfo.nickname }}</text>
              <view :class="['role-tag', 'role-' + userInfo.role]">
                <view class="role-dot"></view>
                <text>{{ roleMap[userInfo.role] }}</text>
              </view>
            </view>
            <view class="phone-row">
              <image class="phone-icon" src="/static/icons/icon-phone.svg" mode="aspectFit" />
              <text class="phone">{{ maskPhone(userInfo.phone) }}</text>
            </view>
          </view>
        </view>
        <view class="info-row">
          <image class="info-row-icon" src="/static/icons/icon-calendar.svg" mode="aspectFit" />
          <text class="label">注册时间</text>
          <text class="value">{{ formatDate(userInfo.created_at) }}</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-bar">
        <view class="btn-edit" @tap="openEditModal">
          <image class="btn-icon" src="/static/icons/icon-edit.svg" mode="aspectFit" />
          <text>编辑信息</text>
        </view>
        <view :class="['btn-block', { 'btn-unblock': userInfo.role === 'blocked' }]" @tap="toggleBlock">
          <image class="btn-icon" :src="userInfo.role === 'blocked' ? '/static/icons/icon-check.svg' : '/static/icons/icon-x.svg'" mode="aspectFit" />
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
          <image
            class="tab-icon"
            :src="tab.icon"
            mode="aspectFit"
          />
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <!-- 列表内容 -->
      <scroll-view class="list-area" scroll-y @scrolltolower="loadMore">
        <!-- 上报事件 -->
        <template v-if="currentTab === 'events'">
          <view class="empty-list" v-if="events.length === 0 && !loadingMore">
            <view class="empty-list-icon-bg">
              <image class="empty-list-icon" src="/static/icons/icon-event.svg" mode="aspectFit" />
            </view>
            <text class="empty-list-text">暂无上报事件</text>
          </view>
          <view
            v-for="ev in events"
            :key="ev.event_id"
            class="list-card"
            :class="'list-card-accent-' + ev.status"
            @tap="goToEvent(ev.event_id)"
          >
            <view class="list-card-accent"></view>
            <view class="list-card-content">
              <view class="card-header">
                <text class="card-title">{{ ev.title || '事件 #' + ev.event_id }}</text>
                <view :class="['status-badge', 'status-' + ev.status]">
                  <view class="status-dot"></view>
                  <text>{{ ev.status }}</text>
                </view>
              </view>
              <text class="card-desc">{{ ev.description || '' }}</text>
              <view class="card-time-row">
                <image class="card-time-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
                <text class="card-time">{{ formatDateTime(ev.created_at) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 认领记录 -->
        <template v-if="currentTab === 'claims'">
          <view class="empty-list" v-if="claims.length === 0 && !loadingMore">
            <view class="empty-list-icon-bg">
              <image class="empty-list-icon" src="/static/icons/icon-shield.svg" mode="aspectFit" />
            </view>
            <text class="empty-list-text">暂无认领记录</text>
          </view>
          <view
            v-for="cl in claims"
            :key="cl.claim_id"
            class="list-card"
            :class="'list-card-accent-' + cl.status"
          >
            <view class="list-card-accent"></view>
            <view class="list-card-content">
              <view class="card-header">
                <text class="card-title">认领 #{{ cl.claim_id }}</text>
                <view :class="['status-badge', 'status-' + cl.status]">
                  <view class="status-dot"></view>
                  <text>{{ statusMap[cl.status] || cl.status }}</text>
                </view>
              </view>
              <text class="card-desc">{{ cl.notes || '' }}</text>
              <view class="card-time-row">
                <image class="card-time-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
                <text class="card-time">{{ formatDateTime(cl.created_at) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 关联动物 -->
        <template v-if="currentTab === 'animals'">
          <view class="empty-list" v-if="animals.length === 0 && !loadingMore">
            <view class="empty-list-icon-bg">
              <image class="empty-list-icon" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" />
            </view>
            <text class="empty-list-text">暂无关联动物</text>
          </view>
          <view
            v-for="an in animals"
            :key="an.animal_id"
            class="list-card"
            :class="'list-card-accent-' + an.status"
            @tap="goToAnimal(an.animal_id)"
          >
            <view class="list-card-accent"></view>
            <view class="list-card-content list-card-content--animal">
              <image class="animal-thumb" :src="resolveImageUrl(an.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
              <view class="animal-info">
                <text class="card-title">{{ an.breed || '动物 #' + an.animal_id }}</text>
                <text class="card-desc">{{ an.color || '' }} · {{ genderMap[an.gender] || '' }}</text>
              </view>
              <view :class="['status-badge', 'status-' + an.status]">
                <view class="status-dot"></view>
                <text>{{ an.status }}</text>
              </view>
            </view>
          </view>
        </template>

        <view class="loading-more" v-if="loadingMore">
          <view class="loading-spinner-small"></view>
          <text>加载中...</text>
        </view>
        <view class="no-more" v-if="!hasMore && listData.length > 0">
          <view class="no-more-line"></view>
          <text>— 没有更多了 —</text>
          <view class="no-more-line"></view>
        </view>
      </scroll-view>
    </template>

    <!-- 编辑 Modal -->
    <view class="modal-mask" v-if="showEditModal" @tap="closeEditModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-title-row">
          <image class="modal-title-icon" src="/static/icons/icon-edit.svg" mode="aspectFit" />
          <text class="modal-title">编辑用户信息</text>
        </view>
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
  { key: 'events',  label: '上报事件', icon: '/static/icons/icon-event.svg' },
  { key: 'claims',  label: '认领记录', icon: '/static/icons/icon-shield.svg' },
  { key: 'animals', label: '关联动物', icon: '/static/icons/icon-paw-filled.svg' }
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
.page {
  min-height: 100vh;
  background: #F5F7FA;
  display: flex;
  flex-direction: column;
}

/* ============ 加载/空状态 ============ */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 16rpx;
}

.loading-spinner {
  width: 56rpx;
  height: 56rpx;
  border: 4rpx solid #F0F0F0;
  border-top-color: #0FBF9F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 26rpx;
  color: #999999;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  padding: 0 32rpx;
}

.empty-icon-bg {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.1) 0%, rgba(76, 144, 230, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-icon-img {
  width: 80rpx;
  height: 80rpx;
  color: #0FBF9F;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 8rpx;
}

.empty-sub {
  font-size: 24rpx;
  color: #999999;
}

/* 用户卡片空列表（Tab 内容区）*/
.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  gap: 16rpx;
}

.empty-list-icon-bg {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.06) 0%, rgba(76, 144, 230, 0.06) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-list-icon {
  width: 60rpx;
  height: 60rpx;
  color: #BBBBBB;
}

.empty-list-text {
  font-size: 26rpx;
  color: #999999;
}

/* ============ 用户卡（带左侧色条）============ */
.info-card {
  position: relative;
  background: #FFFFFF;
  margin: 24rpx 24rpx 16rpx;
  border-radius: 20rpx;
  padding: 24rpx 24rpx 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  overflow: hidden;
}

.info-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
  background: #EEEEEE;
}

.info-card.card-accent-user    ::before { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.info-card.card-accent-admin   ::before { background: linear-gradient(180deg, #FF6B6B 0%, #E53A3A 100%); }
.info-card.card-accent-org     ::before { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.info-card.card-accent-blocked ::before { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }

.user-card { margin-bottom: 0; }

.user-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.user-base { flex: 1; min-width: 0; }

.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}

.nickname {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A1A;
  letter-spacing: 1rpx;
}

.phone-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 14rpx;
  background: #FAFBFC;
  border-radius: 10rpx;
  align-self: flex-start;
}

.phone-icon {
  width: 24rpx;
  height: 24rpx;
  color: #BBBBBB;
  flex-shrink: 0;
}

.phone {
  font-size: 26rpx;
  color: #666666;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 4rpx 0;
}

.info-row-icon {
  width: 26rpx;
  height: 26rpx;
  color: #BBBBBB;
  flex-shrink: 0;
}

.info-row .label {
  font-size: 24rpx;
  color: #999999;
  min-width: 120rpx;
}

.info-row .value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  flex: 1;
  text-align: right;
}

/* ============ 角色 tag — 圆点+浅底 ============ */
.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(15, 191, 159, 0.1);
  color: #0FBF9F;
}

.role-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.role-user    { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.role-admin   { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.role-org     { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }
.role-blocked { background: rgba(187, 187, 187, 0.18); color: #888888; }

/* ============ 操作按钮（带 SVG 图标 + 微动效）============ */
.action-bar {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #FFFFFF;
}

.btn-edit, .btn-block, .btn-unblock {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: transform 0.1s, opacity 0.2s;
}

.btn-edit:active, .btn-block:active, .btn-unblock:active {
  transform: scale(0.97);
}

.btn-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.btn-edit {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}
.btn-edit .btn-icon { filter: brightness(0) invert(1); }

.btn-block {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 107, 0.3);
}
.btn-block .btn-icon { filter: brightness(0) invert(1); }

.btn-unblock {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}
.btn-unblock .btn-icon { filter: brightness(0) invert(1); }

/* ============ Tab 栏（带 SVG 图标）============ */
.tab-bar {
  display: flex;
  background: #FFFFFF;
  border-bottom: 1rpx solid #F0F0F0;
  margin-top: 8rpx;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666666;
  position: relative;
  transition: color 0.2s;
}

.tab-icon {
  width: 32rpx;
  height: 32rpx;
  color: #999999;
  flex-shrink: 0;
  transition: color 0.2s;
}

.tab-item.active {
  color: #0FBF9F;
  font-weight: 600;
}

.tab-item.active .tab-icon { color: #0FBF9F; }

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #0FBF9F;
  border-radius: 2rpx;
}

/* ============ 列表区 ============ */
.list-area {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
  height: 0;
}

/* 列表卡（带左侧色条） */
.list-card {
  position: relative;
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
  transition: transform 0.1s, background 0.2s;
}

.list-card:active {
  transform: scale(0.99);
  background: #FAFBFC;
}

.list-card-accent {
  width: 6rpx;
  flex-shrink: 0;
}

.list-card-accent-pending   .list-card-accent { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.list-card-accent-confirmed .list-card-accent { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.list-card-accent-resolved  .list-card-accent { background: linear-gradient(180deg, #4C90E6 0%, #0FBF9F 100%); }
.list-card-accent-duplicated .list-card-accent { background: linear-gradient(180deg, #9B7BFF 0%, #8B5CF6 100%); }
.list-card-accent-rejected  .list-card-accent { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.list-card-accent-lost      .list-card-accent { background: linear-gradient(180deg, #FF6B6B 0%, #E53A3A 100%); }
.list-card-accent-found     .list-card-accent { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.list-card-accent-claimed   .list-card-accent { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.list-card-accent-approved  .list-card-accent { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.list-card-accent-archived  .list-card-accent { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.list-card-accent-other     .list-card-accent { background: #EEEEEE; }

.list-card-content {
  flex: 1;
  padding: 20rpx 20rpx 20rpx 16rpx;
  min-width: 0;
}

.list-card-content--animal {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.card-desc {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 10rpx;
  line-height: 1.5;
  word-break: break-all;
}

.card-time-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.card-time-icon {
  width: 22rpx;
  height: 22rpx;
  color: #BBBBBB;
  flex-shrink: 0;
}

.card-time {
  font-size: 22rpx;
  color: #999999;
  font-variant-numeric: tabular-nums;
}

/* ============ 状态 badge（圆点+浅底）============ */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(15, 191, 159, 0.1);
  color: #0FBF9F;
  flex-shrink: 0;
}

.status-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-pending    { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }
.status-approved   { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.status-rejected   { background: rgba(187, 187, 187, 0.18); color: #888888; }
.status-lost       { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.status-found      { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.status-claimed    { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }

/* 动物卡片特有 */
.animal-thumb {
  width: 88rpx;
  height: 88rpx;
  border-radius: 14rpx;
  background: #F5F5F5;
  flex-shrink: 0;
  border: 2rpx solid #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}

.animal-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

/* ============ 分页加载 ============ */
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  font-size: 22rpx;
  color: #BBBBBB;
  gap: 16rpx;
}

.no-more-line {
  width: 60rpx;
  height: 1rpx;
  background: #DDDDDD;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #0FBF9F;
  gap: 12rpx;
}

.loading-spinner-small {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid #F0F0F0;
  border-top-color: #0FBF9F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ============ Modal ============ */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 32rpx;
}

.modal-content {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 600rpx;
  max-width: 90vw;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.15);
}

.modal-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin-bottom: 40rpx;
}

.modal-title-icon {
  width: 36rpx;
  height: 36rpx;
  color: #0FBF9F;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.form-item { margin-bottom: 32rpx; }
.form-label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 12rpx;
  font-weight: 500;
}
.form-input {
  background: #F5F7FA;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #0FBF9F;
  background: #FFFFFF;
}

.form-picker {
  background: #F5F7FA;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.picker-arrow {
  font-size: 20rpx;
  color: #999;
}

.modal-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 40rpx;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  transition: transform 0.1s, opacity 0.2s;
}

.btn-cancel:active, .btn-confirm:active { transform: scale(0.97); }

.btn-cancel { background: #F5F5F5; color: #666; }
.btn-confirm {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}
</style>
