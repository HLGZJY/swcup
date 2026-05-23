# 全身照 AI 品种分类 Spec

> 产品流程：先拍全身照 → AI 分类品种预填表单 → 再拍鼻纹照 → 用户确认/修改品种 → 比对

---

## 一、产品流程（完整步骤）

```
Step 0: 选择物种（dog/cat/other）
Step 1: 拍摄全身照 → 前端调 POST /v1/nose/classify → AI 返回品种 → 预填 breed 字段
Step 2: 拍摄鼻纹照（保持现有逻辑）
Step 3: 填写信息（breed/color/gender，品种已预填可修改）
Step 4: 确认提交
```

**关键产品逻辑**：
- 全身照用于 AI 品种分类，**不参与鼻纹比对**
- 鼻纹比对只使用 nose/compare 的向量相似度
- AI 返回的 breed 只是**建议值**，用户可以修改
- AI 分类失败 → breed 留空，不阻止流程继续

---

## 二、后端改动

### B-C1: 新增 POST /v1/nose/classify 端点

**文件**：`backend/src/nose/nose.controller.ts`

**新增 controller 方法**：
```typescript
@Public()
@Post('classify')
@ApiOperation({ summary: 'AI 品种分类（全身照）' })
classify(@Body() dto: { image: string }) {
  return this.noseService.classify(dto)
}
```

### B-C2: NoseService.classify 实现

**文件**：`backend/src/nose/nose.service.ts`

**新增方法**：
```typescript
async classify(dto: { image: string }) {
  const imageData = dto.image.replace(/^data:image\/\w+;base64,/, '')
  const res = await axios.post(`${AI_SERVICE_URL}/classify/breed`, { image: imageData })

  const breedMap: Record<string, string> = {
    shiba_inu: '柴犬', akita: '秋田犬', american_bulldog: '美国 Bulldog',
    beagle: '比格犬', chihuahua: '吉娃娃', pomeranian: '博美犬',
    // ... 37 类 Oxford Pets 映射表
  }

  return {
    breed: res.data.breed,
    breed_cn: breedMap[res.data.breed] || res.data.breed,
    confidence: res.data.confidence,
    top3: res.data.top3?.map((t: any) => ({
      breed: t.breed,
      breed_cn: breedMap[t.breed] || t.breed,
      confidence: t.confidence
    }))
  }
}
```

### B-C3: 前端 API

**文件**：`miniapp-user/src/services/api.js`

**新增**：
```javascript
/**
 * AI 品种分类（全身照）
 * POST /v1/nose/classify
 * 请求: { image: "data:image/jpeg;base64,..." }
 */
export function apiClassifyBreed(params) {
  return request('/v1/nose/classify', { method: 'POST', body: params }, { needAuth: false })
}
```

---

## 三、前端改动

### F-C1: 修改采集页 Step 顺序

**文件**：`miniapp-user/src/pages/collect/index.vue`

**Step 顺序（改动后）**：
```
Step 0: 选择物种
Step 1: 拍摄全身照（新增，AI 品种预填）
Step 2: 拍摄鼻纹照
Step 3: 填写信息（品种已预填，可修改）
Step 4: 确认提交
```

### F-C2: 新增全身照拍摄 section

**在 Step 1 位置（当前 Step 1 鼻纹拍摄之前）新增**：

```vue
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
```

### F-C3: 新增 data 变量

```javascript
const bodyPhoto = ref('')
const bodyPhotoBase64 = ref('')
const aiBreedSuggestion = ref('')
```

### F-C4: onOpenBodyCamera 实现

```javascript
function onOpenBodyCamera() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      bodyPhoto.value = filePath
      uni.showLoading({ title: 'AI 识别品种...' })
      try {
        bodyPhotoBase64.value = await fileToBase64(filePath)
        const aiRes: any = await apiClassifyBreed({
          image: bodyPhotoBase64.value
        })
        if (aiRes.data?.breed_cn) {
          aiBreedSuggestion.value = aiRes.data.breed_cn
          breed.value = aiRes.data.breed_cn  // 预填表单
        }
      } catch (e) {
        // AI 失败不阻止流程
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function onRetakeBody() {
  bodyPhoto.value = ''
  bodyPhotoBase64.value = ''
  aiBreedSuggestion.value = ''
}
```

### F-C5: 修改 steps 定义

```javascript
// 从 ['选择物种', '拍摄鼻纹', '填写信息', '确认提交']
// 改为：
const steps = ['选择物种', '拍摄全身照', '拍摄鼻纹', '填写信息', '确认提交']
```

### F-C6: 修改 canNext

```javascript
const canNext = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return !!bodyPhoto.value  // 全身照必须拍
  if (currentStep.value === 2) return !!nosePhoto.value
  if (currentStep.value === 3) return true
  return true
})
```

### F-C7: 修改 onNext 末尾（跳转 URL 时带 bodyPhoto）

全身照 base64 不带（太大），只带提示信息：

```javascript
// 跳转到结果页时，breed 已经是 AI 预填+用户确认后的值
setTimeout(() => {
  uni.navigateTo({
    url: `/pages/collect/result?nose_id=${noseId}&species=${selectedSpecies.value}&breed=${encodeURIComponent(breed.value)}&color=${encodeURIComponent(color.value)}&gender=${encodeURIComponent(gender.value)}`
  })
}, 1000)
```

### F-C8: 修改 confirm-card（展示全身照缩略图）

在 confirm-card 的鼻子照片行之前，添加全身照：

```vue
<view class="confirm-item">
  <text class="confirm-label">全身照</text>
  <image v-if="bodyPhoto" class="confirm-nose-thumb" :src="bodyPhoto" mode="aspectFill" />
  <text v-else class="confirm-value danger">未上传</text>
</view>
```

### F-C9: 修改鼻纹拍摄的 currentStep 判断

原来 `v-show="currentStep === 1"` 的鼻纹 section 改为 `v-show="currentStep === 2"`

原来的 `v-show="currentStep === 2"` 的填写信息 section 改为 `v-show="currentStep === 3"`

原来的 `v-show="currentStep === 3"` 的确认提交 section 改为 `v-show="currentStep === 4"`

### F-C10: 样式补充

```scss
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
```

---

## 四、验收标准

1. 用户选完物种 → 拍摄全身照 → AI 返回品种 → 自动预填 breed 字段
2. AI 识别失败（如网络问题）→ breed 留空，流程继续，不报错
3. 用户可以修改 AI 预填的 breed 值
4. 全身照不参与鼻纹比对，只用于品种建议
5. 全身照缩略图在确认页可见

---

## 五、依赖关系

```
后端 B-C1（controller 新增 /classify）
后端 B-C2（service 实现 classify）
前端 F-C1（步骤调整）
前端 F-C2~F-C10（全身照拍摄 UI + API 调用）
```

可以同步开发，互不干扰。