"use strict";

/* METADATA
{
  "name": "openclaw_weixin",
  "display_name": {
    "zh": "OpenClaw 微信转发",
    "en": "OpenClaw Weixin Forwarder"
  },
  "description": {
    "zh": "将 Operit AI 完成回复发送到已配置的 OpenClaw 微信 Bridge。",
    "en": "Send completed Operit AI replies to a configured OpenClaw Weixin Bridge."
  },
  "enabledByDefault": false,
  "category": "Communication",
  "tools": [
    {
      "name": "openclaw_weixin_configure",
      "description": { "zh": "保存 OpenClaw 微信 Bridge 与自动转发配置。", "en": "Save OpenClaw Weixin Bridge and forwarding settings." },
      "parameters": [
        { "name": "enabled", "description": { "zh": "是否启用 AI 完成回复自动转发。", "en": "Enable forwarding of completed AI replies." }, "type": "boolean", "required": false },
        { "name": "bridge_url", "description": { "zh": "Bridge HTTP 或 HTTPS 地址。", "en": "Bridge HTTP or HTTPS URL." }, "type": "string", "required": false },
        { "name": "bridge_token", "description": { "zh": "Bridge 专用 token；留空表示不修改。", "en": "Bridge token; leave empty to keep the current token." }, "type": "string", "required": false },
        { "name": "account_id", "description": { "zh": "OpenClaw 微信账号，默认 default。", "en": "OpenClaw Weixin account, default is default." }, "type": "string", "required": false },
        { "name": "target", "description": { "zh": "微信 peer id，不是昵称或手机号。", "en": "Weixin peer id, not a nickname or phone number." }, "type": "string", "required": false },
        { "name": "timeout_ms", "description": { "zh": "HTTP 超时，范围 1000 到 60000。", "en": "HTTP timeout from 1000 to 60000 ms." }, "type": "number", "required": false },
        { "name": "send_mode", "description": { "zh": "manual 或 assistant_reply。", "en": "manual or assistant_reply." }, "type": "string", "required": false },
        { "name": "include_tool_status", "description": { "zh": "是否记录工具状态转发设置，V0.1 不转发工具状态。", "en": "Keep the tool-status forwarding setting; V0.1 does not forward tool status." }, "type": "boolean", "required": false },
        { "name": "test_connection", "description": { "zh": "保存后是否立即调用 Bridge health。", "en": "Call Bridge health after saving." }, "type": "boolean", "required": false }
      ]
    },
    {
      "name": "openclaw_weixin_test_connection",
      "description": { "zh": "检查 Bridge 在线、认证和 OpenClaw 微信通道状态。", "en": "Check Bridge reachability, authentication, and OpenClaw Weixin channel status." },
      "parameters": []
    },
    {
      "name": "openclaw_weixin_send",
      "description": { "zh": "向固定微信 target 手动发送一条文本。", "en": "Manually send text to the configured Weixin target." },
      "parameters": [
        { "name": "text", "description": { "zh": "要发送的文本。", "en": "Text to send." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "openclaw_weixin_status",
      "description": { "zh": "查看配置摘要和最近失败发送记录。", "en": "View configuration summary and the latest failed send record." },
      "parameters": []
    },
    {
      "name": "openclaw_weixin_resend_last",
      "description": { "zh": "重发最后一条失败文本，继续使用原 request id。", "en": "Resend the latest failed text with its original request id." },
      "parameters": []
    },
    {
      "name": "openclaw_weixin_clear_token",
      "description": { "zh": "清除本地保存的 Bridge token。", "en": "Clear the locally stored Bridge token." },
      "parameters": []
    },
    {
      "name": "openclaw_weixin_clear_records",
      "description": { "zh": "清除本地发送记录。", "en": "Clear local send records." },
      "parameters": []
    }
  ]
}
*/

const forwarder = require("../shared/message_forwarder.js");
const { errorText, logEvent } = require("../shared/common.js");

exports.openclaw_weixin_configure = async function (params) {
  try {
    return await forwarder.configure(params || {});
  } catch (error) {
    logEvent("configure", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_test_connection = async function () {
  try {
    return await forwarder.testConnection();
  } catch (error) {
    logEvent("test_connection", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_send = async function (params) {
  try {
    return await forwarder.sendManual(params || {});
  } catch (error) {
    logEvent("manual_send", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_status = async function () {
  try {
    return await forwarder.status();
  } catch (error) {
    logEvent("status", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_resend_last = async function () {
  try {
    return await forwarder.resendLastFailed();
  } catch (error) {
    logEvent("resend", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_clear_token = async function () {
  try {
    return await forwarder.clearTokenAndReturnStatus();
  } catch (error) {
    logEvent("clear_token", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};

exports.openclaw_weixin_clear_records = async function () {
  try {
    return await forwarder.clearHistoryAndReturnStatus();
  } catch (error) {
    logEvent("clear_records", "failed", { error_code: "tool_error", error: errorText(error) });
    return { success: false, error: errorText(error) };
  }
};
