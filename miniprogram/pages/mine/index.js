const postService = require("../../services/post-service");

Page({
  data: {
    posts: [],
    previewAdmin: false,
    adminHint: "",
    openid: "",
    userContextError: ""
  },
  async onShow() {
    const app = getApp();
    const userContext = await postService.getUserContext();
    let posts = [];

    try {
      posts = await postService.getMyPosts();
    } catch (error) {
      wx.showToast({
        title: error.message || "帖子加载失败",
        icon: "none"
      });
    }

    this.setData({
      posts,
      previewAdmin: !!userContext.isAdmin,
      openid: userContext.openid || "",
      userContextError: userContext.error || "",
      adminHint: app.globalData.useMockData
        ? "当前为本地管理员预览"
        : "当前账号已通过云端白名单校验"
    });
  },
  copyOpenid() {
    const { openid } = this.data;

    if (!openid) {
      wx.showToast({
        title: "当前还没有拿到 openid",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: openid,
      success: () => {
        wx.showToast({
          title: "openid 已复制",
          icon: "success"
        });
      }
    });
  },
  async deletePost(event) {
    const { id } = event.currentTarget.dataset;

    try {
      await postService.deletePost(id);
      wx.showToast({
        title: "已删除",
        icon: "success"
      });
      this.onShow();
    } catch (error) {
      wx.showToast({
        title: error.message || "删除失败",
        icon: "none"
      });
    }
  },
  openDetail(event) {
    const { id } = event.currentTarget.dataset;

    if (!id) {
      wx.showToast({
        title: "帖子 ID 缺失",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/detail/index?id=${id}`,
      fail: (error) => {
        wx.showToast({
          title: error.errMsg || "打开帖子失败",
          icon: "none"
        });
      }
    });
  },
  openAdmin() {
    wx.navigateTo({
      url: "/pages/admin/index"
    });
  }
});
