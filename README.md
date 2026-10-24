---
title: 天大智算接入 DSH 指南
created: 2026-01-01
updated: 2026-01-01
tags: [tju-llm, dsh, setup, guide]
status: active
---

# 天大智算接入 DeepSeek Harness 指南

> 让天津大学同学一键把校内免费模型（tju-llm）接入 DeepSeek Harness。

## 为什么接入？

- **免费**：校内模型免费使用，不花一分钱
- **隐私好**：数据不出校，不经过第三方服务器
- **模型新**：天大部署的是最新版的千问系列模型

## 前置条件

1. 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（[安装教程](https://docs.deepseek.ai/)）
2. 拥有天大智算平台的 API Key（[获取地址](https://ai.tju.edu.cn)）

## 三步接入

### 第一步：运行配置脚本

打开 PowerShell，运行以下命令（一行搞定）：

```powershell
cd D:\Documents\AI-System\Projects\tju-llm-dsh-setup
.\setup.ps1
```

脚本会自动：
- 检测 DSH 是否安装
- 创建/更新配置文件
- 提示你输入 API Key

### 第二步：输入 API Key

脚本运行后会提示你输入天大智算的 API Key。输入时**不会显示**，输完按回车即可。

> **没有 Key？** 去 [天大智算平台](https://ai.tju.edu.cn) 注册并获取。

### 第三步：验证连通性

运行验证脚本：

```powershell
.\verify.ps1
```

看到 `连通性测试通过` 就成功了！

## 在 DSH 中使用

1. 打开 DSH Web GUI（`http://127.0.0.1:3080`）
2. 刷新页面
3. 在模型选择器中找到「天大智算」
4. 选中即可使用

## 常见问题

- **脚本找不到 DSH？** 确认 DSH 已安装（`dsh --version`）
- **连通性测试失败？** 检查 API Key 是否正确，或查看 [FAQ](FAQ.md)
- **想切换回默认模型？** 在 DSH 模型选择器中切回即可

## 技术说明

- 配置位置：`~/.dsh/settings.yaml`（模型配置）和 `~/.dsh/.credentials.yaml`（密钥存储）
- 协议：OpenAI 兼容（`openai-completions`）
- 端点：`https://ai.tju.edu.cn/api/v3`
- 模型：`tju-llm`（实际后端为千问系列）

> 本项目仅供天津大学师生使用，请勿将 API Key 分享给他人。
