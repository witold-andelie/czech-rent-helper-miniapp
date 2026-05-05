const postService = require("../../services/post-service");

Page({
  data: {
    post: null
  },
  async onLoad(options) {
    if (!options.id) {
      return;
    }

    try {
      const post = await postService.getPostDetail(options.id);

      this.setData({
        post
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "帖子加载失败",
        icon: "none"
      });
    }
  },
  copyContact() {
    if (!this.data.post) {
      return;
    }

    wx.setClipboardData({
      data: this.data.post.contactLine
    });
  },
  onShareAppMessage() {
    if (!this.data.post) {
      return {
        title: "捷克租房助手",
        path: "/pages/index/index"
      };
    }

    return {
      title: this.data.post.title,
      path: `/pages/detail/index?id=${this.data.post.id}`
    };
  }
});
