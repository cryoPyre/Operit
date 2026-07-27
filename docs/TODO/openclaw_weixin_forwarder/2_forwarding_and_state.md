# 转发与状态

## 转发判定

1. 插件配置 `enabled` 为 true。
2. `send_mode` 为 `assistant_reply`。
3. 事件名为 `message_persisted`。
4. 消息来源为 `ai`，内容非空，`completedAt` 为正数。

工具调用、摘要、系统消息和 user 消息不进入 Bridge。

## 幂等

自动转发 request id 固定为 `operit-<chatId>-<timestamp>`。发送成功记录会在本地保留，重复 Hook 只返回已发送状态。网络失败记录完整请求文本用于设置页重发，但日志只输出长度和脱敏标识。

## 错误分类

Bridge 响应会区分认证失败、微信 channel 未登录、target 无效、超时、HTTP 错误和响应格式错误。响应中已经出现 provider message id 时按已有发送处理，不再次自动发送。

[DONE]
