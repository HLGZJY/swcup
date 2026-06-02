# AI-Service 架构规划书

> 给统筹者看的项目整体架构和AI定位

---

## 一、项目定位

**鼻纹智救** 是一个流浪动物防重复救助系统。AI-Service 是整个系统的"眼睛"——负责从图片中提取动物的身份信息（品种+鼻纹特征），供后端比对、存储、决策。

---

## 二、系统全貌

```
┌─────────────────────────────────────────────────────────────────┐
│                        移动端（前端）                             │
│   拍摄界面：全身照（判断种类）+ 鼻纹特写（采集向量）               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP JSON
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Node.js 后端                              │
│   职责：接收图片base64 → 转发AI → 存向量到MySQL → 算融合分        │
│   端口：3000                                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP JSON（内部局域网调用）
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AI-Service                                 │
│   职责：图片 → 品种 + 向量（只做AI推理，不碰数据库）              │
│   端口：8000                                                     │
│   技术栈：FastAPI + PyTorch + MobileNetV2                        │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                       MySQL 数据库                              │
│   存：鼻纹向量（512维float）、品种、GPS、时间戳等                 │
│   表：animals / sightings                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、AI-Service 包含的模型

| 模型 | 用途 | 训练数据 | 输出 |
|------|------|---------|------|
| **品种分类模型** | 判断动物品种 | Oxford Pets 37类 | 品种名（中文+英文）+ 置信度 |
| **鼻纹特征模型** | 提取身份向量 | dir_train（6000只狗） | 512维float向量 |
| **质量检测** | 判断图片是否可用 | 无需训练（规则算法） | blur_score + brightness + passed |

---

## 四、AI-Service 对外接口

所有接口均为 **HTTP JSON**，请求Body和响应Body均为JSON。

### 1. 健康检查
```
GET /health
响应：{"status": "ok", "service": "ai-service"}
```

### 2. 图片质量检测（鼻纹照拍摄前调用）
```
POST /detect/quality
请求：{"image": "base64字符串"}
响应：{
  "blur_score": 156.3,       // 拉普拉斯方差，越高越清晰，>100可用
  "brightness": 142.5,       // 0-255，>60且<200为正常
  "passed": true,             // 是否通过
  "reason": null              // null=通过，字符串=失败原因
}
```

### 3. 品种分类（全身照调用）
```
POST /classify/breed
请求：{"image": "base64字符串"}
响应：{
  "breed": "shiba_inu",       // 品种英文名（Oxford Pets格式）
  "breed_cn": "柴犬",         // 品种中文名
  "breed_id": 35,            // 品种内部ID（0-36）
  "confidence": 0.87,        // 最高置信度（0-1）
  "top3": [                  // 前三名候选
    {"breed": "shiba_inu", "breed_cn": "柴犬", "confidence": 0.87},
    {"breed": "akita", "breed_cn": "秋田犬", "confidence": 0.07},
    {"breed": "malamute", "breed_cn": "马拉尼特犬", "confidence": 0.03}
  ]
}
```

### 4. 鼻纹特征提取（鼻纹照调用）
```
POST /extract/feature
请求：{"image": "base64字符串"}
响应：{
  "vector": [0.123, -0.456, ...共512个float],
  "embedding_dim": 512
}
```

---

## 五、品种中文名对照表（Oxford Pets 37类）

| 英文名 | 中文名 | 英文名 | 中文名 |
|--------|--------|--------|--------|
| abyssinian | 阿比西尼亚猫 | leonberger | 莱昂贝格犬 |
| american_bulldog | 美国 Bulldog | maine_coon | 缅因猫 |
| american_pit_bull_terrier | 美国比特斗牛犬 | miniature_pinscher | 迷你杜宾犬 |
| basset_hound | 巴吉度猎犬 | newfoundland | 纽芬兰犬 |
| beagle | 比格犬 | persian | 波斯猫 |
| bengal | 孟加拉猫 | pomeranian | 博美犬 |
| birman | 伯曼猫 | pug | 巴哥犬 |
| bombay | 孟买猫 | ragdoll | 布偶猫 |
| boxer | 拳师犬 | russian_blue | 俄罗斯蓝猫 |
| british_shorthair | 英国短毛猫 | saint_bernard | 圣伯纳犬 |
| chihuahua | 吉娃娃 | samoyed | 萨摩耶 |
| egyptian_mau | 埃及猫 | scottish_terrier | 苏格兰梗 |
| english_cocker_spaniel | 英国可卡犬 | shiba_inu | 柴犬 |
| english_setter | 英国塞特犬 | siamese | 暹罗猫 |
| german_shorthaired | 德国短毛指示犬 | sphynx | 斯芬克斯猫 |
| great_pyrenees | 大白熊犬 | staffordshire_bull_terrier | 斯塔福郡斗牛梗 |
| havanese | 哈瓦那犬 | wheaten_terrier | 软毛麦色梗 |
| japanese_chin | 日本 chin 犬 | yorkshire_terrier | 约克夏梗 |

---

## 六、与后端的分工

| 事情 | 谁做 |
|------|------|
| 接收前端base64图片 | 后端 |
| 调用AI-Service四个接口 | 后端 |
| 判断图片质量是否通过 | 前端（前端也可先调quality接口给用户反馈） |
| 品种分类结果（中英文） | AI-Service返回，后端转发 |
| 鼻纹向量存储到MySQL | 后端 |
| 向量比对（欧氏距离/余弦相似度） | 后端算，或调AI的 /compare/vector |
| 融合分计算（0.4×向量+0.2×GPS+0.2×图像哈希+0.2×文本） | 后端 |
| 给前端返回最终结果 | 后端 |

**AI-Service 绝不碰数据库，只做纯粹的图片→信息转换。**

---

## 七、端口约定

| 服务 | 端口 | 本地地址 |
|------|------|---------|
| AI-Service | 8000 | http://localhost:8000 |
| Node.js 后端 | 3000 | http://localhost:3000 |
| 前端（开发） | 5173 | http://localhost:5173 |

---

## 八、当前进度

- [x] 项目骨架搭建（FastAPI + 目录结构）
- [x] 质量检测接口（/detect/quality）完善
- [ ] 品种分类模型训练（breed_classifier.pth）
- [ ] 品种分类接口暴露（/classify/breed，中英文）
- [ ] 鼻纹特征模型训练（nose_feature.pth，ArcFace）
- [ ] 鼻纹特征接口暴露（/extract/feature）
- [ ] 权重部署（两个模型同时加载）

---

## 九、融合分说明（澄清）

```
融合分 = 0.4 × sim_vector（鼻纹向量相似度）
       + 0.2 × sim_location（GPS距离）
       + 0.2 × sim_image（图像哈希相似度）
       + 0.2 × sim_text（文本描述相似度）
```

**其中 sim_vector 来自鼻纹特征模型的向量比对，不是品种分类模型。**
品种分类模型**不参与**融合分计算，只负责显示"这是什么品种"。
