# AI-Service 接口文档（给后端看）

> 后端开发者直接看这份，包含了所有接口的请求/响应格式

---

## 一、概述

AI-Service 是一个**纯推理服务**，只做图片→信息转换，不碰数据库。

**基础地址**：`http://localhost:8000`（AI-Service 本机地址）
**调用方式**：后端收到前端图片后，转发 base64 到 AI-Service，拿到结果继续处理。

---

## 二、接口列表

| 接口 | 方法 | 路径 | 用途 |
|------|------|------|------|
| 健康检查 | GET | `/health` | 确认AI服务存活 |
| 图片质量检测 | POST | `/detect/quality` | 鼻纹照拍摄前检查是否清晰 |
| 品种分类 | POST | `/classify/breed` | 全身照输入，输出品种信息 |
| 鼻纹特征提取 | POST | `/extract/feature` | 鼻纹照输入，输出512维向量 |
| 向量比对 | POST | `/compare/vector` | 两个向量比对相似度（后端也可自己算） |

---

## 三、详细接口

### 3.1 健康检查
```
GET http://localhost:8000/health

响应：
{
  "status": "ok",
  "service": "ai-service"
}
```

### 3.2 图片质量检测（鼻纹照拍摄前调用）
```
POST http://localhost:8000/detect/quality
Content-Type: application/json

请求Body：
{
  "image": "base64字符串（不带data:image前缀）"
}

响应：
{
  "blur_score": 156.3,       // 拉普拉斯方差，>100表示图片清晰
  "brightness": 142.5,         // 平均亮度 0-255，>60且<200为正常
  "passed": true,              // true=通过，false=不通过
  "reason": null               // null=通过，字符串=失败原因如"图片过暗"
}
```

### 3.3 品种分类（全身照调用）
```
POST http://localhost:8000/classify/breed
Content-Type: application/json

请求Body：
{
  "image": "base64字符串（不带data:image前缀）"
}

响应：
{
  "breed": "shiba_inu",       // 品种英文名（Oxford Pets格式，全小写下划线）
  "breed_id": 35,             // 品种ID（0-36）
  "confidence": 0.87,         // 最高置信度（0-1）
  "top3": [
    {"breed": "shiba_inu", "confidence": 0.87},
    {"breed": "akita", "confidence": 0.07},
    {"breed": "malamute", "confidence": 0.03}
  ]
}

注意：品种名是Oxford Pets的37类格式（狗+猫），不是Stanford Dogs的120类。
可用的品种名列表：shiba_inu, akita, american_bulldog, beagle, ... 等37种。
```

### 3.4 鼻纹特征提取（鼻纹照调用）
```
POST http://localhost:8000/extract/feature
Content-Type: application/json

请求Body：
{
  "image": "base64字符串（不带data:image前缀）"
}

响应：
{
  "vector": [0.123, -0.456, 0.789, ...共512个float],
  "embedding_dim": 512
}

注意：
- vector 是 512 维 float 数组，每维范围大约 [-1, 1]
- 需要存入 MySQL 时，可以转成 BLOB 或 JSON 字符串
- 比对时用余弦相似度：sim = dot(v1, v2) / (norm(v1) * norm(v2))
```

### 3.5 向量比对
```
POST http://localhost:8000/compare/vector
Content-Type: application/json

请求Body：
{
  "vector_a": [0.1, 0.2, ...共512个float],
  "vector_b": [0.3, 0.4, ...共512个float]
}

响应：
{
  "cosine_similarity": 0.85,   // 余弦相似度，1=完全相同，-1=完全相反
  "l2_distance": 0.42        // 欧氏距离，0=完全相同，越大越不同
}

注意：后端也可以自己用 numpy 算，不一定要调这个接口。
```

---

## 四、后端典型调用流程

### 场景：用户上传一张全身照 + 一张鼻纹照，查找是否重复

```javascript
// 1. 先调质量检测（鼻纹照）
const qualityRes = await fetch('http://localhost:8000/detect/quality', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({image: noseBase64})
});
const quality = await qualityRes.json();
if (!quality.passed) {
  return {error: `图片不合格：${quality.reason}`};
}

// 2. 调品种分类（全身照）
const breedRes = await fetch('http://localhost:8000/classify/breed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({image: bodyBase64})
});
const breed = await breedRes.json();

// 3. 调鼻纹特征提取（鼻纹照）
const featureRes = await fetch('http://localhost:8000/extract/feature', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({image: noseBase64})
});
const feature = await featureRes.json();

// 4. 组装数据存库或比对
const animal = {
  breed: breed.breed,
  breed_confidence: breed.confidence,
  vector: feature.vector,  // 512维数组
  // ... 其他字段
};
```

---

## 五、存储建议

鼻纹向量（512维float）在MySQL中的存储方式：
```sql
-- 方案1：JSON 字符串
ALTER TABLE animals ADD vector JSON;
INSERT INTO animals (vector) VALUES (JSON_ARRAY(0.123, -0.456, ...));

-- 方案2：BLOB（更紧凑，推荐）
ALTER TABLE animals ADD vector BLOB;
INSERT INTO animals (vector) VALUES (向量转bytes);
```

---

## 六、注意事项

1. **base64 不带前缀**：传入的字符串不要带 `data:image/jpeg;base64,`，只要逗号后面的那串
2. **AI服务不保存任何数据**：所有存储都是后端的责任
3. **AI服务地址**：生产环境需要改成 AI-Service 的实际服务器 IP
4. **品种分类只认 Oxford Pets 的 37 类**：全身照喂进去会返回 37 类之一，如果是猫会返回对应猫品种
