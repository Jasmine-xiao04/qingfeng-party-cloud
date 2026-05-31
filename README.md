# 青锋党建云

面向高校党支部的轻量化党建活动与积分管理平台。项目围绕支部助理真实工作痛点设计，支持成员管理、活动发布、Excel 名单导入、历史积分迁移、积分流水、排行榜、学生端活动提醒和荣誉展示。

## 功能亮点

- 角色权限：书记/老师、支部助理、普通学生三类角色分权访问。
- Excel 导入：活动名单支持预览、成员匹配、失败原因提示、确认后入库。
- 历史迁移：支持一次性导入五月前人工维护的历史积分，并防止重复累计。
- 积分可追溯：总积分由积分流水汇总计算，保留活动加分、扣分、历史导入和管理员调整记录。
- 学生端：展示个人积分、同批次排名、必参加活动、最新活动和荣誉内容。
- 管理端：支部成员、阶段人数、活动数量、参与人次、Top 10 排行和最近积分变动。
- 响应式 UI：PC 端侧边栏导航，移动端抽屉导航。

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite |
| UI | Ant Design + lucide-react |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | JWT + bcrypt |
| Excel 解析 | xlsx |
| Word 解析 | mammoth |
| 部署 | Vercel + Render/Railway + Supabase/Railway PostgreSQL |

## 项目结构

```text
qingfeng-party-cloud/
├── backend/          # Express API
├── frontend/         # React Web
├── prisma/           # Prisma schema 与 seed
├── docs/             # API、数据库、简历描述
├── README.md
├── deploy.md
├── .env.example
└── package.json
```

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写 PostgreSQL 连接：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qingfeng_party_cloud?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
FRONTEND_URL="http://localhost:5173"
VITE_API_BASE_URL="http://localhost:4000/api"
```

使用 Supabase 新版控制台时，点击项目顶部绿色 `Connect`，复制 `Session pooler` 连接串。推荐在末尾追加：

```text
?sslmode=require&pool_timeout=30
```

示例：

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require&pool_timeout=30"
```

3. 初始化数据库

```bash
npm run prisma:generate
npm run db:push
npm run seed
```

4. 启动开发环境

```bash
npm run dev
```

前端：http://localhost:5173  
后端：http://localhost:4000/api/health

## 测试账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 书记/老师 | 01310 | 654321 |
| 支部助理 | 239971435 | 654321 |
| 普通成员 | 239971006 | 123456 |

批量导入后的登录规则：

```text
普通成员：账号为学号/工号，密码为 123456
支部助理、支部书记/老师：账号为学号/工号，密码为 654321
```

## Excel 模板

活动名单导入：

```text
姓名 | 学号 | 活动名称 | 积分变化 | 备注
```

历史积分导入：

```text
姓名 | 学号 | 历史积分 | 所属批次 | 发展阶段 | 所属支部 | 寝室号 | 备注
```

当前导入逻辑已兼容你现有表格中的 `学号/工号`、`总积分` 等字段。

## 功能截图占位

```text
docs/screenshots/login.png
docs/screenshots/admin-dashboard.png
docs/screenshots/import-preview.png
docs/screenshots/student-home.png
```

## 文档

- [数据库设计](docs/database.md)
- [接口说明](docs/api.md)
- [5 月版历史积分导入报告](docs/history-import-report.md)
- [第三期党员技术课堂导入报告](docs/activity-import-report.md)
- [部署说明](deploy.md)
- [简历项目描述](docs/resume.md)

## 未来规划

- 活动报名与二维码签到
- 消息提醒与必参加活动催办
- 批次成长档案
- 寝室维度统计
- PDF 月度报告导出
- 更精细的权限菜单配置
