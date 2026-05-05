const fs = require("fs");
const path = require("path");
const ci = require("miniprogram-ci");

function loadLocalEnv(projectPath) {
  const envPath = path.join(projectPath, ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex <= 0) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key) {
        acc[key] = value;
      }

      return acc;
    }, {});
}

async function main() {
  const projectPath = path.resolve(__dirname, "..");
  const localEnv = loadLocalEnv(projectPath);
  const appid = process.env.WECHAT_APPID || localEnv.WECHAT_APPID;
  const privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH || localEnv.WECHAT_PRIVATE_KEY_PATH;
  const robot = Number(process.env.WECHAT_ROBOT || localEnv.WECHAT_ROBOT || "1");

  if (!appid || !privateKeyPath) {
    console.log("Skip upload: WECHAT_APPID or WECHAT_PRIVATE_KEY_PATH is missing.");
    return;
  }
  const version = process.env.WECHAT_UPLOAD_VERSION
    || localEnv.WECHAT_UPLOAD_VERSION
    || `0.1.${process.env.GITHUB_RUN_NUMBER || "local"}`;
  const revision = process.env.GITHUB_SHA
    ? process.env.GITHUB_SHA.slice(0, 7)
    : "manual";
  const desc = process.env.WECHAT_UPLOAD_DESC
    || localEnv.WECHAT_UPLOAD_DESC
    || `GitHub Actions upload ${revision}`;
  const resolvedPrivateKeyPath = path.resolve(projectPath, privateKeyPath);

  if (!fs.existsSync(resolvedPrivateKeyPath)) {
    throw new Error(`Private key file not found: ${resolvedPrivateKeyPath}`);
  }

  const project = new ci.Project({
    appid,
    type: "miniProgram",
    projectPath,
    privateKeyPath: resolvedPrivateKeyPath,
    ignores: ["node_modules/**/*"]
  });

  await ci.upload({
    project,
    robot,
    version,
    desc,
    setting: {
      es6: true,
      minify: true,
      autoPrefixWXSS: true
    }
  });
  console.log("Upload completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
