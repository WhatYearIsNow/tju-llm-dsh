#!/usr/bin/env node
/**
 * tju-dsh — 把天津大学智算平台 (ai.tju.edu.cn) 接入 DeepSeek Harness (dsh)。
 *
 * 社区工具，与天津大学及 DeepSeek 无关联。
 *
 * 用法：
 *   tju-dsh            配置（默认命令）
 *   tju-dsh verify     连通性测试
 *   tju-dsh models     查看网关当前可用的模型
 *   tju-dsh remove     移除本工具写入的配置
 *
 * 通用选项：
 *   --profile <name>   指定 dsh profile（默认交互选择）
 *   --key <tk-...>     直接提供 API Key（默认交互输入）
 *   --model <id>       verify 使用的模型（默认 tju-llm）
 *   --home <dir>       覆盖用户主目录（测试用）
 *   --yes, -y          非交互模式：能自动决定的都不再询问
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// 常量：网关信息与模型表（来自实测，2026-10）
// ---------------------------------------------------------------------------

const BASE_URL = 'https://ai.tju.edu.cn/api/v3';
const ENV_KEY = 'TJU_API_KEY';
const PLUGIN_ID = 'llm-pi-ai';
const PLUGIN_NAME = '@deepseek-ai/dsh-llm-pi-ai';
const PROVIDER_ID = 'tju';

const PATCH_HEADER = [
  '# Your patch layer for this dsh profile, applied after every bundle layer:',
  '# a top-level YAML array of loader patch entries (id-targeted config',
  '# overrides, disables, and insert lists; `!!js` expressions allowed).',
  '# 「天津大学」段由 tju-dsh 工具写入：tju-dsh remove 可整体移除。',
];

// 「off」必须带引号，否则 YAML 1.1 会解析成布尔 false —— js-yaml dump 时会自动处理，
// 这里仍然用字符串写出，由 dump 决定呈现形式。
const MODELS = [
  {
    id: 'deepseek-v4.1-flash', name: 'tju-llm-think（旗舰·思考）',
    contextWindow: 524288, maxTokens: 65536, input: ['text', 'image'],
    reasoningEfforts: { off: 'none', low: 'low', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  {
    id: 'tju-llm-max', name: 'tju-llm-max（旗舰·快答）',
    contextWindow: 524288, maxTokens: 65536, input: ['text', 'image'],
    reasoningEfforts: false,
  },
  {
    id: 'tju-llm-coder', name: 'tju-llm-coder（代码）',
    contextWindow: 262144, maxTokens: 32768, input: ['text'],
    reasoningEfforts: false,
  },
  {
    id: 'tju-llm', name: 'tju-llm（通用）',
    contextWindow: 262144, maxTokens: 32768, input: ['text', 'image'],
    reasoningEfforts: false,
  },
  {
    id: 'tju-llm-stable', name: 'tju-llm-stable（轻量）',
    contextWindow: 262144, maxTokens: 32768, input: ['text', 'image'],
    reasoningEfforts: false,
  },
];

const DEFAULT_VERIFY_MODEL = 'tju-llm';

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  cyan: (s) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
};

const ok = (msg) => console.log(c.green('✔ ' + msg));
const warn = (msg) => console.log(c.yellow('⚠ ' + msg));
const fail = (msg) => console.log(c.red('✖ ' + msg));
const info = (msg) => console.log(c.dim('  · ' + msg));

function die(msg, code = 1) {
  fail(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--home') opts.home = argv[++i];
    else if (a === '--profile') opts.profile = argv[++i];
    else if (a === '--key') opts.key = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--all') opts.all = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) die(`未知选项：${a}（--help 查看用法）`);
    else opts._.push(a);
  }
  return opts;
}

function backupFile(file) {
  if (!existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const bak = `${file}.bak-${stamp}`;
  writeFileSync(bak, readFileSync(file));
  return bak;
}

/** 备份文件里的敏感内容不进 git（.gitignore 已覆盖 *.bak-*），留在原地以便手动回滚。 */
function restoreHint(bak) {
  return bak ? info(`原文件已备份到 ${bak}，出问题可手动覆盖回去`) : null;
}

// ---------------------------------------------------------------------------
// 交互输入
// ---------------------------------------------------------------------------

async function prompt(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) die('当前不是终端，无法交互输入。请用 --profile / --key 等选项以非交互模式运行。');
  process.stderr.write(question);
  if (hidden) {
    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    await new Promise((resolveLoop) => {
      const onData = (ch) => {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write('\n');
          resolveLoop();
        } else if (ch === '\u0003') { // Ctrl+C
          process.stderr.write('\n');
          process.exit(130);
        } else if (ch === '\u007f' || ch === '\b') {
          chars.pop();
        } else {
          chars.push(ch);
        }
      };
      process.stdin.on('data', onData);
    });
    return chars.join('').trim();
  }
  const rl = (await import('node:readline/promises')).createInterface({ input: process.stdin, output: process.stderr });
  const answer = (await rl.question('')).trim();
  rl.close();
  return answer;
}

// ---------------------------------------------------------------------------
// dsh 目录与 profile
// ---------------------------------------------------------------------------

function dshPaths(opts) {
  const home = opts.home ? resolve(opts.home) : (process.env.USERPROFILE || homedir());
  const dshDir = join(home, '.dsh');
  return {
    home, dshDir,
    profilesDir: join(dshDir, 'profiles'),
    credsFile: join(dshDir, '.credentials.yaml'),
  };
}

function listProfiles({ profilesDir }) {
  if (!existsSync(profilesDir)) return [];
  return readdirSync(profilesDir).filter((n) => statSync(join(profilesDir, n)).isDirectory());
}

async function pickProfile(opts, p) {
  const profiles = listProfiles(p);
  if (opts.profile) {
    if (!profiles.includes(opts.profile)) {
      die(`profile「${opts.profile}」不存在。本机可用：${profiles.join(', ') || '（无）'}。先运行一次 dsh 让它生成 profile。`);
    }
    return opts.profile;
  }
  if (profiles.length === 0) {
    die('没有找到任何 dsh profile。请先安装并运行一次 dsh（它会生成 ~/.dsh/profiles/），再运行本工具。');
  }
  if (profiles.length === 1) {
    info(`使用唯一的 profile：${profiles[0]}`);
    return profiles[0];
  }
  console.log('本机有多个 dsh profile：');
  profiles.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  const answer = await prompt(`要配置哪一个？[1-${profiles.length}]（回车=全部，输入 a=全部）: `);
  if (answer === '' || answer.toLowerCase() === 'a' || answer.toLowerCase() === 'all') return 'ALL';
  const idx = parseInt(answer, 10);
  if (!(idx >= 1 && idx <= profiles.length)) die(`无效选择：${answer}`);
  return profiles[idx - 1];
}

// ---------------------------------------------------------------------------
// cordis.patch.yml 读写
// ---------------------------------------------------------------------------

function patchFileFor(p, profile) {
  return join(p.profilesDir, profile, 'cordis.patch.yml');
}

function buildPatchEntry() {
  return {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    config: {
      providers: {
        [PROVIDER_ID]: {
          apiKeyEnv: ENV_KEY,
          api: 'openai-completions',
          baseURL: BASE_URL,
          displayName: '天津大学',
          defaultContextWindow: 262144,
          defaultMaxTokens: 32768,
          compat: { thinkingFormat: 'openai' },
          models: MODELS.map((m) => ({ ...m })),
        },
      },
    },
  };
}

/** 把顶层条目数组写回文件，保留原有头部注释；文件不存在时写默认头部。 */
function writePatchFile(file, doc, existed) {
  let header = PATCH_HEADER;
  if (existed) {
    const raw = readFileSync(file, 'utf8');
    const lines = raw.split(/\r?\n/);
    const lead = [];
    for (const line of lines) {
      if (line.startsWith('#')) lead.push(line);
      else if (line.trim() === '' && lead.length === 0) continue;
      else break;
    }
    if (lead.length > 0) header = lead;
  }
  const body = yaml.dump(doc, { lineWidth: 0, noRefs: true });
  writeFileSync(file, header.join('\n') + '\n' + body, 'utf8');
}

function readPatchDoc(file) {
  if (!existsSync(file)) return { doc: null, existed: false };
  const raw = readFileSync(file, 'utf8');
  if (raw.trim() === '') return { doc: [], existed: true };
  let doc;
  try {
    doc = yaml.load(raw);
  } catch (e) {
    die(`cordis.patch.yml 解析失败（${e.message.split('\n')[0]}）。\n  请先修复该文件（或从最近的 *.bak-* 备份恢复）后再运行本工具。`);
  }
  if (doc !== null && !Array.isArray(doc)) {
    die('cordis.patch.yml 顶层不是 YAML 数组，不符合 dsh patch 格式，拒绝修改。');
  }
  return { doc: doc || [], existed: true };
}

/** 返回 {action, file}，action ∈ created | added-entry | replaced-provider */
function upsertPatchEntry(file, entry) {
  const { doc, existed } = readPatchDoc(file);
  let action;
  if (!existed) {
    action = 'created';
  } else {
    const idx = doc.findIndex((e) => e && e.id === PLUGIN_ID);
    if (idx === -1) {
      doc.push(entry);
      action = 'added-entry';
    } else {
      const old = doc[idx];
      doc[idx] = {
        ...old,
        name: old.name || entry.name,
        config: { ...(old.config || {}), providers: { ...(old.config?.providers || {}), [PROVIDER_ID]: entry.config.providers[PROVIDER_ID] } },
      };
      action = 'replaced-provider';
    }
  }
  backupFile(file);
  writePatchFile(file, action === 'created' ? [entry] : doc, existed);
  return { action };
}

/** 从 patch 文件中移除 tju provider；若插件条目因此变空则连条目一起移除。 */
function removePatchProvider(file) {
  if (!existsSync(file)) return { action: 'absent' };
  const { doc, existed } = readPatchDoc(file);
  const idx = doc.findIndex((e) => e && e.id === PLUGIN_ID);
  if (idx === -1) return { action: 'absent' };
  const entry = doc[idx];
  const providers = entry?.config?.providers || {};
  if (!(PROVIDER_ID in providers)) return { action: 'absent' };
  delete providers[PROVIDER_ID];
  if (Object.keys(providers).length === 0) {
    const rest = entry.config && Object.keys(entry.config).length > 0;
    if (!rest) doc.splice(idx, 1);
    else delete entry.config.providers;
  }
  backupFile(file);
  writePatchFile(file, doc, existed);
  return { action: 'removed' };
}

// ---------------------------------------------------------------------------
// .credentials.yaml 读写（按行编辑，保留其余内容原样）
// ---------------------------------------------------------------------------

function keyLineRegex() {
  return new RegExp(`^(\\s*)${ENV_KEY}\\s*:\\s*(\\S.*)\\s*$`, 'm');
}

function readCredsKey(credsFile) {
  if (!existsSync(credsFile)) return null;
  const m = readFileSync(credsFile, 'utf8').match(keyLineRegex());
  return m ? m[2].trim() : null;
}

/** 在 refs: 段下写入 ENV_NAME（不存在 refs: 则在文件末尾追加）。 */
function writeCredsKey(credsFile, key) {
  let raw = '';
  if (existsSync(credsFile)) raw = readFileSync(credsFile, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.length ? raw.replace(/\r\n/g, '\n').split('\n') : [];

  const keyRe = keyLineRegex();
  const refsi = lines.findIndex((l) => /^refs:\s*$/.test(l));
  let out;

  if (refsi === -1) {
    // 无 refs 段：末尾追加
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    out = [...lines, 'refs:', `  ${ENV_KEY}: ${key}`, ''];
  } else {
    // 找 refs 段的范围：直到下一条顶层级键（缩进为 0 的非空行）
    let childIndent = null;
    let keyIdx = -1;
    for (let i = refsi + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      if (indent === 0) break; // 离开 refs 段
      if (childIndent === null) childIndent = indent;
      const m = line.match(keyRe);
      if (m) { keyIdx = i; break; }
    }
    const indentStr = childIndent !== null ? ' '.repeat(childIndent) : '  ';
    if (keyIdx >= 0) {
      lines[keyIdx] = `${indentStr}${ENV_KEY}: ${key}`;
      out = lines;
    } else {
      lines.splice(refsi + 1, 0, `${indentStr}${ENV_KEY}: ${key}`);
      out = lines;
    }
  }

  if (raw.length) backupFile(credsFile);
  mkdirSync(join(credsFile, '..'), { recursive: true });
  writeFileSync(credsFile, out.join(eol), 'utf8');
}

function removeCredsKey(credsFile) {
  if (!existsSync(credsFile)) return false;
  const raw = readFileSync(credsFile, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const refsi = lines.findIndex((l) => /^refs:\s*$/.test(l));
  if (refsi === -1) return false;
  const keyRe = keyLineRegex();
  let removed = false;
  for (let i = refsi + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.length - line.trimStart().length === 0) break;
    if (keyRe.test(line)) { lines.splice(i, 1); removed = true; break; }
  }
  if (removed) {
    backupFile(credsFile);
    writeFileSync(credsFile, lines.join(eol), 'utf8');
  }
  return removed;
}

// ---------------------------------------------------------------------------
// 网关请求
// ---------------------------------------------------------------------------

async function fetchModels() {
  const res = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data?.data || []).map((m) => m.id);
}

async function chatOnce(model, key) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: '请只回复两个字：连通' }],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const latency = ((Date.now() - started) / 1000).toFixed(1);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText}${text ? `\n${text.slice(0, 500)}` : ''}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  const data = await res.json();
  return { reply: data?.choices?.[0]?.message?.content ?? '', remoteModel: data?.model ?? model, latency };
}

// ---------------------------------------------------------------------------
// 命令实现
// ---------------------------------------------------------------------------

async function cmdSetup(opts) {
  const p = dshPaths(opts);
  console.log(c.cyan('\n== tju-dsh：把天津大学智算平台接入 DeepSeek Harness ==\n'));

  if (!existsSync(p.dshDir)) {
    die(`未找到 ${p.dshDir}。请先安装并运行一次 dsh（npm i -g @deepseek-ai/dsh 后执行 dsh），再运行本工具。`);
  }

  const profile = await pickProfile(opts, p);
  const profiles = profile === 'ALL' ? listProfiles(p) : [profile];

  // 网关模型探测（仅用于汇报，失败不阻塞）
  let liveModels = null;
  try {
    liveModels = await fetchModels();
    info(`网关可达，当前提供 ${liveModels.length} 个模型：${liveModels.join(', ')}`);
    for (const m of MODELS) {
      if (!liveModels.includes(m.id)) info(`配置表中的 ${m.id} 不在 /models 列表里（该列表可能不全，以实际调用为准）`);
    }
  } catch (e) {
    warn(`暂时探测不到网关模型列表（${e.message}），跳过校验继续配置。`);
  }

  for (const prof of profiles) {
    const file = patchFileFor(p, prof);
    const { action } = upsertPatchEntry(file, buildPatchEntry());
    const desc = { created: '已创建并写入', 'added-entry': '已追加插件条目', 'replaced-provider': '已更新已有的天津大学配置' }[action];
    ok(`[${prof}] cordis.patch.yml ${desc}` + (action === 'replaced-provider' ? `（仅覆盖 providers.${PROVIDER_ID}，其他内容保留）` : ''));
  }

  // API Key
  const existingKey = readCredsKey(p.credsFile);
  let key = opts.key || null;
  if (!key && existingKey) {
    ok(`已存在 ${ENV_KEY}，保持不变（如需更换：tju-dsh remove 后重新配置，或直接编辑 ${p.credsFile}）`);
  } else if (!key) {
    console.log('');
    console.log(`请粘贴天大智算的 API Key（tk- 开头，在 https://ai.tju.edu.cn 个人设置里生成；输入不回显）`);
    key = await prompt('API Key: ', { hidden: true });
    if (!key) die('API Key 不能为空。');
  }
  if (key && key !== existingKey) {
    writeCredsKey(p.credsFile, key);
    ok(`${ENV_KEY} 已写入 ${p.credsFile}`);
  }

  console.log('');
  console.log(c.cyan('完成！下一步：'));
  console.log('  1. 重启 dsh（或刷新 Web GUI 页面）');
  console.log('  2. 模型选择器里会出现「天津大学」分组，含 5 个模型：');
  for (const m of MODELS) console.log(`     · ${m.name}`);
  console.log('  3. 运行 tju-dsh verify 做连通性测试');
  console.log('');
  info('拿不定主意选哪个模型？日常用 tju-llm，写代码用 tju-llm-coder，要最强推理用 deepseek-v4.1-flash。');
}

async function cmdVerify(opts) {
  const p = dshPaths(opts);
  const key = opts.key || readCredsKey(p.credsFile);
  if (!key) die(`未找到 ${ENV_KEY}。请先运行 tju-dsh 完成配置（或在 ${p.credsFile} 的 refs: 下补上）。`);

  const model = opts.model || DEFAULT_VERIFY_MODEL;
  console.log(c.cyan(`\n== 连通性测试：${model} ==\n`));
  info('请求中…');
  try {
    const { reply, remoteModel, latency } = await chatOnce(model, key);
    ok(`连通成功（${latency}s）`);
    console.log(`  模型：${remoteModel}`);
    console.log(`  回复：${reply.replace(/\s+/g, ' ').slice(0, 120)}`);
  } catch (e) {
    fail(`连通失败：${e.message.split('\n')[0]}`);
    if (e.message.includes('\n')) console.log(c.dim(e.message.split('\n').slice(1).join('\n')));
    console.log('');
    if (e.status === 401 || e.status === 403) {
      info('多为 API Key 无效/过期。去 https://ai.tju.edu.cn 重新生成，然后 tju-dsh remove && tju-dsh 重配。');
    } else if (/Prompt token limit/i.test(e.body || '')) {
      info('网关返回「Prompt token limit exceeded」：通常是账户额度用尽或受限（与请求本身无关）。去 https://ai.tju.edu.cn 查看用量，或换一个 Key 试。');
    } else if (e.status === 404 || /model/i.test(e.message)) {
      info(`模型 ${model} 可能不存在或已下线，运行 tju-dsh models 查看可用列表。`);
    } else if (e.status === 429) {
      info('触发限流（60 次/分钟），稍等几秒重试即可。');
    } else {
      info('检查校园网/VPN 是否可达 ai.tju.edu.cn（浏览器打开试试）。');
    }
    process.exit(1);
  }
}

async function cmdModels() {
  console.log(c.cyan('\n== 天大智算网关可用模型 ==\n'));
  let live;
  try {
    live = await fetchModels();
  } catch (e) {
    die(`无法访问网关（${e.message}）。确认校园网/VPN 后重试。`);
  }
  const known = new Map(MODELS.map((m) => [m.id, m]));
  for (const id of live) {
    const m = known.get(id);
    if (m) console.log(`  ${id.padEnd(22)} ctx=${(m.contextWindow / 1024).toFixed(0)}K  out=${(m.maxTokens / 1024).toFixed(0)}K  ${m.input.join('+')}  ${m.name}`);
    else console.log(`  ${id.padEnd(22)} （网关新增模型，本工具配置表暂未收录）`);
  }
  for (const m of MODELS) {
    if (!live.includes(m.id)) info(`配置表中的 ${m.id} 不在 /models 列表里（该列表可能不全，能否调用以实际为准）`);
  }
  console.log('');
}

async function cmdRemove(opts) {
  const p = dshPaths(opts);
  console.log(c.cyan('\n== tju-dsh remove ==\n'));
  const profiles = opts.all ? listProfiles(p) : [await pickProfile(opts, p)];
  let touched = false;
  for (const prof of profiles) {
    const { action } = removePatchProvider(patchFileFor(p, prof));
    if (action === 'removed') { ok(`[${prof}] 已从 cordis.patch.yml 移除天津大学配置`); touched = true; }
    else info(`[${prof}] cordis.patch.yml 中没有天津大学配置，跳过`);
  }
  if (removeCredsKey(p.credsFile)) { ok(`已从 ${p.credsFile} 移除 ${ENV_KEY}`); touched = true; }
  else info(`凭据文件中没有 ${ENV_KEY}，跳过`);
  if (touched) {
    console.log('');
    info('重启 dsh 后生效。备份文件（*.bak-*）保留在原目录，确认无误后可手动删除。');
  }
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

const USAGE = `tju-dsh — 把天津大学智算平台接入 DeepSeek Harness（社区工具，非官方）

用法：
  tju-dsh [setup] [--profile <名>] [--key <tk-...>] [--home <目录>]
  tju-dsh verify  [--model <id>] [--key <tk-...>]
  tju-dsh models
  tju-dsh remove  [--profile <名> | --all]

说明：
  setup   写入 cordis.patch.yml（插件 llm-pi-ai / providers.tju）和 .credentials.yaml（refs.TJU_API_KEY），已有配置会被覆盖更新，其他内容保留并自动备份
  verify  发一条真实请求验证连通（默认模型 tju-llm）
  models  查询网关当前提供的模型列表（无需 Key）
  remove  撤销 setup 写入的内容（仅删天津大学相关部分）`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0] || 'setup';
  if (opts.help) { console.log(USAGE); return; }
  switch (cmd) {
    case 'setup': return cmdSetup(opts);
    case 'verify': return cmdVerify(opts);
    case 'models': return cmdModels();
    case 'remove': return cmdRemove(opts);
    default: die(`未知命令：${cmd}\n\n${USAGE}`);
  }
}

main().catch((e) => die(e?.stack || String(e)));
