---
name: tju-llm-dsh
description: >
  把天津大学智算平台（ai.tju.edu.cn，OpenAI 兼容网关）接入 DeepSeek Harness（dsh）。
  当用户想要「接入天大智算」「配置天大模型到 dsh」「tju-llm 连不上/换 Key/卸载」时使用本技能。
  底层是本仓库 bin/tju-dsh.mjs CLI；本技能只负责指导 agent 正确、安全地调用它。
---

# tju-llm-dsh — 天大智算接入 dsh

帮助用户把天大智算网关接入 DeepSeek Harness。CLI 位于本技能目录旁的 `bin/tju-dsh.mjs`
（即 `<SKILL_DIR>/bin/tju-dsh.mjs`，若用户已 `npm i -g tju-llm-dsh` 则直接用 `tju-dsh` 命令）。

## 三要素（写给 agent 的背景知识）

- Base URL：`https://ai.tju.edu.cn/api/v3`（OpenAI 兼容）
- Key：`tk-` 开头，用户在 https://ai.tju.edu.cn 个人设置生成
- 模型（只认小写）：`deepseek-v4.1-flash`（旗舰·思考）、`tju-llm-max`（快答）、
  `tju-llm-coder`（代码）、`tju-llm`（通用）、`tju-llm-stable`（轻量）

## 操作流程

### 首次接入

1. 确认前置：Node ≥ 18；`~/.dsh/profiles/` 存在（用户至少跑过一次 dsh）。
2. 向用户确认：**要配置哪个 profile**（`tju-dsh` 不带参数会交互询问，agent 调用时请用
   `--profile <名>` 明确指定）、**API Key 由用户提供**（不要猜测、不要从别处复制）。
3. 运行：
   ```bash
   node <SKILL_DIR>/bin/tju-dsh.mjs setup --profile <名> --key <tk-...>
   ```
   工具会自动备份原文件（`*.bak-<时间戳>`）、幂等可重跑、只动天津大学相关内容。
4. 验证：
   ```bash
   node <SKILL_DIR>/bin/tju-dsh.mjs verify --model tju-llm
   ```
5. 提醒用户重启 dsh 进程（不只是刷新页面），模型选择器出现「天津大学」分组。

### 诊断

- `tju-dsh models`：网关可达性与模型列表（无需 Key）。
- `tju-dsh verify --model <id>`：真实请求测试。
- 常见报错：
  - `Prompt token limit exceeded`（HTTP 429）→ **账户额度用尽/受限**，与请求无关，让用户上平台查用量；
  - 纯 429 → 限流 60 次/分钟，稍等重试；
  - 401/403 → Key 无效，`remove` 后重配；
  - `model not found` → 模型名大小写错误或已下线。

### 换 Key / 卸载

- 换 Key：直接编辑 `~/.dsh/.credentials.yaml` 里 `refs:` 下的 `TJU_API_KEY` 行，或
  `remove` 后重新 `setup`。
- 卸载：`node <SKILL_DIR>/bin/tju-dsh.mjs remove --profile <名>`（或 `--all`）；
  只删天津大学相关内容，其他配置不动。

## 安全边界（不可协商）

1. **写配置前必须让用户确认 profile 与 Key 来源**；`cordis.patch.yml` 与凭据文件属于用户真实环境。
2. **Key 不回显、不写入任何日志或仓库文件**；`--key` 传参时注意 shell 历史里也会留下记录，
   敏感环境下建议让用户改用交互输入（不带 `--key` 运行 setup）。
3. 网络请求只发往 `ai.tju.edu.cn`，不得把 Key 或用户内容发往其他服务。
4. 本工具非官方，出问题优先建议 `remove` 回滚（备份文件保留在原目录）。
