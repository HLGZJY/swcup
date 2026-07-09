<template>
  <view class="page">
    <!-- 结果概览 -->
    <view class="result-overview">
      <view class="overview-bg">
        <view class="score-circle">
          <view class="score-value">{{ topScore }}</view>
          <view class="score-label">融合得分</view>
        </view>
      </view>
      <view class="result-status" :class="resultClass">
        <text class="status-icon">{{ statusIcon }}</text>
        <text class="status-text">{{ statusText }}</text>
      </view>
    </view>

    <!-- 四维度得分 -->
    <view class="dimension-section">
      <text class="section-title">四维度融合分析</text>
      <view class="dimension-list">
        <view class="dimension-item" v-for="dim in dimensions" :key="dim.name">
          <view class="dim-header">
            <text class="dim-name">{{ dim.name }}</text>
            <text class="dim-value">{{ dim.value }}</text>
          </view>
          <view class="dim-bar-bg">
            <view class="dim-bar-fill" :style="{ width: dim.percent + '%', background: dim.color }"></view>
          </view>
          <text class="dim-desc">{{ dim.desc }}</text>
        </view>
      </view>
    </view>

    <!-- Top-N 匹配列表 -->
    <view class="match-section">
      <text class="section-title">匹配结果</text>
      <view class="match-count">共 {{ matchList.length }} 条匹配</view>
      <view
        v-for="(item, index) in matchList"
        :key="item.animal_id"
        :class="['match-card', { top1: index === 0 }]"
        @click="goToDetail(item.animal_id)"
      >
        <view class="match-rank">
          <text class="rank-num">{{ index + 1 }}</text>
        </view>
        <image
          class="match-photo"
          :src="resolveImageUrl(item.animal?.photos?.[0]) || '/static/mock/dog-placeholder.png'"
          mode="aspectFill"
        />
        <view class="match-info">
          <view class="match-header">
            <text class="match-breed">{{ item.animal?.breed }}</text>
            <view class="match-score" :class="getScoreClass(item.fusion_score)">
              {{ (item.fusion_score * 100).toFixed(0) }}%
            </view>
          </view>
          <text class="match-color">{{ item.animal?.color }}</text>
          <text class="match-location">{{ item.animal?.address }}</text>
          <view class="match-tags">
            <text class="match-tag">距 {{ item.gps_distance_m }}m</text>
            <text class="match-tag status-badge" :class="'status-' + (item.animal?.status || 'orphan')">
              {{ statusTextMap[item.animal?.status || 'orphan'] || '未建档' }}
            </text>
          </view>
        </view>
        <image class="arrow-img" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <!-- 确认重复: 显示"我要上报"(主) + "认领此动物"(次) -->
      <!-- 阶段 3 (2026-07-06 BUG-FIX): 用户实测反馈
           - 重复检测后只给认领按钮,无法给原档案补充发现记录
           - "我要上报" 提交一条 sighting 事件,事件 intent='stray_sighting'
           - "认领此动物" 走认领流程(animal-detail)
      -->
      <view class="action-hint" v-if="isDuplicateConfirmed">
        <text class="hint-icon">⚠️</text>
        <text>已确认重复,可以上报这条发现记录或认领这只动物</text>
      </view>
      <view class="btn-primary" v-if="isDuplicateConfirmed" @click="onReportSighting">
        <text>我要上报</text>
      </view>
      <view class="btn-secondary" v-if="isDuplicateConfirmed" @click="onClaimAnimal">
        <text>认领此动物</text>
      </view>
      <!-- 有匹配：上报此动物 -->
      <view class="btn-primary" v-if="showMatchList && !isDuplicateConfirmed" @click="onReport">
        <text>上报此动物</text>
      </view>
      <view class="btn-secondary" v-if="showMatchList && !isDuplicateConfirmed" @click="onBackHome">
        <text>返回首页</text>
      </view>
      <!-- Plan B 无匹配：双按钮 -->
      <view class="action-hint info-hint" v-if="needsConfirmation">
        <text class="hint-icon">ℹ️</text>
        <text>未在数据库中找到匹配动物</text>
      </view>
      <view class="btn-primary" v-if="needsConfirmation" @click="onCreateAnimal">
        <text>创建档案</text>
      </view>
      <view class="btn-secondary" v-if="needsConfirmation" @click="onCancel">
        <text>取消</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiNoseCompare, apiCreatePendingAnimalRequest, apiReportEvent, resolveImageUrl } from '@/services/api'

const collectResult = ref<any>(null)
const compareResult = ref<any>(null)
const selectedSpecies = ref('dog')
const noseId = ref('')
const formBreed = ref('')
const formColor = ref('')
const formGender = ref('')
const formSize = ref('')
const formCoatLength = ref('')
const formEarType = ref('')
const formTailType = ref('')
// 补充属性(从 collect 页带过来,用户实际选择)
const formAge = ref('')
const formHealth = ref('')
const formSterilized = ref('')
const formNotes = ref('')
// 位置(用于传给 apiNoseCompare 的 GPS 维度)
const locationLat = ref<number | null>(null)
const locationLng = ref<number | null>(null)
const locationText = ref('')
const bodyPhotoUrl = ref('')
const nosePhotoUrl = ref('')
// 阶段 3 (2026-07-06 BUG-FIX): 用户在 collect 表单选的 intent (lost/found)
//   - 低分走"创建档案" → apiCreatePendingAnimalRequest 走 pending 审核
//   - 高分走"我要上报" → 提交 sighting 事件, intent='stray_sighting' (路人上报)
const formIntent = ref<'lost' | 'found'>('lost')

// 【Defect 2 / 2026-07-08】【2026-07-09 重构】collect 跳过来时,后端 nose.service 透传 next_action:
//   - show_high_score_dialog  → 高分候选,result 页用户要选"认领"还是"创建档案"
//   - show_low_score_dialog   → 低分候选,直接显示 Plan B (创建档案)
//   - show_no_candidate_dialog → 无候选,直接显示 Plan B
//   不再使用旧名 'ask_user_confirm' / 'ask_user_create'
const passedNextAction = ref('')

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const { nose_id, species, breed, color, gender, body_photo_url, nose_photo_url, size, coat_length, ear_type, tail_type, age, health, sterilized, notes, location_lat, location_lng, location_text, intent, next_action } = currentPage.options || {}

  // 【2026-07-09 重构】接受新 3 命名;旧 'ask_user_confirm'/'ask_user_create' 仍兼容
  if (
    next_action === 'show_high_score_dialog' ||
    next_action === 'show_low_score_dialog' ||
    next_action === 'show_no_candidate_dialog' ||
    next_action === 'ask_user_confirm' ||    // 旧名兼容
    next_action === 'ask_user_create'        // 旧名兼容
  ) {
    passedNextAction.value = next_action
  }

  // 【Defect 2 / 2026-07-08】无鼻纹场景判定:
  //   - 有 next_action 兜底 (ask_user_confirm / ask_user_create) → 允许缺鼻纹,后续走 Plan B
  //   - 没有任何 next_action 兜底 + 缺鼻纹 → 才是真的"缺鼻纹ID,请重新采集",回退
  const hasNoValidNose = !nose_id || nose_id === 'undefined' || nose_id === 'null'
  if (hasNoValidNose && !passedNextAction.value) {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    uni.navigateBack()
    return
  }

  // 【Defect 2 / 2026-07-08】合法无鼻纹场景 → 不设 noseId,后续 apiNoseCompare 跳过
  if (!hasNoValidNose) {
    noseId.value = nose_id
  }
  selectedSpecies.value = species || uni.getStorageSync('selectedSpecies') || 'dog'
  // sanitize: URL 参数若为字符串 "undefined"/"null"(由 encodeURIComponent(undefined) 产生)视为空值
  // 避免污染 photos 字段
  const safeDecode = (s: string | undefined) => {
    if (!s || s === 'undefined' || s === 'null') return ''
    try { return decodeURIComponent(s) } catch { return '' }
  }
  bodyPhotoUrl.value = safeDecode(body_photo_url)
  nosePhotoUrl.value = safeDecode(nose_photo_url)

  formBreed.value = safeDecode(breed)
  formColor.value = safeDecode(color)
  formGender.value = safeDecode(gender) || 'unknown'
  formSize.value = safeDecode(size)
  formCoatLength.value = safeDecode(coat_length)
  formEarType.value = safeDecode(ear_type)
  formTailType.value = safeDecode(tail_type)
  formAge.value = safeDecode(age)
  formHealth.value = safeDecode(health)
  formSterilized.value = safeDecode(sterilized)
  formNotes.value = safeDecode(notes)
  // 接收位置(GPS 维度需要)
  if (location_lat && location_lat !== 'undefined') {
    const lat = Number(location_lat)
    if (!isNaN(lat) && lat !== 0) locationLat.value = lat
  }
  if (location_lng && location_lng !== 'undefined') {
    const lng = Number(location_lng)
    if (!isNaN(lng) && lng !== 0) locationLng.value = lng
  }
  locationText.value = safeDecode(location_text)
  // 阶段 3 (2026-07-06 BUG-FIX): 取 intent (lost/found),默认 lost
  //   - 用户在 collect 表单没选时(老调用),默认 lost (向后兼容)
  //   - 用户选 "我捡到狗" 时,found → 创建档案后 animal.status=found
  if (intent === 'found' || intent === 'lost') {
    formIntent.value = intent
  }

  // 【Defect 2 / 2026-07-08】【2026-07-09 重构】无鼻纹场景 → 跳过比对,让 needsConfirmation (Plan B UI) 直接生效
  //   旧逻辑始终调 apiNoseCompare → 后端 404 → 空 catch → compareResult=null → 所有按钮不渲染
  //   → WeChat MP 报 navigateTo:fail timeout (页面无 CTA,用户操作卡死)
  // 新逻辑: show_low_score_dialog / show_no_candidate_dialog / 旧 ask_user_confirm 全部跳过比对
  //   show_high_score_dialog → 仍调 apiNoseCompare 拿完整 candidates (用于高分支)
  if (
    passedNextAction.value === 'show_low_score_dialog' ||
    passedNextAction.value === 'show_no_candidate_dialog' ||
    passedNextAction.value === 'ask_user_confirm'    // 旧名兼容
  ) {
    return
  }

  // 统一走 compare 主路径: 不再因 is_duplicate=true 而本地伪造 compareResult
  // (旧逻辑伪造的 animal.photos=[] 导致匹配卡片预览图永远是 mock 占位图,
  //  但点进去又能看到真实档案 → 显示与详情不一致的漏洞)
  uni.showLoading({ title: '比对中...' })
  try {
    const result: any = await apiNoseCompare({
      nose_id: noseId.value,
      species: selectedSpecies.value,
      breed: formBreed.value,
      color: formColor.value,
      gender: formGender.value,
      size: formSize.value,
      coat_length: formCoatLength.value,
      ear_type: formEarType.value,
      tail_type: formTailType.value,
      // 修复 Bug4: GPS 维度不能为 NULL,否则 fusion_score 永远 < 0.88 阈值
      location_lat: locationLat.value,
      location_lng: locationLng.value,
    })
    compareResult.value = result.data
  } catch (e) {
    // 错误由拦截器处理
  } finally {
    uni.hideLoading()
  }
})

const statusTextMap: Record<string, string> = {
  lost: '走失中',
  found: '发现中',
  claimed: '待认领'
}

const topScore = computed(() => {
  if (!compareResult.value) return 0
  return (compareResult.value.results[0]?.fusion_score * 100).toFixed(0)
})

const resultClass = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (score >= 0.88) return 'result-confirmed'
  if (score >= 0.75) return 'result-suspected'
  return 'result-none'
})

const statusIcon = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (score >= 0.88) return '✅'
  if (score >= 0.75) return '⚠️'
  return 'ℹ️'
})

const statusText = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (compareResult.value.next_action === 'duplicate_detected') return '已确认重复，是否认领这只动物？'
  if (score >= 0.88) return '确认重复，系统将自动合并'
  if (score >= 0.75) return '疑似重复，需管理员审核'
  return '未匹配到相似动物'
})

const matchList = computed(() => {
  if (!compareResult.value) return []
  return compareResult.value.results
})

// ============ Plan B 三分支状态 ============
const hasMatch = computed(() => {
  if (!compareResult.value) return false
  const results = compareResult.value.results
  return results && results.length > 0 && results[0].fusion_score >= 0.75
})

// 【Defect 2 / 2026-07-08】【2026-07-09 重构】展示 Plan B UI (创建档案 + 取消)
//   触发条件:
//   - 旧名 'ask_user_confirm' (无鼻纹透传)
//   - 新 3 命名: 'show_low_score_dialog' / 'show_no_candidate_dialog'
//   - 老 compare 结果里 next_action === 'ask_user_create' (历史兼容)
const needsConfirmation = computed(() => {
  if (
    passedNextAction.value === 'show_low_score_dialog' ||
    passedNextAction.value === 'show_no_candidate_dialog'
  ) {
    return true
  }
  if (passedNextAction.value === 'ask_user_confirm') return true
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'ask_user_create'
})

const showMatchList = computed(() => hasMatch.value)

// 高相似度（确认重复）时隐藏上报按钮，显示认领引导
const isDuplicateConfirmed = computed(() => {
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'duplicate_detected'
    || (compareResult.value.results[0]?.fusion_score >= 0.88 && compareResult.value.results[0]?.animal_id)
})

// GPS 维度得分：≤500m=1.0, ≥1500m=0, 中间线性衰减
function calcLocationScore(distanceM) {
  if (distanceM <= 500) return 1.0
  if (distanceM >= 1500) return 0
  return Math.max(0, 1 - (distanceM - 500) / 1000)
}

const dimensions = computed(() => {
  if (!compareResult.value || !compareResult.value.results[0]) return []
  const r = compareResult.value.results[0]
  const gpsScore = calcLocationScore(r.gps_distance_m)
  return [
    { name: '鼻纹相似度', value: (r.vector_similarity * 100).toFixed(0) + '%', percent: r.vector_similarity * 100, desc: '128维特征向量余弦相似度', color: '#0FBF9F' },
    { name: 'GPS距离', value: r.gps_distance_m + 'm', percent: gpsScore * 100, desc: '≤500m满分，≥1500m得0分', color: '#FF9F00' },
    { name: '文本匹配度', value: (r.text_match_rate * 100).toFixed(0) + '%', percent: r.text_match_rate * 100, desc: '颜色/体型/毛长等身体特征加权评分', color: '#5872E0' }
  ]
})

function getScoreClass(score: number) {
  if (score >= 0.88) return 'score-high'
  if (score >= 0.75) return 'score-mid'
  return 'score-low'
}

function goToDetail(animalId: string) {
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animalId}`
  })
}

function onReport() {
  if (!matchList.value || matchList.value.length === 0) {
    uni.showToast({ title: '无匹配结果，无法上报', icon: 'none' })
    return
  }
  const first = matchList.value[0]
  if (!first?.animal_id || first.animal_id === 'undefined') {
    uni.showToast({ title: '数据异常，请重新比对', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: '/pages/animal-detail/index?animal_id=' + first.animal_id
  })
}

function onBackHome() {
  uni.switchTab({
    url: '/pages/index/index'
  })
}

// 认领已确认重复的动物
async function onClaimAnimal() {
  const first = matchList.value[0]
  if (!first?.animal_id) {
    uni.showToast({ title: '数据异常，请重新采集', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: '/pages/animal-detail/index?animal_id=' + first.animal_id
  })
}

// ============ 阶段 3 (2026-07-06 BUG-FIX): "我要上报" ============
// 用户实测反馈: 重复检测后只给"认领"按钮,无法补充发现记录 → 加此按钮
// 行为:
//   - 提交一条 report 事件, animal_id = 命中动物, intent='stray_sighting'
//   - 后端 processEvent 跑 AI 评分 → fusion_score 落入 DB candidates
//   - admin 端待审中心 +1,审核通过 → 目标 animal.report_count++,timeline +1
//   - 用户立刻跳到动物详情(确认上报成功 + 看到时间轴)
async function onReportSighting() {
  const first = matchList.value[0]
  if (!first?.animal_id) {
    uni.showToast({ title: '数据异常，请重新采集', icon: 'none' })
    return
  }
  if (!noseId.value) {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    return
  }

  // 兜底取真实 GPS (collect 已校验过,但这里再防御一次)
  let realLat: number | null = locationLat.value
  let realLng: number | null = locationLng.value
  if (realLat == null || realLng == null || realLat === 0 || realLng === 0) {
    try {
      const loc: any = await uni.getLocation({ type: 'gcj02' })
      if (loc && loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0) {
        realLat = loc.latitude
        realLng = loc.longitude
      }
    } catch {
      // 静默失败,后端从 animal 反查
    }
  }

  uni.showLoading({ title: '上报中...' })
  try {
    await apiReportEvent({
      event_type: 'report',
      // 路人重复看到 → intent 标记为 stray_sighting
      // (formIntent 是用户在 collect 表单选的 lost/found,这只反映"我自己"
      //  而 sighting 事件是用户替"这次目击"留的证据,所以用 stray_sighting)
      intent: 'stray_sighting',
      animal_id: first.animal_id,
      nose_vector_id: noseId.value,
      species: selectedSpecies.value,
      breed: formBreed.value || undefined,
      color: formColor.value || undefined,
      gender: formGender.value || undefined,
      location_lat: realLat ?? undefined,
      location_lng: realLng ?? undefined,
      address: locationText.value || undefined,
      description: formNotes.value || undefined,
      photos: (bodyPhotoUrl.value && bodyPhotoUrl.value !== 'undefined' && bodyPhotoUrl.value !== 'null')
        ? [bodyPhotoUrl.value] : undefined,
    })
    uni.hideLoading()
    uni.showToast({ title: '上报成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({
        url: '/pages/animal-detail/index?animal_id=' + first.animal_id
      })
    }, 800)
  } catch (e: any) {
    uni.hideLoading()
    console.error('[onReportSighting]', e)
    const detail = extractErrorMessage(e)
    uni.showModal({
      title: '上报失败',
      content: detail,
      showCancel: false,
      confirmText: '我知道了',
    })
  }
}

// ============ Plan B 无匹配流程 ============
function extractErrorMessage(e: any): string {
  // uni.request 失败时 e.data?.message 是后端返回的 message 字段（可能为字符串或字符串数组）
  const data = e?.data
  const msg = data?.message ?? data?.data?.message
  if (Array.isArray(msg)) return msg.join('；')
  if (typeof msg === 'string') return msg
  if (typeof data?.message === 'string') return data.message
  return e?.errMsg || e?.message || '未知错误'
}

async function onCreateAnimal() {
  // 【2026-07-09 重构】onCreateAnimal 现在调 apiCreatePendingAnimalRequest,
  //   后端写入 RescueEvent(source=USER_CREATE,event_type=collect),入审核流
  //   原 pending_nose_records 表已废弃,不再向其写
  uni.showLoading({ title: '提交中...' })
  try {
    // 构建 photos 数组:仅在有有效全身照 URL 时才放进数组
    // 过滤字符串 "undefined"/"null" 等无效值,防止数据库 photos 字段被污染
    const isValidUrl = (s: string) => !!s && s !== 'undefined' && s !== 'null'
    const photos = isValidUrl(bodyPhotoUrl.value) ? [bodyPhotoUrl.value] : []

    // 优先使用 collect 页传来的位置(用户实际选择的);
    // 没有时才重新拿一次 GPS
    let realLat: number | null = locationLat.value
    let realLng: number | null = locationLng.value
    if (realLat == null || realLng == null || realLat === 0 || realLng === 0) {
      try {
        const loc: any = await uni.getLocation({ type: 'gcj02' })
        if (loc && loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0) {
          realLat = loc.latitude
          realLng = loc.longitude
        }
      } catch {
        // 静默失败，让后端自取
      }
    }

    // 【2026-07-09 重构】apiCreatePendingAnimalRequest 已改写为写 RescueEvent(source=USER_CREATE)
    //   不再操作 pending_nose_records 表
    // 【Bug A / 2026-07-08】nose_vector_id 允许 null — 字符串 'null' (无鼻纹) 显式映射为 undefined
    const noseVectorIdForRequest = noseId.value && noseId.value !== 'null' && noseId.value !== 'undefined'
      ? noseId.value
      : undefined
    const pendingRes: any = await apiCreatePendingAnimalRequest({
      nose_vector_id: noseVectorIdForRequest,
      species: selectedSpecies.value,
      breed: formBreed.value,
      color: formColor.value,
      gender: formGender.value,
      age_estimate: formAge.value || undefined,
      health_status: formHealth.value || undefined,
      sterilized: formSterilized.value === 'yes' ? true
        : formSterilized.value === 'no' ? false
        : undefined,  // 'unknown' / 空 -> undefined,不传给后端
      location_lat: realLat,
      location_lng: realLng,
      address: locationText.value || '',
      notes: formNotes.value || '',
      photos,
      intent: formIntent.value,
    })

    uni.hideLoading()
    uni.showModal({
      title: '档案已提交审核',
      content: '您的动物档案已提交,正在等待管理员审核。审核通过后会通知您。',
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        // 跳到首页,不跳转 animal-detail(因为动物还没创建)
        uni.switchTab({ url: '/pages/index/index' })
      },
    })
    // 静默使用 pendingRes 避免 lint 警告
    void pendingRes
  } catch (e: any) {
    uni.hideLoading()
    console.error('[onCreateAnimal]', e)
    const detail = extractErrorMessage(e)
    uni.showModal({
      title: '提交失败',
      content: detail,
      showCancel: false,
      confirmText: '我知道了',
    })
  }
}

function onCancel() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 300rpx;
}

.result-overview {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 48rpx 32rpx;
  text-align: center;
}

.score-circle {
  width: 200rpx;
  height: 200rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  margin: 0 auto 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score-value {
  font-size: 64rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.score-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
}

.result-status {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(255,255,255,0.2);
}

.result-confirmed { background: rgba(7, 193, 96, 0.2); }
.result-suspected { background: rgba(255, 159, 0, 0.2); }
.result-none { background: rgba(255, 255, 255, 0.2); }

.status-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.status-text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.dimension-section {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 24rpx;
  display: block;
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.dimension-item {
  display: flex;
  flex-direction: column;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.dim-name {
  font-size: 26rpx;
  color: #1A1A1A;
}

.dim-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #0FBF9F;
}

.dim-bar-bg {
  height: 12rpx;
  background: #F0F0F0;
  border-radius: 6rpx;
  overflow: hidden;
}

.dim-bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.5s ease;
}

.dim-desc {
  font-size: 20rpx;
  color: #999999;
  margin-top: 4rpx;
}

.match-section {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.match-count {
  font-size: 24rpx;
  color: #999999;
  margin-bottom: 24rpx;
}

.match-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #FAFAFA;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.match-card.top1 {
  background: #E8FDF8;
  border: 2rpx solid #0FBF9F;
}

.match-rank {
  width: 48rpx;
  height: 48rpx;
  background: #CCCCCC;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.match-card.top1 .match-rank {
  background: #0FBF9F;
}

.rank-num {
  font-size: 24rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.match-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
}

.match-info {
  flex: 1;
}

.match-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4rpx;
}

.match-breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.match-score {
  font-size: 26rpx;
  font-weight: 700;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.score-high { color: #07C160; background: #E8FDF8; }
.score-mid { color: #FF9F00; background: #FFF8E8; }
.score-low { color: #999999; background: #F5F5F5; }

.match-color, .match-location {
  font-size: 22rpx;
  color: #666666;
  display: block;
}

.match-tags {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
}

.match-tag {
  font-size: 20rpx;
  color: #666666;
  background: #F0F0F0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.status-badge {
  color: #FFFFFF;
}

.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }

.arrow-img {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  padding: 24rpx 32rpx 48rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
}

.action-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx;
  background: #FFF8E8;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.hint-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.action-hint text:last-child {
  font-size: 24rpx;
  color: #FF9F00;
}

.btn-primary {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-secondary {
  background: #FFFFFF;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: 2rpx solid #EEEEEE;
}

.info-hint {
  background: #E8F4FF;
}
.info-hint text:last-child {
  color: #007AFF;
}
</style>
