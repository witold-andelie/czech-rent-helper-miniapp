const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const CATEGORY_OPTIONS = ["shop", "flex"];
const INTENT_OPTIONS = ["offer", "wanted"];
const STATUS_OPTIONS = ["active", "expired", "deleted"];
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
const FALLBACK_ADMIN_OPENIDS = [];
const DEFAULT_CREATE_WINDOW_MINUTES = 10;
const DEFAULT_MAX_POSTS_PER_WINDOW = 3;
const FORUM_SCENE = 3;
const IMAGE_MEDIA_TYPE = 2;
const MEDIA_CHECK_MODES = {
  OFF: "off",
  LEGACY_SYNC: "legacy_sync",
  ASYNC_V2: "async_v2"
};
const IMAGE_MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp"
};

function getAdminOpenids() {
  const raw = process.env.ADMIN_OPENIDS;

  if (!raw) {
    return FALLBACK_ADMIN_OPENIDS;
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function isAdmin(openid) {
  return getAdminOpenids().includes(openid);
}

function isTextModerationEnabled() {
  const raw = normalizeText(process.env.ENABLE_TEXT_MODERATION || "true", 16).toLowerCase();

  return !["0", "false", "off"].includes(raw);
}

function getMediaCheckMode() {
  const raw = normalizeText(
    process.env.MEDIA_CHECK_MODE || MEDIA_CHECK_MODES.LEGACY_SYNC,
    24
  ).toLowerCase();

  if (Object.values(MEDIA_CHECK_MODES).includes(raw)) {
    return raw;
  }

  return MEDIA_CHECK_MODES.LEGACY_SYNC;
}

function getRateLimitConfig() {
  const windowMinutes = clamp(
    Number(process.env.CREATE_WINDOW_MINUTES) || DEFAULT_CREATE_WINDOW_MINUTES,
    1,
    60
  );
  const maxPosts = clamp(
    Number(process.env.MAX_POSTS_PER_WINDOW) || DEFAULT_MAX_POSTS_PER_WINDOW,
    1,
    20
  );

  return {
    windowMinutes,
    maxPosts
  };
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniq(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getNormalRule(category) {
  return NORMAL_RULES[category] || NORMAL_RULES.flex;
}

function getDurationDays(category, tier, requestedDays) {
  if (tier === "vip") {
    return clamp(Number(requestedDays) || 1, 1, MAX_VIP_DAYS);
  }

  return getNormalRule(category).durationDays;
}

function getImageLimit(category, tier) {
  if (tier === "vip") {
    return MAX_VIP_IMAGES;
  }

  return getNormalRule(category).imageLimit;
}

function sanitizeImageIds(imageFileIds, category, tier) {
  const limit = getImageLimit(category, tier);

  return (Array.isArray(imageFileIds) ? imageFileIds : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildExpireAt(durationDays) {
  const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

  return new Date(expiresAt);
}

function getFileExtension(fileId) {
  const safeFileId = String(fileId || "").split("?")[0];
  const dotIndex = safeFileId.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return safeFileId.slice(dotIndex + 1).toLowerCase();
}

function getImageMimeType(fileId) {
  const extension = getFileExtension(fileId);

  return IMAGE_MIME_TYPES[extension] || "image/jpeg";
}

function diffFileIds(previousFileIds, nextFileIds) {
  const nextSet = new Set(uniq(nextFileIds));

  return uniq(previousFileIds).filter((fileId) => !nextSet.has(fileId));
}

async function safeDeleteFiles(fileIds) {
  const safeFileIds = uniq(fileIds);

  if (!safeFileIds.length) {
    return {
      fileList: []
    };
  }

  try {
    return await cloud.deleteFile({
      fileList: safeFileIds
    });
  } catch (error) {
    return {
      fileList: [],
      error: error.message || "delete failed"
    };
  }
}

function serializePost(record) {
  if (!record) {
    return null;
  }

  const {
    _id,
    id: existingId,
    imageFileIds: rawImageFileIds,
    imageCount: rawImageCount,
    mediaModerationTraceIds: rawMediaModerationTraceIds,
    ...rest
  } = record;
  const imageFileIds = Array.isArray(rawImageFileIds) ? rawImageFileIds : [];
  const mediaModerationTraceIds = Array.isArray(rawMediaModerationTraceIds)
    ? rawMediaModerationTraceIds
    : [];

  return {
    id: existingId || _id || "",
    ...rest,
    imageFileIds,
    mediaModerationTraceIds,
    imageCount: Number.isFinite(rawImageCount) ? rawImageCount : imageFileIds.length
  };
}

function isPublicVisible(record) {
  if (!record || record.status !== "active") {
    return false;
  }

  return new Date(record.expireAt).getTime() > Date.now();
}

function buildModerationContent(payload) {
  return [
    payload.title,
    payload.city,
    payload.district,
    payload.areaText,
    payload.priceText,
    payload.depositText,
    payload.availableFrom,
    payload.minStayText,
    payload.contactName,
    payload.contactLine,
    payload.description
  ].filter(Boolean).join("\n").slice(0, 2500);
}

function extractModerationDecision(response) {
  const result = response && typeof response.result === "object"
    ? response.result
    : response || {};

  return {
    suggest: normalizeText(result.suggest || (response && response.suggest), 20).toLowerCase(),
    label: Number.isFinite(result.label) ? result.label : (
      Number.isFinite(response && response.label) ? response.label : null
    ),
    traceId: normalizeText(
      (response && (response.trace_id || response.traceId)) || result.trace_id || result.traceId,
      120
    )
  };
}

function extractMediaModerationDecision(response) {
  const result = response && typeof response.result === "object"
    ? response.result
    : response || {};

  return {
    suggest: normalizeText(result.suggest || (response && response.suggest), 20).toLowerCase(),
    label: Number.isFinite(result.label) ? result.label : (
      Number.isFinite(response && response.label) ? response.label : null
    ),
    traceId: normalizeText(
      (response && (response.trace_id || response.traceId)) || result.trace_id || result.traceId,
      120
    )
  };
}

async function moderateText(payload, openid) {
  if (!isTextModerationEnabled()) {
    return {
      state: "skipped",
      label: null,
      traceId: ""
    };
  }

  if (!cloud.openapi || !cloud.openapi.security || typeof cloud.openapi.security.msgSecCheck !== "function") {
    return {
      state: "skipped",
      label: null,
      traceId: ""
    };
  }

  const content = buildModerationContent(payload);

  if (!content) {
    return {
      state: "skipped",
      label: null,
      traceId: ""
    };
  }

  try {
    const response = await cloud.openapi.security.msgSecCheck({
      openid,
      scene: FORUM_SCENE,
      version: 2,
      content
    });
    const decision = extractModerationDecision(response);

    if (decision.suggest && decision.suggest !== "pass") {
      throw Object.assign(
        new Error("内容未通过安全检查，请修改后重试"),
        {
          code: "CONTENT_BLOCKED",
          moderation: decision
        }
      );
    }

    return {
      state: "pass",
      label: decision.label,
      traceId: decision.traceId
    };
  } catch (error) {
    if (error.code === "CONTENT_BLOCKED") {
      throw error;
    }

    const errCode = Number(error.errCode || error.errcode || 0);

    if ([87014, 87017].includes(errCode)) {
      throw new Error("内容未通过安全检查，请修改后重试");
    }

    return {
      state: "skipped",
      label: null,
      traceId: ""
    };
  }
}

async function runLegacyImageCheck(fileId) {
  if (!cloud.openapi || !cloud.openapi.security || typeof cloud.openapi.security.imgSecCheck !== "function") {
    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.LEGACY_SYNC
    };
  }

  try {
    const downloadResult = await cloud.downloadFile({
      fileID: fileId
    });
    const fileContent = downloadResult.fileContent || downloadResult.buffer;

    assert(fileContent, "图片下载失败");

    await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: getImageMimeType(fileId),
        value: fileContent
      }
    });

    return {
      state: "pass",
      label: 100,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.LEGACY_SYNC
    };
  } catch (error) {
    const errCode = Number(error.errCode || error.errcode || 0);

    if (errCode === 87014) {
      throw new Error("图片未通过安全检查，请更换后重试");
    }

    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.LEGACY_SYNC
    };
  }
}

async function getTempFileUrl(fileId) {
  if (typeof cloud.getTempFileURL !== "function") {
    return "";
  }

  const result = await cloud.getTempFileURL({
    fileList: [fileId]
  });
  const fileInfo = Array.isArray(result.fileList) ? result.fileList[0] : null;

  if (!fileInfo) {
    return "";
  }

  return normalizeText(fileInfo.tempFileURL || fileInfo.download_url, 2000);
}

async function submitAsyncImageCheck(fileId, openid) {
  if (!cloud.openapi || !cloud.openapi.security || typeof cloud.openapi.security.mediaCheckAsync !== "function") {
    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.ASYNC_V2
    };
  }

  const mediaUrl = await getTempFileUrl(fileId);

  if (!mediaUrl) {
    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.ASYNC_V2
    };
  }

  try {
    const response = await cloud.openapi.security.mediaCheckAsync({
      media_url: mediaUrl,
      media_type: IMAGE_MEDIA_TYPE,
      version: 2,
      scene: FORUM_SCENE,
      openid
    });
    const decision = extractMediaModerationDecision(response);

    return {
      state: decision.traceId ? "pending" : "skipped",
      label: decision.label,
      traceIds: decision.traceId ? [decision.traceId] : [],
      mode: MEDIA_CHECK_MODES.ASYNC_V2
    };
  } catch (error) {
    const errCode = Number(error.errCode || error.errcode || 0);

    if (errCode === 87014) {
      throw new Error("图片未通过安全检查，请更换后重试");
    }

    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode: MEDIA_CHECK_MODES.ASYNC_V2
    };
  }
}

async function moderateImages(imageFileIds, openid) {
  const safeFileIds = uniq(imageFileIds);
  const mode = safeFileIds.length ? getMediaCheckMode() : MEDIA_CHECK_MODES.OFF;

  if (!safeFileIds.length || mode === MEDIA_CHECK_MODES.OFF) {
    return {
      state: "skipped",
      label: null,
      traceIds: [],
      mode
    };
  }

  if (mode === MEDIA_CHECK_MODES.ASYNC_V2) {
    const results = [];

    for (const fileId of safeFileIds) {
      results.push(await submitAsyncImageCheck(fileId, openid));
    }

    return {
      state: results.some((item) => item.state === "pending") ? "pending" : "skipped",
      label: null,
      traceIds: results.flatMap((item) => item.traceIds || []),
      mode
    };
  }

  for (const fileId of safeFileIds) {
    await runLegacyImageCheck(fileId);
  }

  return {
    state: "pass",
    label: 100,
    traceIds: [],
    mode
  };
}

async function assertCreateRateLimit(openid) {
  const { windowMinutes, maxPosts } = getRateLimitConfig();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const result = await db.collection("posts")
    .where({
      createdBy: openid,
      createdAt: _.gte(windowStart)
    })
    .limit(maxPosts)
    .get();

  assert(
    result.data.length < maxPosts,
    `发布过于频繁，请 ${windowMinutes} 分钟后再试`
  );
}

function validateCreatePayload(payload) {
  const category = normalizeText(payload.category, 12);
  const intent = normalizeText(payload.intent, 12);
  const title = normalizeText(payload.title, 60);
  const city = normalizeText(payload.city, 30);
  const district = normalizeText(payload.district, 40);
  const areaText = normalizeText(payload.areaText, 40);
  const priceText = normalizeText(payload.priceText, 40);
  const depositText = normalizeText(payload.depositText, 40);
  const availableFrom = normalizeText(payload.availableFrom, 30);
  const minStayText = normalizeText(payload.minStayText, 30);
  const contactName = normalizeText(payload.contactName, 30);
  const contactLine = normalizeText(payload.contactLine, 60);
  const description = normalizeText(payload.description, 1200);

  assert(CATEGORY_OPTIONS.includes(category), "无效的板块类型");
  assert(INTENT_OPTIONS.includes(intent), "无效的分区类型");
  assert(title, "标题不能为空");
  assert(city, "城市不能为空");
  assert(contactName, "联系人不能为空");
  assert(contactLine, "联系方式不能为空");
  assert(description, "描述不能为空");

  const imageFileIds = sanitizeImageIds(payload.imageFileIds, category, "normal");

  return {
    title,
    category,
    intent,
    city,
    district,
    areaText,
    priceText,
    depositText,
    availableFrom,
    minStayText,
    contactName,
    contactLine,
    description,
    imageFileIds
  };
}

async function handleCreate(payload, openid) {
  assert(openid, "无法识别当前用户");

  await assertCreateRateLimit(openid);

  const safePayload = validateCreatePayload(payload);
  const moderation = await moderateText(safePayload, openid);
  const mediaModeration = await moderateImages(safePayload.imageFileIds, openid);
  const durationDays = getDurationDays(safePayload.category, "normal");
  const record = {
    ...safePayload,
    tier: "normal",
    imageCount: safePayload.imageFileIds.length,
    durationDays,
    status: "active",
    moderationState: moderation.state,
    moderationLabel: moderation.label,
    moderationTraceId: moderation.traceId,
    mediaModerationMode: mediaModeration.mode,
    mediaModerationState: mediaModeration.state,
    mediaModerationLabel: mediaModeration.label,
    mediaModerationTraceIds: mediaModeration.traceIds,
    mediaModerationUpdatedAt: db.serverDate(),
    adminNote: "",
    createdBy: openid,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    expireAt: buildExpireAt(durationDays),
    deletedAt: null
  };

  const result = await db.collection("posts").add({
    data: record
  });
  const created = await db.collection("posts").doc(result._id).get();

  return serializePost(created.data);
}

async function handleList(payload, openid) {
  const category = normalizeText(payload.category, 12);
  const intent = normalizeText(payload.intent, 12);
  const city = normalizeText(payload.city, 30);
  const keyword = normalizeText(payload.keyword, 60);
  const includeInactive = Boolean(payload.includeInactive);
  const includeDeleted = Boolean(payload.includeDeleted);
  const limit = clamp(Number(payload.limit) || 20, 1, 50);
  const conditions = [];

  if (includeInactive) {
    assert(isAdmin(openid), "只有管理员可以查看全部帖子");
  }

  if (CATEGORY_OPTIONS.includes(category)) {
    conditions.push({
      category
    });
  }

  if (INTENT_OPTIONS.includes(intent)) {
    conditions.push({
      intent
    });
  }

  if (city) {
    conditions.push({
      city
    });
  }

  if (keyword) {
    const pattern = db.RegExp({
      regexp: keyword,
      options: "i"
    });

    conditions.push(_.or([
      { title: pattern },
      { city: pattern },
      { district: pattern },
      { description: pattern }
    ]));
  }

  if (!includeInactive) {
    conditions.push({
      status: "active"
    });
    conditions.push({
      expireAt: _.gt(new Date())
    });
  } else if (!includeDeleted) {
    conditions.push({
      status: _.neq("deleted")
    });
  }

  const where = conditions.length ? _.and(conditions) : {};

  const result = await db.collection("posts")
    .where(where)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return result.data.map(serializePost);
}

async function handleDetail(payload, openid) {
  const id = normalizeText(payload.id, 80);

  assert(id, "缺少帖子 ID");

  const result = await db.collection("posts").doc(id).get();
  const record = serializePost(result.data);
  const canManage = record && (record.createdBy === openid || isAdmin(openid));

  assert(record && (isPublicVisible(record) || canManage), "帖子不存在或已下线");

  return record;
}

async function handleMyList(openid) {
  const result = await db.collection("posts")
    .where({
      createdBy: openid,
      status: _.neq("deleted")
    })
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return result.data.map(serializePost);
}

async function handleRemove(payload, openid) {
  const id = normalizeText(payload.id, 80);

  assert(id, "缺少帖子 ID");

  const existing = await db.collection("posts").doc(id).get();
  const record = serializePost(existing.data);

  assert(record, "帖子不存在");

  const canDelete = record.createdBy === openid || isAdmin(openid);

  assert(canDelete, "没有删帖权限");

  await db.collection("posts").doc(id).update({
    data: {
      status: "deleted",
      updatedAt: db.serverDate(),
      deletedAt: db.serverDate()
    }
  });
  await safeDeleteFiles(record.imageFileIds);

  return {
    ok: true
  };
}

async function handleAdminUpdate(payload, openid) {
  assert(isAdmin(openid), "只有管理员可以执行该操作");

  const id = normalizeText(payload.id, 80);

  assert(id, "缺少帖子 ID");

  const existing = await db.collection("posts").doc(id).get();
  const record = serializePost(existing.data);

  assert(record, "帖子不存在");

  const makeVip = Boolean(payload.makeVip);
  const nextTier = makeVip ? "vip" : record.tier;
  const durationDays = payload.durationDays
    ? getDurationDays(record.category, nextTier, payload.durationDays)
    : record.durationDays;
  const shouldReactivate = Boolean(payload.durationDays) && record.status !== "deleted" && !payload.forceExpire;
  const nextStatus = payload.forceExpire
    ? "expired"
    : STATUS_OPTIONS.includes(payload.status)
      ? payload.status
      : shouldReactivate
        ? "active"
        : record.status;
  const nextImages = Array.isArray(payload.imageFileIds)
    ? sanitizeImageIds(payload.imageFileIds, record.category, nextTier)
    : record.imageFileIds;
  const nextExpireAt = payload.forceExpire
    ? new Date()
    : payload.durationDays
      ? buildExpireAt(durationDays)
      : record.expireAt;
  const adminNote = normalizeText(payload.adminNote, 200);
  const hasImageReplacement = Array.isArray(payload.imageFileIds);
  const mediaModeration = hasImageReplacement
    ? await moderateImages(nextImages, openid)
    : null;
  const obsoleteFileIds = hasImageReplacement
    ? diffFileIds(record.imageFileIds, nextImages)
    : [];

  await db.collection("posts").doc(id).update({
    data: {
      tier: nextTier,
      durationDays,
      expireAt: nextExpireAt,
      imageFileIds: nextImages,
      imageCount: nextImages.length,
      adminNote,
      status: nextStatus,
      mediaModerationMode: mediaModeration ? mediaModeration.mode : record.mediaModerationMode,
      mediaModerationState: mediaModeration ? mediaModeration.state : record.mediaModerationState,
      mediaModerationLabel: mediaModeration ? mediaModeration.label : record.mediaModerationLabel,
      mediaModerationTraceIds: mediaModeration ? mediaModeration.traceIds : record.mediaModerationTraceIds,
      mediaModerationUpdatedAt: mediaModeration ? db.serverDate() : record.mediaModerationUpdatedAt,
      updatedAt: db.serverDate()
    }
  });
  await safeDeleteFiles(obsoleteFileIds);

  return {
    ok: true
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = normalizeText(event.action, 24);
  const payload = event.payload || {};

  switch (action) {
    case "context":
      return {
        data: {
          openid: OPENID,
          isAdmin: isAdmin(OPENID),
          textModerationEnabled: isTextModerationEnabled()
        }
      };
    case "create":
      return {
        data: await handleCreate(payload, OPENID)
      };
    case "list":
      return {
        data: await handleList(payload, OPENID)
      };
    case "detail":
      return {
        data: await handleDetail(payload, OPENID)
      };
    case "myList":
      return {
        data: await handleMyList(OPENID)
      };
    case "remove":
      return handleRemove(payload, OPENID);
    case "adminUpdate":
      return handleAdminUpdate(payload, OPENID);
    default:
      throw new Error("未知的 action");
  }
};