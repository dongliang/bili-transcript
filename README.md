# bili-transcript

提取 B 站视频的**文字稿、字幕和 AI 总结**。零依赖，扫码登录，纯命令行。

```sh
npx bili-transcript BV1xx411c7mD --plain
```

## 它能做什么

- 把任意 B 站视频的字幕扒成文字，带不带时间戳都行
- 拿 B 站官方的 **AI 视频总结**（带章节和时间点）
- 支持 BV 号 / av 号 / 完整链接 / b23.tv 短链
- 支持合集视频的分P
- 给 agent 用的 `--json` 结构化输出

## 安装

```sh
npm install -g bili-transcript     # 全局
npx bili-transcript <目标>          # 或者直接用，不装
```

需要 **Node 18+**（用到内置 fetch）。没有其他依赖，一条 `npm i` 装完不到 100 KB。

装好后有两个等价的命令：**`bili-transcript`**（全名）和 **`bili`**（简写）。

> 全局安装报 `EACCES: permission denied, mkdir '/usr/lib/node_modules/...'`？
> 那是 npm 想往系统目录写。别用 sudo，改成装到自己的目录：
> ```sh
> npm config set prefix ~/.local
> npm install -g bili-transcript
> ```
> 再把 `~/.local/bin` 加进 PATH（fish：`fish_add_path ~/.local/bin`）。
> 或者干脆不装，用 `npx`。

## 快速开始

```sh
bili login                          # 扫码登录，一次就够
bili BV1xx411c7mD --plain           # 提取文字稿
bili "https://b23.tv/xxxxx" --plain -o out.txt
bili BV1xx411c7mD --summary         # 顺带拿 AI 总结
bili doctor                         # 出问题了先跑这个
```

## 为什么需要登录

B 站的字幕接口现在强制登录。不登录的话，接口返回的是**空数组**——看起来像"这视频没字幕"，其实是被挡住了。所以必须先登一次。

**登录全程在你的机器上完成，凭据只存在本地。** 扫码用的是 B 站官方的二维码登录接口（就是网页版"扫码登录"用的那个），和任何第三方服务器无关。凭据写在 `~/.config/bili/auth.json`，权限 `0600`。

扫码登录**不会把你手机上的 B 站 App 踢下线**——同一个账号支持多端同时在线。

### 凭据从哪来（多数时候不用扫码）

按顺序自动找，不用你操心：

1. 环境变量 `BILI_SESSDATA`
2. `~/.config/bili/auth.json`（`bili login` 写的位置）
3. **本机浏览器的 cookie 库**（只读，每次现取）
4. `/var/minis/offloads/env_cookies_bilibili*.sh`（Minis 里导出的 cookie）

第 3 级覆盖 Firefox（明文，零解密）和 Chrome / Chromium / Edge / Brave / Vivaldi / Opera（AES-128-CBC + 桌面密钥环）。你日常开着浏览器，多半这一级就命中了——**浏览器里登录着 B 站就不用扫码**。`bili doctor` 会告诉你凭据实际取自哪一级。

浏览器那级是**只读、不落盘**的：只认 bilibili 域名下的 5 个白名单字段，不打印值，绝不写浏览器文件。不想要这一级就设 `BILI_NO_BROWSER=1`。

## 命令

```
bili <BV号|av号|URL> [选项]     提取文字稿（默认动作）
bili fetch <目标> [选项]        同上，显式写法
bili login [选项]              扫码登录
bili doctor                    自检：环境 / 凭据 / 接口
bili install-skill [选项]      把 skill 装到本地 agent
```

### 提取选项

| 选项 | 作用 |
|---|---|
| `--plain` | 只出连续文字，不带时间戳 |
| `--json` | 结构化输出，给程序或 agent 解析 |
| `-p, --page N` | 取第 N 个分P |
| `--list` | 只列出字幕轨，不下载正文 |
| `--summary` | 附带 B 站 AI 总结 |
| `-o, --out FILE` | 写入文件 |

### 登录选项

| 选项 | 作用 |
|---|---|
| `--png <路径>` | 额外写出二维码图片 |
| `--qr-only` | 只生成二维码，稍后用 `--resume` 继续 |
| `--resume` | 用上次的二维码继续轮询 |
| `--timeout N` | 轮询超时秒数（默认 180） |
| `--force` | 已登录时强制重新登录 |

## 给 agent 用

```sh
npx skills add dongliang/bili-transcript
```

装了之后 Claude Code、Codex 这类 agent 会在你提到"这个视频讲了什么"时自动调用它。

agent 内部请用 `--json` 拿结构化数据：

```json
{
  "ok": true,
  "bvid": "BV14Z4R6KEHS",
  "title": "128G 超大内存，密密麻麻全是颗粒",
  "duration": 175,
  "uploader": "韩宇修机",
  "lines": [{ "from": 0, "to": 1.96, "text": "128G大内存" }],
  "summary": { "text": "…", "outline": [] }
}
```

## 已知限制

- **字幕是 AI 自动生成的，有错别字。** 实测中 `CAMM` 被写成 "cam"、`信号线阻值` 被写成 "信号线组织"。**专有名词请核实物件丝印或官方资料**，别直接引用。
- 没有字幕轨的视频（纯音乐、MV、CG 常见）拿不到文字，会明确告诉你而不是编造。
- 只支持 B 站。其他平台是另一件事。
- 登录状态会过期（通常几个月）。失效时 `doctor` 会告诉你，重新 `bili login --force` 即可。

## 设计说明

**零依赖是刻意的。** 核心只用 Node 内置的 `fetch`、`crypto`、`fs`。唯一的难点是二维码——没有引 `qrcode` 这类库，而是自己实现了一个（GF(256) 纠错、Reed-Solomon、掩码择优、连 PNG 都是手写的）。代价是 13 KB 代码，换来的是整个包不到 100 KB，且没有供应链风险。

**只用 `x/player/wbi/v2` 拿字幕，不回退到旧接口。** 旧接口 `x/player/v2` 会返回**别的视频**的字幕——对一条无字幕的 MV 连测 4 次，拿到 4 段完全无关的内容。这种错用户看不出来，只会觉得字幕莫名其妙，所以宁可报"没有字幕"也不给错数据。

**内置数据自洽校验。** 拿到字幕后会检查末条时间戳贴不贴合视频时长。不贴合就告警——这是防"拿到错误数据"的最后一道闸。

## 实现细节（改代码前必读）

**只用 `x/player/wbi/v2` 拿字幕，绝不回退到 `x/player/v2`。** 老接口会返回**别的视频**的字幕——对一条无字幕的 MV 连测 4 次，拿到 4 段完全无关的内容。用户看不出来，只会觉得字幕莫名其妙。所以宁可报「没有字幕」，也不静默给出错数据。

**wbi 签名**：`w_rid` = md5(排序后 query + mixin)，混淆表要完整。

**字幕接口缺凭据时不抛错**，而是正常返回并带 `need_login_subtitle`。判断「要不要扫码」得看 `noSubtitleReason === 'need-login'`，不是 catch 异常。

**`whoami()` 必须走带凭据的 `getJson()`。** 手拼 headers 不带 cookie 永远返回 null——这个 bug 曾让「已登录」守卫失效。

**`getSetCookie()` 在部分 Node 构建上对 fetch 响应不可用**，`get('set-cookie')` 可能返回数组。两种都要兼容。

**字幕 CDN 的 `auth_key` 有时效**（几小时），别存下来当永久地址；`--list` 的输出每次都变（auth_key 是时间签名），别拿它做逐字节比对。

**临时凭据别写 `/tmp`。** 二维码的 `qrcode_key` 能换到登录 cookie，谁先轮询谁拿到账号；二维码图片扫一下就能登录。`/tmp` 全局可读、默认 644，写在那儿等于晾给别人看。现在放 `~/.config/bili/` 下并设 `0600`。

### 读浏览器 cookie 库的五个反直觉点

1. **Chromium 密文前缀是 `v11`。** 这标记以前专指 Windows App-Bound，但 Linux 上仍是标准方案，别以为要特殊处理。
2. **明文前 32 字节是 `SHA256(host_key)`**，不是 cookie 值的一部分。不去掉会多 32 字节。
3. **填充是 PKCS7。** 不去掉末尾会多几个字节，nav 接口报「连不上」，很难查。
4. **用 `file:...?mode=ro`，不要用 `?immutable=1`。** `immutable=1` 声称「文件不会变」于是跳过 WAL，**静默**读到过期 cookie——刚登录完拿到旧值，最难查。
5. **WAL 模式的库必须先复制再读。** SQLite 打开 WAL 库时要在同目录建 `-shm`(32KB) 和 `-wal`，**只读模式也照建**（官方文档承认只读 WAL 库需可写目录）。浏览器运行时这俩文件本就在，直读看不出问题；浏览器干净退出后它们被删了，我们再直读就会凭空留下两个文件——等于偷偷写了用户的浏览器目录。代码靠读文件头第 18 字节（2 = WAL）判断，WAL 一律复制到 `mkdtemp` 再读，约 45ms。Chrome 是传统回滚日志（不是 WAL），直读无副作用，走快路径。

**域名过滤不能只靠 SQL 的 `like '%bilibili%'`**，它会放过 `bilibili.com.evil.com`。取到值后还要按标签边界判一遍，只认 `bilibili.com` / `bilibili.cn` 及其子域。

**Firefox 的 profile 在 `~/.config/mozilla/`，不是 `~/.mozilla/`**（XDG 布局），且目录名随机，要解析 `profiles.ini` 的 `Default=`。

**读 cookie 库需要 Node ≥ 22.5（内置 `node:sqlite`）或系统装有 `sqlite3` 命令。** 都不满足时这一级自动跳过，其余功能不受影响。

## 开发

```sh
git clone https://github.com/dongliang/bili-transcript
cd bili-transcript
npm link            # 让全局 bili 指向本地代码
sh tests/fulltest.sh
```

测试脚本在 `tests/`。改动二维码编码器（`src/qr.mjs`）后必须跑二维码的两个专项测试——**二维码错了不会报错，只会扫不出来**。

## License

MIT
