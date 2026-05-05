# CI / CD 建议

## 结论

这个项目适合做 `CI`，也适合做“半自动 `CD`”。

## 推荐流程

1. 开发分支提交代码
2. GitHub Actions 跑 lint
3. 合并到 `main`
4. 自动上传开发版
5. 手机验收
6. 手动提审和正式发布

## 为什么不建议一开始全自动正式发布

- 小程序正式版还有提审环节
- 云函数和内容风控问题适合人工复核
- 你是唯一管理员，人工把关成本不高

## 工作流依赖

需要在仓库 Secrets 中配置：

- `WECHAT_APPID`
- `WECHAT_PRIVATE_KEY`
- `WECHAT_ROBOT`

## IP 白名单

微信代码上传密钥支持 IP 白名单。

如果你启用白名单，最稳的方式是：

- 使用固定出口 IP 的 Runner
- 或使用自托管 Runner

## 本仓库中的工作流

根目录下的 `.github/workflows/miniapp-ci.yml` 只针对 `miniapp/` 目录生效，避免影响当前已有的 Python 项目。
