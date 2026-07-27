"use strict";

const TOOL_PACKAGE = "openclaw_weixin";
const { errorText, logEvent } = require("../../shared/common.js");

function text(value) {
  return value == null ? "" : String(value);
}

function parseRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      logEvent("ui_parse_result", "failed", { error_code: "invalid_tool_result", error: errorText(error) });
    }
  }
  return {};
}

function useState(ctx, key, initialValue) {
  const pair = ctx.useState(key, initialValue);
  return { value: pair[0], set: pair[1] };
}

function localeText() {
  return text(getLang()).toLowerCase().startsWith("en") ? {
    title: "OpenClaw Weixin Forwarder",
    subtitle: "Forward completed Operit AI replies to one fixed OpenClaw Weixin target.",
    bridgeUrl: "Bridge URL",
    token: "Bridge token",
    account: "Account ID",
    target: "Weixin peer ID",
    timeout: "Timeout (ms)",
    mode: "Send mode",
    modeHint: "manual or assistant_reply",
    enabled: "Enable automatic forwarding",
    toolStatus: "Keep tool-status setting",
    save: "Save settings",
    saveTest: "Save and test",
    test: "Test connection",
    sendText: "Manual text",
    send: "Send text",
    resend: "Resend last failure",
    clearToken: "Clear token",
    clearRecords: "Clear send records",
    status: "Status",
    saved: "Settings saved.",
    sent: "Message sent.",
    cleared: "Operation completed.",
    noStatus: "No status loaded.",
    lastError: "Last error",
    notConfigured: "Not configured",
    configured: "configured",
    tokenHint: "Leave empty to keep the current token.",
    failed: "Failed: "
  } : {
    title: "OpenClaw 微信转发",
    subtitle: "将 Operit AI 完成回复转发到一个固定的 OpenClaw 微信目标。",
    bridgeUrl: "Bridge 地址",
    token: "Bridge token",
    account: "微信 account id",
    target: "微信 peer id",
    timeout: "超时（毫秒）",
    mode: "发送模式",
    modeHint: "manual 或 assistant_reply",
    enabled: "启用 AI 完成回复自动转发",
    toolStatus: "保留工具状态配置",
    save: "保存配置",
    saveTest: "保存并测试",
    test: "测试连接",
    sendText: "手动发送文本",
    send: "发送文本",
    resend: "重发最后一条失败消息",
    clearToken: "清除 token",
    clearRecords: "清除发送记录",
    status: "状态",
    saved: "配置已保存。",
    sent: "消息已发送。",
    cleared: "操作已完成。",
    noStatus: "尚未读取状态。",
    lastError: "最近错误",
    notConfigured: "未配置",
    configured: "已配置",
    tokenHint: "留空表示保持当前 token。",
    failed: "失败："
  };
}

async function callTool(ctx, toolName, params) {
  const candidates = [];
  if (ctx.resolveToolName) {
    const resolved = await ctx.resolveToolName({ packageName: TOOL_PACKAGE, toolName, preferImported: true });
    if (text(resolved).trim()) {
      candidates.push(text(resolved).trim());
    }
  }
  candidates.push(`${TOOL_PACKAGE}:${toolName}`);
  let lastError = "";
  for (const candidate of candidates.filter((item, index, list) => list.indexOf(item) === index)) {
    try {
      return parseRecord(await ctx.callTool(candidate, params));
    } catch (error) {
      lastError = errorText(error);
    }
  }
  throw new Error(lastError || `Tool call failed: ${toolName}`);
}

function statusRows(ctx, labels, model) {
  const rows = [];
  const add = (label, value) => {
    if (text(value).trim()) {
      rows.push(ctx.UI.Row({ fillMaxWidth: true }, [
        ctx.UI.Text({ text: `${label}:`, style: "bodySmall", fontWeight: "semiBold", width: 130 }),
        ctx.UI.Text({ text: text(value), style: "bodySmall", weight: 1 })
      ]));
    }
  };
  add(labels.status, model.configured ? labels.configured : labels.notConfigured);
  add(labels.bridgeUrl, model.bridgeUrl);
  add(labels.account, model.accountId);
  add(labels.target, model.targetMasked);
  add(labels.mode, model.sendMode);
  add(labels.lastError, model.lastError);
  return rows;
}

function Screen(ctx) {
  const labels = localeText();
  const bridgeUrl = useState(ctx, "bridgeUrl", "");
  const token = useState(ctx, "token", "");
  const accountId = useState(ctx, "accountId", "default");
  const target = useState(ctx, "target", "");
  const timeoutMs = useState(ctx, "timeoutMs", "10000");
  const sendMode = useState(ctx, "sendMode", "manual");
  const enabled = useState(ctx, "enabled", false);
  const includeToolStatus = useState(ctx, "includeToolStatus", false);
  const manualText = useState(ctx, "manualText", "");
  const busy = useState(ctx, "busy", false);
  const message = useState(ctx, "message", "");
  const error = useState(ctx, "error", "");
  const statusModel = useState(ctx, "statusModel", { configured: false, bridgeUrl: "", accountId: "", targetMasked: "", sendMode: "", lastError: "" });
  const initialized = useState(ctx, "initialized", false);

  const applyStatus = (result) => {
    const config = result.config || {};
    statusModel.set({
      configured: config.configured === true,
      bridgeUrl: text(config.bridgeUrl),
      accountId: text(config.accountId),
      targetMasked: text(config.targetMasked),
      sendMode: text(config.sendMode),
      lastError: text(result.lastSend && result.lastSend.error)
    });
    if (config.bridgeUrl) bridgeUrl.set(text(config.bridgeUrl));
    if (config.accountId) accountId.set(text(config.accountId));
    if (config.timeoutMs) timeoutMs.set(text(config.timeoutMs));
    if (config.sendMode) sendMode.set(text(config.sendMode));
    enabled.set(config.enabled === true);
    includeToolStatus.set(config.includeToolStatus === true);
  };

  const run = async (action, successMessage) => {
    busy.set(true);
    message.set("");
    error.set("");
    try {
      const result = await action();
      if (result.success === false) throw new Error(text(result.error) || labels.notConfigured);
      if (result.config) applyStatus(result);
      message.set(successMessage);
      return result;
    } catch (caught) {
      logEvent("ui_action", "failed", { error_code: "ui_error", error: errorText(caught) });
      error.set(`${labels.failed}${errorText(caught)}`);
      return null;
    } finally {
      busy.set(false);
    }
  };

  const configure = async (testConnection) => {
    const params = {
      bridge_url: bridgeUrl.value.trim(),
      account_id: accountId.value.trim(),
      target: target.value.trim(),
      timeout_ms: timeoutMs.value.trim(),
      send_mode: sendMode.value.trim(),
      enabled: enabled.value,
      include_tool_status: includeToolStatus.value,
      test_connection: testConnection
    };
    if (token.value.trim()) params.bridge_token = token.value.trim();
    await run(() => callTool(ctx, "openclaw_weixin_configure", params), testConnection ? labels.saved : labels.saved);
  };

  const children = [
    ctx.UI.Row({ verticalAlignment: "center" }, [ctx.UI.Icon({ name: "devices", tint: "primary" }), ctx.UI.Spacer({ width: 8 }), ctx.UI.Text({ text: labels.title, style: "headlineSmall", fontWeight: "bold" })]),
    ctx.UI.Text({ text: labels.subtitle, style: "bodyMedium", color: "onSurfaceVariant" }),
    ctx.UI.Card({ fillMaxWidth: true, containerColor: "surfaceVariant" }, [ctx.UI.Column({ padding: 16, spacing: 8 }, [ctx.UI.Text({ text: labels.status, style: "titleMedium", fontWeight: "semiBold" }), ...statusRows(ctx, labels, statusModel.value)])]),
    ctx.UI.Card({ fillMaxWidth: true }, [ctx.UI.Column({ padding: 16, spacing: 10 }, [
      ctx.UI.TextField({ label: labels.bridgeUrl, value: bridgeUrl.value, onValueChange: bridgeUrl.set, singleLine: true }),
      ctx.UI.TextField({ label: labels.token, placeholder: labels.tokenHint, value: token.value, onValueChange: token.set, singleLine: true, isPassword: true }),
      ctx.UI.TextField({ label: labels.account, value: accountId.value, onValueChange: accountId.set, singleLine: true }),
      ctx.UI.TextField({ label: labels.target, value: target.value, onValueChange: target.set, singleLine: true }),
      ctx.UI.TextField({ label: labels.timeout, value: timeoutMs.value, onValueChange: timeoutMs.set, singleLine: true }),
      ctx.UI.TextField({ label: labels.mode, placeholder: labels.modeHint, value: sendMode.value, onValueChange: sendMode.set, singleLine: true }),
      ctx.UI.Row({ horizontalArrangement: "spaceBetween", verticalAlignment: "center" }, [ctx.UI.Text({ text: labels.enabled, style: "bodyMedium", weight: 1 }), ctx.UI.Switch({ checked: enabled.value, onCheckedChange: enabled.set })]),
      ctx.UI.Row({ horizontalArrangement: "spaceBetween", verticalAlignment: "center" }, [ctx.UI.Text({ text: labels.toolStatus, style: "bodyMedium", weight: 1 }), ctx.UI.Switch({ checked: includeToolStatus.value, onCheckedChange: includeToolStatus.set })]),
      ctx.UI.Button({ text: labels.save, enabled: !busy.value, fillMaxWidth: true, onClick: () => configure(false) }),
      ctx.UI.Button({ text: labels.saveTest, enabled: !busy.value, fillMaxWidth: true, onClick: () => configure(true) }),
      ctx.UI.Button({ text: labels.test, enabled: !busy.value, fillMaxWidth: true, onClick: () => run(async () => { const result = await callTool(ctx, "openclaw_weixin_test_connection", {}); if (result.success) applyStatus(await callTool(ctx, "openclaw_weixin_status", {})); return result; }, labels.saved) })
    ])]),
    ctx.UI.Card({ fillMaxWidth: true }, [ctx.UI.Column({ padding: 16, spacing: 10 }, [
      ctx.UI.Text({ text: labels.sendText, style: "titleMedium", fontWeight: "semiBold" }),
      ctx.UI.TextField({ label: labels.sendText, value: manualText.value, onValueChange: manualText.set, minLines: 3 }),
      ctx.UI.Button({ text: labels.send, enabled: !busy.value, fillMaxWidth: true, onClick: () => run(() => callTool(ctx, "openclaw_weixin_send", { text: manualText.value }), labels.sent) }),
      ctx.UI.Button({ text: labels.resend, enabled: !busy.value, fillMaxWidth: true, onClick: () => run(() => callTool(ctx, "openclaw_weixin_resend_last", {}), labels.sent) }),
      ctx.UI.Button({ text: labels.clearToken, enabled: !busy.value, fillMaxWidth: true, onClick: () => run(() => callTool(ctx, "openclaw_weixin_clear_token", {}), labels.cleared) }),
      ctx.UI.Button({ text: labels.clearRecords, enabled: !busy.value, fillMaxWidth: true, onClick: () => run(() => callTool(ctx, "openclaw_weixin_clear_records", {}), labels.cleared) })
    ])])
  ];
  if (message.value) children.push(ctx.UI.Card({ fillMaxWidth: true, containerColor: "primaryContainer" }, [ctx.UI.Text({ text: message.value, color: "onPrimaryContainer", style: "bodyMedium" })]));
  if (error.value) children.push(ctx.UI.Card({ fillMaxWidth: true, containerColor: "errorContainer" }, [ctx.UI.Text({ text: error.value, color: "onErrorContainer", style: "bodyMedium" })]));

  return ctx.UI.LazyColumn({
    fillMaxSize: true,
    padding: 16,
    spacing: 16,
    onLoad: async () => {
      if (initialized.value) return;
      initialized.set(true);
      await run(async () => {
        const result = await callTool(ctx, "openclaw_weixin_status", {});
        applyStatus(result);
        return result;
      }, labels.saved);
    }
  }, children);
}

module.exports = { default: Screen };
