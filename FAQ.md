# tju-llm-dsh — 常见问题

## 配置写入

### Q: 我完全没用过 dsh，怎么开始？

先装 DeepSeek Harness（官方开源项目）：

1. 装 Node.js ≥ 18（[nodejs.org](https://nodejs.org/) 下载 LTS，Windows 可 `winget install OpenJS.NodeJS.LTS`）；
2. `npm install -g @deepseek-ai/dsh`；
3. 终端跑 `dsh web`——首次运行自动初始化 profile 并生成 `~/.dsh/` 目录，按输出地址打开浏览器（一般是 `http://127.0.0.1:3080`）确认能访问。

然后回来照 README「三步接入」走即可。用 DeepSeek 桌面版的话，`desktop` profile 同样被本工具支持。

### Q: 工具到底改了哪两个文件？

1. `~/.dsh/profiles/<profile>/cordis.patch.yml` — 顶层补丁数组中加入/合并 `llm-pi-ai` 插件条目，provider 名为 `tju`。
2. `~/.dsh/.credentials.yaml` — `refs:` 段下写入 `TJU_API_KEY: <你的 Key>`。

其他任何内容（其他 provider、其他插件条目、`records` 段、注释、格式）都原样保留。每次写文件前自动备份为 `*.bak-<时间戳>`。

### Q: 出问题怎么回滚？

- 最简单：`npx github:WhatYearIsNow/tju-llm-dsh remove --all`，只删天津大学相关内容。
- 手动：删除 `cordis.patch.yml` 里 `providers:` 下的 `tju:` 段（整个条目是为本工具新建时才需要整条删），以及凭据文件里 `refs:` 下的 `TJU_API_KEY` 行；或直接用同目录的 `*.bak-*` 备份覆盖回去。

### Q: 我在 cordis.patch.yml 里手动加过别的 provider，会被覆盖吗？

不会。工具只替换 `providers.tju` 这一个键，其余 provider（如 openrouter）原样保留；头部注释也会保留。

### Q: 多个 profile 怎么办？

交互模式会列出所有 profile 让你选（回车=全部）；`--profile <名>` 可指定，`remove --all` 撤销全部。

## 连通与使用

### Q: 怎么获取 API Key？

两步（依据[信息与网络中心推文](https://mp.weixin.qq.com/s/iNoT0yAlxM0iv9NjJ15s6Q)）：

1. **申请开通**：登录融合门户 → 网上办事大厅 → 检索「Token」或「大模型」→ 填写《本地大模型免费 Token 服务开通申请表》提交，**系统自动开通 API 访问权限**；
2. **获取 Key**：登录[智能体广场](https://ai.tju.edu.cn)，获取 `tk-` 开头的个人 API Key，同页可查用量、管理密钥。

注意：仅限校园网访问；额度每人每月上行 10 亿 / 下行 1000 万词元；Key 不得转借或公开发布；咨询 022-27404455。

### Q: verify 报「Prompt token limit exceeded」？

这是**账户层面**的额度限制，与请求大小无关（一个 "hi" 也会报）。通常是额度用尽、账户受限，或**服务未开通**（先按上一条走开通流程）。去 [ai.tju.edu.cn](https://ai.tju.edu.cn) 查看用量，或换一个 Key。

### Q: verify 报 429？

网关限流 60 次/分钟，等几秒重试。注意 429 有时也包裹其他错误，看返回体里的 `msg`。

### Q: 重启 dsh 后模型选择器里没有「天津大学」？

1. `tju-dsh models` 确认网关可达（校园网/VPN）；
2. 确认对应 profile 的 `cordis.patch.yml` 里确实有 `providers.tju`；
3. 完全退出 dsh 进程再启动（不只是刷新页面）。

### Q: 模型名大小写有要求吗？

有。**只认小写**，大写会报 `model not found`。

### Q: 思考模型（deepseek-v4.1-flash）回复正文是空的？

思维链计入输出 token。`max_tokens` 别小于 500（本工具配置为 64K，一般不会遇到）。

### Q: 网关新增了模型，怎么加进配置？

改 `bin/tju-dsh.mjs` 里的 `MODELS` 表（id、上下文、输出上限、是否视觉/思考），重跑 setup 即可；或手动编辑 `cordis.patch.yml`。也欢迎发 PR。

### Q: Claude Code 能用天大智算吗？

不能直连——网关只提供 OpenAI 兼容协议，没有 Anthropic 的 `/v1/messages` 接口。需要中间层（如 claude-code-router / LiteLLM）转换，不在本工具范围内。

## 其他

### Q: Windows / macOS / Linux 都支持吗？

支持。本工具是零平台假设的 Node CLI，只要 Node ≥ 18 且 dsh 正常运行即可。

### Q: 为什么要用 Node 而不是 PowerShell/bash 脚本？

dsh 用户必然有 Node；YAML 合并用手写文本操作很容易弄坏用户配置，交给 `js-yaml` 解析更可靠，且一份代码跨三平台。

### Q: 会把我的 Key 传到别处吗？

不会。Key 只写入本机凭据文件；工具的全部网络请求只发往 `ai.tju.edu.cn`。源码可审计（就一个文件）。
