---
title: 天大智算接入 FAQ
created: 2026-01-01
updated: 2026-01-01
tags: [tju-llm, dsh, faq]
status: active
---

# 天大智算接入 DSH — 常见问题

## 基础问题

### Q: 天大智算是什么？
天大智算是天津大学提供的校内大模型服务平台，基于千问系列模型，免费向师生开放，数据不出校。

### Q: 为什么不用环境变量？
DSH 的 pi-ai 插件**不依赖** `OPENAI_BASE_URL` 等环境变量。它使用自己的配置机制：
- `~/.dsh/settings.yaml`：模型配置
- `~/.dsh/.credentials.yaml`：密钥存储

网上有些教程提到环境变量，那些是针对其他框架（如 OpenAI SDK 直接调用），不适用于 DSH。

### Q: 接入后数据安全吗？
安全。天大智算的数据不经过第三方服务器，完全在校内网络中流转。

## 配置问题

### Q: 脚本运行报错"未检测到 DSH"？
确认 DSH 已安装：
```powershell
dsh --version
```
如果未安装，运行：
```powershell
npm install -g @deepseek-ai/dsh
```

### Q: 脚本运行报错"凭据文件写入失败"？
检查 `~/.dsh/` 目录是否有写入权限。Windows 下通常没问题，但如果使用了组策略限制，可能需要管理员权限运行 PowerShell。

### Q: 想更换 API Key 怎么办？
直接编辑 `~/.dsh/.credentials.yaml`，找到 `TJU_LLM_API_KEY:` 那一行，替换后面的值即可。DSH 凭据服务会自动重载，无需重启。

### Q: 配置写错了怎么恢复？
手动编辑 `~/.dsh/settings.yaml`，删除 `tju-llm:` 开头的整个配置块即可。

### Q: 我的 DSH 安装路径不在默认位置？
DSH 的配置文件始终在 `%USERPROFILE%\.dsh\` 下，与安装路径无关。脚本会自动定位。

## 使用问题

### Q: 刷新页面后看不到「天大智算」？
1. 确认 `settings.yaml` 中确实有 `tju-llm` 配置
2. 强制刷新页面（Ctrl + Shift + R）
3. 检查 DSH Web GUI 日志（`~/.dsh/dsh-web.err.log`）是否有报错

### Q: 选中「天大智算」后报错？
运行 `.\verify.ps1` 测试连通性。如果验证通过但 DSH 中报错，可能是：
- 模型参数（contextWindow / maxTokens）与实际不符
- API Key 在凭据文件中格式不正确

### Q: 天大智算的模型名是什么？
配置中使用 `tju-llm` 作为模型 ID。实际后端模型可能因天大智算平台升级而变化（如 qwen3.6-35b-a3b），但配置无需修改。

### Q: 可以同时使用多个模型吗？
可以。DSH 支持多个 provider 并存。配置好天大智算后，你仍然可以使用默认的 DeepSeek 模型或其他已配置的模型。

### Q: 默认模型还是 DeepSeek，怎么切换？
在 DSH Web GUI 的模型选择器中手动切换即可。如果想永久切换，编辑 `~/.dsh/settings.yaml` 中的 `agent-default-model` 段。

## 脚本问题

### Q: 脚本提示"已存在配置"，但我没手动改过？
可能之前运行过脚本或手动配置过。脚本会跳过已有配置，不会重复写入。

### Q: 脚本输入 API Key 时看不到输入？
这是正常的安全设计，防止密码被旁人看到。输入时不显示字符，输完按回车即可。

### Q: 验证脚本返回"连通性测试通过"但 DSH 中无法使用？
验证脚本测试的是 API 端点本身，DSH 使用还依赖配置是否正确。请：
1. 检查 `settings.yaml` 格式是否正确（缩进、冒号后有空格）
2. 检查 `.credentials.yaml` 中 API Key 是否正确
3. 刷新 DSH Web GUI 页面

## 其他

### Q: 这个项目的源码在哪里？
本地路径：`D:\Documents\AI-System\Projects\tju-llm-dsh-setup\`

### Q: 可以修改脚本吗？
可以。脚本是 PowerShell 源码，你可以按需修改。修改后重新运行即可。

### Q: 遇到问题怎么办？
1. 先运行 `.\verify.ps1` 测试连通性
2. 查看本 FAQ
3. 如果问题仍未解决，联系项目维护者
