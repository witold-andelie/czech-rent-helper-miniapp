function buildLabel(name, data = {}) {
  const action = data && data.action ? `/${data.action}` : "";

  return `[cloud] ${name}${action}`;
}

function getDuration(startAt) {
  return Date.now() - startAt;
}

async function callWithLog(name, data = {}) {
  const startAt = Date.now();
  const label = buildLabel(name, data);

  try {
    const result = await wx.cloud.callFunction({
      name,
      data
    });

    console.log(`${label} OK ${getDuration(startAt)}ms`);
    return result;
  } catch (error) {
    console.error(`${label} FAILED ${getDuration(startAt)}ms`, error);
    throw error;
  }
}

module.exports = {
  callWithLog
};
