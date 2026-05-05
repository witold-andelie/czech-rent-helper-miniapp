const postService = require("../../services/post-service");

Page({
  data: {
    previewAdmin: false,
    adminHint: "",
    posts: [],
    postCount: 0,
    customDaysById: {},
    localImagesById: {}
  },
  async onShow() {
    const app = getApp();
    const userContext = await postService.getUserContext();
    const previewAdmin = !!userContext.isAdmin;
    const adminHint = app.globalData.useMockData
      ? "当前为本地管理员预览"
      : "当前账号已通过云端白名单校验";
    let posts = [];

    if (previewAdmin) {
      try {
        posts = await postService.listAllPosts();
      } catch (error) {
        wx.showToast({
          title: error.message || "帖子加载失败",
          icon: "none"
        });
      }
    }

    this.setData({
      previewAdmin,
      adminHint,
      posts,
      postCount: posts.length
    });
  },
  refreshPosts() {
    this.onShow();
  },
  onDaysInput(event) {
    const { id } = event.currentTarget.dataset;

    this.setData({
      [`customDaysById.${id}`]: event.detail.value
    });
  },
  chooseImages(event) {
    const { id } = event.currentTarget.dataset;
    const currentImages = this.data.localImagesById[id] || [];
    const remaining = 3 - currentImages.length;

    if (remaining <= 0) {
      wx.showToast({
        title: "最多 3 张图",
        icon: "none"
      });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (result) => {
        const nextImages = currentImages.concat(
          result.tempFiles.map((item) => item.tempFilePath)
        ).slice(0, 3);

        this.setData({
          [`localImagesById.${id}`]: nextImages
        });
      }
    });
  },
  removeImage(event) {
    const { id, index } = event.currentTarget.dataset;
    const currentImages = this.data.localImagesById[id] || [];
    const nextImages = currentImages.filter((_, currentIndex) => currentIndex !== index);

    this.setData({
      [`localImagesById.${id}`]: nextImages
    });
  },
  async applyVipUpdate(event) {
    const { id } = event.currentTarget.dataset;
    const customDays = Number(this.data.customDaysById[id] || "0");

    if (!customDays || customDays < 1 || customDays > 360) {
      wx.showToast({
        title: "请输入 1-360 天",
        icon: "none"
      });
      return;
    }

    try {
      await postService.adminUpdatePost({
        id,
        makeVip: true,
        durationDays: customDays,
        localImagePaths: this.data.localImagesById[id] || [],
        adminNote: `管理员升级为 VIP，展示 ${customDays} 天。`
      });

      wx.showToast({
        title: "VIP 已更新",
        icon: "success"
      });

      this.setData({
        [`localImagesById.${id}`]: []
      });
      this.onShow();
    } catch (error) {
      wx.showToast({
        title: error.message || "操作失败",
        icon: "none"
      });
    }
  },
  async forceExpire(event) {
    const { id } = event.currentTarget.dataset;

    try {
      await postService.adminUpdatePost({
        id,
        forceExpire: true,
        adminNote: "管理员强制下线。"
      });

      wx.showToast({
        title: "已强制下线",
        icon: "success"
      });
      this.onShow();
    } catch (error) {
      wx.showToast({
        title: error.message || "操作失败",
        icon: "none"
      });
    }
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
  }
});
