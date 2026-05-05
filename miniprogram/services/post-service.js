const seedPosts = require("../utils/mock-posts");
const { callWithLog } = require("../utils/cloud-call");
const {
  CATEGORY_LABELS,
  INTENT_LABELS,
  getDurationDays,
  getImageLimit,
  buildRuleSummary
} = require("../utils/post-rules");

let store = seedPosts.map((item) => ({ ...item }));

function getAppSafe() {
  try {
    return getApp();
  } catch (error) {
    return null;
  }
}

function useMockData() {
  const app = getAppSafe();

  return !app || app.globalData.useMockData;
}

function getCurrentUserId() {
  const app = getAppSafe();

  return (app && app.globalData.currentUserId) || "mock-user-1";
}

function isPreviewAdmin() {
  const app = getAppSafe();

  return !!(app && app.globalData.previewAdmin);
}

async function getUserContext(forceRefresh = false) {
  const app = getAppSafe();

  if (!app) {
    return {
      openid: "",
      isAdmin: false,
      loaded: true,
      error: "应用上下文不可用",
      textModerationEnabled: false
    };
  }

  if (typeof app.loadUserContext === "function") {
    return app.loadUserContext(forceRefresh);
  }

  return app.globalData.userContext || {
    openid: "",
    isAdmin: false,
    loaded: false,
    error: "",
    textModerationEnabled: false
  };
}

function sortByLatest(list) {
  return list.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function getMediaModerationLabelText(state) {
  switch (state) {
    case "pass":
      return "图片审核通过";
    case "pending":
      return "图片审核中";
    case "review":
      return "图片待复核";
    case "risky":
    case "reject":
      return "图片审核未通过";
    case "skipped":
      return "未执行图片审核";
    default:
      return "图片审核状态未知";
  }
}

function enrichPost(post) {
  const location = [post.city, post.district].filter(Boolean).join(" · ");
  const localImagePaths = Array.isArray(post.localImagePaths) && post.localImagePaths.length
    ? post.localImagePaths
    : Array.isArray(post.imageFileIds)
      ? post.imageFileIds
      : [];
  const mediaModerationState = post.mediaModerationState || (localImagePaths.length ? "pass" : "skipped");
  const mediaModerationLabelText = getMediaModerationLabelText(mediaModerationState);
  const mediaModerationNotice = mediaModerationState === "pending"
    ? "图片正在进行安全检测，结果回传前可能存在延迟。"
    : mediaModerationState === "review"
      ? "图片已进入复核状态，建议稍后再查看。"
      : "";

  return {
    ...post,
    localImagePaths,
    mediaModerationState,
    mediaModerationLabelText,
    mediaModerationNotice,
    categoryLabel: CATEGORY_LABELS[post.category] || post.category,
    intentLabel: INTENT_LABELS[post.intent] || post.intent,
    locationText: location || "待补充位置",
    hasImages: localImagePaths.length > 0 || post.imageCount > 0,
    statusLabel: post.status === "active"
      ? "展示中"
      : post.status === "expired"
        ? "已到期"
        : "已删除",
    ruleSummary: buildRuleSummary(post.category, post.tier),
    daysText: `${post.durationDays} 天展示`
  };
}

async function callCloud(action, payload = {}) {
  const response = await callWithLog("post", {
    action,
    payload
  });

  return response.result;
}

async function uploadLocalImages(category, localImagePaths = []) {
  const uploads = await Promise.all(localImagePaths.map((filePath, index) => {
    const extension = filePath.includes(".")
      ? filePath.slice(filePath.lastIndexOf("."))
      : ".jpg";

    return wx.cloud.uploadFile({
      cloudPath: `posts/${category}/${Date.now()}-${index}${extension}`,
      filePath
    });
  }));

  return uploads.map((item) => item.fileID);
}

async function listPosts(filters = {}) {
  if (!useMockData()) {
    const result = await callCloud("list", filters);

    return (result.data || []).map(enrichPost);
  }

  const now = Date.now();
  const filtered = store.filter((item) => {
    const alive = item.status === "active" && new Date(item.expireAt).getTime() > now;
    const hitCategory = !filters.category || item.category === filters.category;
    const hitIntent = !filters.intent || item.intent === filters.intent;
    const hitCity = !filters.city || item.city === filters.city;
    const keyword = String(filters.keyword || "").trim().toLowerCase();
    const haystack = [
      item.title,
      item.city,
      item.district,
      item.description
    ].join(" ").toLowerCase();
    const hitKeyword = !keyword || haystack.includes(keyword);

    return alive && hitCategory && hitIntent && hitCity && hitKeyword;
  });

  return sortByLatest(filtered).map(enrichPost);
}

async function listAllPosts() {
  if (!useMockData()) {
    const result = await callCloud("list", {
      includeInactive: true,
      includeDeleted: false
    });

    return (result.data || []).map(enrichPost);
  }

  return sortByLatest(
    store.filter((item) => item.status !== "deleted")
  ).map(enrichPost);
}

async function getPostDetail(id) {
  if (!useMockData()) {
    const result = await callCloud("detail", { id });

    return enrichPost(result.data);
  }

  const found = store.find((item) => item.id === id);

  return found ? enrichPost(found) : null;
}

async function getMyPosts() {
  if (!useMockData()) {
    const result = await callCloud("myList");

    return (result.data || []).map(enrichPost);
  }

  const currentUserId = getCurrentUserId();

  return sortByLatest(
    store.filter((item) => item.createdBy === currentUserId && item.status !== "deleted")
  ).map(enrichPost);
}

async function createPost(payload) {
  if (!useMockData()) {
    let imageFileIds = [];

    try {
      imageFileIds = await uploadLocalImages(payload.category, payload.localImagePaths || []);

      const result = await callCloud("create", {
        ...payload,
        imageFileIds
      });

      return enrichPost(result.data);
    } catch (error) {
      if (imageFileIds.length) {
        wx.cloud.deleteFile({
          fileList: imageFileIds
        }).catch(() => {});
      }

      throw error;
    }
  }

  const durationDays = getDurationDays(payload.category, "normal");
  const imageLimit = getImageLimit(payload.category, "normal");
  const imageFileIds = (payload.localImagePaths || []).slice(0, imageLimit);
  const createdAt = new Date().toISOString();
  const expireAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const record = {
    id: `mock-${Date.now()}`,
    title: payload.title,
    category: payload.category,
    intent: payload.intent,
    tier: "normal",
    city: payload.city,
    district: payload.district,
    areaText: payload.areaText,
    priceText: payload.priceText,
    depositText: payload.depositText,
    availableFrom: payload.availableFrom,
    minStayText: payload.minStayText,
    contactName: payload.contactName,
    contactLine: payload.contactLine,
    description: payload.description,
    imageFileIds,
    localImagePaths: imageFileIds,
    imageCount: imageFileIds.length,
    durationDays,
    status: "active",
    moderationState: "pending",
    mediaModerationMode: imageFileIds.length ? "legacy_sync" : "off",
    mediaModerationState: imageFileIds.length ? "pass" : "skipped",
    mediaModerationTraceIds: [],
    adminNote: "",
    createdBy: getCurrentUserId(),
    createdAt,
    updatedAt: createdAt,
    expireAt
  };

  store = [record].concat(store);

  return enrichPost(record);
}

async function deletePost(id) {
  if (!useMockData()) {
    return callCloud("remove", { id });
  }

  store = store.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      status: "deleted",
      updatedAt: new Date().toISOString()
    };
  });

  return { ok: true };
}

async function adminUpdatePost(payload) {
  if (!useMockData()) {
    let uploadedFileIds = [];

    try {
      const imageFileIds = Array.isArray(payload.localImagePaths) && payload.localImagePaths.length
        ? await uploadLocalImages("admin", payload.localImagePaths)
        : payload.imageFileIds;

      uploadedFileIds = Array.isArray(imageFileIds) ? imageFileIds : [];

      return callCloud("adminUpdate", {
        ...payload,
        imageFileIds
      });
    } catch (error) {
      if (uploadedFileIds.length) {
        wx.cloud.deleteFile({
          fileList: uploadedFileIds
        }).catch(() => {});
      }

      throw error;
    }
  }

  if (!isPreviewAdmin()) {
    throw new Error("管理员预览未开启");
  }

  store = store.map((item) => {
    if (item.id !== payload.id) {
      return item;
    }

    const nextTier = payload.makeVip ? "vip" : item.tier;
    const nextDuration = payload.durationDays
      ? getDurationDays(item.category, nextTier, payload.durationDays)
      : item.durationDays;
    const nextExpireAt = payload.durationDays
      ? new Date(Date.now() + nextDuration * 24 * 60 * 60 * 1000).toISOString()
      : item.expireAt;
    const nextImages = Array.isArray(payload.imageFileIds)
      ? payload.imageFileIds.slice(0, getImageLimit(item.category, nextTier))
      : Array.isArray(payload.localImagePaths)
        ? payload.localImagePaths.slice(0, getImageLimit(item.category, nextTier))
      : item.imageFileIds;

    return {
      ...item,
      tier: nextTier,
      durationDays: nextDuration,
      expireAt: nextExpireAt,
      status: payload.forceExpire ? "expired" : (payload.status || item.status),
      imageFileIds: nextImages,
      localImagePaths: nextImages,
      imageCount: nextImages.length,
      mediaModerationMode: nextImages.length ? "legacy_sync" : "off",
      mediaModerationState: nextImages.length ? "pass" : "skipped",
      mediaModerationTraceIds: [],
      adminNote: payload.adminNote || item.adminNote,
      updatedAt: new Date().toISOString()
    };
  });

  return { ok: true };
}

module.exports = {
  getUserContext,
  listPosts,
  listAllPosts,
  getPostDetail,
  getMyPosts,
  createPost,
  deletePost,
  adminUpdatePost
};
