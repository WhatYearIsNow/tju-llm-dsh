/**
 * 端到端测试：在临时目录里模拟 ~/.dsh 结构，跑 tju-dsh CLI 的真实写入路径。
 * 不访问网络（setup 的模型探测失败会自动跳过）。
 *
 * 运行：npm test
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'tju-dsh.mjs');
const KEY = 'tk-test-key-0123456789abcdef';

let passed = 0;
let failed = 0;

function makeHome({ patch, creds }) {
  const home = mkdtempSync(join(tmpdir(), 'tju-dsh-test-'));
  const prof = join(home, '.dsh', 'profiles', 'desktop');
  mkdirSync(prof, { recursive: true });
  if (patch !== undefined) writeFileSync(join(prof, 'cordis.patch.yml'), patch, 'utf8');
  if (creds !== undefined) writeFileSync(join(home, '.dsh', '.credentials.yaml'), creds, 'utf8');
  return home;
}

function run(home, args) {
  return execFileSync(process.execPath, [CLI, ...args, '--home', home, '--yes'], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', USERPROFILE: home, HOME: home },
  });
}

function assert(cond, label, detail = '') {
  if (cond) { passed++; console.log(`  ✔ ${label}`); }
  else { failed++; console.log(`  ✖ ${label}${detail ? ' —— ' + detail : ''}`); }
}

const T = (name, fn) => {
  console.log(`\n[${name}]`);
  try { fn(); } catch (e) { failed++; console.log(`  ✖ 异常：${e.message.split('\n')[0]}`); }
};

// ---------------------------------------------------------------------------
// 场景 1：全新安装（无 cordis.patch.yml、无凭据文件）
// ---------------------------------------------------------------------------

T('全新安装', () => {
  const home = makeHome({});
  run(home, ['setup', '--key', KEY]);

  const patchRaw = readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8');
  const patch = yaml.load(patchRaw);
  assert(Array.isArray(patch) && patch.length === 1, '生成单条插件条目');
  assert(patch[0].id === 'llm-pi-ai' && patch[0].name === '@deepseek-ai/dsh-llm-pi-ai', '插件 id/name 正确');
  const prov = patch[0].config?.providers?.tju;
  assert(prov?.baseURL === 'https://ai.tju.edu.cn/api/v3' && prov?.apiKeyEnv === 'TJU_API_KEY', 'provider 字段正确');
  assert(prov?.models?.length === 5, '写入 5 个模型');
  const think = prov.models.find((m) => m.id === 'deepseek-v4.1-flash');
  assert(think?.reasoningEfforts?.off === 'none', 'reasoningEfforts.off 是字符串 "none"');
  assert(patchRaw.match(/["']off["']\s*:/) !== null, 'YAML 输出中 off 带引号（防布尔化）');

  const credsRaw = readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8');
  const creds = yaml.load(credsRaw);
  assert(creds?.refs?.TJU_API_KEY === KEY, 'Key 写入 refs.TJU_API_KEY');
  assert(creds?.records === undefined, '不虚构 records 段');

  rmSync(home, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 场景 2：已有配置（含其他 provider 和头部注释）——合并不能破坏
// ---------------------------------------------------------------------------

const EXISTING_PATCH = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      openrouter:
        apiKeyEnv: OPENROUTER_API_KEY
        api: openai-completions
        baseURL: https://openrouter.ai/api/v1
        models:
          - id: some/model
            name: Some Model
            contextWindow: 128000
            maxTokens: 8192
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: openrouter
    model: some/model
`;

const EXISTING_CREDS = `version: 1
refs:
  DEEPSEEK_API_KEY: sk-other-key-xxxxxxxxxxxxxxxx
records:
  deepseek-account-platform/device:
    kind: device
    payload:
      id: device-123
`;

T('合并已有配置', () => {
  const home = makeHome({ patch: EXISTING_PATCH, creds: EXISTING_CREDS });
  run(home, ['setup', '--key', KEY]);

  const patch = yaml.load(readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8'));
  assert(patch.length === 2, '条目总数不变（tju 并入已有 llm-pi-ai）');
  const entry = patch.find((e) => e.id === 'llm-pi-ai');
  assert(entry.config.providers.openrouter?.models?.[0]?.id === 'some/model', '其他 provider 原样保留');
  assert(entry.config.providers.tju?.models?.length === 5, 'tju provider 已写入');
  assert(patch.find((e) => e.id === 'agent-default-model')?.config?.provider === 'openrouter', '其他插件条目不受影响');
  assert(readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8').startsWith('# Your patch layer'),
    '头部注释保留');

  const credsRaw = readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8');
  const creds = yaml.load(credsRaw);
  assert(creds.refs.TJU_API_KEY === KEY, 'TJU_API_KEY 写入 refs');
  assert(creds.refs.DEEPSEEK_API_KEY === 'sk-other-key-xxxxxxxxxxxxxxxx', '其他 Key 原样保留');
  assert(creds.records?.['deepseek-account-platform/device']?.payload?.id === 'device-123', 'records 段原样保留');
  assert(existsSync(join(home, '.dsh', '.credentials.yaml')) && readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8').startsWith('version: 1'),
    'version 字段保留在文件顶部');

  // 备份文件存在
  const files = readdirSync(join(home, '.dsh'));
  assert(files.some((f) => f.startsWith('.credentials.yaml.bak-')), '凭据文件有备份');

  rmSync(home, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 场景 3：幂等——重复运行不重复写入、不覆盖已有 Key
// ---------------------------------------------------------------------------

T('幂等性', () => {
  const home = makeHome({ patch: EXISTING_PATCH, creds: EXISTING_CREDS });
  run(home, ['setup', '--key', KEY]);
  const after1 = readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8');
  const credsAfter1 = readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8');

  // 不带 --key 再跑一次：应复用已有 Key，不交互
  run(home, ['setup']);
  const after2 = readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8');
  const credsAfter2 = readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8');

  assert(yaml.load(after2).length === 2, '重复运行条目数不变');
  assert(yaml.load(after2).find((e) => e.id === 'llm-pi-ai').config.providers.tju, 'tju 配置仍存在');
  assert(credsAfter2.includes('tk-test-key-0123456789abcdef'), '已有 Key 不被清掉');
  assert(yaml.load(credsAfter2).refs.DEEPSEEK_API_KEY === 'sk-other-key-xxxxxxxxxxxxxxxx', '其他 Key 仍完好');

  rmSync(home, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 场景 4：remove——只删天津大学相关内容
// ---------------------------------------------------------------------------

T('卸载', () => {
  const home = makeHome({ patch: EXISTING_PATCH, creds: EXISTING_CREDS });
  run(home, ['setup', '--key', KEY]);
  run(home, ['remove', '--profile', 'desktop']);

  const patch = yaml.load(readFileSync(join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8'));
  const entry = patch.find((e) => e.id === 'llm-pi-ai');
  assert(entry && entry.config.providers.tju === undefined, 'tju provider 已移除');
  assert(entry.config.providers.openrouter, '其他 provider 保留');
  assert(patch.find((e) => e.id === 'agent-default-model'), '其他条目保留');

  const creds = yaml.load(readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8'));
  assert(creds.refs.TJU_API_KEY === undefined, 'TJU_API_KEY 已移除');
  assert(creds.refs.DEEPSEEK_API_KEY === 'sk-other-key-xxxxxxxxxxxxxxxx', '其他 Key 保留');
  assert(creds.records?.['deepseek-account-platform/device']?.payload?.id === 'device-123', 'records 保留');

  rmSync(home, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 场景 5：refs 段不存在 / 凭据文件不存在时的写入
// ---------------------------------------------------------------------------

T('异常凭据结构', () => {
  const home = makeHome({ creds: 'version: 1\nrecords:\n  x/y:\n    kind: k\n' });
  run(home, ['setup', '--key', KEY]);
  const creds = yaml.load(readFileSync(join(home, '.dsh', '.credentials.yaml'), 'utf8'));
  assert(creds.refs?.TJU_API_KEY === KEY, '无 refs 段时正确追加');
  assert(creds.records?.['x/y']?.kind === 'k', '原有内容保留');

  rmSync(home, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
