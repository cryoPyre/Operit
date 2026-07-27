"use strict";

const {
  TOOLPKG_ID,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_TIMEOUT_MS,
  asText,
  hasOwn,
  isObject,
  parseJsonObject,
  parseTimeout
} = require("./common");

const CONFIG_FILE_NAME = "config.json";
const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  bridgeUrl: "",
  bridgeToken: "",
  accountId: DEFAULT_ACCOUNT_ID,
  target: "",
  timeoutMs: DEFAULT_TIMEOUT_MS,
  sendMode: "manual",
  includeToolStatus: false
});

function getConfigPath() {
  const directory = asText(ToolPkg.getConfigDir(TOOLPKG_ID)).trim();
  if (!directory) {
    throw new Error(`Unable to resolve config directory for ${TOOLPKG_ID}`);
  }
  return `${directory}/${CONFIG_FILE_NAME}`;
}

async function readConfigFile() {
  const path = getConfigPath();
  // 配置属于插件私有数据，统一通过宿主文件工具访问，避免直接依赖 Android 文件路径。
  const exists = await Tools.Files.exists(path, "android");
  if (!exists || !exists.exists) {
    return {};
  }
  const result = await Tools.Files.read({ path, environment: "android" });
  return parseJsonObject(result && result.content, "OpenClaw Weixin config");
}

async function writeConfigFile(value) {
  const path = getConfigPath();
  // token 与目标只落盘到插件配置目录，工具返回值和日志均不携带 token。
  await Tools.Files.write(path, JSON.stringify(value, null, 2), false, "android");
}

function readBoolean(value, fieldName, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be boolean`);
  }
  return value;
}

function normalizeConfig(raw) {
  const value = isObject(raw) ? raw : {};
  const sendMode = value.sendMode === undefined ? DEFAULT_CONFIG.sendMode : asText(value.sendMode).trim();
  if (sendMode !== "manual" && sendMode !== "assistant_reply") {
    throw new Error("sendMode must be manual or assistant_reply");
  }
  const accountId = value.accountId === undefined ? DEFAULT_ACCOUNT_ID : asText(value.accountId).trim();
  if (!accountId) {
    throw new Error("accountId must not be empty");
  }
  return {
    enabled: readBoolean(value.enabled, "enabled", DEFAULT_CONFIG.enabled),
    bridgeUrl: value.bridgeUrl === undefined ? DEFAULT_CONFIG.bridgeUrl : asText(value.bridgeUrl).trim(),
    bridgeToken: value.bridgeToken === undefined ? DEFAULT_CONFIG.bridgeToken : asText(value.bridgeToken).trim(),
    accountId,
    target: value.target === undefined ? DEFAULT_CONFIG.target : asText(value.target).trim(),
    timeoutMs: parseTimeout(value.timeoutMs, DEFAULT_TIMEOUT_MS),
    sendMode,
    includeToolStatus: readBoolean(value.includeToolStatus, "includeToolStatus", DEFAULT_CONFIG.includeToolStatus)
  };
}

async function readConfig() {
  return normalizeConfig(await readConfigFile());
}

async function updateConfig(patch) {
  const current = await readConfig();
  const next = normalizeConfig(Object.assign({}, current, patch || {}));
  await writeConfig(next);
  return next;
}

async function clearToken() {
  return updateConfig({ bridgeToken: "" });
}

function buildConfigStatus(config) {
  return {
    enabled: config.enabled,
    configured: !!config.bridgeUrl && !!config.bridgeToken && !!config.target,
    bridgeUrl: config.bridgeUrl,
    accountId: config.accountId,
    targetMasked: config.target ? `${config.target.slice(0, 2)}***${config.target.slice(-2)}` : "",
    timeoutMs: config.timeoutMs,
    sendMode: config.sendMode,
    includeToolStatus: config.includeToolStatus,
    tokenConfigured: !!config.bridgeToken
  };
}

function applyToolConfig(current, params) {
  const patch = {};
  if (hasOwn(params, "enabled")) {
    patch.enabled = params.enabled;
  }
  if (hasOwn(params, "bridge_url")) {
    const bridgeUrl = asText(params.bridge_url).trim();
    if (bridgeUrl) {
      patch.bridgeUrl = bridgeUrl;
    }
  }
  if (hasOwn(params, "bridge_token")) {
    const bridgeToken = asText(params.bridge_token).trim();
    if (bridgeToken) {
      patch.bridgeToken = bridgeToken;
    }
  }
  if (hasOwn(params, "account_id")) {
    const accountId = asText(params.account_id).trim();
    if (accountId) {
      patch.accountId = accountId;
    }
  }
  if (hasOwn(params, "target")) {
    const target = asText(params.target).trim();
    if (target) {
      patch.target = target;
    }
  }
  if (hasOwn(params, "timeout_ms")) {
    patch.timeoutMs = params.timeout_ms;
  }
  if (hasOwn(params, "send_mode")) {
    patch.sendMode = asText(params.send_mode).trim();
  }
  if (hasOwn(params, "include_tool_status")) {
    patch.includeToolStatus = params.include_tool_status;
  }
  return normalizeConfig(Object.assign({}, current, patch));
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigPath,
  readConfig,
  updateConfig,
  clearToken,
  buildConfigStatus,
  applyToolConfig
};
