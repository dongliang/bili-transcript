#!/usr/bin/env node
// CI 冒烟测试 —— 不需要 B 站凭据、不访问网络
// 在 npm publish 之前跑，确保发出去的东西至少是「语法对、装得上、二维码没错」
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m) => { fail++; console.log(`  ❌ ${m}`); };

console.log('\n== 语法检查 ==');
for (const f of readdirSync(join(ROOT, 'src')).filter((x) => x.endsWith('.mjs'))) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, 'src', f)], { stdio: 'pipe' });
    ok(f);
  } catch (e) {
    no(`${f} 语法错误：${String(e.stderr || e.message).split('\n')[0]}`);
  }
}

console.log('\n== 必需文件 ==');
for (const f of ['package.json', 'README.md', 'SKILL.md', 'LICENSE', 'src/cli.mjs']) {
  existsSync(join(ROOT, f)) ? ok(f) : no(`缺 ${f}`);
}

console.log('\n== package.json ==');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const bins = Object.keys(pkg.bin || {});
bins.includes('bili-transcript') ? ok('bin 含全名 bili-transcript') : no('bin 缺全名');
bins.includes('bili') ? ok('bin 含别名 bili') : no('bin 缺别名');
/^\d+\.\d+\.\d+$/.test(pkg.version) ? ok(`版本号格式正确（${pkg.version}）`) : no(`版本号格式异常：${pkg.version}`);
Object.keys(pkg.dependencies || {}).length === 0 ? ok('dependencies 为空') : no('有运行时依赖');
pkg.engines?.node ? ok(`声明了 node 版本要求（${pkg.engines.node}）`) : no('没声明 engines.node');

console.log('\n== 二维码编码器（最容易静默出错的部分）==');
const { encodeQR, renderText, writePNG } = await import(join(ROOT, 'src', 'qr.mjs'));

function finderOK(mx, r, c) {
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const on = (i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
    if (mx[r + i][c + j] !== on) return false;
  }
  return true;
}

const m = encodeQR('HELLO');
const n = m.length;
n === 21 ? ok(`1 字节 → 版本 1（${n}×${n}）`) : no(`尺寸不对：${n}`);
(finderOK(m, 0, 0) && finderOK(m, 0, n - 7) && finderOK(m, n - 7, 0))
  ? ok('三个定位图形位置正确') : no('定位图形不对');
m[n - 8][8] === true ? ok('固定暗模块存在') : no('缺固定暗模块');

let timingOK = true;
for (let i = 8; i < n - 8; i++) {
  if (m[6][i] !== (i % 2 === 0)) timingOK = false;
  if (m[i][6] !== (i % 2 === 0)) timingOK = false;
}
timingOK ? ok('定时图形交替正确') : no('定时图形不对');

// 版本选择：期望值由 python-qrcode 实测得出（纠错等级 M，字节模式）
for (const [len, want] of [[1, 21], [40, 29], [80, 37], [100, 41], [120, 45], [140, 49]]) {
  const mm = encodeQR('x'.repeat(len));
  mm.length === want ? ok(`${len} 字节 → ${want}×${want}`) : no(`${len} 字节 → ${mm.length}，期望 ${want}`);
}

renderText(m).split('\n').length === n ? ok('文本渲染行数正确') : no('文本渲染有误');
try {
  const r = writePNG(m, '/tmp/_ci_qr.png', { scale: 4, quiet: 2 });
  r.bytes > 100 && r.width === (n + 4) * 4
    ? ok(`PNG 写出正常（${r.width}×${r.height}，${r.bytes} 字节）`)
    : no(`PNG 尺寸异常 ${JSON.stringify(r)}`);
} catch (e) { no(`PNG 写出失败：${e.message}`); }

console.log('\n== CLI ==');
try {
  const v = execFileSync(process.execPath, [join(ROOT, 'src', 'cli.mjs'), '--version'], { encoding: 'utf8' }).trim();
  /^\d+\.\d+\.\d+/.test(v) ? ok(`--version → ${v}`) : no(`--version 输出异常：${v}`);
} catch (e) { no(`--version 跑不起来：${e.message}`); }
try {
  const h = execFileSync(process.execPath, [join(ROOT, 'src', 'cli.mjs'), '--help'], { encoding: 'utf8' });
  h.includes('用法') ? ok('--help 正常') : no('--help 输出异常');
} catch (e) { no(`--help 跑不起来：${e.message}`); }

console.log('\n== 干净度 ==');
!existsSync(join(ROOT, 'node_modules')) ? ok('没有 node_modules') : no('存在 node_modules，不该提交');
try {
  // 注意：必须排除本文件，否则「检测凭据的正则」会匹配到它自己的源码
  const out = execFileSync('git',
    ['grep', '-lIE', 'npm_[A-Za-z0-9]{20,}|_authToken|SESSDATA=[A-Za-z0-9%]{20,}',
     '--', '.', ':(exclude)tests/ci-check.mjs', ':(exclude)node_modules'],
    { cwd: ROOT, encoding: 'utf8' });
  no(`发现疑似凭据：${out.trim()}`);
} catch { ok('仓库里没有 token / 凭据'); }

console.log(`\n== 冒烟测试：通过 ${pass} / ${pass + fail} ==\n`);
process.exit(fail ? 1 : 0);
