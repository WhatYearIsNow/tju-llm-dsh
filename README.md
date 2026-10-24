# tju-llm-dsh

[![test](https://github.com/WhatYearIsNow/tju-llm-dsh/actions/workflows/test.yml/badge.svg)](https://github.com/WhatYearIsNow/tju-llm-dsh/actions/workflows/test.yml)

> 一键把**天津大学智算平台**（[ai.tju.edu.cn](https://ai.tju.edu.cn)）接入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）。
>
> 社区工具，非官方，与天津大学及 DeepSeek 无关联。

**English quick start:** `npm i -g tju-llm-dsh && tju-dsh` (or `npx github:WhatYearIsNow/tju-llm-dsh`), then `tju-dsh verify` to test. Requires Node ≥ 18, git (for the npx-github route), and a TJU LLM API key. See [Command reference](#命令一览) below.

## 为什么接入天大智算？

- **免费**：校内大模型服务平台，不花一分钱
- **数据不出校**：请求直接发往校内网关，不经过第三方
- **模型新**：DeepSeek / Qwen 系列最新模型，最高 512K 上下文

## 从零开始：先装 DeepSeek Harness（没用过 dsh？看这里）

dsh 是 DeepSeek 官方的开源 agent 入口（[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)）。从未接触过的话，三步装好：

1. **装 Node.js ≥ 18**（还没有的话）：去 [nodejs.org](https://nodejs.org/) 下载 LTS 版安装，Windows 也可以在 PowerShell 里执行 `winget install OpenJS.NodeJS.LTS`。装完在终端跑 `node --version` 能看到版本号即可。
2. **装 dsh**：

   ```powershell
   npm install -g @deepseek-ai/dsh
   ```

3. **跑一次**：

   ```powershell
   dsh web
   ```

   首次运行会自动初始化 Web profile 并生成 `~/.dsh/` 配置目录（Windows 即 `%USERPROFILE%\.dsh`）；按终端输出的本地地址打开浏览器即可使用（一般是 `http://127.0.0.1:3080`）。确认页面能打开后 Ctrl+C 停掉，回到下面的接入步骤。

> 用 DeepSeek 桌面版的同学：它使用的 `desktop` profile 本工具同样支持，装好本工具直接配置即可。

## 前置条件

1. **Node.js ≥ 18**（dsh 用户天然满足）
2. **已安装并运行过一次 dsh**（没装过？照上一节《从零开始》三步即可）
3. **天大智算 API Key**（`tk-` 开头）——需要先申请开通服务，见[下一节](#如何获取-api-key)

## 如何获取 API Key（两步）

> 依据信息与网络中心推文[《学校智能体广场上新"词元（Token）"API服务》](https://mp.weixin.qq.com/s/iNoT0yAlxM0iv9NjJ15s6Q)（2026-05）。

**第 1 步 · 申请开通（没有这一步就没有额度）**：登录融合门户 → **网上办事大厅** → 检索「**Token**」或「**大模型**」→ 填写《本地大模型免费 Token 服务开通申请表》并提交。**提交后系统自动开通 API 访问权限。**

**第 2 步 · 获取 Key**：登录[**智能体广场**](https://ai.tju.edu.cn)，获取个人 API Key（`tk-` 开头）；同一页面可查询用量、管理密钥。

注意事项：

- 服务仅限**校园网络环境**内访问；
- 密钥须妥善保管，**不得转借、不得发布于公开平台**；
- 词元额度按月统计：每人每月**上行 10 亿、下行 1000 万**；
- 遇到问题可咨询信息与网络中心：**022-27404455**。

## 三步接入

```powershell
# 1. 配置（交互式：选 profile → 粘贴 Key）
npm i -g tju-llm-dsh   # 或者不装：npx github:WhatYearIsNow/tju-llm-dsh
tju-dsh

# 2. 重启 dsh（或刷新 Web GUI 页面），模型选择器出现「天津大学」分组

# 3. 验证连通
tju-dsh verify
```

> `npx github:...` 需要本机装有 git；`npm i -g` 需要包已发布到 npm。也可以 `git clone` 后本地运行：`npm install && node bin/tju-dsh.mjs`。

## 不想敲命令？把链接发给 agent

把本仓库链接贴给任意能执行命令的 agent（WorkBuddy、豆包办公、Claude Code、ZCode…），说一句「帮我接入天大智算」，然后按它的提示：

1. 粘贴你的 API Key（`tk-` 开头）；
2. 告诉它想要哪些模型（不选就全配上）；
3. 完成后重启 dsh 即可。

Agent 侧的完整引导脚本见 [SKILL.md](SKILL.md)——把这个仓库装进技能目录它就会照做。

## 写入了什么？

工具只做两件事，且**只动天津大学相关的内容**，其余配置一律不碰：

| 文件 | 写入内容 |
|---|---|
| `~/.dsh/profiles/<profile>/cordis.patch.yml` | 顶层补丁数组中 `llm-pi-ai` 插件的 `providers.tju` 段（含 5 个模型） |
| `~/.dsh/.credentials.yaml` | `refs:` 下的 `TJU_API_KEY: <你的 Key>` |

每次修改前自动备份（`*.bak-<时间戳>`，保留在原目录）；重复运行安全（幂等）；`remove` 命令可一键撤销。

## 模型一览

| 模型 ID | 用途 | 上下文 | 单次输出上限 | 视觉 | 思考 |
|---|---|---|---|---|---|
| `deepseek-v4.1-flash` | 旗舰·思考（最强） | 512K | 64K | ✅ | ✅ off/low/high/xhigh/max |
| `tju-llm-max` | 旗舰·快答 | 512K | 64K | ✅ | ❌ |
| `tju-llm-coder` | 代码 | 256K | 32K | ❌ 纯文本 | ❌ |
| `tju-llm` | 通用 | 256K | 32K | ✅ | ❌ |
| `tju-llm-stable` | 轻量 | 256K | 32K | ✅ | ❌ |

> 拿不定主意：日常用 `tju-llm`，写代码用 `tju-llm-coder`，要最强推理用 `deepseek-v4.1-flash`。
> 网关限流 **60 次/分钟**；思考模型的思维链计入输出 token，`max_tokens` 别设太小。

## 命令一览

```
tju-dsh [setup]             配置（默认命令；交互选择 profile 和模型，粘贴 Key）
tju-dsh verify [--model id] 连通性测试（默认 tju-llm）
tju-dsh models              查询网关当前提供的模型列表（无需 Key）
tju-dsh remove [--all]      撤销写入的内容（只删天津大学相关部分）

选项：--profile <名>      指定 profile
      --models <id,序号>  只写入指定模型（逗号分隔）；缺省全部写入
      --key <tk-...>      非交互提供 Key（会留在 shell 历史里）
      环境变量 TJU_DSH_KEY  等效 --key，agent/脚本调用推荐用它
      --home <目录>       覆盖用户主目录（测试用）
      --yes, -y           非交互模式
```

## 常见问题

见 [FAQ.md](FAQ.md)。高频三条：

- **连通报「Prompt token limit exceeded」**：账户额度用尽或受限，与请求本身无关，去平台看用量。
- **刷新后看不到「天津大学」**：重启 dsh 进程；仍不行就运行 `tju-dsh models` 确认网关可达。
- **想换 Key**：编辑 `~/.dsh/.credentials.yaml` 里 `refs:` 下的 `TJU_API_KEY` 即可，或 `remove` 后重跑。

## 开发

```powershell
npm test    # 端到端测试：临时目录模拟 ~/.dsh，覆盖全新安装/合并/幂等/卸载
```

欢迎 PR。新增模型只需改 `bin/tju-dsh.mjs` 里的 `MODELS` 表。

## 安全说明

- API Key 只写入本机 `~/.dsh/.credentials.yaml`，不经过任何第三方（包括本工具作者）。
- 本工具不收集、不上传任何数据；网络请求只发往 `ai.tju.edu.cn`。

## License

[MIT](LICENSE)
