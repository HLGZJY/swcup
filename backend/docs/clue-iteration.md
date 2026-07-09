# 线索识别迭代手册

> 阶段 D：统计 + dry-run + 词库管理。全流程为本地规则计算，不调用 LLM。

## 1. 词库位置

运行时词库位于：

```text
backend/data/dicts/
├── entities.json
├── synonyms.json
├── negations.json
├── time-markers.json
└── sentiment-rules.json
```

服务启动时由 `DictionaryLoader` 加载；运行中修改 JSON 后，`chokidar` 会在约 500ms 去抖后自动 reload。

如需关闭热加载：

```bash
DICT_DISABLE_HOTRELOAD=1 npm run start:dev
```

## 2. 常用运营操作

### 添加实体词

编辑 `entities.json`，按类别加入词条：

```json
{
  "version": 1,
  "categories": {
    "breed": { "weight": 0.2, "words": ["金毛", "边牧"] },
    "color": { "weight": 0.15, "words": ["棕色", "黑色"] },
    "feature": { "weight": 0.15, "words": ["项圈", "断尾"] }
  }
}
```

权重含义：命中评论文本和事件文本中的同一实体词后，按类别加分，总实体加分上限为 `entityMax=0.4`。

### 添加同义词

编辑 `synonyms.json`：

```json
{
  "version": 1,
  "groups": [
    { "canonical": "狗", "aliases": ["狗狗", "毛孩子"] }
  ]
}
```

同义词只作为实体未命中时的兜底加分。

### 添加否定词

编辑 `negations.json`：

```json
{ "version": 1, "words": ["不是", "没有", "未见"] }
```

评论含否定词且实体未命中时，会扣 `negationPenalty=0.2`。

## 3. Admin API

所有接口沿用现有 admin 鉴权。`PUT /admin/dicts/:category` 会立即覆盖线上词库，请先用 dry-run 验证变更意图。

### dry-run 单条评论

```bash
curl -X POST http://localhost:3500/v1/admin/clues/dry-run \
  -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"animal_id":"<animal_id>","content":"昨天在朝阳公园看到金毛"}'
```

返回字段：

- `normalized_content`：清洗后的评论
- `sentiment`：本地审核得到的情感分类
- `score` / `reasons`：最高分候选的分数与解释
- `candidate_events`：召回事件及逐条评分，不写入线索状态文件

### 查看当前词库

```bash
curl http://localhost:3500/v1/admin/dicts \
  -H "Authorization: Bearer <admin token>"
```

### 写回指定词库

```bash
curl -X PUT http://localhost:3500/v1/admin/dicts/entities \
  -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"categories":{"breed":{"weight":0.2,"words":["金毛","边牧"]}}}'
```

允许的 `category`：`entities`、`synonyms`、`negations`、`time-markers`、`sentiment-rules`。

### 手动 reload

```bash
curl -X POST http://localhost:3500/v1/admin/dicts/reload \
  -H "Authorization: Bearer <admin token>"
```

## 4. 统计文件

`ClueStatsService` 按服务器本地时间每日 0 点扫描 `data/clue_state/*.json`，输出：

```text
backend/data/clue_state/_stats/YYYY-MM-DD.json
```

核心字段：

- `total`：线索总数
- `pending_count` / `confirmed_count` / `rejected_count`
- `hit_rate`：`confirmed_count / total`
- `average_match_score`
- `top_keywords`：全部线索 TOP 20 关键词
- `rejected_keywords`：被拒线索 TOP 20 关键词

## 5. 调参建议

1. 先用 dry-run 验证 5-10 条真实评论。
2. 如果真实线索分数偏低，优先补 `entities.json`，不要先调阈值。
3. 如果干扰评论误命中，优先补 `negations.json` 或降低对应实体类别权重。
4. 每天查看 `_stats/YYYY-MM-DD.json`：
   - `rejected_keywords` 高频词适合加入否定或降权策略。
   - `top_keywords` 高频但命中率低的词，说明词库可能过宽。
5. 当前阈值在 `src/comments/scoring-rules.ts` 的 `DEFAULT_RULES.threshold`，调整前先用 dry-run 对比误判与漏判。
