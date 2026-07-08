<template>
  <view class="page">
    <!-- 顶部占位(关掉系统胶囊后,需要 88rpx 让内容不顶到状态栏) -->
    <view class="navbar-placeholder" />

    <!-- 位置选择(始终可见,可点击重新选) -->
    <view class="location-box" @click="onManualSelectLocation">
      <view class="location-icon-wrap">
        <image class="location-icon" src="/static/mock/location-icon.png" mode="aspectFit" @error="onLocationIconError" />
      </view>
      <view class="location-info">
        <text class="location-text">{{ locationText }}</text>
        <text class="location-tip">点击重新选择位置</text>
      </view>
    </view>

    <!-- 顶部品牌区(照抄 report 页:paw logo + 副标题) -->
    <view class="guide-header">
      <view class="guide-brand">
        <view class="guide-logo">
          <image class="logo-icon" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" @error="onImageError" />
        </view>
        <view class="guide-title">
          <text class="title-main">{{ animalId ? '鼻纹补录' : '鼻纹采集' }}</text>
          <text class="title-sub">{{ animalId ? '为已建档的动物补录鼻纹数据' : '为你的宠物建立唯一身份档案' }}</text>
        </view>
      </view>
    </view>

    <!-- 步骤指示(照抄 report 页:5 圆点 + 连线 + 步骤计数) -->
    <view class="steps-indicator">
      <view class="steps-progress">
        <template v-for="(s, i) in steps" :key="i">
          <view
            :class="['steps-dot', { done: i < currentStep, active: i === currentStep }]"
          />
          <view
            v-if="i < steps.length - 1"
            :class="['steps-line', { done: i < currentStep }]"
          />
        </template>
      </view>
      <view class="steps-info">
        <text class="steps-counter">步骤 {{ currentStep + 1 }} / {{ steps.length }}</text>
        <text class="steps-name">{{ steps[currentStep] }}</text>
      </view>
    </view>

    <!-- 物种选择 -->
    <view class="section" v-show="currentStep === 0">
      <text class="section-title">选择物种</text>
      <view class="species-grid">
        <view
          v-for="spec in speciesList"
          :key="spec.value"
          :class="['species-card', { selected: selectedSpecies === spec.value }]"
          @click="onSelectSpecies(spec.value)"
        >
          <image class="species-icon" :src="spec.icon" mode="aspectFit" />
          <text class="species-name">{{ spec.label }}</text>
        </view>
      </view>
    </view>

    <!-- 拍摄全身照 -->
    <view class="section" v-show="currentStep === 1">
      <text class="section-title">拍摄全身照</text>

      <view class="camera-area" @click="onOpenBodyCamera">
        <image
          v-if="!bodyPhoto"
          class="camera-placeholder"
          src="/static/mock/body-guide.png"
          mode="aspectFit"
        />
        <image v-else class="captured-photo" :src="bodyPhoto" mode="aspectFill" />
        <view class="camera-overlay" v-if="!bodyPhoto">
          <text class="camera-text">点击拍摄全身照</text>
          <text class="camera-hint">请拍摄能看清品种特征的完整照片</text>
        </view>
        <view class="retake-btn" v-if="bodyPhoto" @click.stop="onRetakeBody">
          <text>重新拍摄</text>
        </view>
      </view>

      <view class="ai-hint" v-if="aiBreedSuggestion">
        <text class="ai-icon">🤖</text>
        <text>AI 识别为：{{ aiBreedSuggestion }}</text>
      </view>
    </view>

    <!-- 拍摄引导 -->
    <view class="section" v-show="currentStep === 2">
      <text class="section-title">拍摄鼻纹</text>

      <!-- 相机区域 -->
      <view class="camera-area" @click="onOpenCamera">
        <image
          v-if="!nosePhoto"
          class="camera-placeholder"
          src="/static/mock/camera-guide.png"
          mode="aspectFit"
        />
        <image
          v-else
          class="captured-photo"
          :src="nosePhoto"
          mode="aspectFill"
        />
        <view class="camera-overlay" v-if="!nosePhoto">
          <text class="camera-text">点击拍摄鼻纹照片</text>
          <view class="nose-outline">
            <view class="outline-ring"></view>
            <text class="outline-hint">将鼻子置于框内</text>
          </view>
        </view>
        <view class="retake-btn" v-if="nosePhoto" @click.stop="onRetake">
          <text>重新拍摄</text>
        </view>
      </view>

      <!-- 拍摄提示 -->
      <view class="tips-box">
        <view class="tips-title">
          <image class="tips-title-icon" src="/static/icons/icon-camera.png" mode="aspectFit" />
          <text>拍摄技巧</text>
        </view>
        <view class="tip-item" v-for="tip in tips" :key="tip">
          <text class="tip-bullet">•</text>
          <text class="tip-text">{{ tip }}</text>
        </view>
      </view>
    </view>

    <!-- 填写信息 -->
    <view class="section" v-show="currentStep === 3">
      <text class="section-title">填写宠物信息</text>

      <view class="form-item">
        <text class="form-label">品种</text>
        <input
          class="form-input"
          v-model="breed"
          placeholder="输入品种名称（如：柴犬）"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">颜色</text>
        <input
          class="form-input"
          v-model="color"
          placeholder="输入颜色（如：黄白）"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">性别</text>
        <view class="gender-options">
          <view
            v-for="opt in genderOptions"
            :key="opt.value"
            :class="['gender-btn', { selected: gender === opt.value }]"
            @click="gender = opt.value"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">年龄段</text>
        <view class="gender-options">
          <view
            v-for="opt in ageOptions"
            :key="opt.value"
            :class="['gender-btn', { selected: age === opt.value }]"
            @click="age = opt.value"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">健康状况</text>
        <view class="gender-options">
          <view
            v-for="opt in healthOptions"
            :key="opt.value"
            :class="['gender-btn', { selected: health === opt.value }]"
            @click="health = opt.value"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">绝育</text>
        <view class="gender-options">
          <view
            v-for="opt in sterilizedOptions"
            :key="opt.value"
            :class="['gender-btn', { selected: sterilized === opt.value }]"
            @click="sterilized = opt.value"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">补充描述</text>
        <textarea
          class="form-textarea"
          v-model="notes"
          placeholder="补充特征（如：佩戴蓝色项圈、尾巴尖有白毛、亲人等）"
          placeholder-class="input-placeholder"
          maxlength="500"
        />
        <text class="char-count">{{ notes.length }}/500</text>
      </view>

      <!-- 阶段 3 (2026-07-06): intent 收音机 — 用户表达走失/捡到意图 -->
      <view class="form-item">
        <text class="form-label">我的意图</text>
        <view class="gender-options">
          <view
            :class="['gender-btn', { selected: intent === 'lost' }]"
            @click="intent = 'lost'"
          >
            <text>我走失了狗</text>
          </view>
          <view
            :class="['gender-btn', { selected: intent === 'found' }]"
            @click="intent = 'found'"
          >
            <text>我捡到狗</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 确认提交 -->
    <view class="section" v-show="currentStep === 4">
      <text class="section-title">确认信息</text>

      <view class="confirm-card">
        <view class="confirm-item">
          <text class="confirm-label">物种</text>
          <text class="confirm-value">{{ speciesLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">全身照</text>
          <image v-if="bodyPhoto" class="confirm-nose-thumb" :src="bodyPhoto" mode="aspectFill" />
          <text v-else class="confirm-value danger">未上传</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">鼻纹照片</text>
          <image v-if="nosePhoto" class="confirm-nose-thumb" :src="nosePhoto" mode="aspectFill" />
          <text v-else class="confirm-value danger">未上传</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">品种</text>
          <text class="confirm-value">{{ breed || '未填写' }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">颜色</text>
          <text class="confirm-value">{{ color || '未填写' }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">性别</text>
          <text class="confirm-value">{{ genderLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">年龄段</text>
          <text class="confirm-value">{{ ageLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">健康状况</text>
          <text class="confirm-value">{{ healthLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">绝育</text>
          <text class="confirm-value">{{ sterilizedLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">补充描述</text>
          <text class="confirm-value">{{ notes || '未填写' }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">位置</text>
          <text class="confirm-value">{{ locationText }}</text>
        </view>
      </view>

      <!-- 质量评估 -->
      <view class="quality-card" v-if="collectResult">
        <text class="quality-title">采集质量评估</text>
        <view class="quality-row">
          <text>置信度</text>
          <view class="quality-bar-bg">
            <view class="quality-bar-fill" :style="{ width: (collectResult.confidence_score * 100) + '%' }"></view>
          </view>
          <text class="quality-percent">{{ (collectResult.confidence_score * 100).toFixed(0) }}%</text>
        </view>
        <view class="quality-row">
          <text>活体检测</text>
          <text :class="['liveness-tag', collectResult.liveness_passed ? 'pass' : 'fail']">
            {{ collectResult.liveness_passed ? '通过 ✓' : '未通过 ✗' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view class="btn-back" v-if="currentStep > 0" @click="onBack">
        <text>上一步</text>
      </view>
      <view
        :class="['btn-next', { disabled: !canNext || submitting }]"
        @click="onNext"
      >
        <text v-if="currentStep < 3">{{ currentStep === 2 && !nosePhoto ? '上传鼻纹' : '下一步' }}</text>
        <text v-else>开始比对</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiNoseCollect, apiClassifyBreed, apiUploadFile, apiGetAnimalDetail } from '@/services/api'

const currentStep = ref(0)
const selectedSpecies = ref('dog')
// 补录模式:从 animal-detail 跳过来时携带,代表"为这只动物补录鼻纹"
const animalId = ref('')
const prefilling = ref(false)
const bodyPhoto = ref('')
const bodyPhotoBase64 = ref('')
const bodyPhotoUrl = ref('') // 上传后的全身照 URL
const aiBreedSuggestion = ref('')
const nosePhoto = ref('')
const nosePhotoBase64 = ref('') // Base64 格式用于上传
const nosePhotoUrl = ref('') // 上传后的鼻纹照 URL
const locationText = ref('定位中...')
const collectResult = ref<any>(null)
const locationLat = ref<number | null>(null)
const locationLng = ref<number | null>(null)
// 位置已被用户/预填锁定,GPS 回调不能覆盖
const locationLocked = ref(false)
// 【Bug 5 防抖 / 2026-07-08】用户手抖 1 秒内连点"开始比对"导致重复提交
//   后端已有幂等缓存兜底,前端再加 disabled 视觉反馈,提升体验
const submitting = ref(false)

const breed = ref('')
const color = ref('')
const gender = ref('unknown')
const genderOptions = [
  { value: 'unknown', label: '未知' },
  { value: 'male', label: '公' },
  { value: 'female', label: '母' },
]
// 阶段 3 (2026-07-06): 用户意图 — 走失/捡到 (供后续事件透传使用)
const intent = ref<'lost' | 'found'>('lost')
const genderLabel = computed(() => {
  return genderOptions.find(g => g.value === gender.value)?.label || '未知'
})

// 补充属性(本地存储,后端接口暂不接收,功能 0 改动)
const age = ref('')
const ageOptions = [
  { value: 'junior', label: '幼年' },
  { value: 'adult', label: '成年' },
  { value: 'senior', label: '老年' },
  { value: 'unknown', label: '未知' },
]
const ageLabel = computed(() => ageOptions.find(a => a.value === age.value)?.label || '未填写')

const health = ref('')
const healthOptions = [
  { value: 'healthy', label: '健康' },
  { value: 'injured', label: '受伤' },
  { value: 'sick', label: '生病' },
  { value: 'unknown', label: '未知' },
]
const healthLabel = computed(() => healthOptions.find(h => h.value === health.value)?.label || '未填写')

const sterilized = ref('')
const sterilizedOptions = [
  { value: 'yes', label: '已绝育' },
  { value: 'no', label: '未绝育' },
  { value: 'unknown', label: '未知' },
]
const sterilizedLabel = computed(() => sterilizedOptions.find(s => s.value === sterilized.value)?.label || '未填写')

const notes = ref('')

const steps = ['选择物种', '拍摄全身照', '拍摄鼻纹', '填写信息', '确认提交']
const tips = [
  '保持光线充足，避免强烈反光',
  '鼻头正对镜头，距离10-20cm',
  '确保鼻纹纹路清晰可见',
  '避免拍摄到嘴唇或毛发干扰'
]

const speciesList = [
  { value: 'dog', label: '狗狗', icon: '/static/mock/dog-icon.svg' },
  { value: 'cat', label: '猫咪', icon: '/static/mock/cat-icon.svg' },
  { value: 'other', label: '其他', icon: '/static/mock/other-icon.svg' }
]

const speciesLabel = computed(() => {
  return speciesList.find(s => s.value === selectedSpecies.value)?.label || ''
})

const canNext = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return !!bodyPhoto.value
  if (currentStep.value === 2) return !!nosePhoto.value
  if (currentStep.value === 3) return true
  return true
})

// 补录模式:加载已有动物信息并预填
async function loadAnimalForPrefill(id: string) {
  prefilling.value = true
  try {
    const res: any = await apiGetAnimalDetail(id)
    const data = res?.data
    if (!data) return
    if (data.species) selectedSpecies.value = data.species
    if (data.breed) breed.value = data.breed
    if (data.color) color.value = data.color
    if (data.gender) gender.value = data.gender
    if (data.location_lat != null) locationLat.value = Number(data.location_lat)
    if (data.location_lng != null) locationLng.value = Number(data.location_lng)
    if (data.address) locationText.value = data.address
    // 补录预填了位置:锁定,后续 GPS 回调不能覆盖
    if (data.location_lat != null && data.location_lng != null) {
      locationLocked.value = true
    }
  } catch (e) {
    console.error('[collect] 加载动物信息失败', e)
  } finally {
    prefilling.value = false
  }
}

onMounted(() => {
  // 拿 query 参数(uni-app 小程序环境下 getCurrentPages 可用;测试环境下安全降级)
  let animal_id = ''
  try {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as any
    animal_id = currentPage?.options?.animal_id || ''
  } catch {
    // 单元测试或非小程序环境:无 query
  }
  if (animal_id) {
    animalId.value = animal_id
    loadAnimalForPrefill(animal_id)
  }
})

// 获取位置（gcj02 坐标系，与腾讯/高德地图一致）
function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      // 已锁定(用户手动选了/补录预填了)则不覆盖
      if (locationLocked.value) return
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: (err) => {
      console.error('GPS 获取失败', err)
      // 静默降级:location-box 仍可点击,用户手动选位置
      if (!locationLocked.value) {
        locationText.value = '未定位,点击选择位置'
      }
    }
  })
}

// 手动选择位置(微信原生 chooseLocation,弹窗带搜索栏)
function onManualSelectLocation() {
  uni.chooseLocation({
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = res.address || `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
      // 锁定:用户已选位置,后续 GPS 回调不能覆盖
      locationLocked.value = true
    },
    fail: (err) => {
      // 用户主动取消不报错;其他错误给提示
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        uni.showToast({ title: '位置选择失败', icon: 'none' })
      }
    }
  })
}

// 占位图加载失败时静默忽略
function onLocationIconError() {
  // no-op
}

getLocation()

function onSelectSpecies(value: string) {
  selectedSpecies.value = value
  uni.setStorageSync('selectedSpecies', value)
}

function onImageError(e: any) {
  // 占位图加载失败时隐藏
}

function onOpenBodyCamera() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      bodyPhoto.value = filePath
      uni.showLoading({ title: '上传中...' })
      try {
        // 上传获得 URL
        bodyPhotoUrl.value = await apiUploadFile(filePath)
        // AI 识别使用 Base64
        bodyPhotoBase64.value = await fileToBase64(filePath)
        const aiRes: any = await apiClassifyBreed({
          image: bodyPhotoBase64.value
        })
        if (aiRes.data?.breed_cn) {
          aiBreedSuggestion.value = aiRes.data.breed_cn
          breed.value = aiRes.data.breed_cn
        }
      } catch (e) {
        // AI 失败不阻止流程
        console.error('[onOpenBodyCamera]', e)
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function onRetakeBody() {
  bodyPhoto.value = ''
  bodyPhotoBase64.value = ''
  bodyPhotoUrl.value = ''
  aiBreedSuggestion.value = ''
}

/**
 * 图片压缩 + 转 Base64
 * 大小上限 5MB，超过则压缩到质量 0.8，宽高 ≤ 1024px
 */
function fileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getFileInfo({
      filePath,
      success: (info) => {
        const sizeMB = info.size / 1024 / 1024
        if (sizeMB <= 5) {
          // 不超过5MB，直接转 Base64
          uni.getFileSystemManager().readFile({
            filePath,
            encoding: 'base64',
            success: (res) => {
              resolve('data:image/jpeg;base64,' + res.data)
            },
            fail: reject
          })
        } else {
          // 超过5MB，需要压缩
          uni.compressImage({
            src: filePath,
            quality: 80,
            success: (compressRes) => {
              uni.getFileSystemManager().readFile({
                filePath: compressRes.tempFilePath,
                encoding: 'base64',
                success: (res2) => {
                  resolve('data:image/jpeg;base64,' + res2.data)
                },
                fail: reject
              })
            },
            fail: reject
          })
        }
      },
      fail: reject
    })
  })
}

function onOpenCamera() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      nosePhoto.value = filePath // 用于本地预览

      uni.showLoading({ title: '上传鼻纹照...' })
      try {
        // 上传鼻纹照获得 URL
        nosePhotoUrl.value = await apiUploadFile(filePath)
        // 保留 Base64 供 AI 提取向量
        nosePhotoBase64.value = await fileToBase64(filePath)
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '图片上传失败', icon: 'none' })
        return
      }
      uni.hideLoading()
    },
    fail: () => {
      uni.showToast({ title: '请允许相机权限', icon: 'none' })
    }
  })
}

function onRetake() {
  nosePhoto.value = ''
  nosePhotoBase64.value = ''
  nosePhotoUrl.value = ''
}

function onBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function onNext() {
  if (currentStep.value < 3) {
    currentStep.value++
    return
  }

  // 【Bug 5 防抖 / 2026-07-08】采集步骤且正在提交中 → 拦截重复点击
  //   防止 1.66s 内连点产生两次 vector_id(后端有幂等缓存兜底,这里是 UX 提升)
  if (submitting.value) return
  submitting.value = true

  if (!nosePhotoBase64.value) {
    submitting.value = false
    uni.showToast({ title: '请先拍摄鼻纹照片', icon: 'none' })
    return
  }

  // GPS 校验：禁止使用 (0,0) 默认值
  if (!locationLat.value || !locationLng.value || locationLat.value === 0 || locationLng.value === 0) {
    submitting.value = false
    uni.showToast({ title: '请提供有效的位置信息', icon: 'none' })
    return
  }

  // 提交采集
  uni.showLoading({ title: '采集中...' })

  try {
    const collectRes: any = await apiNoseCollect({
      nose_photo: nosePhotoBase64.value,
      species: selectedSpecies.value,
      animal_id: animalId.value || null,
      location_lat: locationLat.value ?? 0,
      location_lng: locationLng.value ?? 0,
      device_id: 'miniapp_user',
      timestamp: new Date().toISOString(),
      breed: breed.value,
      color: color.value,
      gender: gender.value,
      body_photo_url: bodyPhotoUrl.value,
      nose_photo_url: nosePhotoUrl.value,
    })

    collectResult.value = collectRes.data
    // 阶段 4 (2026-07-07 低分鼻纹人工审核): 后端返回 under_review 时,前端拦截,不去比对页
    // 场景: 后端在 collect 阶段发现向量相似度 < 0.75,已写入 pending_nose_records,
    //       等待 Admin 审核。这条 vector_id 不该进比对流程,直接给用户"审核中"提示
    if (collectRes.data?.next_action === 'under_review') {
      uni.hideLoading()
      uni.showModal({
        title: '鼻纹审核中',
        content: '鼻纹质量评分较低,已提交管理员人工审核,请耐心等待。审核通过后会通知您。',
        showCancel: false,
        confirmText: '返回首页',
        success: (modalRes) => {
          if (modalRes.confirm) {
            uni.switchTab({ url: '/pages/index/index' })
          }
        },
      })
      return  // 阻断后续的 result 页跳转
    }
    // 后端返回 vector_id，前端用 nose_id 作参数名（后端已兼容）
    const noseId = collectRes.data.vector_id || collectRes.data.nose_id
    const isDuplicate = collectRes.data.is_duplicate ? String(collectRes.data.is_duplicate) : 'false'
    const matchedAnimalId = collectRes.data.matched_animal_id || ''
    const similarity = collectRes.data.similarity || 0
    uni.setStorageSync('vector_id', noseId)

    uni.hideLoading()
    uni.showToast({ title: '采集成功', icon: 'success' })

    // 跳转到结果页
    // 阶段 3 (2026-07-06 BUG-FIX): 透传 intent (走失/捡到) 到 result 页,
    //   重复检测后用户点"我要上报"时,事件 intent 由它派生;
    //   低分创建时,apiCreateAnimal 也读这个 intent 决定 status (lost/found)
    setTimeout(() => {
      uni.navigateTo({
        url: `/pages/collect/result?nose_id=${noseId}&species=${selectedSpecies.value}&breed=${encodeURIComponent(breed.value)}&color=${encodeURIComponent(color.value)}&gender=${encodeURIComponent(gender.value)}&age=${age.value}&health=${health.value}&sterilized=${sterilized.value}&notes=${encodeURIComponent(notes.value)}&location_lat=${locationLat.value ?? ''}&location_lng=${locationLng.value ?? ''}&location_text=${encodeURIComponent(locationText.value)}&is_duplicate=${isDuplicate}&matched_animal_id=${matchedAnimalId}&similarity=${similarity}&body_photo_url=${encodeURIComponent(bodyPhotoUrl.value)}&nose_photo_url=${encodeURIComponent(nosePhotoUrl.value)}&intent=${intent.value}`
      })
    }, 1000)
  } catch (e: any) {
    uni.hideLoading()
    // 错误已由拦截器处理，这里只做兜底提示
    if (!e.code) {
      uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    }
  } finally {
    // 注意: 成功路径会 navigateTo 跳页,这里设 false 主要给 catch 路径兜底
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 280rpx;
}

/* 顶部占位(关掉系统胶囊后,需要 88rpx 让内容不顶到状态栏) */
.navbar-placeholder {
  height: 88rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  flex-shrink: 0;
}

.guide-header {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 24rpx 32rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.guide-header::before {
  content: '';
  position: absolute;
  top: -60rpx;
  right: -40rpx;
  width: 240rpx;
  height: 240rpx;
  background: radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.guide-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.guide-logo {
  width: 64rpx;
  height: 64rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-icon {
  width: 40rpx;
  height: 40rpx;
}

.guide-title {
  display: flex;
  flex-direction: column;
}

.title-main {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  display: block;
  line-height: 1.2;
}

.title-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
  letter-spacing: 1rpx;
  display: block;
  margin-top: 4rpx;
}

/* 步骤指示(照抄 report 页:5 圆点 + 连线 + 步骤计数) */
.steps-indicator {
  padding: 32rpx 32rpx 24rpx;
  background: #FFFFFF;
}

.steps-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

.steps-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #E5E7EB;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.steps-dot.done {
  background: #0FBF9F;
}

.steps-dot.active {
  width: 20rpx;
  height: 20rpx;
  background: #FFFFFF;
  border: 4rpx solid #0FBF9F;
  box-shadow: 0 0 0 6rpx rgba(15, 191, 159, 0.15);
}

.steps-line {
  flex: 1;
  height: 4rpx;
  background: #E5E7EB;
  margin: 0 -2rpx;
  position: relative;
  z-index: 1;
}

.steps-line.done {
  background: linear-gradient(90deg, #0FBF9F, #07C160);
}

.steps-info {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.steps-counter {
  font-size: 24rpx;
  color: #6B7280;
}

.steps-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.section {
  margin: 16rpx 24rpx 24rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 28rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 24rpx;
}

.section-hint {
  font-size: 24rpx;
  color: #999999;
  display: block;
  margin-bottom: 24rpx;
}

.species-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.species-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx;
  background: #F5F5F5;
  border-radius: 16rpx;
  border: 4rpx solid transparent;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.species-card.selected {
  border-color: #0FBF9F;
  background: linear-gradient(135deg, #E8FDF8 0%, #F5FBFA 100%);
  box-shadow: 0 6rpx 20rpx rgba(15, 191, 159, 0.2);
  transform: translateY(-2rpx);
}

.species-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 12rpx;
  background: #E8FDF8;
  border-radius: 50%;
}

.species-card.selected .species-icon {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.3);
}

.species-name {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.species-paw-mark {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 36rpx;
  height: 36rpx;
  background: #0FBF9F;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(15, 191, 159, 0.4);
}

.species-paw-mark image {
  width: 22rpx;
  height: 22rpx;
}

.step-hint {
  margin-top: 24rpx;
  padding: 16rpx 24rpx;
  background: rgba(15, 191, 159, 0.06);
  border-left: 6rpx solid #0FBF9F;
  border-radius: 8rpx;
}

.camera-area {
  position: relative;
  height: 400rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx dashed #CCCCCC;
}

.camera-placeholder {
  width: 200rpx;
  height: 200rpx;
  opacity: 0.6;
}

.captured-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.camera-text {
  font-size: 28rpx;
  color: #1A1A1A;
  background: rgba(15, 191, 159, 0.1);
  padding: 12rpx 24rpx;
  border-radius: 40rpx;
}

.nose-outline {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.outline-ring {
  width: 180rpx;
  height: 180rpx;
  border: 4rpx dashed #0FBF9F;
  border-radius: 50%;
}

.outline-hint {
  font-size: 22rpx;
  color: #666666;
  margin-top: 12rpx;
}

.retake-btn {
  position: absolute;
  bottom: 24rpx;
  right: 24rpx;
  background: rgba(0,0,0,0.6);
  color: #FFFFFF;
  font-size: 24rpx;
  padding: 12rpx 24rpx;
  border-radius: 40rpx;
}

.tips-box {
  margin-top: 24rpx;
  background: rgba(15, 191, 159, 0.06);
  border-left: 6rpx solid #0FBF9F;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}

.tips-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0FBF9F;
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.tips-title-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8rpx;
}

.tip-bullet {
  color: #0FBF9F;
  margin-right: 8rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #1A1A1A;
  flex: 1;
}

.confirm-card {
  background: #FAFAFA;
  border-radius: 12rpx;
  padding: 24rpx;
}

.confirm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.confirm-item:last-child {
  border-bottom: none;
}

.confirm-label {
  font-size: 26rpx;
  color: #666666;
}

.confirm-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.confirm-value.danger {
  color: #E53A3A;
}

.confirm-nose-thumb {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
}

.quality-card {
  margin-top: 24rpx;
  background: #E8FDF8;
  border-radius: 12rpx;
  padding: 24rpx;
}

.quality-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0FBF9F;
  display: block;
  margin-bottom: 16rpx;
}

.quality-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #1A1A1A;
}

.quality-row text:first-child {
  width: 140rpx;
}

.quality-bar-bg {
  flex: 1;
  height: 12rpx;
  background: rgba(15, 191, 159, 0.2);
  border-radius: 6rpx;
  margin-right: 12rpx;
}

.quality-bar-fill {
  height: 100%;
  background: #0FBF9F;
  border-radius: 6rpx;
}

.quality-percent {
  width: 80rpx;
  text-align: right;
  color: #0FBF9F;
  font-weight: 600;
}

.liveness-tag {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.liveness-tag.pass {
  background: #07C160;
  color: #FFFFFF;
}

.liveness-tag.fail {
  background: #E53A3A;
  color: #FFFFFF;
}

.bottom-bar {
  position: fixed;
  bottom: 120rpx;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
  z-index: 998;
}

.btn-back {
  flex: 1;
  background: #F5F5F5;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.btn-next {
  flex: 2;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-next.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
}

.form-input {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  width: 100%;
  box-sizing: border-box;
  min-height: 96rpx;
  line-height: 1.5;
}

.form-textarea {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  min-height: 160rpx;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.6;
}

.char-count {
  font-size: 22rpx;
  color: #AAAAAA;
  text-align: right;
  display: block;
  margin-top: 8rpx;
}

.input-placeholder {
  color: #AAAAAA;
}

.gender-options {
  display: flex;
  gap: 16rpx;
}

.gender-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  border: 4rpx solid transparent;
  box-sizing: border-box;
  transition: all 0.2s;
}

.gender-btn.selected {
  border-color: #0FBF9F;
  background: #E8FDF8;
  color: #0FBF9F;
  font-weight: 600;
}

.ai-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx;
  background: #E8F4FF;
  border-radius: 12rpx;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #007AFF;
}

.camera-hint {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 8rpx;
}

/* 顶部位置栏(照抄 report 页 location-box) */
.location-box {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 12rpx;
  margin: 24rpx;
  padding: 24rpx;
}

.location-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  background: #E8FDF8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.location-icon {
  width: 40rpx;
  height: 40rpx;
}

.location-info {
  flex: 1;
}

.location-text {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
}

.location-tip {
  font-size: 22rpx;
  color: #AAAAAA;
  display: block;
  margin-top: 4rpx;
}
</style>
