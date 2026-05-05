const runtimeConfig = require("./config/runtime");
const { callWithLog } = require("./utils/cloud-call");

function isTimeoutError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();

  return message.includes("timeout");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentRoute() {
  try {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];

    return current ? current.route : "unknown";
  } catch (error) {
    return "unknown";
  }
}

App({
  globalData: {
    useMockData: runtimeConfig.useMockData,
    previewAdmin: runtimeConfig.useMockData && runtimeConfig.enableAdminPreview,
    currentUserId: runtimeConfig.mockCurrentUserId,
    nextBoardFilters: null,
    userContext: {
      openid: "",
      isAdmin: runtimeConfig.useMockData && runtimeConfig.enableAdminPreview,
      loaded: false,
      error: "",
      textModerationEnabled: false
    }
  },
  onLaunch() {
    this.installDiagnostics();

    if (wx.cloud) {
      const options = {
        traceUser: true
      };

      if (runtimeConfig.cloudEnvId) {
        options.env = runtimeConfig.cloudEnvId;
      }

      wx.cloud.init({
        ...options
      });
    }
  },
  installDiagnostics() {
    if (this.diagnosticsInstalled) {
      return;
    }

    this.diagnosticsInstalled = true;

    if (typeof wx.onError === "function") {
      wx.onError((error) => {
        console.error(`[wx.onError] route=${getCurrentRoute()}`, error);
      });
    }

    if (typeof wx.onUnhandledRejection === "function") {
      wx.onUnhandledRejection((result) => {
        console.error(`[wx.onUnhandledRejection] route=${getCurrentRoute()}`, result);
      });
    }

    if (wx.cloud && typeof wx.cloud.callFunction === "function" && !wx.cloud.__codexWrapped) {
      const originalCallFunction = wx.cloud.callFunction.bind(wx.cloud);

      wx.cloud.callFunction = (options = {}) => {
        const startedAt = Date.now();
        const action = options.data && options.data.action ? `/${options.data.action}` : "";
        const label = `[cloudraw] ${options.name || "unknown"}${action}`;

        console.log(`${label} START route=${getCurrentRoute()}`);

        return originalCallFunction(options).then((result) => {
          console.log(`${label} OK ${Date.now() - startedAt}ms route=${getCurrentRoute()}`);
          return result;
        }).catch((error) => {
          console.error(`${label} FAILED ${Date.now() - startedAt}ms route=${getCurrentRoute()}`, error);
          throw error;
        });
      };

      wx.cloud.__codexWrapped = true;
    }
  },
  loadUserContext(forceRefresh = false) {
    if (this.globalData.useMockData) {
      const context = {
        openid: this.globalData.currentUserId,
        isAdmin: !!runtimeConfig.enableAdminPreview,
        loaded: true,
        error: "",
        textModerationEnabled: false
      };

      this.globalData.userContext = context;
      this.globalData.previewAdmin = context.isAdmin;

      return Promise.resolve(context);
    }

    if (!wx.cloud) {
      const fallback = {
        openid: "",
        isAdmin: false,
        loaded: true,
        error: "当前基础库不支持云开发",
        textModerationEnabled: false
      };

      this.globalData.userContext = fallback;
      this.globalData.previewAdmin = false;

      return Promise.resolve(fallback);
    }

    if (this.userContextPromise && !forceRefresh) {
      return this.userContextPromise;
    }

    const fetchContext = async () => {
      let lastError = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await callWithLog("post", {
            action: "context"
          });
        } catch (error) {
          lastError = error;

          if (!isTimeoutError(error) || attempt === 1) {
            throw error;
          }

          await wait(500);
        }
      }

      throw lastError;
    };

    this.userContextPromise = fetchContext().then((response) => {
      const data = response.result && response.result.data ? response.result.data : {};
      const context = {
        openid: data.openid || "",
        isAdmin: !!data.isAdmin,
        loaded: true,
        error: "",
        textModerationEnabled: !!data.textModerationEnabled
      };

      this.globalData.userContext = context;
      this.globalData.previewAdmin = context.isAdmin;

      return context;
    }).catch((error) => {
      const fallback = {
        openid: "",
        isAdmin: false,
        loaded: true,
        error: error.message || "用户身份加载失败",
        textModerationEnabled: false
      };

      this.globalData.userContext = fallback;
      this.globalData.previewAdmin = false;

      return fallback;
    }).finally(() => {
      this.userContextPromise = null;
    });

    return this.userContextPromise;
  }
});
