const fs = require("fs");
const path = require("path");

const seedPosts = require("../miniprogram/utils/mock-posts");

function omitLocalOnlyFields(post) {
  const {
    id,
    localImagePaths,
    categoryLabel,
    intentLabel,
    locationText,
    hasImages,
    statusLabel,
    ruleSummary,
    daysText,
    mediaModerationLabelText,
    mediaModerationNotice,
    ...rest
  } = post;

  return {
    ...rest,
    imageFileIds: Array.isArray(post.imageFileIds) ? post.imageFileIds : [],
    imageCount: Number.isFinite(post.imageCount)
      ? post.imageCount
      : Array.isArray(post.imageFileIds) ? post.imageFileIds.length : 0,
    mediaModerationMode: post.mediaModerationMode || (post.imageCount ? "legacy_sync" : "off"),
    mediaModerationState: post.mediaModerationState || (post.imageCount ? "pass" : "skipped"),
    mediaModerationTraceIds: Array.isArray(post.mediaModerationTraceIds)
      ? post.mediaModerationTraceIds
      : []
  };
}

function main() {
  const outputDir = path.join(__dirname, "..", "database");
  const outputFile = path.join(outputDir, "posts.seed.json");
  const payload = seedPosts.map(omitLocalOnlyFields);

  fs.mkdirSync(outputDir, {
    recursive: true
  });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  process.stdout.write(`${outputFile}\n`);
}

main();
