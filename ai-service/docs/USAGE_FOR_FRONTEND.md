# AI-Service 使用指南（给前端看）

> 前端开发者看这份，了解产品流程和调用时机

---

## 一、产品拍照流程

产品设计上，用户需要拍摄**两张照片**：

```
第一步：拍摄全身照
┌────────────────────────┐
│  让用户拍一张能看清     │
│  狗的品种特征的全身照   │
│  （不要只拍鼻子！）     │
└────────────────────────┘
        ↓
 全身照base64 → 发给后端 → 后端调AI → 返回品种结果
        ↓
 显示给用户："这是柴犬吗？"

第二步：拍摄鼻纹照
┌────────────────────────┐
│  让用户凑近拍摄狗鼻子   │
│  清晰地特写鼻纹纹理     │
│  （这是狗的唯一身份ID） │
└────────────────────────┘
        ↓
 先调质量检测 → 看看清晰不清晰
        ↓
 不清晰 → 提示用户重拍
 清晰 → 鼻纹照base64 → 发给后端 → 后端调AI → 返回向量
        ↓
 存储/比对，完成登记
```

---

## 二、前端需要调用的接口（直接调后端，不调AI）

| 步骤 | 调哪个接口 | 传给谁 | 目的 |
|------|-----------|--------|------|
| 拍完全身照 | `POST /api/identify/breed` | 后端 | 后端调AI返回品种 |
| 拍完鼻纹照 | `POST /api/identify/check-quality` | 后端 | 后端调AI返回质量是否通过 |
| 鼻纹照质量不通过 | 显示"图片模糊/太暗，请重拍" | 用户 | 提示用户 |
| 质量通过后提交 | `POST /api/animals` | 后端 | 后端调AI提取向量并存库 |

**总结：前端不直接调 AI-Service，所有请求都发往后端。后端内部调用 AI。**

---

## 三、后端给前端的响应格式（前端需要知道）

### 3.1 品种识别结果
```json
{
  "success": true,
  "breed": "shiba_inu",
  "breed_cn": "柴犬",
  "confidence": 0.87,
  "top3": [
    {"breed": "shiba_inu", "breed_cn": "柴犬", "confidence": 0.87},
    {"breed": "akita", "breed_cn": "秋田犬", "confidence": 0.07},
    {"breed": "malamute", "breed_cn": "马拉尼特犬", "confidence": 0.03}
  ]
}
```

### 3.2 图片质量检测结果
```json
{
  "success": true,
  "passed": true,
  "blur_score": 156.3,
  "brightness": 142.5
}
```

质量不通过时：
```json
{
  "success": true,
  "passed": false,
  "blur_score": 23.1,
  "brightness": 142.5,
  "reason": "图片过模糊，请靠近拍摄"
}
```

### 3.3 提交登记结果
```json
{
  "success": true,
  "message": "登记成功，动物ID: 12345",
  "is_duplicate": false,
  "match_score": 0.0,
  "matched_animal_id": null
}
```

---

## 四、前端产品建议

### 拍照界面设计建议

```
┌──────────────────────────────┐
│  步骤1：拍摄全身照              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │   [相机预览画面]        │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  提示：请拍摄能看清狗狗全貌     │
│        的照片，距离1-2米       │
│                              │
│       [ 拍 照 ]              │
└──────────────────────────────┘

┌──────────────────────────────┐
│  步骤2：拍摄鼻纹特写           │
│  ┌────────────────────────┐  │
│  │   🔍 [鼻纹取景框]       │  │
│  │   （放大显示鼻子区域）   │  │
│  └────────────────────────┘  │
│                              │
│  提示：请将狗鼻子对准框内       │
│        保持稳定，拍摄清晰      │
│                              │
│  [ 拍 照 ]                   │
│                              │
│  ┌────────────────────────┐  │
│  │ ✓ 图片清晰度: 良好       │  │
│  │ ✓ 亮度: 正常            │  │
│  │ ✓ 可以提交              │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### 错误提示文案

| AI返回原因 | 前端显示 |
|-----------|---------|
| 图片过暗 | "环境太暗，请到光线充足的地方拍摄" |
| 图片过亮 | "环境太亮，请避免阳光直射" |
| 图片过模糊 | "图片模糊，请保持手机稳定或靠近拍摄" |
| 图片质量不通过 | "图片质量不达标，请重拍" |

---

## 五、品种中文名对照表（37类 Oxford Pets）

| 英文名 | 中文名 |
|--------|--------|
| shiba_inu | 柴犬 |
| akita | 秋田犬 |
| american_bulldog | 美国 Bulldog |
| beagle | 比格犬 |
| bengal | 孟加拉猫 |
| birman | 伯曼猫 |
| bombay | 孟买猫 |
| boxer | 拳师犬 |
| british_shorthair | 英国短毛猫 |
| chihuahua | 吉娃娃 |
| egyptian_mau | 埃及猫 |
| english_cocker_spaniel | 英国可卡犬 |
| english_setter | 英国塞特犬 |
| german_shorthaired | 德国短毛指示犬 |
| great_pyrenees | 大白熊犬 |
| havanese | 哈瓦那犬 |
| japanese_chin | 日本 chin 犬 |
| keeshond | 荷兰毛狮犬 |
| leonberger | 莱昂贝格犬 |
| maine_coon | 缅因猫 |
| miniature_pinscher | 迷你杜宾犬 |
| newfoundland | 纽芬兰犬 |
| persian | 波斯猫 |
| pomeranian | 博美犬 |
| pug | 巴哥犬 |
| ragdoll | 布偶猫 |
| russian_blue | 俄罗斯蓝猫 |
| saint_bernard | 圣伯纳犬 |
| samoyed | 萨摩耶 |
| scottish_terrier | 苏格兰梗 |
| shiba_inu | 柴犬 |
| siamese | 暹罗猫 |
| sphynx | 斯芬克斯猫 |
| staffordshire_bull_terrier | 斯塔福郡斗牛梗 |
| wheaten_terrier | 软毛麦色梗 |
| yorkshire_terrier | 约克夏梗 |
| abyssinian | 阿比西尼亚猫 |
| american_pit_bull_terrier | 美国比特斗牛犬 |

---

## 六、不需要前端知道的技术细节

以下内容由后端和AI服务处理，前端不需要关心：
- AI-Service 的地址和端口
- 特征向量的存储方式
- 数据库结构
- 向量比对的融合分算法
