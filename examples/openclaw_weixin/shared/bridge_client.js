"use strict";

const {
  asText,
  errorText,
  firstNonBlank,
  logEvent,
  parseJsonObject
} = require("./common");

function normalizeBridgeUrl(value) {
  const raw = asText(value).trim().replace(/\/+$/g, "");
  if (!raw) {
    throw new Error("bridge_url is required");
  }
  if (!/^https?:\/\/[^/?#]+(?:\/[^?#]*)?$/i.test(raw)) {
    throw new Error("bridge_url must be an HTTP or HTTPS URL");
  }
  return raw;
}

function classifyError(statusCode, data, networkError) {
  const rawCode = firstNonBlank(data && data.code, data && data.error_code).toLowerCase();
  const rawMessage = firstNonBlank(data && data.error, data && data.message, networkError);
  if (networkError) {
    return { code: "bridge_unreachable", message: rawMessage };
  }
  if (statusCode === 401 || statusCode === 403 || rawCode === "unauthorized") {
    return { code: "authentication_failed", message: rawMessage || "Bridge authentication failed" };
  }
  if (rawCode === "channel_not_logged_in" || rawCode === "not_logged_in") {
    return { code: "channel_not_logged_in", message: rawMessage || "OpenClaw Weixin channel is not logged in" };
  }
  if (rawCode === "target_invalid" || rawCode === "invalid_target") {
    return { code: "target_invalid", message: rawMessage || "Weixin target is invalid" };
  }
  if (rawCode === "timeout" || statusCode === 408 || statusCode === 504) {
    return { code: "timeout", message: rawMessage || "Bridge request timed out" };
  }
  return { code: "bridge_http_error", message: rawMessage || `Bridge returned HTTP ${statusCode}` };
}

async function requestJson(config, path, method, body, action, requestId) {
  const url = `${normalizeBridgeUrl(config.bridgeUrl)}${path}`;
  const startedAt = Date.now();
  logEvent(action, "started", {
    request_id: requestId || "",
    endpoint: path
  });
  try {
    // Bridge 是 Android 与 OpenClaw 之间的唯一网络边界，所有请求都带专用 token 和明确超时。
    const response = await Tools.Net.http({
      url,
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.bridgeToken}`,
        ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      connect_timeout: Math.min(Math.ceil(config.timeoutMs / 1000), 10),
      read_timeout: Math.ceil(config.timeoutMs / 1000),
      validateStatus: false,
      responseType: "text"
    });
    const statusCode = Number(response && response.statusCode) || 0;
    const data = parseJsonObject(response && response.content, "Bridge response");
    const bodyFailed = data.success === false;
    const error = statusCode >= 400 || bodyFailed ? classifyError(statusCode, data, "") : null;
    if (error) {
      logEvent(action, "failed", {
        request_id: requestId || "",
        http_status: statusCode,
        error_code: error.code,
        elapsed_ms: Date.now() - startedAt
      });
      return { success: false, statusCode, data, error };
    }
    logEvent(action, "sent", {
      request_id: requestId || "",
      http_status: statusCode,
      elapsed_ms: Date.now() - startedAt
    });
    return { success: true, statusCode, data, error: null };
  } catch (error) {
    const classified = classifyError(0, {}, errorText(error));
    logEvent(action, "failed", {
      request_id: requestId || "",
      error_code: classified.code,
      elapsed_ms: Date.now() - startedAt
    });
    return { success: false, statusCode: 0, data: {}, error: classified };
  }
}

function requireBridgeCredentials(config) {
  if (!config.bridgeUrl) {
    throw new Error("bridge_url is required");
  }
  if (!config.bridgeToken) {
    throw new Error("bridge_token is required");
  }
}

async function healthCheck(config) {
  requireBridgeCredentials(config);
  const result = await requestJson(config, "/health", "GET", null, "health", "");
  const status = firstNonBlank(result.data.status, result.success ? "ok" : "failed");
  const channelNotLoggedIn = result.data.channel_logged_in === false;
  return {
    success: result.success && result.data.success !== false && !channelNotLoggedIn,
    status,
    channel: firstNonBlank(result.data.channel, "openclaw-weixin"),
    channelLoggedIn: result.data.channel_logged_in,
    httpStatus: result.statusCode,
    errorCode: channelNotLoggedIn ? "channel_not_logged_in" : result.error ? result.error.code : "",
    error: channelNotLoggedIn ? "OpenClaw Weixin channel is not logged in" : result.error ? result.error.message : firstNonBlank(result.data.error)
  };
}

async function sendMessage(config, request) {
  requireBridgeCredentials(config);
  if (!config.accountId) {
    throw new Error("account_id is required");
  }
  if (!config.target) {
    throw new Error("target is required");
  }
  if (!request.text) {
    throw new Error("text is required");
  }
  const result = await requestJson(config, "/v1/weixin/send", "POST", {
    request_id: request.requestId,
    channel: "openclaw-weixin",
    account_id: config.accountId,
    target: config.target,
    text: request.text,
    session_key: request.sessionKey || ""
  }, "send", request.requestId);
  const providerMessageId = firstNonBlank(result.data.message_id, result.data.provider_message_id);
  const success = result.success && result.data.success !== false;
  return {
    success: success || !!providerMessageId,
    partial: !success && !!providerMessageId,
    providerMessageId,
    httpStatus: result.statusCode,
    errorCode: result.error ? result.error.code : "",
    error: result.error ? result.error.message : firstNonBlank(result.data.error)
  };
}

module.exports = {
  healthCheck,
  sendMessage,
  requireBridgeCredentials,
  normalizeBridgeUrl
};
