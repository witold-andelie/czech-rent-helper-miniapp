const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function expireBatch() {
  const now = new Date();
  const result = await db.collection("posts")
    .where({
      status: "active",
      expireAt: _.lte(now)
    })
    .orderBy("expireAt", "asc")
    .limit(100)
    .get();

  if (!result.data.length) {
    return 0;
  }

  const fileIds = [];

  result.data.forEach((item) => {
    (item.imageFileIds || []).forEach((fileId) => {
      if (fileId) {
        fileIds.push(fileId);
      }
    });
  });

  await Promise.all(result.data.map((item) => {
    return db.collection("posts").doc(item._id).update({
      data: {
        status: "expired",
        updatedAt: db.serverDate()
      }
    });
  }));

  if (fileIds.length) {
    await cloud.deleteFile({
      fileList: Array.from(new Set(fileIds))
    }).catch(() => {});
  }

  return result.data.length;
}

exports.main = async () => {
  let total = 0;
  let changed = 0;

  do {
    changed = await expireBatch();
    total += changed;
  } while (changed === 100);

  return {
    ok: true,
    expiredCount: total
  };
};
