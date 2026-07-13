<template>
  <view class="page">
    <!-- 顶部占位（关掉系统胶囊后，需要 88rpx 让内容不顶到状态栏） -->
    <view class="navbar-placeholder" />

    <!-- 顶部品牌区（与采集页同款：logo + 副标题） -->
    <view class="guide-header">
      <view class="guide-brand">
        <view class="guide-logo">
          <image
            class="logo-icon"
            src="/static/icons/icon-paw-filled.svg"
            mode="aspectFit"
            @error="onImageError"
          />
        </view>
        <text class="title-sub">提供线索，帮助它们回家</text>
      </view>
    </view>

    <!-- 步骤指示（与采集页同款：进度条 + 当前步骤名） -->
    <view class="steps-indicator">
      <view class="steps-progress">
        <template v-for="(s, i) in steps" :key="i">
          <view
            :class="[
              'steps-dot',
              { done: i < currentStep, active: i === currentStep },
            ]"
          />
          <view
            v-if="i < steps.length - 1"
            :class="['steps-line', { done: i < currentStep }]"
          />
        </template>
      </view>
      <view class="steps-info">
        <text class="steps-counter"
          >步骤 {{ currentStep + 1 }} / {{ steps.length }}</text
        >
        <text class="steps-name">{{ steps[currentStep] }}</text>
      </view>
    </view>

    <!-- Step 0: 选择物种 -->
    <view class="section" v-if="currentStep === 0">
      <text class="section-title">选择物种</text>
      <view class="species-grid">
        <view
          v-for="spec in speciesList"
          :key="spec.value"
          :class="[
            'species-card',
            { selected: selectedSpecies === spec.value },
          ]"
          @click="onSelectSpecies(spec.value)"
        >
          <image class="species-icon" :src="spec.icon" mode="aspectFit" />
          <text class="species-name">{{ spec.label }}</text>
          <view v-if="selectedSpecies === spec.value" class="species-paw-mark">
            <image src="/static/icons/icon-paw-white.svg" mode="aspectFit" />
          </view>
        </view>
      </view>
      <view class="step-hint">
        <text>选择后点击底部"下一步"继续</text>
      </view>
    </view>

    <!-- Step 1: 拍摄照片 -->
    <view class="section" v-if="currentStep === 1">
      <text class="section-title">拍摄照片</text>
      <text class="section-hint">请上传 1-3 张照片</text>

      <view class="photo-grid">
        <view v-for="(photo, index) in photos" :key="index" class="photo-item">
          <image class="photo-img" :src="photo" mode="aspectFill" />
          <view class="photo-remove" @click="onRemovePhoto(index)">
            <text class="remove-icon">×</text>
          </view>
        </view>
        <view v-if="photos.length < 3" class="photo-add" @click="onAddPhoto">
          <text class="add-icon">+</text>
          <text class="add-text">添加照片</text>
        </view>
      </view>
    </view>

    <!-- Step 2: 获取 GPS 位置 -->
    <view class="section" v-if="currentStep === 2">
      <text class="section-title">获取位置</text>
      <text class="section-hint">请提供发现流浪动物的位置</text>

      <view class="location-box" @click="onManualSelect">
        <view class="location-icon-wrap">
          <image
            class="location-icon"
            src="/static/mock/location-icon.png"
            mode="aspectFit"
            @error="onLocationIconError"
          />
        </view>
        <view class="location-info">
          <text class="location-text">{{ locationText }}</text>
          <text class="location-tip">点击重新选择位置</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 填写信息 (结构化字段 + 文字描述) -->
    <view class="section" v-if="currentStep === 3">
      <text class="section-title">填写信息</text>
      <text class="section-hint"
        >补充结构化信息可显著提高匹配准确度（选填）</text
      >

      <view class="form-item">
        <text class="form-label">品种</text>
        <input
          class="form-input"
          v-model="breed"
          placeholder="例如:柴犬/金毛/中华田园犬"
          placeholder-class="input-placeholder"
        />
        <view class="quick-tags">
          <view
            v-for="t in breedPresets"
            :key="t"
            class="quick-tag"
            @click="breed = t"
          >
            <text>{{ t }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">颜色</text>
        <input
          class="form-input"
          v-model="color"
          placeholder="例如:棕白相间、纯黑带白爪子"
          placeholder-class="input-placeholder"
        />
        <view class="quick-tags">
          <view
            v-for="t in colorPresets"
            :key="t.label"
            class="quick-tag"
            @click="onPickColor(t.label)"
          >
            <text>{{ t.label }}</text>
          </view>
        </view>
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
        <text class="form-label">补充描述</text>
        <textarea
          class="description-input"
          v-model="description"
          placeholder="例如:左耳有伤,右后腿行动不便..."
          placeholder-class="textarea-placeholder"
          maxlength="500"
        />
        <view class="feature-tags">
          <view
            v-for="f in featurePresets"
            :key="f"
            class="feature-tag"
            @click="onAddFeature(f)"
          >
            <text>+ {{ f }}</text>
          </view>
        </view>
        <text class="char-count">{{ description.length }}/500</text>
      </view>
    </view>

    <!-- Step 4: 确认提交 -->
    <view class="section" v-if="currentStep === 4">
      <text class="section-title">确认提交</text>

      <view class="confirm-card">
        <view class="confirm-item">
          <text class="confirm-label">物种</text>
          <text class="confirm-value">{{ speciesLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">照片</text>
          <view class="confirm-photos">
            <image
              v-for="(photo, index) in photos"
              :key="index"
              class="confirm-photo-thumb"
              :src="photo"
              mode="aspectFill"
            />
          </view>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">位置</text>
          <text class="confirm-value">{{ locationText }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">品种</text>
          <text class="confirm-value">{{ breed || "未填写" }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">颜色</text>
          <text class="confirm-value">{{ color || "未填写" }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">性别</text>
          <text class="confirm-value">{{ genderLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">补充描述</text>
          <text class="confirm-value">{{ description || "未填写" }}</text>
        </view>
      </view>

      <!-- BUG-019 (2026-07-06): 提交按钮已移到底部 bottom-bar,section 内只剩追加观察提示 -->
      <view v-if="linkedAnimalId" class="sighting-hint">
        <text>你正在为该动物追加一条观察记录</text>
      </view>
    </view>

    <!-- 底部按钮: 步骤 0-3 → 上一步/下一步 (1:2); 步骤 4 → 上一步/提交上报 (1:1) -->
    <view class="bottom-bar">
      <view class="btn-back" v-if="currentStep > 0" @click="onBack">
        <text>上一步</text>
      </view>
      <view
        v-if="currentStep < 4"
        :class="['btn-next', { disabled: !canNext }]"
        @click="onNext"
      >
        <text>下一步</text>
      </view>
      <view v-else class="btn-submit" @click="handleReportSubmit">
        <text>提交上报</text>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <view class="success-modal" v-if="showSuccess" @click="showSuccess = false">
      <view class="success-content" @click.stop>
        <view class="success-icon-wrap">
          <text class="success-icon">✓</text>
        </view>
        <text class="success-title">上报成功</text>
        <text class="success-subtitle">感谢您提供线索，我们将尽快处理</text>
        <view class="success-btns">
          <view class="btn-view-reports" @click="goToMyReports">
            <text>查看我的上报</text>
          </view>
          <view class="btn-go-home" @click="goHome">
            <text>返回首页</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 自定义 tabBar -->
    <custom-tabbar />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { apiUploadFile, apiReportEvent } from "@/services/api";

const currentStep = ref(0);
const selectedSpecies = ref("dog");
const photos = ref<string[]>([]);
const photoUrls = ref<string[]>([]);
const description = ref("");
const locationText = ref("定位中...");
const locationLat = ref<number | null>(null);
const locationLng = ref<number | null>(null);
const showSuccess = ref(false);
// 阶段 3 (2026-07-06): 从 animal-detail 跳过来时携带,代表"为该动物追加观察"
const linkedAnimalId = ref("");

onLoad((query: any) => {
  if (query && query.animal_id) {
    linkedAnimalId.value = String(query.animal_id);
  }
});

// 结构化字段 (提高文本匹配分数)
const breed = ref("");
const color = ref("");
const gender = ref("unknown");
const genderOptions = [
  { value: "unknown", label: "未知" },
  { value: "male", label: "公" },
  { value: "female", label: "母" },
];
const genderLabel = computed(() => {
  return genderOptions.find((g) => g.value === gender.value)?.label || "未知";
});

// 快捷品种（按当前 species 切换）
const breedPresets = computed(() => {
  if (selectedSpecies.value === "cat") {
    return [
      "中华田园猫",
      "橘猫",
      "三花",
      "英短",
      "美短",
      "狸花猫",
      "布偶",
      "其他",
    ];
  }
  return [
    "中华田园犬",
    "柴犬",
    "金毛",
    "拉布拉多",
    "柯基",
    "泰迪",
    "哈士奇",
    "其他",
  ];
});

// 常用颜色预设（按你说的"前提得是纯色"做单色 + 双拼）
const colorPresets = [
  { label: "纯黑", hex: "#1A1A1A" },
  { label: "纯白", hex: "#FFFFFF" },
  { label: "棕色", hex: "#8B5A3C" },
  { label: "黄色", hex: "#D4A857" },
  { label: "灰色", hex: "#9CA3AF" },
  { label: "橘色", hex: "#FF8C42" },
  { label: "黑白", hex: "linear-gradient(90deg, #1A1A1A 50%, #FFFFFF 50%)" },
  { label: "黄白", hex: "linear-gradient(90deg, #D4A857 50%, #FFFFFF 50%)" },
];

// 常见特征标签（点一下追加到描述，避免手打）
const featurePresets = [
  "亲人",
  "怕人",
  "受伤",
  "怀孕/哺乳",
  "有项圈",
  "幼年",
  "老年",
  "行动不便",
  "左耳缺",
  "右耳缺",
];

function onPickColor(label: string) {
  color.value = label;
}

function onAddFeature(feature: string) {
  if (description.value.length >= 500) return;
  if (description.value.length === 0) {
    description.value = feature;
  } else if (!description.value.includes(feature)) {
    description.value = description.value + "，" + feature;
  }
  uni.showToast({ title: `已添加：${feature}`, icon: "none", duration: 800 });
}

const steps = ["选择物种", "拍摄照片", "获取位置", "填写信息", "确认提交"];

const speciesList = [
  { value: "dog", label: "狗狗", icon: "/static/mock/dog-icon.svg" },
  { value: "cat", label: "猫咪", icon: "/static/mock/cat-icon.svg" },
  { value: "other", label: "其他", icon: "/static/mock/other-icon.svg" },
];

const speciesLabel = computed(() => {
  return (
    speciesList.find((s) => s.value === selectedSpecies.value)?.label || ""
  );
});

const canNext = computed(() => {
  if (currentStep.value === 0) return true;
  if (currentStep.value === 1) return photos.value.length > 0;
  if (currentStep.value === 2) {
    return (
      locationLat.value !== null &&
      locationLng.value !== null &&
      locationLat.value !== 0 &&
      locationLng.value !== 0
    );
  }
  if (currentStep.value === 3) return true;
  return true;
});

function getLocation() {
  uni.getLocation({
    type: "gcj02",
    success: (res) => {
      locationLat.value = res.latitude;
      locationLng.value = res.longitude;
      locationText.value = `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`;
    },
    fail: () => {
      locationText.value = "定位失败，请手动选择位置";
      uni.showToast({ title: "定位失败，请手动选择位置", icon: "none" });
    },
  });
}

function onManualSelect() {
  uni.chooseLocation({
    success: (res) => {
      locationLat.value = res.latitude;
      locationLng.value = res.longitude;
      locationText.value =
        res.address ||
        `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`;
    },
    fail: () => {
      uni.showToast({ title: "请允许位置权限", icon: "none" });
    },
  });
}

function onLocationIconError() {
  // 占位图标加载失败时隐藏
}

function onImageError(e: any) {
  // 顶部 logo 加载失败时静默处理
}

function onSelectSpecies(value: string) {
  selectedSpecies.value = value;
}

async function onAddPhoto() {
  const remaining = 3 - photos.value.length;
  if (remaining <= 0) return;

  uni.chooseImage({
    count: remaining,
    sourceType: ["camera", "album"],
    success: async (res) => {
      for (const filePath of res.tempFilePaths) {
        try {
          const uploadedUrl = await apiUploadFile(filePath);
          photos.value = [...photos.value, filePath];
          photoUrls.value = [...photoUrls.value, uploadedUrl];
        } catch (e) {
          uni.showToast({ title: "图片上传失败", icon: "none" });
        }
      }
    },
    fail: () => {
      uni.showToast({ title: "请允许相机/相册权限", icon: "none" });
    },
  });
}

function onRemovePhoto(index: number) {
  photos.value = photos.value.filter((_, i) => i !== index);
  photoUrls.value = photoUrls.value.filter((_, i) => i !== index);
}

function onBack() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

async function onNext() {
  if (!canNext.value) {
    if (currentStep.value === 1) {
      uni.showToast({ title: "请至少上传一张照片", icon: "none" });
    } else if (currentStep.value === 2) {
      uni.showToast({ title: "请先获取位置", icon: "none" });
    }
    return;
  }

  if (currentStep.value < 4) {
    currentStep.value++;
    return;
  }
}

// 阶段 3 (2026-07-06): UnifiedReportForm 提交处理,透传 intent + animal_id
async function handleReportSubmit(_payload: Record<string, any>) {
  uni.showLoading({ title: "提交中..." });

  try {
    // 2026-07-01: 颜色由用户自由文本描述, 直接发 color 字段; 不再携带 body_colors
    // 阶段 3 (2026-07-06): 透传 intent + animal_id (从 animal-detail 跳过来时存在)
    await apiReportEvent({
      event_type: "report",
      intent: "stray_sighting",
      species: selectedSpecies.value,
      breed: breed.value || undefined,
      color: color.value || undefined,
      gender: gender.value,
      location_lat: locationLat.value ?? 0,
      location_lng: locationLng.value ?? 0,
      address: locationText.value,
      description: description.value,
      photos: photoUrls.value,
      animal_id: linkedAnimalId.value || undefined,
    });

    uni.hideLoading();
    showSuccess.value = true;
  } catch (e: any) {
    uni.hideLoading();
    if (!e.code) {
      uni.showToast({ title: "网络异常，请稍后重试", icon: "none" });
    }
  }
}

// 成功弹窗按钮跳转
function goToMyReports() {
  uni.reLaunch({ url: "/pages/my-reports/index" });
}

function goHome() {
  uni.switchTab({ url: "/pages/index/index" });
}

// 初始化定位
getLocation();
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 240rpx;
}

/* 顶部占位（关掉系统胶囊后，留 88rpx 让内容不顶到状态栏） */
.navbar-placeholder {
  height: 88rpx;
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  flex-shrink: 0;
}

.guide-header {
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  padding: 24rpx 32rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.guide-header::before {
  content: "";
  position: absolute;
  top: -60rpx;
  right: -40rpx;
  width: 240rpx;
  height: 240rpx;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.18),
    transparent 70%
  );
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

.title-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
  letter-spacing: 1rpx;
}

.steps-indicator {
  padding: 32rpx 32rpx 24rpx;
  background: #ffffff;
}

/* 进度条：Dribbble 风（5 圆点 + 连线，当前步骤实心+发光） */
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
  background: #e5e7eb;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.steps-dot.done {
  background: #0fbf9f;
}

.steps-dot.active {
  width: 20rpx;
  height: 20rpx;
  background: #ffffff;
  border: 4rpx solid #0fbf9f;
  box-shadow: 0 0 0 6rpx rgba(15, 191, 159, 0.15);
}

.steps-line {
  flex: 1;
  height: 4rpx;
  background: #e5e7eb;
  margin: 0 -2rpx;
  position: relative;
  z-index: 1;
}

.steps-line.done {
  background: linear-gradient(90deg, #0fbf9f, #07c160);
}

.steps-info {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.steps-counter {
  font-size: 24rpx;
  color: #6b7280;
}

.steps-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.section {
  margin: 16rpx 24rpx 24rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
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
  background: #f5f5f5;
  border-radius: 16rpx;
  border: 4rpx solid transparent;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.species-card.selected {
  border-color: #0fbf9f;
  background: linear-gradient(135deg, #e8fdf8 0%, #f5fbfa 100%);
  box-shadow: 0 6rpx 20rpx rgba(15, 191, 159, 0.2);
  transform: translateY(-2rpx);
}

.species-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 12rpx;
  background: #e8fdf8;
  border-radius: 50%;
}

.species-card.selected .species-icon {
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.3);
}

.species-name {
  font-size: 26rpx;
  color: #1a1a1a;
  font-weight: 600;
}

.species-paw-mark {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 36rpx;
  height: 36rpx;
  background: #0fbf9f;
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
  border-left: 6rpx solid #0fbf9f;
  border-radius: 8rpx;
}

.step-hint text {
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.6;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
}

.photo-img {
  width: 100%;
  height: 100%;
}

.photo-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-icon {
  color: #ffffff;
  font-size: 32rpx;
  line-height: 1;
}

.photo-add {
  aspect-ratio: 1;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 4rpx dashed #cccccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.add-icon {
  font-size: 48rpx;
  color: #cccccc;
  line-height: 1;
}

.add-text {
  font-size: 22rpx;
  color: #aaaaaa;
  margin-top: 8rpx;
}

.location-box {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 24rpx;
}

.location-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  background: #e8fdf8;
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
  color: #1a1a1a;
  font-weight: 600;
  display: block;
}

.location-tip {
  font-size: 22rpx;
  color: #aaaaaa;
  display: block;
  margin-top: 4rpx;
}

.description-input {
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1a1a1a;
  min-height: 160rpx;
  width: 100%;
  box-sizing: border-box;
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
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  color: #1a1a1a;
  width: 100%;
  box-sizing: border-box;
  min-height: 96rpx;
  line-height: 1.5;
}

.input-placeholder {
  color: #aaaaaa;
}

.gender-options {
  display: flex;
  gap: 16rpx;
}

.gender-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1a1a1a;
  border: 4rpx solid transparent;
  box-sizing: border-box;
  transition: all 0.2s;
}

.gender-btn.selected {
  background: #e8fdf8;
  border-color: #0fbf9f;
  color: #0fbf9f;
  font-weight: 600;
}

.textarea-placeholder {
  color: #aaaaaa;
}

.char-count {
  font-size: 22rpx;
  color: #aaaaaa;
  text-align: right;
  display: block;
  margin-top: 8rpx;
}

/* 快捷品种标签 */
.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.quick-tag {
  padding: 10rpx 20rpx;
  background: rgba(15, 191, 159, 0.08);
  border: 2rpx solid rgba(15, 191, 159, 0.2);
  border-radius: 24rpx;
  transition: all 0.15s;
}

.quick-tag:active {
  background: rgba(15, 191, 159, 0.2);
  transform: scale(0.95);
}

.quick-tag text {
  font-size: 24rpx;
  color: #0fbf9f;
  font-weight: 500;
}

/* 特征标签 */
.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.feature-tag {
  padding: 10rpx 18rpx;
  background: #ffffff;
  border: 2rpx solid #e5e7eb;
  border-radius: 24rpx;
  transition: all 0.15s;
}

.feature-tag:active {
  background: rgba(15, 191, 159, 0.08);
  border-color: #0fbf9f;
  transform: scale(0.95);
}

.feature-tag text {
  font-size: 24rpx;
  color: #4b5563;
}

.confirm-card {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 24rpx;
}

.confirm-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.confirm-item:last-child {
  border-bottom: none;
}

.confirm-label {
  font-size: 26rpx;
  color: #666666;
  flex-shrink: 0;
}

.confirm-value {
  font-size: 26rpx;
  color: #1a1a1a;
  font-weight: 600;
  margin-left: 16rpx;
  text-align: right;
  flex: 1;
}

.confirm-photos {
  display: flex;
  gap: 8rpx;
  margin-left: 16rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.confirm-photo-thumb {
  width: 60rpx;
  height: 60rpx;
  border-radius: 8rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 160rpx; /* 增大数值，给下方Tab留出空间，按需微调 */
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 998;
  box-sizing: border-box;
}

.btn-back {
  flex: 1;
  background: #f5f5f5;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.btn-next {
  flex: 2;
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  color: #ffffff;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-next.disabled {
  background: #cccccc;
  box-shadow: none;
}

/* BUG-019 (2026-07-06): 步骤 4 的"提交上报"按钮,与"上一步"50/50 对半排 */
.btn-submit {
  flex: 1;
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  color: #ffffff;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

/* BUG-019 (2026-07-06): 追加观察提示 (从 animal-detail 跳过来时) */
.sighting-hint {
  margin: 16rpx 0;
  color: #0fbf9f;
  font-size: 26rpx;
  text-align: center;
}

.success-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.success-content {
  width: 600rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.success-icon {
  font-size: 60rpx;
  color: #ffffff;
}

.success-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a1a;
  display: block;
  margin-bottom: 12rpx;
}

.success-subtitle {
  font-size: 26rpx;
  color: #666666;
  text-align: center;
  display: block;
  margin-bottom: 32rpx;
}

.success-btns {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.btn-view-reports {
  background: linear-gradient(135deg, #0fbf9f 0%, #07c160 100%);
  color: #ffffff;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.btn-go-home {
  background: #f5f5f5;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
