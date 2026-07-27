"use strict";

const settingsUi = require("./ui/openclaw_weixin_settings/index.ui.js");
const forwarder = require("./shared/message_forwarder.js");
const { logEvent } = require("./shared/common.js");

function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "openclaw_weixin_settings",
    runtime: "compose_dsl",
    screen: settingsUi.default || settingsUi,
    params: {},
    title: {
      zh: "OpenClaw 微信转发",
      en: "OpenClaw Weixin Forwarder"
    }
  });
  ToolPkg.registerAppLifecycleHook({
    id: "openclaw_weixin_app_create",
    event: "application_on_create",
    function: forwarder.onApplicationLifecycle
  });
  ToolPkg.registerAppLifecycleHook({
    id: "openclaw_weixin_app_foreground",
    event: "application_on_foreground",
    function: forwarder.onApplicationLifecycle
  });
  ToolPkg.registerChatMessageHook({
    id: "openclaw_weixin_message_persisted",
    // Hook 只通知转发器，不把 Bridge 响应写回当前聊天，避免消息循环。
    function: forwarder.onMessagePersisted
  });
  logEvent("register", "ready", {});
  return true;
}

exports.registerToolPkg = registerToolPkg;
