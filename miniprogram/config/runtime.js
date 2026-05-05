module.exports = {
  // 开发阶段默认保留 mock 数据，接入真实云开发后改为 false。
  useMockData: false,
  // 仅在 mock 模式下生效，用于本地预览管理员页面。
  enableAdminPreview: false,
  // mock 模式下当前用户 ID。
  mockCurrentUserId: "",
  // 如需显式指定云环境，可填写环境 ID；留空则使用当前环境。
  cloudEnvId: "cloud1-3go77lwb3c514943"
};
