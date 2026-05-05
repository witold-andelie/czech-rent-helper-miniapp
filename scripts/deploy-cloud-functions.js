const fs = require("fs");
const path = require("path");
const ci = require("miniprogram-ci");
const cloudapi = require("../node_modules/miniprogram-ci/dist/ci/cloud/cloudapi.js");
const cloudAPI = require("../node_modules/miniprogram-ci/dist/common/cloud-api/index.js");
const { zipFile, zipToBuffer } = require("../node_modules/miniprogram-ci/dist/ci/cloud/utils.js");

const DEFAULT_HELLO_WORLD_ZIP = "UEsDBBQACAAIALB+WU4AAAAAAAAAAAAAAAAIABAAaW5kZXguanNVWAwAAZ9zXPuec1z1ARQAdY7BCsIwEETv+Yoll6ZQ+wOhnv0DD+IhxkWC664kWwmI/27V3IpzGuYNw3RzQSiaU9TOG6x3yVrGW0gMEzh8IOsAUVixfkwgOoV47WHawtPAooUVIRxJLs7ukEhgL5nOtl/h79qf+GBZeIM1FbXHdac9aKC9cDwTDfCb9eblzRtQSwcI6+pcr4AAAADOAAAAUEsBAhUDFAAIAAgAsH5ZTuvqXK+AAAAAzgAAAAgADAAAAAAAAAAAQKSBAAAAAGluZGV4LmpzVVgIAAGfc1z7nnNcUEsFBgAAAAABAAEAQgAAAMYAAAAAAA==";
const DEFAULT_FUNCTION_TIMEOUT = 10;
const DEFAULT_FUNCTION_MEMORY = 512;
const DEFAULT_FUNCTIONS = [
  {
    name: "post",
    path: "cloudfunctions/post"
  },
  {
    name: "expirePosts",
    path: "cloudfunctions/expirePosts"
  }
];

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

      acc[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
      return acc;
    }, {});
}

function getLogServiceProperties(envInfo) {
  try {
    const service = envInfo.logServices[0];

    return {
      clsLogsetId: service.logsetId,
      clsTopicId: service.topicId
    };
  } catch (error) {
    return {
      clsLogsetId: undefined,
      clsTopicId: undefined
    };
  }
}

async function waitForFunctionActive({
  project,
  envId,
  region,
  functionName,
  codeSecret,
  allowMissing = false,
  timeoutMs = 15 * 60 * 1000
}) {
  const start = Date.now();
  const request = cloudapi.boundTransactRequest(project);
  const topts = {
    request,
    transactType: cloudAPI.TransactType.IDE
  };
  let lastStatus = "";

  while (Date.now() - start < timeoutMs) {
    try {
      const info = await cloudAPI.scfGetFunctionInfo({
        namespace: envId,
        region,
        functionName,
        codeSecret
      }, topts);

      if (info.status !== lastStatus) {
        console.log(`[cloud] ${functionName} status: ${info.status}`);
        lastStatus = info.status;
      }

      if (info.status === "Active") {
        return info;
      }

      if (info.status === "CreateFailed") {
        throw new Error(`Create failed: ${info.statusDesc || info.status}`);
      }

      if (info.status === "UpdateFailed") {
        throw new Error(`Update failed: ${info.statusDesc || info.status}`);
      }
    } catch (error) {
      if (allowMissing && error.code === "ResourceNotFound.Function") {
        return null;
      }

      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timeout waiting for ${functionName} to become active.`);
}

async function ensureFunctionExists({
  project,
  envId,
  region,
  functionName,
  remoteNpmInstall,
  codeSecret,
  clsLogsetId,
  clsTopicId,
  timeout,
  memorySize
}) {
  const request = cloudapi.boundTransactRequest(project);
  const topts = {
    request,
    transactType: cloudAPI.TransactType.IDE
  };
  const existing = await waitForFunctionActive({
    project,
    envId,
    region,
    functionName,
    codeSecret,
    allowMissing: true
  });

  if (existing) {
    const expectedInstallDependency = remoteNpmInstall ? "TRUE" : "FALSE";
    const shouldUpdateConfig = existing.installDependency !== expectedInstallDependency
      || Number(existing.timeout) !== Number(timeout)
      || Number(existing.memorySize) !== Number(memorySize);

    if (shouldUpdateConfig) {
      console.log(`[cloud] updating ${functionName} function config`);
      await cloudAPI.scfUpdateFunctionInfo({
        namespace: envId,
        region,
        functionName,
        runtime: existing.runtime,
        memorySize,
        timeout,
        installDependency: remoteNpmInstall,
        clsLogsetId,
        clsTopicId
      }, topts);

      await waitForFunctionActive({
        project,
        envId,
        region,
        functionName,
        codeSecret
      });
    }

    return existing;
  }

  console.log(`[cloud] creating function ${functionName}`);
  await cloudAPI.scfCreateFunction({
    functionName,
    code: {
      zipFile: DEFAULT_HELLO_WORLD_ZIP
    },
    handler: "index.main",
    description: "",
    memorySize,
    timeout,
    environment: {
      variables: []
    },
    role: "TCB_QcsRole",
    runtime: "Nodejs8.9",
    namespace: envId,
    region,
    stamp: "MINI_QCBASE",
    installDependency: remoteNpmInstall,
    codeSecret,
    clsLogsetId,
    clsTopicId
  }, topts);

  return waitForFunctionActive({
    project,
    envId,
    region,
    functionName,
    codeSecret
  });
}

async function deployFunction({
  project,
  envId,
  region,
  functionName,
  functionPath,
  remoteNpmInstall,
  codeSecret,
  clsLogsetId,
  clsTopicId,
  timeout,
  memorySize
}) {
  const request = cloudapi.boundTransactRequest(project);
  const topts = {
    request,
    transactType: cloudAPI.TransactType.IDE
  };

  await ensureFunctionExists({
    project,
    envId,
    region,
    functionName,
    remoteNpmInstall,
    codeSecret,
    clsLogsetId,
    clsTopicId,
    timeout,
    memorySize
  });

  const zip = zipFile(functionPath, {
    ignore: remoteNpmInstall ? ["node_modules"] : undefined
  });
  const archive = await zipToBuffer(zip);

  console.log(`[cloud] uploading ${functionName} from ${functionPath}`);
  await cloudAPI.scfUpdateFunction({
    functionName,
    namespace: envId,
    region,
    handler: "index.main",
    installDependency: remoteNpmInstall,
    fileData: archive.toString("base64"),
    codeSecret
  }, topts);

  await waitForFunctionActive({
    project,
    envId,
    region,
    functionName,
    codeSecret
  });

  console.log(`[cloud] ${functionName} deployed`);
}

async function main() {
  const projectPath = path.resolve(__dirname, "..");
  const localEnv = loadLocalEnv(projectPath);
  const appid = process.env.WECHAT_APPID || localEnv.WECHAT_APPID;
  const privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH || localEnv.WECHAT_PRIVATE_KEY_PATH;
  const envId = process.env.WECHAT_CLOUD_ENV_ID || localEnv.WECHAT_CLOUD_ENV_ID || "cloud1-3go77lwb3c514943";
  const remoteNpmInstall = (process.env.WECHAT_REMOTE_NPM_INSTALL || localEnv.WECHAT_REMOTE_NPM_INSTALL || "true") !== "false";
  const timeout = Number(process.env.WECHAT_FUNCTION_TIMEOUT || localEnv.WECHAT_FUNCTION_TIMEOUT || DEFAULT_FUNCTION_TIMEOUT);
  const memorySize = Number(process.env.WECHAT_FUNCTION_MEMORY || localEnv.WECHAT_FUNCTION_MEMORY || DEFAULT_FUNCTION_MEMORY);
  const selectedNames = process.argv.slice(2);

  if (!appid || !privateKeyPath || !envId) {
    throw new Error("Missing WECHAT_APPID, WECHAT_PRIVATE_KEY_PATH or WECHAT_CLOUD_ENV_ID.");
  }

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

  const extAppid = await project.getExtAppid();
  cloudapi.initCloudAPI(extAppid || project.appid);

  const request = cloudapi.boundTransactRequest(project);
  const topts = {
    request,
    transactType: cloudAPI.TransactType.IDE
  };
  const { envList } = await cloudAPI.tcbGetEnvironments({}, topts);
  const envInfo = envList.find((item) => item.envId === envId);

  if (!envInfo) {
    throw new Error(`Cloud env not found: ${envId}`);
  }

  const region = envInfo.functions && envInfo.functions[0]
    ? envInfo.functions[0].region
    : (envInfo.storages && envInfo.storages[0] ? envInfo.storages[0].region : "");

  if (!region) {
    throw new Error(`Region not found for cloud env: ${envId}`);
  }

  const { clsLogsetId, clsTopicId } = getLogServiceProperties(envInfo);
  const codeSecret = await cloudapi.get3rdCloudCodeSecret(project);
  const targets = selectedNames.length
    ? DEFAULT_FUNCTIONS.filter((item) => selectedNames.includes(item.name))
    : DEFAULT_FUNCTIONS;

  if (!targets.length) {
    throw new Error("No cloud functions selected for deployment.");
  }

  for (const target of targets) {
    await deployFunction({
      project,
      envId,
      region,
      functionName: target.name,
      functionPath: path.join(projectPath, target.path),
      remoteNpmInstall,
      codeSecret,
      clsLogsetId,
      clsTopicId,
      timeout,
      memorySize
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
