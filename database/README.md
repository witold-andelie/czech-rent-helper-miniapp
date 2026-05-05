# 数据库初始化

这个目录放的是项目内的数据库初始化清单，不是假定可直接导入微信控制台的专有格式。

## 文件

- `posts.rules.json`: `posts` 集合的最简前端权限，建议配置为只读
- `posts.indexes.json`: 推荐在云数据库控制台手动创建的索引清单
- `posts.seed.json`: 示例数据导入文件，可通过脚本生成

## 建议顺序

1. 在云数据库中创建 `posts` 集合
2. 将 `posts.rules.json` 的规则填到集合权限配置
3. 参考 `posts.indexes.json` 在控制台创建索引
4. 如需演示数据，运行 `npm run db:seed` 生成 `posts.seed.json`
5. 使用控制台的数据导入能力导入 `posts.seed.json`

## 说明

- `posts.seed.json` 来自前端 mock 数据，会去掉页面展示专用字段
- 正式环境建议先空库上线，再根据需要导入少量示例帖
- 如果启用 `MEDIA_CHECK_MODE=async_v2`，图片审核结果仍需后续接消息推送回调
