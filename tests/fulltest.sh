#!/bin/sh
# bili 全功能测试（npm 包结构版）
CLI="${CLI:-bili}"
D=/tmp/pkgtest; mkdir -p $D
pass=0; fail=0

ok(){ echo "  ✅ $1"; pass=$((pass+1)); }
no(){ echo "  ❌ $1"; fail=$((fail+1)); }
chk(){ grep -q -- "$3" "$2" && ok "$1" || no "$1（没找到「$3」）"; }

echo "######## 1. 基本提取 ########"
$CLI BV14Z4R6KEHS -o $D/a.txt >/dev/null 2>&1
chk "带时间戳" $D/a.txt "^\[00:00"
chk "标题" $D/a.txt "128G 超大内存"

$CLI BV14Z4R6KEHS --plain -o $D/b.txt >/dev/null 2>&1
chk "--plain 去时间戳" $D/b.txt "128G大内存"
grep -q '^\[' $D/b.txt && no "--plain 仍带时间戳" || ok "--plain 确实没时间戳"

echo
echo "######## 2. 输入形式 ########"
$CLI "https://www.bilibili.com/video/BV14Z4R6KEHS/" --plain -o $D/c.txt >/dev/null 2>&1
chk "完整 URL" $D/c.txt "128G大内存"
$CLI av80433022 --plain -o $D/d.txt >/dev/null 2>&1
chk "av 号" $D/d.txt "永不"

echo
echo "######## 3. JSON 输出 ########"
$CLI BV14Z4R6KEHS --json -o $D/j.json >/dev/null 2>&1
python3 -c "
import json,sys
d=json.load(open('$D/j.json'))
assert d['ok'] is True, 'ok 字段'
assert d['bvid']=='BV14Z4R6KEHS'
assert len(d['lines'])>50, '字幕条数'
assert d['lines'][0]['text'], '首条文本'
assert d['duration']==175
print('  ✅ JSON 结构完整：%d 条字幕' % len(d['lines']))
" 2>/dev/null || no "JSON 输出结构不对"

echo
echo "######## 4. 分P ########"
$CLI BV1WC7n6LELj -p 3 --plain -o $D/e.txt >/dev/null 2>&1
chk "分P 标题" $D/e.txt "\[P3"
$CLI BV1WC7n6LELj -p 3 --list -o $D/e2.txt >/dev/null 2>&1
chk "分P --list" $D/e2.txt "aisubtitle"

echo
echo "######## 5. 字幕轨与总结 ########"
$CLI BV14Z4R6KEHS --list -o $D/f.txt >/dev/null 2>&1
chk "--list 多语言轨" $D/f.txt "English"
$CLI BV14Z4R6KEHS --summary -o $D/g.txt >/dev/null 2>&1
chk "--summary 正文" $D/g.txt "戴尔工作站"
chk "--summary 章节" $D/g.txt "^\[0"

echo
echo "######## 6. 边界 ########"
$CLI BV1DRHU6LELy -o $D/h.txt >/dev/null 2>&1
chk "无字幕提示" $D/h.txt "没有字幕轨"
$CLI BV14Z4R6KEHS -p 99 >/dev/null 2> $D/err1.txt
[ $? -ne 0 ] && grep -q "只有 1 个分P" $D/err1.txt && ok "分P 越界报错" || no "分P 越界处理不对"
$CLI "not-a-video" >/dev/null 2> $D/err2.txt
[ $? -ne 0 ] && grep -q "认不出视频号" $D/err2.txt && ok "非法输入报错" || no "非法输入处理不对"

echo
echo "######## 7. 长视频 ########"
$CLI BV1atCRYsE7x --plain -o $D/i.txt >/dev/null 2>&1
chk "90 分钟末句完整" $D/i.txt "我们下期再会"
echo "     行数 $(wc -l < $D/i.txt)"

echo
echo "######## 8. 帮助与版本 ########"
$CLI --help 2>&1 | grep -q "用法" && ok "--help 可用" || no "--help 不可用"
$CLI --version 2>&1 | grep -qE '^[0-9]+\.[0-9]+' && ok "--version 可用" || no "--version 不可用"

echo
echo "通过 $pass / $((pass+fail))"
