"use strict";

const {
  PACKAGE_VERSION,
  asText,
  errorText,
  logEvent,
  makeAutomaticRequestId,
  makeManualRequestId,
  maskValue,
  previewText
} = require("./common");
const {
  readConfig,
  updateConfig,
  buildConfigStatus,
  clearToken,
  applyToolConfig
} = require("./config");
const {
  saveRecord,
  getRecord,
  getLastFailure,
  clearRecords,
  readStateFile
} = require("./state_store");
const { healthCheck, sendMessage, requireBridgeCredentials } = require("./bridge_client");

const inFlight = Object.create(null);

function validateAutomaticConfig(config) {
  requireBridgeCredentials(config);
  if (!config.target) {
    throw new Error("target is required");
  }
}

function isCompletedAiMessage(event) {
  // 只接受已落库的最终 AI 消息，避免 user、摘要、系统和流式中间态外发。
  if (!event || event.eventName !== "message_persisted") {
    return false;
  }
  const message = event.eventPayload;
  return !!message && message.sender === "ai" && Number(message.completedAt) > 0 && !!asText(message.content).trim();
}

async function sendConfiguredText(text, requestId, sessionKey, source) {
  const config = await readConfig();
  validateAutomaticConfig(config);
  const existing = await getRecord(requestId);
  // 成功记录是幂等屏障；网络超时后由 Bridge 依据同一 request id 决定是否已发送。
  if (existing && existing.status === "sent") {
    logEvent("send", "duplicate", {
      request_id: requestId,
      source,
      provider_message_id: existing.providerMessageId || ""
    });
    return { success: true, duplicate: true, providerMessageId: existing.providerMessageId || "" };
  }
  if (inFlight[requestId]) {
    return { success: true, duplicate: true, pending: true };
  }

  inFlight[requestId] = true;
  const startedAt = Date.now();
  try {
    const result = await sendMessage(config, { requestId, sessionKey, text });
    if (result.success) {
      await saveRecord({
        requestId,
        status: "sent",
        source,
        providerMessageId: result.providerMessageId,
        chatId: sessionKey ? sessionKey.slice("operit:".length) : "",
        textPreview: previewText(text),
        error: "",
        sentAt: Date.now(),
        elapsedMs: Date.now() - startedAt
      });
      logEvent("send", "sent", {
        request_id: requestId,
        source,
        target: maskValue(config.target),
        provider_message_id: result.providerMessageId,
        elapsed_ms: Date.now() - startedAt
      });
      return result;
    }

    await saveRecord({
      requestId,
      status: "failed",
      source,
      providerMessageId: result.providerMessageId || "",
      chatId: sessionKey ? sessionKey.slice("operit:".length) : "",
      content: text,
      textPreview: previewText(text),
      errorCode: result.errorCode,
      error: result.error,
      sentAt: 0,
      elapsedMs: Date.now() - startedAt
    });
    logEvent("send", "failed", {
      request_id: requestId,
      source,
      target: maskValue(config.target),
      error_code: result.errorCode,
      elapsed_ms: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    const message = errorText(error);
    await saveRecord({
      requestId,
      status: "failed",
      source,
      providerMessageId: "",
      chatId: sessionKey ? sessionKey.slice("operit:".length) : "",
      content: text,
      textPreview: previewText(text),
      errorCode: "configuration_error",
      error: message,
      sentAt: 0,
      elapsedMs: Date.now() - startedAt
    });
    logEvent("send", "failed", {
      request_id: requestId,
      source,
      error_code: "configuration_error",
      elapsed_ms: Date.now() - startedAt
    });
    return { success: false, errorCode: "configuration_error", error: message };
  } finally {
    delete inFlight[requestId];
  }
}

async function onMessagePersisted(event) {
  try {
    if (!isCompletedAiMessage(event)) {
      return null;
    }
    const config = await readConfig();
    if (!config.enabled || config.sendMode !== "assistant_reply") {
      return null;
    }
    const message = event.eventPayload;
    const chatId = asText(message.chatId).trim();
    const timestamp = Number(message.timestamp);
    if (!chatId || !Number.isInteger(timestamp) || timestamp <= 0) {
      return null;
    }
    const requestId = makeAutomaticRequestId(chatId, timestamp);
    logEvent("message_persisted", "started", {
      request_id: requestId,
      chat_id: maskValue(chatId),
      content_length: asText(message.content).length
    });
    return await sendConfiguredText(
      asText(message.content).trim(),
      requestId,
      `operit:${chatId}`,
      "assistant_reply"
    );
  } catch (error) {
    logEvent("message_persisted", "failed", {
      request_id: "",
      error_code: "hook_error",
      error: errorText(error)
    });
    return null;
  }
}

async function configure(params) {
  const current = await readConfig();
  const next = applyToolConfig(current, params || {});
  await updateConfig(next);
  const result = {
    success: true,
    packageVersion: PACKAGE_VERSION,
    status: buildConfigStatus(next)
  };
  if (params && params.test_connection === true) {
    result.health = await healthCheck(next);
    result.success = result.health.success;
  }
  return result;
}

async function testConnection() {
  const config = await readConfig();
  return Object.assign({ packageVersion: PACKAGE_VERSION }, await healthCheck(config));
}

async function sendManual(params) {
  const text = asText(params && params.text).trim();
  if (!text) {
    throw new Error("text is required");
  }
  const requestId = makeManualRequestId();
  return Object.assign({ packageVersion: PACKAGE_VERSION, requestId }, await sendConfiguredText(text, requestId, "", "manual"));
}

async function status() {
  const config = await readConfig();
  const state = await readStateFile();
  const lastRecord = state.lastRequestId ? state.records[state.lastRequestId] : null;
  return {
    success: true,
    packageVersion: PACKAGE_VERSION,
    config: buildConfigStatus(config),
    lastSend: lastRecord ? {
      status: lastRecord.status,
      requestId: lastRecord.requestId,
      errorCode: lastRecord.errorCode || "",
      error: lastRecord.error || "",
      textPreview: lastRecord.textPreview || "",
      providerMessageId: lastRecord.providerMessageId || "",
      updatedAt: lastRecord.updatedAt || 0
    } : null
  };
}

async function resendLastFailed() {
  const record = await getLastFailure();
  if (!record) {
    throw new Error("No failed message is available for resend");
  }
  return Object.assign({ packageVersion: PACKAGE_VERSION, requestId: record.requestId }, await sendConfiguredText(
    record.content,
    record.requestId,
    record.chatId ? `operit:${record.chatId}` : "",
    "manual_resend"
  ));
}

async function onApplicationLifecycle(event) {
  const config = await readConfig();
  logEvent("lifecycle", "ready", {
    event: event && event.eventName ? event.eventName : "unknown",
    enabled: config.enabled,
    send_mode: config.sendMode
  });
  return { ok: true, enabled: config.enabled, sendMode: config.sendMode };
}

async function clearTokenAndReturnStatus() {
  const config = await clearToken();
  return { success: true, packageVersion: PACKAGE_VERSION, status: buildConfigStatus(config) };
}

async function clearHistoryAndReturnStatus() {
  await clearRecords();
  return { success: true, packageVersion: PACKAGE_VERSION };
}

module.exports = {
  configure,
  testConnection,
  sendManual,
  status,
  resendLastFailed,
  onMessagePersisted,
  onApplicationLifecycle,
  clearTokenAndReturnStatus,
  clearHistoryAndReturnStatus
};
