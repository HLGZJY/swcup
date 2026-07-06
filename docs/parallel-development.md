# 并行开发规约(鼻纹智救)

## 物理隔离: git worktree

| 分支 | worktree 路径 | 用途 |
|------|---------------|------|
| `main` | F:/swcup2026 | 保护分支,只接受来自 dev 的 PR |
| `dev` | (worktree 内 hot-swap) | 集成基线,所有 PR 终点 |
| `fix/stage3-bugs` | F:/swcup2026-bugs | 阶段三 bug 验证 + 修复 |
| `feature/comments-ai` | F:/swcup2026-comments | 评论 + AI 摘要 |

## 5 条铁规(违反拒绝合并)

1. 不修改共享文件: 阶段三改的文件(animal-detail/index.vue, my-reports/index.vue, report/index.vue, collect/index.vue)只准在自己分支改,合并时 git rerere + 手工
2. 新功能只增不删: 评论功能只准 + 不准 - main 已存的行
3. 接口先于代码: openapi spec 先合 main 才能写实现
4. migrations 单列: 命名 `backend/scripts/migrate-YYYY-MM-DD-<topic>.sql`,内容对齐 MySQL 8 方言, fix 分支禁止触数据库
5. 端到端冒烟: 每个 PR 合 dev 后必须能跑 miniapp-user + backend + ai-service 三端起来,curl 走通 happy path

## 共享 schema 协议

双方都需要的小合约 → 先合到 main,后两边用:
- docs/api/comments.openapi.yaml (POST/GET/summary)

## 新建 worktree 命令

```bash
cd F:/swcup2026
git worktree add ../swcup2026-comments feature/comments-ai
git worktree add ../swcup2026-bugs fix/stage3-bugs
```

## 集成顺序

1. worktree-A 提 PR → dev(评论 feature)
2. worktree-B 提 PR → dev(阶段三 bugfix)
3. dev 顺序集成: comments 先合,bugfix 后合(comments 后合会冲突)
4. dev E2E → main