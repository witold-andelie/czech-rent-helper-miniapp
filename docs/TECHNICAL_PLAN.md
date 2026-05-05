# 技术方案

## 技术选择

- 前端：微信小程序原生
- 后端：微信云开发
- 数据库：云数据库
- 文件：云存储
- 业务入口：云函数
- 定时任务：云函数定时触发器

## 为什么核心写入必须走云函数

前端上的“最多 1 张图 / 15 天”只是界面限制，无法作为真实安全边界。

核心原因：

- 前端请求可以被篡改
- 直接写库无法可靠校验 VIP 权限
- 删帖、续期、加图需要管理员权限
- 自动写入 `status`、`expireAt`、`tier` 更适合在后端统一处理

推荐权限策略：

- 小程序端：公开读，禁止直写核心集合
- 云函数端：统一负责 create / delete / admin update

## 数据模型

主集合：`posts`

建议字段：

```js
{
  title: string,
  category: "shop" | "flex",
  intent: "offer" | "wanted",
  tier: "normal" | "vip",
  city: string,
  district: string,
  areaText: string,
  priceText: string,
  depositText: string,
  availableFrom: string,
  minStayText: string,
  contactName: string,
  contactLine: string,
  description: string,
  imageFileIds: string[],
  imageCount: number,
  durationDays: number,
  status: "active" | "expired" | "deleted",
  moderationState: "pending" | "pass" | "reject" | "skipped",
  moderationTraceId: string,
  mediaModerationMode: "off" | "legacy_sync" | "async_v2",
  mediaModerationState: "skipped" | "pass" | "pending" | "review" | "risky",
  mediaModerationTraceIds: string[],
  adminNote: string,
  createdBy: string,
  createdAt: Date,
  updatedAt: Date,
  expireAt: Date,
  deletedAt: Date | null
}
```

## 云函数

### `post`

统一处理：

- `create`
- `list`
- `detail`
- `myList`
- `remove`
- `adminUpdate`

### `expirePosts`

定时扫描：

- 找出 `status=active` 且 `expireAt <= now` 的帖子
- 改为 `expired`
- 如有图片则顺手删除云存储文件

## 风控

第一阶段建议：

- 文本内容安全检测接入云函数
- 有图帖子支持两种模式：
  - `legacy_sync`: 使用旧版同步图片检测，适合当前轻量上线
  - `async_v2`: 提交新版异步检测任务，后续再接消息推送回调
- 单用户限频发帖
- 标题和描述长度限制
- 联系方式统一放在固定字段，不允许在正文无限复制广告

## 管理员能力

管理员 `openid` 由白名单控制。

建议环境变量：

- `ADMIN_OPENIDS`: 逗号分隔的管理员 `openid`
- `ENABLE_TEXT_MODERATION`: 是否启用文本安全检测，默认开启
- `CREATE_WINDOW_MINUTES`: 发帖限频时间窗，默认 10 分钟
- `MAX_POSTS_PER_WINDOW`: 时间窗内最多发帖数，默认 3
- `MEDIA_CHECK_MODE`: 图片审核模式，支持 `legacy_sync`、`async_v2`、`off`

管理员可执行：

- 删除任意帖子
- 将帖子升级为 VIP
- 修改 VIP 天数
- 为 VIP 帖补充图片
- 强制下线帖子

## 时区

微信云开发定时触发器按 `UTC+8` 执行。

因此前端展示“还剩几天”时必须按绝对时间戳 `expireAt` 计算，不要只依赖创建时间加天数的显示推断。
