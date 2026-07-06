# 补齐后端启动文档 — 行动计划

> 整理人：统筹协调者
> 日期：2026-05-13
> 目标：补齐后端开发所需的两份关键文档，供老师启动 Node.js + MySQL 后端开发

---

## 目标

补齐以下两份文档：

1. **`docs/数据库建表脚本.md`** — 完整的 MySQL 建表 SQL + 测试数据脚本
2. **`docs/后端启动配置指南.md`** — Node.js 项目初始化步骤 + 目录结构 + 配置说明

AI 服务接口文档（`docs/AI服务接口文档.md`）**暂留白**，等模型训练完成后补充。

---

## 当前上下文

- 前端已开发完成，接口文档 `docs/前端接口文档-给老师.md` 已输出（v1.0，1005行）
- 后端（`backend/`）目录为空，老师尚未开始
- `docs/架构设计.md` 有部分建表 SQL，但不完整（缺少 `users` 表、缺少测试数据脚本）
- AI 服务（`ai-service/`）只有空目录或占位符，模型训练未完成

---

## 步骤一：整理数据库建表脚本

### 操作内容

根据 `docs/架构设计.md` 中已有的建表 SQL 片段，补全以下内容：

1. **完整的 `users` 表**（架构文档中缺失）
   - 字段：`user_id`（UUID）、`nickname`、`phone`、`avatar_url`、`role`、`created_at`、`updated_at`

2. **补充 `animals` 表**（已部分定义，补全索引和外键）

3. **补充 `nose_features` 表**（已部分定义，补全索引）

4. **补充 `rescue_events` 表**（已部分定义，补全索引）

5. **补充 `claims` 表**（已部分定义，补全索引）

6. **补充 `locations` 表**（架构文档中有片段）

7. **新增：测试数据 SQL 脚本**
   - 插入 3~5 条 animals 记录（与 mock.js 对齐）
   - 插入 2 条 rescue_events 记录
   - 插入 1 条 users 记录（含 admin 用户）
   - 插入 1 条 claims 记录

8. **新增：数据库初始化脚本**
   - `CREATE DATABASE IF NOT EXISTS nose_rescue DEFAULT CHARACTER SET utf8mb4;`
   - 建表顺序（考虑外键依赖）

### 产出文件

```
docs/数据库建表脚本.md
```

### 验证方式

SQL 脚本在 MySQL 客户端执行无报错，`SELECT COUNT(*) FROM animals` 返回 3 以上。

---

## 步骤二：整理后端启动配置指南

### 操作内容

1. **Node.js 项目初始化步骤**
   - `npm init -y`
   - 安装依赖：`express`、`cors`、`mysql2`、`jsonwebtoken`、`bcryptjs`（可选）、`uuid`、`dotenv`
   - 目录结构建议：
     ```
     backend/
     ├── src/
     │   ├── app.js              # 入口
     │   ├── config/
     │   │   └── db.js           # MySQL 连接配置
     │   ├── routes/
     │   │   ├── auth.js
     │   │   ├── animals.js
     │   │   ├── nose.js
     │   │   ├── events.js
     │   │   ├── claims.js
     │   │   └── admin.js
     │   ├── middleware/
     │   │   └── auth.js         # JWT 校验中间件
     │   └── utils/
     │       └── jwt.js
     ├── .env                    # 配置（不提交）
     ├── package.json
     └── README.md
     ```

2. **`.env` 配置模板**
   ```
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=nose_rescue
   JWT_SECRET=your_secret_key
   ```

3. **`src/app.js` 骨架代码**
   - Express 初始化
   - CORS 中间件（允许所有来源，开发阶段）
   - JSON body-parser
   - 各路由挂载
   - 错误处理中间件

4. **JWT 校验中间件示例**（`src/middleware/auth.js`）
   - 解析 `Authorization: Bearer <token>`
   - 验证 JWT 有效性
   - 校验 admin 角色（用于 `/api/admin/*` 路由）

5. **MySQL 连接示例**（`src/config/db.js`）
   - 使用 `mysql2/promise`
   - 连接池配置

### 产出文件

```
docs/后端启动配置指南.md
```

### 验证方式

老师按照文档执行 `npm install` + `node src/app.js` 后，`curl http://localhost:3000/api/admin/stats` 能返回 JSON 响应（可以是 mock 数据，只要不报错）。

---

## 步骤三：AI 服务接口文档留白

### 操作内容

在 `docs/` 下新建 `AI服务接口文档.md`，仅填充框架，空出具体端点详情：

```markdown
# AI 服务接口文档 — 鼻纹智救

> 状态：待补充（AI 模型训练未完成）

## 一、概述

AI 服务（FastAPI）由后端 Node.js 内网调用，小程序不能直连。

## 二、服务地址

- 开发环境：`http://localhost:8000`
- 生产环境：（待定）

## 三、认证方式

（待补充）

## 四、端点清单

### 4.1 活体检测
- 端点：`POST /api/detect/liveness`
- 请求：（待补充）
- 响应：（待补充）

### 4.2 特征提取
- 端点：`POST /api/extract/feature`
- 请求：（待补充）
- 响应：（待补充）

### 4.3 向量比对
- 端点：`POST /api/compare/vector`
- 请求：（待补充）
- 响应：（待补充）

## 五、后端调用示例（Node.js）

（待补充，等模型就绪后补全）
```

### 产出文件

```
docs/AI服务接口文档.md
```

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `docs/数据库建表脚本.md` | 新建 |
| `docs/后端启动配置指南.md` | 新建 |
| `docs/AI服务接口文档.md` | 新建（框架，内容待填） |

---

## 风险与tradeoff

| 风险 | 应对 |
|------|------|
| 架构文档中建表 SQL 有细节错误 | 以 `docs/前端接口文档-给老师.md` 的字段要求为准，字段名/类型/约束必须严格对齐 |
| 老师本地 MySQL 版本不一致 | 文档中注明 MySQL 最低版本要求（如 5.7+），使用标准 SQL 语法 |
| AI 服务实现方式未确定（HTTP/内部调用） | 先留白，不做假设，等队长明确 AI 服务接口后再补充 |

---

## 优先级

1. **最高**：数据库建表脚本（老师建表后立刻要用）
2. **高**：后端启动配置指南（老师初始化项目要用）
3. **低**：AI 服务接口文档（可后续补充，不阻塞后端主流程开发）

---

## 待确认事项

- MySQL 连接账号密码是否由老师自行配置（`.env` 模板已包含占位符）
- 后端是否需要支持文件上传到本地磁盘，还是老师已有 OSS/七牛等方案
- admin 默认账号是否需要初始化脚本创建（当前计划在测试数据脚本中创建）
