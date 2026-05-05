const postService = require("../../services/post-service");
const {
  CATEGORY_LABELS,
  INTENT_LABELS,
  buildRuleSummary
} = require("../../utils/post-rules");
const { CITY_FILTER_OPTIONS } = require("../../utils/cities");

function buildTabOptions(source) {
  return Object.keys(source).map((key) => ({
    key,
    label: source[key]
  }));
}

Page({
  data: {
    categoryTabs: buildTabOptions(CATEGORY_LABELS),
    intentTabs: buildTabOptions(INTENT_LABELS),
    cityTabs: CITY_FILTER_OPTIONS,
    activeCategory: "shop",
    activeIntent: "offer",
    activeCity: "",
    activeRuleSummary: buildRuleSummary("shop", "normal"),
    keyword: "",
    posts: []
  },
  onLoad(options) {
    this.loadBoard({
      category: options.category || "shop",
      intent: options.intent || "offer"
    });
  },
  onShow() {
    const app = getApp();
    const nextBoardFilters = app.globalData.nextBoardFilters;

    if (nextBoardFilters) {
      app.globalData.nextBoardFilters = null;
      this.loadBoard(nextBoardFilters);
      return;
    }

    this.loadPosts();
  },
  loadBoard({ category, intent }) {
    this.setData({
      activeCategory: category,
      activeIntent: intent,
      activeRuleSummary: buildRuleSummary(category, "normal")
    });

    this.loadPosts();
  },
  async loadPosts() {
    const { activeCategory, activeIntent } = this.data;
    const posts = await postService.listPosts({
      category: activeCategory,
      intent: activeIntent,
      city: this.data.activeCity,
      keyword: this.data.keyword
    });

    this.setData({
      posts
    });
  },
  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },
  applyKeyword() {
    this.loadPosts();
  },
  clearKeyword() {
    this.setData({
      keyword: ""
    });
    this.loadPosts();
  },
  switchCity(event) {
    const { city } = event.currentTarget.dataset;

    this.setData({
      activeCity: city
    });
    this.loadPosts();
  },
  onPullDownRefresh() {
    this.loadPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  switchCategory(event) {
    const { category } = event.currentTarget.dataset;

    this.loadBoard({
      category,
      intent: this.data.activeIntent
    });
  },
  switchIntent(event) {
    const { intent } = event.currentTarget.dataset;

    this.loadBoard({
      category: this.data.activeCategory,
      intent
    });
  },
  openDetail(event) {
    const { id } = event.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/detail/index?id=${id}`
    });
  },
  openPublish() {
    wx.switchTab({
      url: "/pages/publish/index"
    });
  }
});
