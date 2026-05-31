# API 说明

所有接口默认返回：

```json
{
  "success": true,
  "data": {}
}
```

错误返回：

```json
{
  "success": false,
  "message": "错误原因"
}
```

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/logout` | 退出 |

## 成员

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/users` | 管理角色 | 成员列表 |
| GET | `/api/users/:id` | 管理角色 | 成员详情 |
| POST | `/api/users` | 管理角色 | 新增成员 |
| PUT | `/api/users/:id` | 管理角色 | 编辑成员 |
| DELETE | `/api/users/:id` | 管理角色 | 删除成员 |
| POST | `/api/users/import` | 管理角色 | 批量导入成员 |

## 活动

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/activities` | 登录用户 | 活动列表 |
| GET | `/api/activities/:id` | 登录用户 | 活动详情 |
| POST | `/api/activities` | 管理角色 | 发布活动 |
| PUT | `/api/activities/:id` | 管理角色 | 编辑活动 |
| DELETE | `/api/activities/:id` | 书记/老师 | 删除活动 |
| POST | `/api/activities/parse-word` | 管理角色 | Word 活动信息解析 |

## 导入

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/import/activity-preview` | 活动名单导入预览 |
| POST | `/api/import/activity-confirm` | 活动名单确认入库 |
| POST | `/api/import/history-preview` | 历史积分导入预览 |
| POST | `/api/import/history-confirm` | 历史积分确认入库 |

活动名单导入支持的常见 Excel 表头：

```text
姓名、姓名（必填）、学生姓名
学号、学号（必填）、学号/工号、学生学号
积分变化、积分、加减分、得分、分数
备注、说明、原因
```

导入预览会拦截：

```text
上传文件内重复成员
系统中找不到的成员
同名但无法确认唯一成员
该成员已存在同一活动参与记录
```

## 积分

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/points/my` | 我的积分 |
| GET | `/api/points/user/:id` | 指定成员积分 |
| GET | `/api/points/records` | 积分流水 |
| POST | `/api/points/adjust` | 管理员调整积分 |
| GET | `/api/rankings` | 排行榜 |

## 荣誉与看板

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/honors` | 荣誉列表 |
| POST | `/api/honors` | 新增荣誉 |
| PUT | `/api/honors/:id` | 编辑荣誉 |
| DELETE | `/api/honors/:id` | 删除荣誉 |
| GET | `/api/dashboard/admin` | 管理端看板 |
| GET | `/api/dashboard/student` | 学生端首页数据 |
