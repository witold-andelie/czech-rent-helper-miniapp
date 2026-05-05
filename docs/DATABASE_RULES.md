# 数据库权限示例

目标：`posts` 集合允许前端读取，但不允许前端直接写入。

这样所有创建、删帖、VIP 升级都只能经过云函数。

## 最简思路

- `read: true`
- `write: false`

## 示例

```json
{
  "read": true,
  "write": false
}
```

项目内也放了一份同内容清单，可直接参考：

- [database/posts.rules.json](/Users/mac/Documents/New%20project/codex1/miniapp/database/posts.rules.json:1)
- [database/posts.indexes.json](/Users/mac/Documents/New%20project/codex1/miniapp/database/posts.indexes.json:1)

## 说明

- 小程序端可以列表查询和详情查询
- 小程序端不能直接 `add / update / remove`
- 云函数和控制台仍拥有管理端权限

## 为什么适合这个项目

- 普通用户不能伪造 VIP 天数
- 普通用户不能绕过前端把店铺帖强行塞图
- 普通用户不能删除别人的帖子
- 管理员删帖、续期、加图都可以稳定放在云函数中统一校验
