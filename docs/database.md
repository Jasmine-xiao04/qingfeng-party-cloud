# 数据库设计

数据库使用 PostgreSQL，ORM 使用 Prisma。

## 核心表

| 表 | 说明 |
|---|---|
| `roles` | 角色表 |
| `users` | 用户/成员表 |
| `activities` | 活动表 |
| `activity_participants` | 活动参与记录 |
| `points_records` | 积分流水 |
| `honors` | 荣誉展示 |
| `import_batches` | 导入批次 |
| `import_records` | 导入明细 |

## 关键关系

```text
roles 1 - n users
users 1 - n points_records
activities 1 - n activity_participants
activities 1 - n points_records
import_batches 1 - n import_records
import_batches 1 - n points_records
```

## 设计说明

- `points_records` 是积分计算的唯一事实来源，总积分通过流水求和得到。
- `import_batches` 保存一次导入行为，支持预览、确认、后续回滚扩展。
- `import_records` 保存每一行 Excel 的匹配状态和失败原因，方便支部助理修正数据。
- `activity_participants` 独立于积分流水，既能统计参与情况，也能保留签到/请假/缺席扩展空间。
- `activities.requiredStages` 使用枚举数组，便于学生首页筛选“我必须参加”的活动。
