/**
 * i18n selection and badge-color mapping (pure modules).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStrings } from '../i18n.js';
import { BADGE_COLOR_OPTIONS, resolveBadgeColorId, resolveSizeBucketColorId } from '../badgeColors.js';

test('loadStrings: zh* variants share the Chinese table, others fall back to English', () => {
  const zh = loadStrings('zh-cn');
  assert.strictEqual(zh, loadStrings('zh-tw'));
  assert.strictEqual(zh, loadStrings('zh-CN'));
  const en = loadStrings('en');
  assert.strictEqual(en, loadStrings('en-US'));
  assert.strictEqual(en, loadStrings('fr'));
  assert.strictEqual(en, loadStrings(''));
  assert.notStrictEqual(zh, en);
});

test('loadStrings: rendered lines match each locale exactly', () => {
  assert.equal(loadStrings('en').size('6 KB', '6,144'), 'Size: 6 KB (6,144 bytes)');
  assert.equal(loadStrings('zh-cn').size('6 KB', '6,144'), '大小: 6 KB（6,144 字节）');
  assert.equal(loadStrings('en').contents('12', '3', false), 'Contents: 12 files, 3 folders');
  assert.equal(loadStrings('zh-cn').contents('12', '3', true), '内容: 12 个文件, 3 个文件夹（部分统计）');
  assert.equal(loadStrings('zh-cn').totalSize('1.5 MB', '1,572,864'), '总大小: 1.5 MB（1,572,864 字节）');
  assert.equal(loadStrings('zh-cn').readonlyAttr(), '属性: 只读');
  assert.equal(loadStrings('zh-cn').symlink('../x'), '符号链接 → ../x');
});

test('badge colors: every option maps to a ThemeColor id except "default"', () => {
  assert.equal(resolveBadgeColorId('default'), undefined);
  assert.equal(resolveBadgeColorId('brightCyan'), 'terminal.ansiBrightCyan');
  assert.equal(resolveBadgeColorId('orange'), 'charts.orange');
  assert.equal(resolveBadgeColorId('no-such-color'), undefined);
  for (const opt of BADGE_COLOR_OPTIONS) {
    if (opt === 'default') continue;
    assert.ok(resolveBadgeColorId(opt), `option ${opt} must map to a ThemeColor id`);
  }
});

test('colorBySize buckets: green below 1 MB, yellow MBs, red GB+', () => {
  assert.equal(resolveSizeBucketColorId(0), 'terminal.ansiBrightGreen');
  assert.equal(resolveSizeBucketColorId(500 * 1024), 'terminal.ansiBrightGreen');
  assert.equal(resolveSizeBucketColorId(1024 * 1024), 'terminal.ansiBrightYellow');
  assert.equal(resolveSizeBucketColorId(500 * 1024 * 1024), 'terminal.ansiBrightYellow');
  assert.equal(resolveSizeBucketColorId(1024 * 1024 * 1024), 'terminal.ansiBrightRed');
  assert.equal(resolveSizeBucketColorId(5 * 1024 * 1024 * 1024), 'terminal.ansiBrightRed');
});
