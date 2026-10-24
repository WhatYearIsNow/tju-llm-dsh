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

## 前置条件

1. **Node.js ≥ 18**（dsh 用户天然满足）
2. **已安装并运行过一次 dsh**（`npm i -g @deepseek-ai/dsh`，跑一次让它生成 `~/.dsh/profiles/`）
3. **天大智算 API Key**（`tk-` 开头，在 [ai.tju.edu.cn](https://ai.tju.edu.cn) 个人设置里生成）

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
