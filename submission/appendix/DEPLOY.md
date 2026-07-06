# 附录 DEPLOY — 鼻纹智救 5 分钟部署指南

> **目标**：5 分钟内，在任意一台 Windows / macOS / Linux 机器上跑通完整系统。
> **前置条件**：Docker 20.10+、Docker Compose v2、4GB+ RAM、10GB 磁盘。
> **操作系统**：Windows 11 / macOS / Linux（Docker Desktop 或原生 Docker）
> **文档版本**：v1.1（2026-06-19，Docker 化版本）

---

## 0. 总览：3 服务一键编排（推荐）

通过仓库根目录的 `docker-compose.yml`，**一条命令启动全部服务**：

| 服务 | 容器名 | 主机端口 | 镜像 | 健康检查 |
|------|--------|---------|------|---------|
| MySQL 8.0 | `nose-mysql` | 3306 | `mysql:8.0` | `mysqladmin ping` |
| NestJS 后端 | `nose-backend` | 3000 | 本地构建（多阶段） | `/api-docs-json` |
| FastAPI AI 服务 | `nose-ai` | 8000 | 本地构建 | `/health` |

> **模型权重**：通过 bind mount `./ai-service/weights:/app/weights:ro` 注入，**避免镜像膨胀到 1.5GB+**。
>
> 如需源码级开发（非容器），见 §6「本地源码开发」。

---

## 1. 准备工作（30 秒）

### 1.1 获取代码

```bash
git clone https://github.com/[team]/nose-rescue.git
cd nose-rescue
# 或直接解压提交包到 F:\swcup2026\
```

### 1.2 检查环境

```bash
docker --version       # 应 ≥ 20.10
docker compose version # 应 ≥ v2.x（旧版用 docker-compose --version）
```

> **仅需 Docker**，无需手动安装 Node.js / Python / MySQL。

### 1.3 准备模型权重（首次）

由于模型权重（~197 MB）不进 git，需首次放置：

```bash
mkdir -p ai-service/weights
# 从团队云盘 / 比赛发放渠道获取：
#   nose_v3_sgd.pth           (98.6 MB)
#   breed_classifier_v3.pth   (98.6 MB)
#   breed_protos_*.pt         (322 KB)
# 放入 ai-service/weights/
```

---

## 2. 一键启动（90 秒）

> ⚠️ **必须先 `cd` 到 `code/` 目录**（docker-compose.yml 在此目录，不在项目根目录）

```bash
cd code/                       # 含 docker-compose.yml 的目录

# 1. 准备环境变量
cp .env.example .env           # Windows: copy .env.example .env
# 编辑 .env，至少修改 JWT_SECRET 与 MYSQL_ROOT_PASSWORD

# 2. 启动全部服务
docker compose up -d --build   # 首次构建约 90 秒，后续秒级

# 3. 查看状态
docker compose ps
# 期望看到 3 个服务都是 Up（mysql 为 healthy，其余 30s 后变 healthy）
```

**预期输出**（`docker compose ps`）：
```
NAME              STATUS              PORTS
nose-mysql        Up (healthy)        0.0.0.0:3306->3306/tcp
nose-backend      Up (healthy)        0.0.0.0:3000->3000/tcp
nose-ai           Up (healthy)        0.0.0.0:8000->8000/tcp
```

### 2.1 查看启动日志

```bash
docker compose logs -f backend    # Ctrl+C 退出
docker compose logs --tail=100 ai-service
```

**后端健康日志样例**（最后 5 行）：
```
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [NestApplication] Application is running on: http://localhost:3000
TypeORM: schema synchronization: enabled  ← 首次启动自动建表
AI service ready: http://ai-service:8000/health → 200
```

**AI 服务启动日志样例**（最后 5 行）：
```
INFO:     Loading nose model from /app/weights/nose_v3_sgd.pth ...
INFO:     Loading breed model from /app/weights/breed_classifier_v3.pth ...
INFO:     Built prototypes from XXXX training images
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 3. 端到端验证（60 秒）

执行以下 5 条命令，验证完整链路：

```bash
# 1. 后端 Swagger 可达
curl -s http://localhost:3000/api-docs-json | head -c 80
# 预期：以 {"openapi":"3.0.0" 开头

# 2. AI 服务健康
curl -s http://localhost:8000/health
# 预期：{"status":"ok"}

# 3. 数据库就绪（容器内执行）
docker exec nose-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "SHOW DATABASES;" | grep nose_rescue

# 4. AI 提取向量（需 jpg 图片）
curl -X POST http://localhost:8000/v1/nose/extract \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w 0 ai-service/test_img.jpg)\"}"
# 预期：{"vector":[512 floats],"dim":512}

# 5. 业务 API（先 seed 测试数据）
docker compose exec backend npm run seed
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000001","password":"admin123"}'
# 预期：{"code":0,"data":{"token":"eyJ...","user":{...}}}
```

---

## 4. 启动小程序（30 秒）

### 4.1 用户端

```bash
# 用微信开发者工具打开 code/miniapp-user/
open -a "WeChat DevTools" code/miniapp-user/    # macOS
# 或手动拖 code/miniapp-user/ 到微信开发者工具
```

**配置**：
1. 在 `miniapp-user/src/manifest.json` 中设置 `appid`（测试号即可）
2. 编译运行
3. 真机预览需要扫码

### 4.2 管理端

```bash
open -a "WeChat DevTools" code/miniapp-admin/
```

**注意**：管理端登录需要用 `admin` 角色账号。测试账号：
- 用户名：`admin_test`
- 密码：`admin123`（开发期 seed 数据，需先 `docker compose exec backend npm run seed`）

---

## 5. 常用命令速查

```bash
# 启动 / 停止 / 重启
docker compose up -d
docker compose stop
docker compose restart backend

# 查看状态 / 日志
docker compose ps
docker compose logs -f --tail=50 backend

# 进入容器调试
docker compose exec backend sh
docker compose exec ai-service python -c "import torch; print(torch.cuda.is_available())"

# 完全清理（含数据卷，慎用！）
docker compose down         # 停服，保留数据卷
docker compose down -v      # 停服 + 删除所有数据

# 重新构建（修改 Dockerfile 后）
docker compose build backend --no-cache
docker compose up -d backend

# 仅启动部分服务
docker compose up -d mysql backend
```

---

## 6. 本地源码开发（可选）

如需在 IDE 中调试 NestJS / FastAPI 源码，可绕过容器：

### 6.1 仅用 Docker 跑 MySQL

```bash
# 注释掉 docker-compose.yml 中的 backend / ai-service 两段
docker compose up -d mysql
```

### 6.2 本地启动后端

```bash
cd code/backend
cp .env.example .env   # 改 DB_HOST=localhost, AI_SERVICE_URL=http://localhost:8000
npm install
npm run start:dev      # nodemon 热重载
```

### 6.3 本地启动 AI 服务

```bash
cd code/ai-service
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 7. 常见问题（FAQ）

### Q1：MySQL 连接被拒绝
**A**：检查 `docker compose ps` 中 mysql 是否 `healthy`；首次启动需 30s 等待。
容器间通信用 `DB_HOST=mysql`（不是 `localhost`），由 docker-compose 已配。

### Q2：AI 服务启动报"找不到 weights/xxx.pth"
**A**：bind mount 需要 `./ai-service/weights/` 目录存在且含 3 个文件。
验证：`docker compose exec ai-service ls /app/weights/`。

### Q3：后端首次启动很慢
**A**：正常，需执行 `npm ci`（约 60s）+ TS 编译（约 30s）。镜像构建后启动约 5s。

### Q4：小程序登录失败
**A**：检查后端是否启动；管理端登录用 `admin` 角色（不是普通用户）。

### Q5：AI 服务报"CUDA out of memory"
**A**：容器默认 CPU 推理，无需 GPU。如需 GPU：
```yaml
ai-service:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### Q6：端口被占用
**A**：修改 `.env` 中 `BACKEND_HOST_PORT` / `AI_HOST_PORT` / `MYSQL_HOST_PORT`，
或停掉占用进程：`netstat -ano | findstr :3306`。

### Q7：忘记 admin 密码
**A**：`docker compose exec backend npm run seed`，重新创建测试账号。

### Q8：镜像占用空间大
**A**：模型权重不进镜像，`docker images` 应在 ~1.2GB 左右。检查
`docker system df`，可用 `docker builder prune` 清理悬空构建缓存。

---

## 8. 生产部署建议

### 8.1 必须改的 3 处

1. **JWT_SECRET**：用 `openssl rand -hex 32` 生成，写入 `.env`
2. **MYSQL_ROOT_PASSWORD**：用强密码，写入 `.env`
3. **`synchronize: true`**：改为 `false`，手动用 DDL 建表（已有初始化 SQL）

### 8.2 推荐架构

```
[Nginx / SLB] → [NestJS × N 实例]  (PM2 / k8s)
              → [FastAPI × N 实例]  (uvicorn --workers / k8s) → GPU 节点
              → [MySQL 主从]  (RDS / 自建)
```

### 8.3 监控

- 后端：PM2 + Keymetrics / k8s Prometheus
- AI 服务：Prometheus + Grafana（已暴露 `/metrics`）
- 数据库：MySQL Exporter

### 8.4 备份

```bash
# 每日 cron 备份
docker exec nose-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" nose_rescue \
  | gzip > /backups/nose_rescue_$(date +%Y%m%d).sql.gz
```

---

## 附录：端口清单

| 端口 | 服务 | 备注 |
|------|------|------|
| 3306 | MySQL | 数据库 |
| 3000 | NestJS 后端 | 业务 API（Swagger: /api-docs）|
| 8000 | FastAPI AI 服务 | AI 推理（Swagger: /docs）|
| 80 / 443 | Nginx（可选）| 反向代理 |

> **防火墙**：生产环境需开放 80/443 给公网，3306 仅内网访问。

---

**部署指南结束。按本指南，5 分钟内可启动完整系统（首构建约 90s，后续秒级）。**