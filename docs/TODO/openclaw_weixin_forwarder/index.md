---
title: OpenClaw 微信转发 ToolPkg
status: completed
---

# OpenClaw 微信转发 ToolPkg

## 原本状况

仓库已有 ToolPkg 格式、ToolPkg UI、应用生命周期 Hook 和 `message_persisted` Hook，但没有把 Operit AI 完成消息发送到 OpenClaw Bridge 的插件实现。

## 本次意图

新增独立的 `examples/openclaw_weixin` ToolPkg，按实现文档完成 V0.1 单向文本链路：

`Operit AI 完成回复 -> ToolPkg Hook -> HTTPS Bridge -> OpenClaw 微信通道`

OpenClaw Gateway 和微信 iLink 协议不进入 Android 插件。插件只依赖 Bridge 的 `/health` 与 `/v1/weixin/send` 公共接口。

## 作用域

- 配置 Bridge 地址、Bridge token、微信 account、peer target、超时和发送模式
- 默认关闭自动转发
- 健康检查、手动文本发送、状态查看、最后一条失败消息重发
- 仅转发 `sender == "ai"` 且 `completedAt > 0` 的持久化消息
- 通过 `chatId + timestamp` 形成稳定 request id，保存发送记录并避免同一消息重复发送
- UI 使用中文和英文文案
- 记录 ToolPkg 源码、可直接安装的 `manifest.json` 和 JavaScript 入口

## 不包含

- 微信入站消息
- 图片、文件和群聊
- Operit 主应用协议修改
- OpenClaw 私有模块导入
- 聊天内容动态指定目标

## 验收边界

- `manifest.json` 指向存在的主入口和子包入口
- 未启用自动转发时消息 Hook 不发起 Bridge 请求
- Hook 忽略 user、summary、system、工具状态和未完成消息
- 成功记录 provider message id；失败记录可见错误并允许手动重发
- token、完整 peer id 和完整消息内容不进入日志

[DONE]
