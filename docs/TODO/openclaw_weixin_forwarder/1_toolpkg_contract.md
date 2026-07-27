# ToolPkg 合同

## 新实现

- `examples/openclaw_weixin/manifest.json` 使用 `com.operit.openclaw_weixin_bundle`，默认关闭。
- `main.js` 注册设置页、应用生命周期 Hook 和聊天消息 Hook。
- `packages/openclaw_weixin.js` 通过 `METADATA` 暴露配置、测试、发送、状态和重发工具。
- `ui/openclaw_weixin_settings/index.ui.js` 只通过公开工具调用主运行时，不读取 Bridge token。

## 运行时边界

- 配置和发送记录写入 `ToolPkg.getConfigDir()` 对应目录。
- 网络请求集中在 `shared/bridge_client.js`，统一使用 Bearer token 和超时。
- `message_persisted` 是通知事件，Hook 不修改聊天消息，也不重新触发对话。

## 兼容性

这是新增 ToolPkg，不替换已发布用户接口，不需要迁移旧版本配置。

[DONE]
