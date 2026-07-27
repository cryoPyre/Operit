# OpenClaw 微信转发 ToolPkg

这是 Operit 的独立 ToolPkg 示例，V0.1 只实现文本单向转发：

`Operit AI 完成消息 -> ToolPkg -> OpenClaw Bridge -> openclaw-weixin`

## 安装前提

需要在 OpenClaw 所在设备部署窄权限 Bridge，并提供：

- `GET /health`
- `POST /v1/weixin/send`

Bridge token 应独立于 OpenClaw Gateway 管理员 token。`target` 必须是 `openclaw-weixin` 实际识别的 peer id，不能填写昵称或手机号。

## 使用

1. 安装并启用 ToolPkg 和 `openclaw_weixin` 子包
2. 打开工具箱中的“OpenClaw 微信转发”
3. 填写 Bridge URL、Bridge token、account id 和微信 peer id
4. 点击“保存并测试”确认 Bridge 和微信通道状态
5. 需要自动发送时打开自动转发，并将发送模式设置为 `assistant_reply`

插件默认关闭自动转发。手动发送不依赖自动转发开关，但仍使用配置中的固定 target。

## 工具

- `openclaw_weixin_configure`
- `openclaw_weixin_test_connection`
- `openclaw_weixin_send`
- `openclaw_weixin_status`
- `openclaw_weixin_resend_last`
- `openclaw_weixin_clear_token`
- `openclaw_weixin_clear_records`

## 安全边界

- 不把 OpenClaw Gateway token 放进 ToolPkg
- 日志不写 token、完整 peer id 或完整消息内容
- Hook 只处理 `sender == "ai"` 且 `completedAt > 0` 的 `message_persisted`
- 不支持从聊天内容动态指定微信目标
- 发送记录存放在 ToolPkg 私有配置目录，失败记录用于设置页手动重发
