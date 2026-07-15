# 评论 + AI 摘要 + 并行规约 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dev 分支上并入两件互不阻塞的工作——(A) 评论 + AI 摘要新功能 与 (B) 阶段 3 已落地 5 commit 的 bug 验证与修复，且 main 上零回归。

**Architecture:**
- 平行两 worktree：`feature/comments-ai` (A) 与 `fix/stage3-bugs` (B)；共享契约(OpenAPI + 数据库 migration + README 规约)先合 main。
- 评论功能在 NestJS 后端 + ai-service(Python 启发式,不上 LLM) + UniApp 前端三端加新模块，**不修改已合 main 的 5 个阶段三 commit 的代码**。
- AI 后台化：内容审核(关键词)+ 情感标签(词典)+ 摘要(jieba TF)三件，零外部 LLM 依赖。

**Tech Stack:**
- 后端: NestJS 10 + TypeORM + PostgreSQL + Jest
- 前端: UniApp + Vue 3 + Vitest（已用）,但本计划只增不改
- AI 服务: Python 3.11 + FastAPI + jieba(已用)+ 简单正则
- 共享契约: OpenAPI 3.0
- 提交规范: 项目 [日期] 类型 | 摘要

**前置条件:**
- 当前 git 状态: main c071672, 有本地 dev / feature/ai-model / feature/backend / feature/miniapp 分支
- 后端现有测试已 189+ 全绿(参考 stage3 实施后 commit 状态)
- ai-service 现运行端口 8000(无 comments 路由)

---

## 关键不变量(违反拒绝合并)

1. **不删行**: 评论功能不允许 `-` 任何 main 已存的行；只能 `+`
2. **接口先合**: openapi spec 先合 main → 才能写实现
3. **migration 单列**: 数字版本号递增, fix 分支禁止触数据库
4. **worktree 不串**: A 线只动新建目录;B 线只动已存在的 5 个 commit 涉及的目录
5. **commit 不带 Co-Authored-By**(项目规则)

---

## Phase 0: 共享契约(必须先于一切 PR)

### Task 0.1: 写 OpenAPI comments 合约

**Files:**
- Create: `docs/api/comments.openapi.yaml`
- Modify: 无
- Test: `docs/api/comments.openapi.test.ts` (用 @apidevtools/swagger-parser 校验合法性)

- [ ] **Step 1: 写失败的解析测试**

新建文件 `docs/api/comments.openapi.test.ts`:

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'
import SwaggerParser from '@apidevtools/swagger-parser'

describe('comments.openapi.yaml', () => {
  it('parses as valid OpenAPI 3.0', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api = await SwaggerParser.validate(file as any)
    expect(api.openapi).toMatch(/^3\.0\./)
  })
  it('exposes POST /v1/comments', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api: any = await SwaggerParser.dereference(file as any)
    expect(api.paths['/v1/comments'].post).toBeDefined()
  })
  it('exposes GET /v1/comments/animal/{animal_id}/summary', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api: any = await SwaggerParser.dereference(file as any)
    expect(api.paths['/v1/comments/animal/{animal_id}/summary'].get).toBeDefined()
  })
})
```

- [ ] **Step 2: 跑测试确认 FAIL**

Run: `cd backend && npx jest docs/api/comments.openapi.test.ts --no-coverage 2>&1 | head -40`
Expected: FAIL — "Cannot find module" / file 不存在

- [ ] **Step 3: 写 openapi 合约**

新建 `docs/api/comments.openapi.yaml`:

```yaml
openapi: 3.0.3
info:
  title: Comments API
  version: '1.0.0'
  description: 用户对动物评论 + AI 后台处理
paths:
  /v1/comments:
    post:
      summary: 发表评论
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateCommentDto'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Comment'
        '400': { description: Bad Request }
  /v1/comments/animal/{animal_id}/summary:
    get:
      summary: 评论摘要(情感分布 + Top 关键词)
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: animal_id
          required: true
          schema: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CommentSummary'
  /v1/comments/animal/{animal_id}:
    get:
      summary: 列出该动物评论
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: animal_id
          required: true
          schema: { type: string }
        - in: query
          name: limit
          schema: { type: integer, default: 20, maximum: 100 }
        - in: query
          name: offset
          schema: { type: integer, default: 0 }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  total: { type: integer }
                  items:
                    type: array
                    items: { $ref: '#/components/schemas/Comment' }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Sentiment:
      type: string
      enum: [care, seek, fake, thanks, report, neutral]
    Comment:
      type: object
      properties:
        comment_id: { type: string, format: uuid }
        animal_id: { type: string, format: uuid }
        reporter_id: { type: string, format: uuid }
        content: { type: string, maxLength: 500 }
        sentiment: { $ref: '#/components/schemas/Sentiment' }
        is_hidden: { type: boolean }
        created_at: { type: string, format: date-time }
    CreateCommentDto:
      type: object
      required: [animal_id, content]
      properties:
        animal_id: { type: string, format: uuid }
        content: { type: string, minLength: 1, maxLength: 500 }
    CommentSummary:
      type: object
      properties:
        animal_id: { type: string, format: uuid }
        total: { type: integer }
        sentiment_dist:
          type: object
          additionalProperties: { type: integer }
        top_keywords:
          type: array
          items: { type: string }
        auto_summary: { type: string }
```

- [ ] **Step 4: 加测试用依赖到 backend/package.json**

修改 `backend/package.json` devDependencies(只加,不删):

```json
"@apidevtools/swagger-parser": "^10.1.0"
```

Run: `cd backend && npm install --save-dev @apidevtools/swagger-parser`
Expected: 安装完成，package-lock.json 更新

- [ ] **Step 5: 跑测试确认 PASS**

Run: `cd backend && npx jest docs/api/comments.openapi.test.ts --no-coverage`
Expected: PASS — 3 specs 全过

- [ ] **Step 6: 提交**

```bash
git add docs/api/comments.openapi.yaml docs/api/comments.openapi.test.ts backend/package.json backend/package-lock.json
git commit -m "[2026-07-06] docs | 增加评论功能 OpenAPI 合约

- 定义 POST /v1/comments, GET /v1/comments/animal/{id}, GET .../summary
- 校验文件可被 swagger-parser 解析为 3.0"
```

注意: docs/api 不在 backend 跑测试默认路径下,后续需在 jest.config.ts 加 testMatch。
应在 Task 0.1 内一并补:

修改 `backend/jest.config.ts`:

```typescript
// 在已有 testRegex 改为:
testRegex: '(/__tests__/.*|\\.(test|spec))\\.(ts|tsx|js)$',
testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/docs/**/*.test.ts'],
```

跑 `cd backend && npx jest docs/api` 确认 tests 被拾取。

### Task 0.2: 数据库 migration 占位 + README 并行规约

**Files:**
- Create: `backend/src/database/migrations/005-create-comments.sql`
- Create: `docs/parallel-development.md`

- [ ] **Step 1: 写 migration 模板(字段定义,不写索引)**

新建 `backend/src/database/migrations/005-create-comments.sql`:

```sql
-- 评论表 (依赖 phase A 完成)
-- 对应 OpenAPI: docs/api/comments.openapi.yaml
CREATE TABLE IF NOT EXISTS comments (
  comment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     UUID NOT NULL REFERENCES animals(animal_id) ON DELETE CASCADE,
  reporter_id   UUID NOT NULL REFERENCES users(user_id),
  content       TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  sentiment     VARCHAR(16) NOT NULL DEFAULT 'neutral',
  is_hidden     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- 索引在 A 实施时加,本任务仅列 schema
```

- [ ] **Step 2: 写并行规约 README**

新建 `docs/parallel-development.md`:

```markdown
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
4. migrations 单列: 数字版本号递增, fix 分支禁止触数据库
5. 端到端冒烟: 每个 PR 合 dev 后必须能跑 miniapp-user + backend + ai-service 三端起来,curl 走通 happy path

## 共享 schema 协议

双方都需要的小合约 → 先合到 main,后两边用:
- docs/api/comments.openapi.yaml (POST/GET/summary)

## 新建 worktree 命令

\`\`\`bash
cd F:/swcup2026
git worktree add ../swcup2026-comments feature/comments-ai
git worktree add ../swcup2026-bugs fix/stage3-bugs
\`\`\`

## 集成顺序

1. worktree-A 提 PR → dev(评论 feature)
2. worktree-B 提 PR → dev(阶段三 bugfix)
3. dev 顺序集成: comments 先合,bugfix 后合(comments 后合会冲突)
4. dev E2E → main
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/database/migrations/005-create-comments.sql docs/parallel-development.md
git commit -m "[2026-07-06] docs | 评论表 migration 占位 + 并行规约 README

- migration 005 占位,字段与 openapi 对齐
- 规约落到 docs/parallel-development.md: worktree + 铁规 + 集成顺序"
```

Phase 0 完成。等此 commit 合到 main 后,A 与 B 才能并行开 PR 进 dev。

---

## Phase A: 评论 + AI 摘要(worktree-A, 分支 feature/comments-ai)

> 前置: Phase 0 已合 main。
> 工作目录: `F:/swcup2026-comments`

### Task A.1: 数据库 schema 索引(migration 完整化)

**Files:**
- Modify: `backend/src/database/migrations/005-create-comments.sql`
- Test: `backend/src/comments/comments.service.spec.ts` (写入依赖,但这个 task 只做迁移)

- [ ] **Step 1: 加索引**

修改文件,在文件末尾追加:

```sql
-- 索引(查询热点)
CREATE INDEX IF NOT EXISTS idx_comments_animal_created ON comments(animal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_animal_visible ON comments(animal_id) WHERE is_hidden = false;
```

- [ ] **Step 2: 跑迁移(本地 dev DB)**

Run: `cd backend && npm run migration:run` (项目已用 TypeORM CLI)
Expected: `005-create-comments.sql` 已执行,表 + 索引均在

- [ ] **Step 3: 验证表存在**

Run: `cd backend && psql $DATABASE_URL -c "\d comments"`
Expected: 输出包含 comment_id, animal_id, content, sentiment 字段

- [ ] **Step 4: 提交**

```bash
git add backend/src/database/migrations/005-create-comments.sql
git commit -m "[2026-07-06] feat(db) | 评论表加索引(animal_id+created_at, visible-only)"
```

### Task A.2: entity + DTO(TypeScript 严格模式)

**Files:**
- Create: `backend/src/comments/entities/comment.entity.ts`
- Create: `backend/src/comments/dto/create-comment.dto.ts`
- Create: `backend/src/comments/entities/comment-ai-meta.entity.ts`
- Test: `backend/src/comments/comments.service.spec.ts`

- [ ] **Step 1: 写 ai-meta entity**

新建 `backend/src/comments/entities/comment-ai-meta.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Comment } from './comment.entity';

@Entity('comment_ai_meta')
export class CommentAiMeta {
  @PrimaryGeneratedColumn('uuid')
  ai_meta_id!: string;

  @OneToOne(() => Comment)
  @JoinColumn({ name: 'comment_id' })
  comment_id!: string;

  @Column({ type: 'varchar', length: 16, default: 'neutral' })
  sentiment!: 'care' | 'seek' | 'fake' | 'thanks' | 'report' | 'neutral';

  @Column({ type: 'jsonb', default: '[]' })
  tags!: string[];

  @Column({ type: 'real', default: 0 })
  confidence!: number;

  @Column({ type: 'varchar', length: 64, default: 'kw_only' })
  pipeline!: string;
}
```

- [ ] **Step 2: 写 comment entity**

新建 `backend/src/comments/entities/comment.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Animal } from '../../animals/entities/animal.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
@Index(['animal_id', 'created_at'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  comment_id!: string;

  @Column({ type: 'uuid' })
  animal_id!: string;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'animal_id' })
  animal?: Animal;

  @Column({ type: 'uuid' })
  reporter_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 16, default: 'neutral' })
  sentiment!: string;

  @Column({ type: 'boolean', default: false })
  is_hidden!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
```

- [ ] **Step 3: 写 DTO(用 class-validator,与项目一致)**

新建 `backend/src/comments/dto/create-comment.dto.ts`:

```typescript
import { IsUUID, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  animal_id!: string;

  @IsString()
  @Length(1, 500)
  content!: string;
}
```

- [ ] **Step 4: 写 service 测试(TDD-RED)**

新建 `backend/src/comments/comments.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { CommentAiMeta } from './entities/comment-ai-meta.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepo: any;
  let aiMetaRepo: any;
  let http: any;

  beforeEach(async () => {
    commentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };
    aiMetaRepo = { save: jest.fn() };
    http = { post: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(CommentAiMeta), useValue: aiMetaRepo },
        { provide: HttpService, useValue: http },
      ],
    }).compile();
    service = module.get(CommentsService);
  });

  it('creates a comment and writes ai-meta, returns hidden if profanity', async () => {
    http.post.mockResolvedValue({
      data: { is_safe: false, sentiment: 'report', tags: ['violence'], confidence: 0.92 },
    });
    commentRepo.create.mockReturnValue({
      comment_id: 'c1',
      animal_id: 'a1',
      reporter_id: 'u1',
      content: 'bad',
      sentiment: 'report',
      is_hidden: true,
    });
    commentRepo.save.mockResolvedValue({
      comment_id: 'c1',
      animal_id: 'a1',
      reporter_id: 'u1',
      content: 'bad',
      sentiment: 'report',
      is_hidden: true,
    });
    aiMetaRepo.save.mockResolvedValue({});

    const out = await service.create({ animal_id: 'a1', content: 'bad' }, 'u1');
    expect(out.is_hidden).toBe(true);
    expect(out.sentiment).toBe('report');
    expect(aiMetaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 'c1', sentiment: 'report', tags: ['violence'] }),
    );
  });

  it('lists comments visible only', async () => {
    commentRepo.findAndCount.mockResolvedValue([[], 0]);
    const r = await service.findByAnimal('a1', 20, 0);
    expect(r.total).toBe(0);
    expect(commentRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ animal_id: 'a1', is_hidden: false }) }),
    );
  });

  it('summarizes by sentiment distribution and top keywords', async () => {
    commentRepo.find.mockResolvedValue([
      { content: '希望主人快点找到它', sentiment: 'seek' },
      { content: '加油', sentiment: 'care' },
      { content: '看到了', sentiment: 'report' },
    ]);
    const summary = await service.summarize('a1');
    expect(summary.sentiment_dist.seek).toBe(1);
    expect(summary.sentiment_dist.care).toBe(1);
    expect(summary.top_keywords.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: 跑测试确认 FAIL**

Run: `cd backend && npx jest src/comments/comments.service.spec.ts --no-coverage`
Expected: FAIL — `Cannot find module './comments.service'`

- [ ] **Step 6: 实现 service**

新建 `backend/src/comments/comments.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Comment } from './entities/comment.entity';
import { CommentAiMeta } from './entities/comment-ai-meta.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

export interface AiModerateResponse {
  is_safe: boolean;
  sentiment: 'care' | 'seek' | 'fake' | 'thanks' | 'report' | 'neutral';
  tags: string[];
  confidence: number;
}

@Injectable()
export class CommentsService {
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  constructor(
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommentAiMeta) private readonly aiMetaRepo: Repository<CommentAiMeta>,
    private readonly http: HttpService,
  ) {}

  async create(dto: CreateCommentDto, reporterId: string): Promise<Comment> {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('评论内容不能为空');
    }
    const moderation = await this.moderate(dto.content);
    const comment = this.commentRepo.create({
      animal_id: dto.animal_id,
      reporter_id: reporterId,
      content: dto.content,
      sentiment: moderation.sentiment,
      is_hidden: !moderation.is_safe,
    });
    const saved = await this.commentRepo.save(comment);
    await this.aiMetaRepo.save({
      comment_id: saved.comment_id,
      sentiment: moderation.sentiment,
      tags: moderation.tags,
      confidence: moderation.confidence,
      pipeline: 'kw_only',
    });
    return saved;
  }

  async findByAnimal(animalId: string, limit: number, offset: number) {
    const [items, total] = await this.commentRepo.findAndCount({
      where: { animal_id: animalId, is_hidden: false },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async summarize(animalId: string) {
    const items = await this.commentRepo.find({
      where: { animal_id: animalId, is_hidden: false },
      take: 200,
      order: { created_at: 'DESC' },
    });
    const sentiment_dist: Record<string, number> = {};
    const wordCount = new Map<string, number>();
    for (const c of items) {
      sentiment_dist[c.sentiment] = (sentiment_dist[c.sentiment] || 0) + 1;
      for (const w of c.content.split(/\s+/)) {
        if (w.length < 2) continue;
        wordCount.set(w, (wordCount.get(w) || 0) + 1);
      }
    }
    const top_keywords = [...wordCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);
    return {
      animal_id: animalId,
      total: items.length,
      sentiment_dist,
      top_keywords,
      auto_summary: items.length === 0 ? '暂无评论' : `最近 ${items.length} 条评论主要表达 ${this.pickTopSentiment(sentiment_dist)}`,
    };
  }

  private pickTopSentiment(dist: Record<string, number>): string {
    const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    const map: Record<string, string> = {
      care: '关心',
      seek: '寻主',
      report: '线索',
      fake: '质疑',
      thanks: '感谢',
      neutral: '中肯',
    };
    return map[sorted[0]?.[0]] || '中肯';
  }

  private async moderate(content: string): Promise<AiModerateResponse> {
    try {
      const resp = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/comments/moderate`, { content }, { timeout: 3000 }),
      );
      return resp.data;
    } catch {
      // ai-service 不可用时降级:默认通过,中性情感
      return { is_safe: true, sentiment: 'neutral', tags: [], confidence: 0 };
    }
  }
}
```

- [ ] **Step 7: 写 controller**

新建 `backend/src/comments/comments.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('评论')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: '发表评论' })
  create(@Body() dto: CreateCommentDto, @Request() req: any) {
    return this.commentsService.create(dto, req.user.user_id);
  }

  @Get('animal/:animal_id')
  @ApiOperation({ summary: '列出动物评论' })
  list(
    @Param('animal_id') animalId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.commentsService.findByAnimal(animalId, Number(limit), Number(offset));
  }

  @Get('animal/:animal_id/summary')
  @ApiOperation({ summary: '评论摘要(情感分布 + 关键词)' })
  summary(@Param('animal_id') animalId: string) {
    return this.commentsService.summarize(animalId);
  }
}
```

- [ ] **Step 8: 写 module**

新建 `backend/src/comments/comments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Comment } from './entities/comment.entity';
import { CommentAiMeta } from './entities/comment-ai-meta.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, CommentAiMeta]), HttpModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

- [ ] **Step 9: 注册到 AppModule(只追加,不删)**

修改 `backend/src/app.module.ts`,在 imports 数组末尾追加 `CommentsModule`(找到 imports 数组的最后一项后添加):

```typescript
import { CommentsModule } from './comments/comments.module';
// ...existing imports
@Module({
  imports: [
    // ...existing modules
    CommentsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 10: 跑测试确认 PASS**

Run: `cd backend && npx jest src/comments/comments.service.spec.ts --no-coverage`
Expected: PASS — 3 specs 全过

- [ ] **Step 11: 启动 backend 烟测**

Run: `cd backend && npm run start:dev` (另开终端)
另开终端 Run: `curl -s http://localhost:3000/comments/animal/<uuid> -H "Authorization: Bearer <test-jwt>" | head -5`
Expected: 200, JSON 数组(可能空)

- [ ] **Step 12: 提交**

```bash
git add backend/src/comments/ backend/src/app.module.ts
git commit -m "[2026-07-06] feat(comments) | 评论 entity/dto/service/controller/module + service 单测

- entity: Comment + CommentAiMeta (TypeORM, OneToOne, 索引已由 migration 加)
- service: moderate pipeline + findByAnimal + summarize (降级: AI 不可用返回 neutral)
- controller: POST /v1/comments, GET .../summary, GET .../list
- 单测覆盖 hidden / visible 过滤 / 摘要情感分布"
```

### Task A.3: ai-service moderate + summary 端点

**Files:**
- Create: `ai-service/comments/__init__.py`
- Create: `ai-service/comments/moderate.py`
- Create: `ai-service/comments/summary.py`
- Modify: `ai-service/app.py` (注册路由)
- Test: `ai-service/tests/test_comments_moderate.py`

- [ ] **Step 1: 写 moderate 测试**

新建 `ai-service/tests/test_comments_moderate.py`:

```python
from comments.moderate import moderate

def test_blocks_phone_number():
    r = moderate("联系我吧 13800000000")
    assert r["is_safe"] is False
    assert "phone" in r["tags"]

def test_blocks_wechat():
    r = moderate("加我微信 abc123")
    assert r["is_safe"] is False
    assert "wechat" in r["tags"]

def test_classifies_care():
    r = moderate("希望主人快点找到它,加油")
    assert r["is_safe"] is True
    assert r["sentiment"] == "care"

def test_classifies_seek():
    r = moderate("有没有人看到过这只狗,请联系我主人")
    assert r["sentiment"] == "seek"

def test_classifies_fake():
    r = moderate("假消息,骗人的吧")
    assert r["sentiment"] == "fake"

def test_default_neutral():
    r = moderate("hello world")
    assert r["sentiment"] == "neutral"
```

- [ ] **Step 2: 跑测试确认 FAIL**

Run: `cd ai-service && .venv/Scripts/python.exe -m pytest tests/test_comments_moderate.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'comments'`

- [ ] **Step 3: 写 moderate.py**

新建 `ai-service/comments/__init__.py`(空文件)。

新建 `ai-service/comments/moderate.py`:

```python
"""关键词词典启发式内容审核 + 情感分类。
零 LLM 依赖。响应 < 5ms。
"""
import re
from typing import Dict, List

_SENTIMENT_DICT: Dict[str, List[str]] = {
    "care": ["加油", "希望", "心疼", "快回家", "平安", "关爱", "想念"],
    "seek": ["主人", "走失", "丢失", "找主人", "寻主", "回家", "请帮忙"],
    "report": ["看到了", "目击", "现场", "地点", "时间"],
    "fake": ["假的", "骗人", "假的吧", "不信", "广告"],
    "thanks": ["感谢", "谢谢", "找到了", "已找回"],
}

_PROFANITY = ["傻逼", "操你", "妈的", "fuck", "shit"]
_PHONE_RE = re.compile(r"1[3-9]\d{9}")
_WECHAT_RE = re.compile(r"(微信|加我|vx|v信)", re.IGNORECASE)


def moderate(content: str) -> Dict:
    """返回 {is_safe, sentiment, tags, confidence}"""
    if not content or not isinstance(content, str):
        return {"is_safe": False, "sentiment": "neutral", "tags": ["empty"], "confidence": 1.0}

    text = content.strip().lower()
    tags: List[str] = []

    if any(p in text for p in _PROFANITY):
        tags.append("profanity")
    if _PHONE_RE.search(text):
        tags.append("phone")
    if _WECHAT_RE.search(text):
        tags.append("wechat")

    is_safe = len(tags) == 0

    sentiment = "neutral"
    max_hits = 0
    for label, words in _SENTIMENT_DICT.items():
        hits = sum(1 for w in words if w in text)
        if hits > max_hits:
            max_hits = hits
            sentiment = label

    confidence = 0.7 if max_hits > 0 else 0.3
    return {
        "is_safe": is_safe,
        "sentiment": sentiment,
        "tags": tags,
        "confidence": confidence,
    }
```

- [ ] **Step 4: 跑测试确认 PASS**

Run: `cd ai-service && .venv/Scripts/python.exe -m pytest tests/test_comments_moderate.py -v`
Expected: PASS — 6 tests 全过

- [ ] **Step 5: 写 summary.py(纯本地 TF 排序)**

新建 `ai-service/comments/summary.py`:

```python
"""评论摘要生成: TF 排序 + 句子选择。
零 LLM 依赖。
"""
from collections import Counter
from typing import Dict, List
import re

_STOP_WORDS = set(["的", "了", "和", "是", "在", "我", "你", "它", "啊", "吧", "吗", "呢", "啦"])


def make_top_keywords(comments: List[Dict], k: int = 8) -> List[str]:
    cnt: Counter = Counter()
    for c in comments:
        for w in re.findall(r"[\u4e00-\u9fff]{2,}", c.get("content", "")):
            if w in _STOP_WORDS:
                continue
            cnt[w] += 1
    return [w for w, _ in cnt.most_common(k)]


def make_summary(comments: List[Dict], sentiment_dist: Dict[str, int]) -> str:
    if not comments:
        return "暂无评论"
    top = max(sentiment_dist.items(), key=lambda x: x[1], default=("neutral", 0))[0]
    label_map = {
        "care": "关心", "seek": "寻主", "report": "线索",
        "fake": "质疑", "thanks": "感谢", "neutral": "中肯",
    }
    label = label_map.get(top, "中肯")
    return f"最近 {len(comments)} 条评论主要表达{label}"


def build_summary_response(animal_id: str, comments: List[Dict]) -> Dict:
    sentiment_dist: Dict[str, int] = {}
    for c in comments:
        s = c.get("sentiment", "neutral")
        sentiment_dist[s] = sentiment_dist.get(s, 0) + 1
    return {
        "animal_id": animal_id,
        "total": len(comments),
        "sentiment_dist": sentiment_dist,
        "top_keywords": make_top_keywords(comments),
        "auto_summary": make_summary(comments, sentiment_dist),
    }
```

- [ ] **Step 6: 注册路由(只追加,不改 main.py)**

修改 `ai-service/app.py`: 在文件末尾追加端点(寻找 `if __name__ == "__main__":` 之前的位置):

```python
from comments.moderate import moderate as moderate_comment
from comments.summary import build_summary_response

@app.post("/comments/moderate")
def comments_moderate(payload: dict):
    return moderate_comment(payload.get("content", ""))

@app.post("/comments/summary")
def comments_summary(payload: dict):
    return build_summary_response(payload.get("animal_id", ""), payload.get("comments", []))
```

- [ ] **Step 7: 启动 ai-service + curl 验证**

Run(另开终端): `cd ai-service && .venv/Scripts/python.exe -m uvicorn app:app --reload --port 8000`
另开终端 Run:

```bash
curl -s -X POST http://localhost:8000/comments/moderate -H "Content-Type: application/json" -d '{"content":"加油,希望主人找到它"}'
```

Expected: `{"is_safe":true,"sentiment":"care","tags":[],"confidence":0.7}`

- [ ] **Step 8: 提交**

```bash
git add ai-service/comments/ ai-service/tests/ ai-service/app.py
git commit -m "[2026-07-06] feat(ai) | 评论 moderate + summary 端点(关键词+TF,零 LLM)

- moderate: 关键词词典 + 正则(电话/微信/脏话)
- summary: TF 排序 + 情感分布,响应 < 5ms
- 6 单测覆盖三类情感 + 安全过滤"
```

### Task A.4: 前端组件 + 页面(UniApp Vue3)

**Files:**
- Create: `miniapp-user/src/components/comment-list/index.vue`
- Create: `miniapp-user/src/components/comment-input/index.vue`
- Create: `miniapp-user/src/pages/animal-detail/comments.vue`
- Test: `miniapp-user/src/components/comment-list/index.spec.ts`

- [ ] **Step 1: 写组件测试(TDD-RED)**

新建 `miniapp-user/src/components/comment-list/index.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CommentList from './index.vue'

describe('CommentList', () => {
  it('renders empty state when no items', () => {
    const wrapper = mount(CommentList, { props: { items: [], summary: null } })
    expect(wrapper.text()).toContain('暂无评论')
  })

  it('renders sentiment chip', () => {
    const wrapper = mount(CommentList, {
      props: {
        items: [{ comment_id: 'c1', content: '加油', sentiment: 'care', is_hidden: false, created_at: new Date().toISOString() }],
        summary: { auto_summary: '测试' } as any,
      },
    })
    expect(wrapper.text()).toContain('加油')
    expect(wrapper.text()).toContain('care')
  })

  it('hides hidden items', () => {
    const wrapper = mount(CommentList, {
      props: {
        items: [{ comment_id: 'c1', content: '隐藏', sentiment: 'fake', is_hidden: true, created_at: new Date().toISOString() }],
      },
    })
    expect(wrapper.text()).not.toContain('隐藏')
  })
})
```

- [ ] **Step 2: 跑测试确认 FAIL**

Run: `cd miniapp-user && npx vitest run src/components/comment-list/index.spec.ts 2>&1 | head -30`
Expected: FAIL — 找不到组件

- [ ] **Step 3: 写组件**

新建 `miniapp-user/src/components/comment-list/index.vue`:

```vue
<template>
  <view class="comment-list">
    <view v-if="summary" class="ai-summary">
      <text class="ai-label">AI 摘要</text>
      <text class="ai-text">{{ summary.auto_summary }}</text>
      <view v-if="summary.top_keywords?.length" class="keywords">
        <text v-for="k in summary.top_keywords" :key="k" class="keyword-chip">{{ k }}</text>
      </view>
    </view>

    <view v-if="displayItems.length === 0" class="empty">
      <text>暂无评论,做第一个发声的人吧</text>
    </view>

    <view v-for="c in displayItems" :key="c.comment_id" class="comment-card">
      <text class="content">{{ c.content }}</text>
      <view class="meta">
        <text class="sentiment" :class="`sent-${c.sentiment}`">{{ sentimentLabel(c.sentiment) }}</text>
        <text class="time">{{ formatRelative(c.created_at) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface CommentItem {
  comment_id: string
  content: string
  sentiment: string
  is_hidden: boolean
  created_at: string
}

interface Props {
  items: CommentItem[]
  summary?: { auto_summary: string; top_keywords?: string[]; sentiment_dist?: Record<string, number> } | null
}

const props = withDefaults(defineProps<Props>(), { summary: null })

const displayItems = computed(() => props.items.filter((i) => !i.is_hidden))

const _LABELS: Record<string, string> = { care: '关心', seek: '寻主', report: '线索', fake: '质疑', thanks: '感谢', neutral: '中肯' }
function sentimentLabel(s: string) { return _LABELS[s] || s }

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  return `${Math.floor(min / 60)}小时前`
}
</script>

<style lang="scss" scoped>
.comment-list { padding: 16rpx 0; }
.ai-summary { background: #f0f9ff; padding: 20rpx; border-radius: 12rpx; margin-bottom: 16rpx; }
.ai-label { font-size: 24rpx; color: #0369a1; font-weight: 600; }
.ai-text { font-size: 28rpx; color: #0c4a6e; display: block; margin-top: 8rpx; }
.keywords { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.keyword-chip { background: #e0f2fe; padding: 4rpx 12rpx; border-radius: 16rpx; font-size: 22rpx; color: #0369a1; }
.empty { padding: 40rpx; text-align: center; color: #94a3b8; }
.comment-card { padding: 20rpx 0; border-bottom: 1rpx solid #e2e8f0; }
.content { font-size: 30rpx; color: #1e293b; display: block; }
.meta { display: flex; justify-content: space-between; margin-top: 8rpx; }
.sentiment { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.sent-care { background: #dcfce7; color: #166534; }
.sent-seek { background: #fef3c7; color: #854d0e; }
.sent-report { background: #dbeafe; color: #1e40af; }
.sent-fake { background: #fee2e2; color: #991b1b; }
.sent-thanks { background: #ede9fe; color: #5b21b6; }
.sent-neutral { background: #f1f5f9; color: #475569; }
.time { font-size: 22rpx; color: #64748b; }
</style>
```

- [ ] **Step 4: 写 comment-input 组件**

新建 `miniapp-user/src/components/comment-input/index.vue`:

```vue
<template>
  <view class="comment-input-bar">
    <textarea
      v-model="text"
      :maxlength="500"
      placeholder="说点什么吧 (≤ 500 字)"
      class="input"
      @input="onInput"
    />
    <button :disabled="!canSubmit" @click="submit">{{ submitting ? '提交中' : '发送' }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{ (e: 'submit', content: string): void }>()
const text = ref('')
const submitting = ref(false)

const canSubmit = computed(() => text.value.trim().length > 0 && !submitting.value)

function onInput(e: any) { text.value = e.detail.value }

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    emit('submit', text.value.trim())
    text.value = ''
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.comment-input-bar {
  display: flex; gap: 12rpx; padding: 16rpx;
  background: #fff; border-top: 1rpx solid #e2e8f0;
}
.input { flex: 1; height: 80rpx; padding: 12rpx; background: #f8fafc; border-radius: 8rpx; font-size: 28rpx; }
button { font-size: 28rpx; padding: 0 24rpx; }
</style>
```

- [ ] **Step 5: 写评论子页(只追加,不动 animal-detail/index.vue)**

新建 `miniapp-user/src/pages/animal-detail/comments.vue`:

```vue
<template>
  <view class="comments-page">
    <view class="header">
      <text class="title">{{ animalName }} 的评论</text>
    </view>
    <CommentList :items="items" :summary="summary" />
    <CommentInput @submit="handleSubmit" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import CommentList from '@/components/comment-list/index.vue'
import CommentInput from '@/components/comment-input/index.vue'
import { request } from '@/utils/request'

const animalId = ref('')
const animalName = ref('这只动物')
const items = ref<any[]>([])
const summary = ref<any>(null)

onLoad((q: any) => {
  animalId.value = q?.animal_id || ''
  animalName.value = q?.animal_name || '这只动物'
  load()
})

async function load() {
  if (!animalId.value) return
  const [list, sum] = await Promise.all([
    request<any>({ url: `/v1/comments/animal/${animalId.value}`, method: 'GET' }),
    request<any>({ url: `/v1/comments/animal/${animalId.value}/summary`, method: 'GET' }),
  ])
  items.value = list?.items || []
  summary.value = sum || null
}

async function handleSubmit(content: string) {
  const created = await request<any>({
    url: '/v1/comments',
    method: 'POST',
    data: { animal_id: animalId.value, content },
  })
  if (created) {
    if (created.is_hidden) {
      uni.showToast({ title: '评论已提交(内容待审)', icon: 'none' })
    } else {
      uni.showToast({ title: '评论成功', icon: 'success' })
    }
    await load()
  }
}
</script>

<style lang="scss" scoped>
.comments-page { padding: 24rpx; }
.header { padding: 24rpx 0; }
.title { font-size: 36rpx; font-weight: 600; }
</style>
```

- [ ] **Step 6: 注册页面 + 入口(只追加,不改 main files)**

修改 `miniapp-user/src/pages.json`,在 pages 数组末尾追加(只加不删,遵守铁规 #1):

```json
{
  "path": "pages/animal-detail/comments",
  "style": {
    "navigationBarTitleText": "评论"
  }
}
```

修改 `miniapp-user/src/pages/animal-detail/index.vue`,在"查看时间轴"按钮旁边追加一个"查看评论"按钮(只新增一行 + 一个 `<view>` 块):

```vue
<navigator :url="`/pages/animal-detail/comments?animal_id=${animal.animal_id}&animal_name=${animal.name || '这只动物'}`" class="btn-link">
  查看评论
</navigator>
```

> 实际写代码时: 在已存在的 .vue 找到合适位置追加, **不删任何旧代码**。

- [ ] **Step 7: 跑测试确认 PASS**

Run: `cd miniapp-user && npx vitest run src/components/comment-list/index.spec.ts`
Expected: PASS — 3 specs 全过

- [ ] **Step 8: 启动 + 手动走通**

Run: `cd miniapp-user && npm run dev:h5` (或 dev:mp-weixin)
Expected: H5 端打开后能跳到评论页,UI 渲染"暂无评论"

- [ ] **Step 9: 提交**

```bash
git add miniapp-user/src/components/comment-list/ miniapp-user/src/components/comment-input/ miniapp-user/src/pages/animal-detail/comments.vue miniapp-user/src/pages/animal-detail/index.vue miniapp-user/src/pages.json miniapp-user/src/components/comment-list/index.spec.ts
git commit -m "[2026-07-06] feat(miniapp) | 评论列表/输入组件 + 评论页 + 入口

- CommentList: AI 摘要条 + 情感 chip + 隐藏过滤
- CommentInput: 500 字 textarea + 提交按钮 loading
- pages/animal-detail/comments.vue: 拉取 + 提交 + 刷新
- 入口只在 animal-detail 加导航 href,不动原代码"
```

### Task A.5: PR 到 dev(comments 集成)

- [ ] **Step 1: 推分支**

Run: `cd F:/swcup2026-comments && git push -u origin feature/comments-ai`
Expected: 分支建好, remote OK

- [ ] **Step 2: 创 PR**

打开 `F:/swcup2026-comments` 在 GitHub 上 `feature/comments-ai` → `dev`,标题:
"feat: 评论 + AI 摘要(关键词+TF,零 LLM)"

PR body 模板:
```
## 内容
- 后端: CommentsModule + ai-meta + 2 controller 端点
- ai-service: /comments/moderate + /comments/summary
- 前端: CommentList/Input + 评论页 + 入口(只追加,不改 main 代码)

## 验证
- [x] backend jest N+3 PASS(参见 Task A.2 step 10)
- [x] ai-service pytest 6 PASS(参见 Task A.3 step 4)
- [x] 前端 vitest 3 PASS(参见 Task A.4 step 7)

## 修改文件清单
- backend/src/comments/ (新)
- backend/src/app.module.ts (+1 行)
- ai-service/comments/, ai-service/tests/, ai-service/app.py
- miniapp-user/src/components/comment-list/, comment-input/ (新)
- miniapp-user/src/pages/animal-detail/comments.vue (新)
- miniapp-user/src/pages.json (+1 条)
- miniapp-user/src/pages/animal-detail/index.vue (+1 个导航)

## 不变量
- main 已存代码 0 删除
- 不涉及阶段三 5 commit 修改
```

合并前 dev 自己 reviewer 跑一次:

Run: `git checkout dev && git pull && cd backend && npm install && npx jest --no-coverage`
Expected: 全部测试通过 + 新增 3 个 comments 测试 pass

---

## Phase B: 阶段三 bug 验证 + 修复(worktree-B, 分支 fix/stage3-bugs)

> 工作目录: `F:/swcup2026` (主仓库),checkout 到 `fix/stage3-bugs`
> 前置: Phase 0 已合 main

### Task B.1: 把 main 5 个 commit 验证清单跑通(P1-P11)

**Files:**
- Create: `docs/verification/stage3-p1-p11-report.md`
- Test: 手动 walkthrough

- [ ] **Step 1: 切到 fix 分支**

Run:
```bash
cd F:/swcup2026
git checkout -b fix/stage3-bugs main
```

Expected: 当前 HEAD 在 fix/stage3-bugs

- [ ] **Step 2: 跑后端测试基线**

Run: `cd backend && npm install && npx jest --no-coverage 2>&1 | tail -20`
Expected: 全部通过(或本次 baseline 数)

若失败,记录首个失败用于 Task B.3 修。

- [ ] **Step 3: 启动三端**

并行启动(三个终端):
```bash
# T1
cd backend && npm run start:dev
# T2
cd ai-service && .venv/Scripts/python.exe -m uvicorn app:app --reload --port 8000
# T3
cd miniapp-user && npm run dev:mp-weixin
```

Expected: 三端监听端口,无 error

- [ ] **Step 4: 跑 P1-P11 walkthrough**

参考 `docs/superpowers/specs/2026-07-06-stage3-frontend-unified-form-design.md` §8.3:

| # | 场景 | 操作 | 期望 | 实际 |
|---|------|------|------|------|
| P1 | 注册/登录 | 打开小程序→登录 | 跳转首页 |  |
| P2 | 录入档案 (intent=lost, 有鼻纹) | 走 collect → 选 lost | 跳 result 页 |  |
| P3 | 录入档案 (intent=lost, 无鼻纹) | 走 collect → 选 lost 不上传鼻纹 | 后端不 400,ask_user_confirm |  |
| P4 | 录入档案 (intent=found) | collect → found | animal.status=found |  |
| P5 | 上报一只 (无鼻纹) | report | 弹 toast 等审 |  |
| P6 | 上报一只 (有鼻纹) | report + 鼻纹 | 事件 high score → 自动 merge |  |
| P7 | 详情页"我又看到这只" | 点 → 跳 report | report 预填 animal_id |  |
| P8 | 详情页"这是我的狗" | 点 → 跳 claim | claim 流程 |  |
| P9 | 时间轴页 | 详情 → 时间轴 | 倒序事件卡片 |  |
| P10 | my-reports 关联入口 | 我的 → 关联 | 选择器弹层 + 选动物 |  |
| P11 | admin 4 动作 | admin 后台 → 事件动作 | 4 个按钮可用 |  |

每项记录"实际"列,把 fail 项列入 Task B.3。

- [ ] **Step 5: 写验证报告**

新建 `docs/verification/stage3-p1-p11-report.md`:

```markdown
# 阶段三 P1-P11 验证报告

> 时间: 2026-07-06
> 分支: fix/stage3-bugs (from main c071672)
> 5 commit: e21a078, 1f25468, 6d9b15d, ef9988e, c071672

## 测试基线
- backend jest: <N> PASS / 0 FAIL (baseline)
- ai-service pytest: baseline 数
- vitest: baseline

## 手动 walkthrough

| # | 场景 | 期望 | 实际 | 失败原因 |
|---|------|------|------|---------|
| P1 | ... |  |  |  |
... (11 行)

## 真实 bug 清单(进 Task B.3)

| 编号 | 现象 | 文件 | 重现步骤 | 优先级 |
|------|------|------|---------|--------|
| FIX-001 |  |  |  |  |
| FIX-002 |  |  |  |  |
```

- [ ] **Step 6: 提交报告**

```bash
git add docs/verification/stage3-p1-p11-report.md
git commit -m "[2026-07-06] wip | 阶段三 P1-P11 验证报告(沿用 [wip])"
```

> `[wip]` 标记: 报告+fix 未完成前不算正式 commit

### Task B.2: 不回归现有 189 后端测试(本任务可能无活可干)

- [ ] **Step 1: 跑全量 jest,记录 fail 数**

Run: `cd backend && npx jest --no-coverage 2>&1 | tee /tmp/jest-baseline.log | tail -20`
Expected: 若"全部通过",本任务完成。
若失败,把 fail spec 列入 Task B.3。

- [ ] **Step 2: 跑前端 vitest**

Run: `cd miniapp-user && npx vitest run 2>&1 | tail -20`
Expected: 全过,或记录 fail 进 Task B.3

### Task B.3: 修真实 bug(每个 bug 一个 fix commit)

> 模板: 列出 walkthrough 后 P1-P11 标 fail 的项 + 后端 jest fail 项
> 每个 bug: 一个 Task 编号, 5 个 step

**通用 5 step 模板(每个 bug 复制此结构,替换 FIXME_BUG_ID):**

#### Task B.3.N: 修 FIX-NNN: <一句话现象>

**Files:**
- Modify: <真实路径>
- Test: <真实 spec>

- [ ] **Step 1: 写复现测试(RED)**

在对应 .spec.ts 加一个 it("FIX-NNN: <现象>", ...), 测试覆盖 bug 复现路径

- [ ] **Step 2: 跑测试确认 FAIL**

Run: `cd backend && npx jest <relative-path>.spec.ts --no-coverage`
Expected: FAIL, 现象与 walkthrough 一致

- [ ] **Step 3: 最小修复**

直接 edit 文件,使测试 PASS,**不引入新依赖,不改其他文件的实现**

- [ ] **Step 4: 跑测试确认 PASS**

Run: `cd backend && npx jest <relative-path>.spec.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: 跑全量确保 0 回归**

Run: `cd backend && npx jest --no-coverage`
Expected: 总数 = baseline,全过

- [ ] **Step 6: 提交**

```bash
git add <files>
git commit -m "[2026-07-06] fix(miniapp) | FIX-NNN <一句话现象>
\n- 重现步骤: <一行>
- 修复: <一行>
- 不影响其他用例"
```

**Repeat for each FIX-NNN bug found in Task B.1**

### Task B.4: PR fix/stage3-bugs → dev

- [ ] **Step 1: 跑最终全测**

Run:
```bash
cd backend && npx jest --no-coverage
cd miniapp-user && npx vitest run
```

Expected: 0 回归,数 ≥ baseline

- [ ] **Step 2: 手动回归 P1-P11 中标 fail 的 4-5 项**

在 H5 端(或微信开发者工具)再走一遍 bug 路径

- [ ] **Step 3: 推分支**

Run:
```bash
cd F:/swcup2026
git push -u origin fix/stage3-bugs
```

- [ ] **Step 4: 创 PR 到 dev**

PR title: "fix(stage3): 5 commit (c071672~e21a078) P1-P11 验证 + 修 X 个真实 bug"

PR body 模板:
```
## 验证清单
- 11 项 walkthrough 全过(参见 docs/verification/stage3-p1-p11-report.md)
- 后端 jest N+N' PASS, 0 回归
- 前端 vitest 全 PASS

## 修改文件清单
(只列 FIX-NNN 涉及的文件)

## 不变量
- 不修数据库 migration
- 不引入新依赖

## 不在此次 PR 的项
- 评论功能(走 feature/comments-ai PR)
- AI 服务改动(走 feature/comments-ai PR)
```

---

## Phase C: dev 集成 + E2E

### Task C.1: 合 PR 顺序 = comments 先,fix 后

- [ ] **Step 1: 检 dev 状态**

Run:
```bash
cd F:/swcup2026
git checkout dev && git pull
git log --oneline -5
```

Expected: dev 已有 Phase 0 commits

- [ ] **Step 2: merge comments PR(用 --no-ff 保分支历史)**

Run:
```bash
git merge --no-ff feature/comments-ai -m "[2026-07-06] merge | 评论 + AI 摘要 集成"
```

- [ ] **Step 3: 立刻跑后端 + 前端测试**

Run:
```bash
cd backend && npx jest --no-coverage
cd miniapp-user && npx vitest run
```

Expected: 全过

- [ ] **Step 4: 启动三端,跑 happy path curl**

Run(开三端后):
```bash
TOKEN=...
ANIMAL_ID=...
curl -s -X POST http://localhost:3000/v1/comments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"animal_id\":\"$ANIMAL_ID\",\"content\":\"加油,希望主人找到它\"}"
curl -s http://localhost:3000/v1/comments/animal/$ANIMAL_ID/summary -H "Authorization: Bearer $TOKEN"
```

Expected: 201 + JSON 包含 sentiment=care

- [ ] **Step 5: merge fix PR**

Run:
```bash
git merge --no-ff fix/stage3-bugs -m "[2026-07-06] merge | 阶段三 P1-P11 验证 + 修 X 个真实 bug"
```

如有冲突,主要位置(估计无,因为两侧不重叠):
- miniapp-user/src/pages.json  ← 两侧都加项,但在不同 array 末尾位置,git 自动合并
- backend/src/app.module.ts ← 两侧都加 module,但 comments 在尾部追加,fix 端不动

冲突时手工解决:
- 接受双方 append 的内容
- 重跑 Step 3 的 jest/vitest

- [ ] **Step 6: 全量回归**

Run:
```bash
cd backend && npx jest --no-coverage
cd miniapp-user && npx vitest run
cd ai-service && .venv/Scripts/python.exe -m pytest -v
```

Expected: 全过

### Task C.2: 端到端冒烟 + 文档更新

**Files:**
- Modify: `CHANGELOG.md`(若存在)或新建

- [ ] **Step 1: 在 H5 走一遍 happy path**

操作步骤:
1. 登录一个测试号
2. 进一只动物的详情页 (admin 已建)
3. 点"查看评论" → 评论页
4. 发评论 "加油,希望主人找到它"
5. 确认页顶部显示"AI 摘要", 卡片情感 chip=关心
6. 发评论 "加我微信 abc123" → 卡片不显示,但 ai-service 收到 request 且 is_safe=false
7. 退出

- [ ] **Step 2: 写 CHANGELOG 条目**

新建或追加 `CHANGELOG.md`:

```markdown
## [Unreleased]
### Added
- 评论功能 + AI 后台内容审核/情感/摘要(用户端, worktree-A feature/comments-ai)
- 阶段三 P1-P11 验证报告 + 修 N 个真实 bug(worktree-B fix/stage3-bugs)

### Migration
- 005-create-comments.sql 自动生效

### Notes
- 两条工作流为 worktree 隔离,集成顺序: comments → fix
- AI 服务零外部 LLM 依赖,关键词 + TF
```

- [ ] **Step 3: 提交 CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "[2026-07-06] docs | CHANGELOG: 评论 + 阶段三 bug 修复 集成"
```

---

## Phase D: 上 main

### Task D.1: dev → main PR

- [ ] **Step 1: 在 GitHub/GitLab 创 PR**: dev → main

PR title: "release: 评论功能 + 阶段三 bug 修复"

PR body: 摘 Phase C 的 CHANGELOG + 集成结果

- [ ] **Step 2: 等 CI(若有)**

Run: 等 green

- [ ] **Step 3: 合并**

Run: 在 PR UI 点"Merge"

如项目要求 squash: 用 squash, commit message:
```
[2026-07-06] release | 评论功能 + 阶段三 bug 修复

- 评论 + AI 摘要(关键词 + TF, 零 LLM)
- 阶段三 P1-P11 验证 + N 个真实 bug
- 集成顺序: comments 先, fix 后
```

- [ ] **Step 4: 打 tag**

```bash
git tag v0.4.0-comment-ai main
git push origin v0.4.0-comment-ai
```

---

## 完成定义(Definition of Done)

- [ ] main 上有新 tag v0.4.0-comment-ai
- [ ] backend jest 总数 ≥ baseline,0 回归
- [ ] ai-service pytest 6 个 comments 测试通过
- [ ] vitest CommentList 3 测试通过
- [ ] P1-P11 全过(参见 docs/verification/stage3-p1-p11-report.md)
- [ ] happy path curl: POST /v1/comments + GET summary 返回正常
- [ ] H5 手动冒烟通过
- [ ] CHANGELOG 更新
- [ ] 两个 worktree 可以清掉

## 清 worktree 命令

```bash
cd F:/swcup2026
git worktree remove ../swcup2026-comments
git worktree remove ../swcup2026-bugs
git branch -d feature/comments-ai
git branch -d fix/stage3-bugs
```
