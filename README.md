# 捷克租房助手小程序骨架

这个目录是一个独立于当前 Python 项目的微信小程序原生骨架，面向“捷克华人低门槛中文租房信息板”。

## 目录

- `docs/PRODUCT_SPEC.md`: 产品定位、模块和发帖规则
- `docs/TECHNICAL_PLAN.md`: 数据模型、云函数、权限和风控方案
- `docs/CI_CD.md`: 推荐的 CI/CD 方式
- `docs/DATABASE_RULES.md`: 云数据库最简权限示例
- `miniprogram/`: 小程序前端源码
- `cloudfunctions/`: 微信云开发云函数
- `project.config.json`: 微信开发者工具项目配置

## 当前范围

当前版本包含：

- 首页、列表、发布、详情、我的、管理页的原生小程序骨架
- 普通帖与 VIP 帖的前后端规则草案
- `post` / `expirePosts` 两个云函数入口
- `openid` 上下文识别、管理员白名单、文本安全检测和发帖限频
- 图片审核双模式：`legacy_sync` 同步兜底 / `async_v2` 异步提交
- 适合本项目的 GitHub Actions 工作流模板

## 本地开发

当前机器已安装 `node` / `npm`，并已在本地跑通过一次 `npm run lint`。

首次拉起时执行：

```bash
cd miniapp
npm install --ignore-scripts
```

然后用微信开发者工具打开 [project.config.json](/Users/mac/Documents/New%20project/codex1/miniapp/project.config.json)。

如需在本机直接用 `miniprogram-ci` 上传开发版，可在 [miniapp/.env.local](/Users/mac/Documents/New%20project/codex1/miniapp/.env.local:1) 配置：

```bash
WECHAT_APPID=你的小程序AppID
WECHAT_PRIVATE_KEY_PATH=/绝对路径/private.xxx.key
WECHAT_ROBOT=1
```

然后执行：

```bash
cd miniapp
/Users/mac/.local/node/current/bin/node scripts/upload-ci.js
```

如果微信后台开启了“IP 白名单”，还需要先把当前机器的公网出口 IP 加到白名单，否则上传会报 `invalid ip`。

## 切换到真实云开发

默认仍保留 mock 数据，便于直接预览 UI。要切到真实云开发，请优先处理：

- 将 [miniprogram/config/runtime.js](/Users/mac/Documents/New%20project/codex1/miniapp/miniprogram/config/runtime.js:1) 里的 `useMockData` 改为 `false`
- 在微信云开发环境变量里配置 `ADMIN_OPENIDS`
- 按需配置 `ENABLE_TEXT_MODERATION`、`CREATE_WINDOW_MINUTES`、`MAX_POSTS_PER_WINDOW`
- 按需配置 `MEDIA_CHECK_MODE`
- 部署 `post` 云函数时带上 [cloudfunctions/post/config.json](/Users/mac/Documents/New%20project/codex1/miniapp/cloudfunctions/post/config.json:1) 的 OpenAPI 权限
- 在云数据库里对 `posts` 集合启用只读前端规则
- 按 [database/README.md](/Users/mac/Documents/New%20project/codex1/miniapp/database/README.md:1) 创建 `posts` 集合、权限和索引

## 替换项

首次接手时请优先替换：

- `project.config.json` 中的 `appid`
- [miniprogram/config/runtime.js](/Users/mac/Documents/New%20project/codex1/miniapp/miniprogram/config/runtime.js:1) 中的运行模式
- `cloudfunctions/post/index.js` 对应的 `ADMIN_OPENIDS` 环境变量值
- `MEDIA_CHECK_MODE` 选项：`legacy_sync`、`async_v2`、`off`
- 发布页和管理页里的联系文案
