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
        <text v-if="mode === 'read'" class="form-value">{{ speciesMap[form.species] || '其他' }}</text>
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
        <switch v-else :checked="!!form.sterilized" @change="onSterilizedChange" color="#0FBF9F" />
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
const speciesMap: Record<string, string> = { cat: '猫', dog: '狗', other: '其他' }
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

const statusIndex = computed(() => {
  const idx = statusOptions.findIndex((o) => o.value === form.value.status)
  return idx === -1 ? 0 : idx
})
const speciesIndex = computed(() => {
  const idx = speciesOptions.findIndex((o) => o.value === form.value.species)
  return idx === -1 ? 0 : idx
})
const genderIndex = computed(() => {
  const idx = genderOptions.findIndex((o) => o.value === form.value.gender)
  return idx === -1 ? 0 : idx
})
const ageIndex = computed(() => {
  const idx = ageOptions.findIndex((o) => o.value === form.value.age_estimate)
  return idx === -1 ? 0 : idx
})
const healthIndex = computed(() => {
  const idx = healthOptions.findIndex((o) => o.value === form.value.health_status)
  return idx === -1 ? 0 : idx
})

function onStatusChange(e: any) { form.value.status = statusOptions[e.detail.value]?.value || 'lost' }
function onSterilizedChange(e: { detail: { value: boolean } }) {
  form.value.sterilized = e.detail.value
}
function onSpeciesChange(e: any) { form.value.species = speciesOptions[e.detail.value]?.value || 'dog' }
function onGenderChange(e: any) { form.value.gender = genderOptions[e.detail.value]?.value || 'unknown' }
function onAgeChange(e: any) { form.value.age_estimate = ageOptions[e.detail.value]?.value || '' }
function onHealthChange(e: any) { form.value.health_status = healthOptions[e.detail.value]?.value || 'unknown' }

// 对外暴露的方法,供父组件触发提交
defineExpose<{ submit: () => void; cancel: () => void; archive: () => void }>({
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
