<template>
  <view class="unified-report-form">
    <!-- intent 收音机: 仅 collect 模式显示 (lost / found) -->
    <view v-if="mode === 'collect'" class="intent-radio">
      <text class="intent-label">我的意图：</text>
      <radio-group @change="onIntentChange">
        <label class="intent-item">
          <radio value="lost" :checked="formData.intent === 'lost'" />我走失了狗
        </label>
        <label class="intent-item">
          <radio value="found" :checked="formData.intent === 'found'" />我捡到狗
        </label>
      </radio-group>
    </view>

    <!-- report 模式若带 animalId, 顶部提示追加观察 -->
    <view v-if="mode === 'report' && animalId" class="sighting-hint">
      <text>你正在为该动物追加一条观察记录</text>
    </view>

    <button class="submit-btn" :disabled="!canSubmit" @click="handleSubmit">
      {{ submitButtonText }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'

interface Props {
  mode: 'collect' | 'report'
  defaultIntent?: 'lost' | 'found' | 'stray_sighting'
  animalId?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultIntent: undefined,
  animalId: undefined,
})

const emit = defineEmits<{
  (e: 'submit', payload: Record<string, any>): void
}>()

const formData = reactive<Record<string, any>>({
  intent:
    props.defaultIntent ||
    (props.mode === 'collect' ? 'lost' : 'stray_sighting'),
  animal_id: props.animalId,
})

const submitButtonText = computed(() =>
  props.mode === 'collect' ? '提交我的' : '提交上报',
)

// collect 必须选 intent; report 固定 stray_sighting 恒真
const canSubmit = computed(() => !!formData.intent)

function onIntentChange(e: any) {
  formData.intent = e.detail.value
}

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', { ...formData })
}

defineExpose({ formData, handleSubmit })
</script>

<style scoped>
.unified-report-form { padding: 20rpx; }
.intent-radio { margin: 20rpx 0; }
.intent-label { font-weight: bold; }
.intent-item { display: inline-block; margin-right: 30rpx; }
.sighting-hint { margin: 16rpx 0; color: #666; font-size: 26rpx; }
.submit-btn { margin-top: 30rpx; }
.submit-btn[disabled] { opacity: 0.5; }
</style>
