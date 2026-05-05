Page({
  data: {
    boards: [
      {
        category: "shop",
        title: "店铺出租",
        summary: "适合转租、店铺接手、街铺和档口信息。",
        rule: "普通帖无图，固定 30 天。"
      },
      {
        category: "flex",
        title: "灵活短租",
        summary: "面向个人和游客，适合短住、过渡和按周租。",
        rule: "普通帖最多 1 图，固定 15 天。"
      }
    ],
    highlights: [
      {
        title: "中文直接看",
        copy: "不用在一堆捷克语、英语页面里来回翻，重要信息一眼就能看懂。"
      },
      {
        title: "平台不碰交易",
        copy: "租金怎么付、合同怎么谈，你们自己决定，我们只负责把信息放清楚。"
      },
      {
        title: "版面不会太乱",
        copy: "续期、加图、删帖这些事由管理员处理，普通用户发帖也更省事。"
      }
    ],
    stats: [
      {
        value: "2",
        label: "核心板块"
      },
      {
        value: "15 / 30",
        label: "普通帖有效期"
      },
      {
        value: "360",
        label: "VIP 最长天数"
      }
    ]
  },
  openBoard(event) {
    const { category } = event.currentTarget.dataset;
    const app = getApp();

    app.globalData.nextBoardFilters = {
      category,
      intent: "offer"
    };
    wx.switchTab({
      url: "/pages/board/index"
    });
  },
  openPublish() {
    wx.switchTab({
      url: "/pages/publish/index"
    });
  }
});
