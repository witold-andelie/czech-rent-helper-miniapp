const CATEGORY_LABELS = {
  shop: "店铺出租",
  flex: "灵活短租"
};

const INTENT_LABELS = {
  offer: "我要出租",
  wanted: "我要求租"
};

const NORMAL_RULES = {
  shop: {
    durationDays: 30,
    imageLimit: 0
  },
  flex: {
    durationDays: 15,
    imageLimit: 1
  }
};

const MAX_VIP_DAYS = 360;
const MAX_VIP_IMAGES = 3;

function getNormalRule(category) {
  return NORMAL_RULES[category] || NORMAL_RULES.flex;
}

function getImageLimit(category, tier = "normal") {
  if (tier === "vip") {
    return MAX_VIP_IMAGES;
  }

  return getNormalRule(category).imageLimit;
}

function getDurationDays(category, tier = "normal", requestedDays = 0) {
  if (tier === "vip") {
    const safeDays = Number(requestedDays) || 0;

    if (safeDays < 1) {
      return 1;
    }

    return Math.min(safeDays, MAX_VIP_DAYS);
  }

  return getNormalRule(category).durationDays;
}

function buildRuleSummary(category, tier = "normal") {
  const imageLimit = getImageLimit(category, tier);
  const duration = tier === "vip"
    ? `1-${MAX_VIP_DAYS} 天`
    : `${getDurationDays(category, "normal")} 天`;
  const imageText = imageLimit === 0 ? "不允许上传图片" : `最多 ${imageLimit} 张图`;

  return `${imageText} / ${duration} / 到期自动下线`;
}

module.exports = {
  CATEGORY_LABELS,
  INTENT_LABELS,
  NORMAL_RULES,
  MAX_VIP_DAYS,
  MAX_VIP_IMAGES,
  getNormalRule,
  getImageLimit,
  getDurationDays,
  buildRuleSummary
};
