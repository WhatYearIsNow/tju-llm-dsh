---
name: tju-llm-dsh
description: >
  把天津大学智算平台（ai.tju.edu.cn，OpenAI 兼容网关，免费、数据不出校）接入 DeepSeek Harness（dsh）。
  当用户贴出本仓库/skill 链接并要求「接入天大智算」「配置天大模型到 dsh」，
  或 tju-llm 连不上、换 Key、卸载时，按本技能的引导脚本操作。
  目标用户是小白：全程由 agent 提问并执行，用户只需回答和粘贴 Key。
---

# tju-llm-dsh — 天大智算接入 dsh（agent 引导脚本）

用户可能是小白，把仓库链接丢给你就指望配好。你要做的是：**按下面的对话脚本提问 → 执行 CLI → 汇报结果**。CLI 位于本技能目录的 `bin/tju-dsh.mjs`（`<SKILL_DIR>/bin/tju-dsh.mjs`）。

## 第 0 步：安装（只需一次）

```bash
# 方式 A（推荐，需 npm 包已发布）：
npm install -g tju-llm-dsh        # 之后直接用 tju-dsh 命令

# 方式 B（从本仓库装为技能/工具）：
git clone https://github.com/WhatYearIsNow/tju-llm-dsh <安装目录>
cd <安装目录> && npm install --omit=dev
# 之后用 node bin/tju-dsh.mjs 代替 tju-dsh
```

前置检查：`node --version`（需 ≥ 18）；目录 `~/.dsh/profiles/` 是否存在
（Windows 为 `%USERPROFILE%\.dsh\profiles`）。不存在就先让用户安装并运行一次
`dsh`（`npm i -g @deepseek-ai/dsh`），没有 dsh 就没有配置目标。

## 对话脚本（按顺序，不要跳步）

### 1. 问用户要 Key（唯一必须问的）

先确认用户**是否已开通服务**——Key 不是上来就能生成的，依据信息与网络中心推文（[原文](https://mp.weixin.qq.com/s/iNoT0yAlxM0iv9NjJ15s6Q)）需要两步：

1. **申请开通**：融合门户 → **网上办事大厅** → 检索「Token」或「大模型」→ 填《本地大模型免费 Token 服务开通申请表》提交，**系统自动开通**；
2. **获取 Key**：登录[**智能体广场**](https://ai.tju.edu.cn)获取 `tk-` 开头的个人 API Key（同页可查用量）。

> 话术：「天大智算的 Key 需要先开通服务：登录融合门户→网上办事大厅→搜『Token』提交开通申请（自动生效），然后到 ai.tju.edu.cn（智能体广场）拿你的 tk- 开头 Key 发给我。」

用户没有 Key → 按上面话术引导，等拿到再继续。额度规则（可顺带告知）：每人每月上行 10 亿 / 下行 1000 万词元；仅限校园网访问；咨询 022-27404455。

### 2. profile（多数情况不用问）

先自己探测：`tju-dsh models` 能跑通说明网关可达（顺便展示模型表给用户看）。
配置时若用户只有一个 dsh profile，直接配；多个或不确定时问一句
「你平时用 dsh 的哪个 profile？」，拿不准就用不带 `--profile` 的交互模式让用户自己选。

### 3. 模型（让用户选，但不强制）

把模型表给用户看，问「想要哪些？回车/不选就全配上，以后在 dsh 里随时切换」：

| 模型 ID | 用途 | 上下文 | 视觉 | 思考 |
|---|---|---|---|---|
| `deepseek-v4.1-flash` | 旗舰·思考（最强） | 512K | ✅ | ✅ |
| `tju-llm-max` | 旗舰·快答 | 512K | ✅ | ❌ |
| `tju-llm-coder` | 代码 | 256K | ❌ | ❌ |
| `tju-llm` | 通用 | 256K | ✅ | ❌ |
| `tju-llm-stable` | 轻量 | 256K | ✅ | ❌ |

用户指定了 → 用 `--models <id,-id>`；没指定/全要 → 不传该参数（默认全部写入）。

### 4. 执行配置

```bash
# 推荐：Key 走环境变量，避免留在 shell 历史里
TJU_DSH_KEY=<用户的tk-key> tju-dsh setup --profile <名> [--models tju-llm,tju-llm-coder]
```

工具自动：备份原文件（`*.bak-<时间戳>`）、只动天津大学相关内容、幂等可重跑。
**不要**用 `--key` 传 Key，除非环境变量方式不可用。

### 5. 验证并收尾

```bash
tju-dsh verify --model <用户最关心的那个模型，缺省 tju-llm>
```

成功 → 告诉用户「重启 dsh 进程（不是只刷新页面），模型选择器里找『天津大学』分组」。
失败 → 按下面的诊断表给用户解释，不要拿话术搪塞。

## 诊断表（verify/models 报错时对照）

| 现象 | 原因与话术 |
|---|---|
| HTTP 429 且 body 含 `Prompt token limit exceeded` | **账户额度用尽/受限，或服务根本没开通**（要先去网上办事大厅申请）。让用户上 ai.tju.edu.cn 查用量 |
| 纯 429 | 限流 60 次/分钟，等几秒重试 |
| 401/403 | Key 无效或过期 → `remove` 后用新 Key 重配 |
| `model not found` | 模型名大小写错了（只认小写）或已下线 → `tju-dsh models` 看列表 |
| `tju-dsh models` 都连不上 | 校园网/VPN 问题，让用户浏览器打开 https://ai.tju.edu.cn 试试 |

换 Key：编辑 `~/.dsh/.credentials.yaml` 里 `refs:` 下的 `TJU_API_KEY` 行，或
`remove` 后重新 setup。卸载：`tju-dsh remove --profile <名>`（或 `--all`）。

## 安全边界（不可协商）

1. **执行 setup 前把将要做的改动告诉用户**（写哪两个文件、只动天津大学部分），得到同意再跑。
2. **Key 只通过环境变量或交互输入传递**，不写进日志、不存进任何仓库文件、不回显。
3. 网络请求只发往 `ai.tju.edu.cn`；绝不把 Key 或用户内容发往其他服务。
4. 本工具非官方；出问题先建议 `tju-dsh remove` 回滚（备份保留在原目录）。
5. dsh 不在本机（比如用户想配服务器上的 dsh）时不要瞎猜路径——让用户在目标机器上操作。
