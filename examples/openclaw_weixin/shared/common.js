"use strict";

const TOOLPKG_ID = "com.operit.openclaw_weixin_bundle";
const PACKAGE_VERSION = "0.1.0";
const DEFAULT_ACCOUNT_ID = "default";
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 60000;

function asText(value) {
  return value == null ? "" : String(value);
}

function hasOwn(value, key) {
  return !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstNonBlank() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = asText(arguments[index]).trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function errorText(error) {
  if (error instanceof Error) {
    return error.message || "unknown error";
  }
  return asText(error) || "unknown error";
}

function parseJsonObject(content, label) {
  const raw = asText(content).trim();
  if (!raw) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label || "JSON"} is invalid: ${errorText(error)}`);
  }
  if (!isObject(parsed)) {
    throw new Error(`${label || "JSON"} must be an object`);
  }
  return parsed;
}

function parseTimeout(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > MAX_TIMEOUT_MS) {
    throw new Error(`timeout_ms must be an integer between 1000 and ${MAX_TIMEOUT_MS}`);
  }
  return parsed;
}

function maskValue(value) {
  const text = asText(value);
  if (!text) {
    return "";
  }
  if (text.length <= 4) {
    return "***";
  }
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function previewText(value, maxLength) {
  const text = asText(value);
  const limit = maxLength || 80;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function logEvent(action, status, fields) {
  const payload = Object.assign({
    module: "openclaw_weixin",
    action,
    status
  }, fields || {});
  console.log(`[openclaw_weixin] ${JSON.stringify(payload)}`);
}

function makeAutomaticRequestId(chatId, timestamp) {
  return `operit-${asText(chatId).trim()}-${String(timestamp)}`;
}

function makeManualRequestId() {
  return `operit-manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  TOOLPKG_ID,
  PACKAGE_VERSION,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  asText,
  hasOwn,
  isObject,
  firstNonBlank,
  errorText,
  parseJsonObject,
  parseTimeout,
  maskValue,
  previewText,
  logEvent,
  makeAutomaticRequestId,
  makeManualRequestId
};
