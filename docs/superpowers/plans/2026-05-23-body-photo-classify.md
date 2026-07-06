# 全身照 AI 品种分类实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 采集页新增 Step 1 拍摄全身照 → 调用 AI 品种分类 → 预填 breed 字段；后端新增 /v1/nose/classify 端点

**Architecture:** 前端拍全身照 → apiClassifyBreed → AI 返回品种 → 预填 breed；后端转发 AI-service /classify/breed

**Tech Stack:** NestJS / Vue 3 (uni-app) / AI-service

---

## 后端任务

### Task B-C1: 新增 POST /v1/nose/classify 端点

**Files:**
- Modify: `backend/src/nose/nose.controller.ts`
- Modify: `backend/src/nose/nose.service.ts`

- [ ] **Step 1: 在 nose.controller.ts 新增 classify 方法**

在 `@Public() @Post('compare')` 之后添加：

```typescript
@Public()
@Post('classify')
@ApiOperation({ summary: 'AI 品种分类（全身照）' })
classify(@Body() dto: { image: string }) {
  return this.noseService.classify(dto)
}
```

- [ ] **Step 2: 在 nose.service.ts 新增 classify 方法**

在类最后（`recalculateAll` 之后）添加：

```typescript
async classify(dto: { image: string }) {
  const imageData = dto.image.replace(/^data:image\/\w+;base64,/, '')
  const res = await axios.post(`${AI_SERVICE_URL}/classify/breed`, { image: imageData })

  const breedMap: Record<string, string> = {
    shiba_inu: '柴犬',
    akita: '秋田犬',
    american_bulldog: '美国 Bulldog',
    beagle: '比格犬',
    bengal: '孟加拉猫',
    birman: '伯曼猫',
    bombay: '孟买猫',
    boxer: '拳师犬',
    british_shorthair: '英国短毛猫',
    chihuahua: '吉娃娃',
    egyptian_mau: '埃及猫',
    english_cocker_spaniel: '英国可卡犬',
    english_setter: '英国塞特犬',
    german_shorthaired: '德国短毛指示犬',
    great_pyrenees: '大白熊犬',
    havanese: '哈瓦那犬',
    japanese_chin: '日本 chin 犬',
    keeshond: '荷兰毛狮犬',
    leonberger: '莱昂贝格犬',
    maine_coon: '缅因猫',
    miniature_pinscher: '迷你杜宾犬',
    newfoundland: '纽芬兰犬',
    persian: '波斯猫',
    pomeranian: '博美犬',
    pug: '巴哥犬',
    ragdoll: '布偶猫',
    russian_blue: '俄罗斯蓝猫',
    saint_bernard: '圣伯纳犬',
    samoyed: '萨摩耶',
    scottish_terrier: '苏格兰梗',
    siamese: '暹罗猫',
    sphynx: '斯芬克斯猫',
    staffordshire_bull_terrier: '斯塔福郡斗牛梗',
    wheaten_terrier: '软毛麦色梗',
    yorkshire_terrier: '约克夏梗',
    abyssinian: '阿比西尼亚猫',
    american_pit_bull_terrier: '美国比特斗牛犬',
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

- [ ] **Step 3: 提交**

```bash
git add backend/src/nose/nose.controller.ts backend/src/nose/nose.service.ts
git commit -m "feat(nose): add POST /v1/nose/classify for AI breed classification"
```

---

## 前端任务

### Task F-C: 采集页新增全身照拍摄步骤

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`
- Modify: `miniapp-user/src/services/api.js`

- [ ] **Step 1: 新增 apiClassifyBreed 到 api.js**

在 `apiNoseCompare` 之后添加：

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

- [ ] **Step 2: 修改 steps 定义（从4步变5步）**

```javascript
// 约 line 158
const steps = ['选择物种', '拍摄全身照', '拍摄鼻纹', '填写信息', '确认提交']
```

- [ ] **Step 3: 新增 data 变量**

```javascript
const bodyPhoto = ref('')
const bodyPhotoBase64 = ref('')
const aiBreedSuggestion = ref('')
```

- [ ] **Step 4: 在 Step 1 鼻纹拍摄之前新增全身照 section（v-show="currentStep === 1"）**

在 `<!-- 物种选择 -->` 之后、`<!-- 拍摄引导 -->` 之前添加：

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

- [ ] **Step 5: 修改原鼻纹拍摄的 v-show（1 → 2）**

找到 `v-show="currentStep === 1"` 的 section，改为 `v-show="currentStep === 2"`

- [ ] **Step 6: 修改填写信息的 v-show（2 → 3）**

`v-show="currentStep === 2"` → `v-show="currentStep === 3"`

- [ ] **Step 7: 修改确认提交的 v-show（3 → 4）**

`v-show="currentStep === 3"` → `v-show="currentStep === 4"`

- [ ] **Step 8: 新增 onOpenBodyCamera 方法**

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

- [ ] **Step 9: 修改 canNext**

```javascript
const canNext = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return !!bodyPhoto.value
  if (currentStep.value === 2) return !!nosePhoto.value
  if (currentStep.value === 3) return true
  return true
})
```

- [ ] **Step 10: 修改 confirm-card（新增全身照展示行）**

在确认提交的 confirm-card 里，在鼻纹照片行之前添加：

```vue
<view class="confirm-item">
  <text class="confirm-label">全身照</text>
  <image v-if="bodyPhoto" class="confirm-nose-thumb" :src="bodyPhoto" mode="aspectFill" />
  <text v-else class="confirm-value danger">未上传</text>
</view>
```

- [ ] **Step 11: 添加样式**

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

- [ ] **Step 12: 提交**

```bash
git add miniapp-user/src/services/api.js miniapp-user/src/pages/collect/index.vue
git commit -m "feat(collect): add body photo AI breed classification step"
```