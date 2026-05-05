const postService = require("../../services/post-service");
const {
  CATEGORY_LABELS,
  INTENT_LABELS,
  getDurationDays,
  getImageLimit,
  buildRuleSummary
} = require("../../utils/post-rules");
const { PRIORITY_CITIES } = require("../../utils/cities");

function createDefaultForm() {
  return {
    title: "",
    category: "shop",
    intent: "offer",
    city: "",
    district: "",
    areaText: "",
    priceText: "",
    depositText: "",
    availableFrom: "",
    minStayText: "",
    contactName: "",
    contactLine: "",
    description: "",
    localImagePaths: []
  };
}

Page({
  data: {
    categoryTabs: Object.keys(CATEGORY_LABELS).map((key) => ({
      key,
      label: CATEGORY_LABELS[key]
    })),
    intentTabs: Object.keys(INTENT_LABELS).map((key) => ({
      key,
      label: INTENT_LABELS[key]
    })),
    priorityCities: PRIORITY_CITIES,
    form: createDefaultForm(),
    imageLimit: 0,
    durationDays: 30,
    ruleSummary: buildRuleSummary("shop", "normal"),
    submitting: false
  },
  onLoad() {
    this.syncRules();
  },
  resetForm() {
    this.setData({
      form: createDefaultForm()
    });
    this.syncRules();
  },
  switchCategory(event) {
    const { category } = event.currentTarget.dataset;

    this.setData({
      "form.category": category,
      "form.localImagePaths": []
    });
    this.syncRules();
  },
  switchIntent(event) {
    const { intent } = event.currentTarget.dataset;

    this.setData({
      "form.intent": intent
    });
  },
  chooseCity(event) {
    const { city } = event.currentTarget.dataset;

    this.setData({
      "form.city": city
    });
  },
  onFieldInput(event) {
    const { name } = event.currentTarget.dataset;

    this.setData({
      [`form.${name}`]: event.detail.value
    });
  },
  syncRules() {
    const category = this.data.form.category;

    this.setData({
      imageLimit: getImageLimit(category, "normal"),
      durationDays: getDurationDays(category, "normal"),
      ruleSummary: buildRuleSummary(category, "normal")
    });
  },
  chooseImages() {
    const remaining = this.data.imageLimit - this.data.form.localImagePaths.length;

    if (remaining <= 0) {
      wx.showToast({
        title: "当前类型不能再加图",
        icon: "none"
      });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (result) => {
        const nextPaths = result.tempFiles.map((item) => item.tempFilePath);

        this.setData({
          "form.localImagePaths": this.data.form.localImagePaths.concat(nextPaths).slice(0, this.data.imageLimit)
        });
      }
    });
  },
  removeImage(event) {
    const { index } = event.currentTarget.dataset;
    const nextImages = this.data.form.localImagePaths.filter((_, currentIndex) => currentIndex !== index);

    this.setData({
      "form.localImagePaths": nextImages
    });
  },
  validateForm() {
    const requiredFields = ["title", "city", "contactName", "contactLine", "description"];
    const emptyField = requiredFields.find((field) => !this.data.form[field].trim());

    if (emptyField) {
      wx.showToast({
        title: "请补全标题、城市、联系方式和描述",
        icon: "none"
      });
      return false;
    }

    return true;
  },
  async submitForm() {
    if (this.data.submitting || !this.validateForm()) {
      return;
    }

    this.setData({
      submitting: true
    });

    try {
      const post = await postService.createPost(this.data.form);

      wx.showToast({
        title: "发布成功",
        icon: "success"
      });

      this.resetForm();

      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/detail/index?id=${post.id}`
        });
      }, 500);
    } catch (error) {
      wx.showToast({
        title: error.message || "发布失败",
        icon: "none"
      });
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});
