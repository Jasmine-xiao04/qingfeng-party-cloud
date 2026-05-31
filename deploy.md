# 部署说明

推荐部署组合：Vercel 前端 + Render/Railway 后端 + Supabase/Railway PostgreSQL。

## 数据库

1. 在 Supabase 或 Railway 创建 PostgreSQL 数据库。
2. Supabase 推荐复制顶部 `Connect` 里的 `Session pooler` 连接串，填入后端环境变量 `DATABASE_URL`。
3. 连接串末尾建议追加 `?sslmode=require&pool_timeout=30`，避免本地 Prisma 连接池超时。
4. 在线上执行：

```bash
npm run prisma:generate
npm run db:push
npm run seed
```

## 后端部署到 Render

1. 新建 Web Service，连接 GitHub 仓库。
2. Root Directory 留空。
3. Build Command：

```bash
npm install && npm run prisma:generate && npm run build -w backend
```

4. Start Command：

```bash
npm run start -w backend
```

5. 配置环境变量：

```text
DATABASE_URL
JWT_SECRET
PORT=4000
FRONTEND_URL=https://你的前端域名
```

## 前端部署到 Vercel

1. 导入 GitHub 仓库。
2. Framework Preset 选择 Vite。
3. Root Directory 填 `frontend`。
4. Build Command：

```bash
npm run build
```

5. Output Directory：

```text
dist
```

6. 环境变量：

```text
VITE_API_BASE_URL=https://你的后端域名/api
```

## 常见问题

- 登录失败：检查后端 `JWT_SECRET` 和数据库 seed 是否执行。
- CORS 报错：检查后端 `FRONTEND_URL` 是否等于线上前端域名。
- Prisma 连接失败：检查 `DATABASE_URL` 是否包含正确账号、密码、端口和库名。
- Excel 导入无匹配：优先确认 Excel 中是否存在 `学号`、`学号/工号` 或 `姓名` 字段。
