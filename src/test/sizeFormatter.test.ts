import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBadgeCircled,
  formatBadgeEmojiCircle,
  formatBadgeKeycap,
  formatBadgeSize,
  formatBadgeWide,
  formatCount,
  formatDateTime,
  formatHumanSize,
} from '../sizeFormatter.js';

const graphemes = (s: string): number =>
  [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
const TB = 1024 * 1024 * 1024 * 1024;

test('formatHumanSize: bytes below 1 KB are shown verbatim', () => {
  assert.equal(formatHumanSize(0), '0 B');
  assert.equal(formatHumanSize(1), '1 B');
  assert.equal(formatHumanSize(745), '745 B');
  assert.equal(formatHumanSize(1023), '1023 B');
});

test('formatHumanSize: exactly two decimals above 1 KB, B stays integer', () => {
  assert.equal(formatHumanSize(KB), '1.00 KB');
  assert.equal(formatHumanSize(1536), '1.50 KB');
  assert.equal(formatHumanSize(20.5 * KB), '20.50 KB');
  assert.equal(formatHumanSize(6 * KB), '6.00 KB');
  assert.equal(formatHumanSize(1229), '1.20 KB');
  assert.equal(formatHumanSize(12345), '12.06 KB');
  assert.equal(formatHumanSize(MB), '1.00 MB');
  assert.equal(formatHumanSize(2 * MB), '2.00 MB');
  assert.equal(formatHumanSize(4718592), '4.50 MB');
  assert.equal(formatHumanSize(GB), '1.00 GB');
  assert.equal(formatHumanSize(TB), '1.00 TB');
});

test('formatHumanSize: degenerate values are defensive, not throwing', () => {
  assert.equal(formatHumanSize(-5), '-5 B');
  assert.equal(formatHumanSize(Number.NaN), '?');
  assert.equal(formatHumanSize(Number.POSITIVE_INFINITY), '?');
});

test('formatBadgeSize: below 1 KB has no badge', () => {
  assert.equal(formatBadgeSize(0), undefined);
  assert.equal(formatBadgeSize(1), undefined);
  assert.equal(formatBadgeSize(1023), undefined);
});

test('formatBadgeSize: 1..9.5 range gets value+unit in two chars', () => {
  assert.equal(formatBadgeSize(KB), '1K');
  assert.equal(formatBadgeSize(1536), '2K'); // 1.5 rounds up
  assert.equal(formatBadgeSize(9 * KB), '9K');
  assert.equal(formatBadgeSize(1.5 * MB), '2M');
  assert.equal(formatBadgeSize(3.4 * GB), '3G');
});

test('formatBadgeSize: 9.5..99.5 range gets two plain digits', () => {
  assert.equal(formatBadgeSize(9728), '10'); // 9.5 KB → 10
  assert.equal(formatBadgeSize(45 * KB), '45');
  assert.equal(formatBadgeSize(99 * KB), '99');
});

test('formatBadgeSize: >=99.5 rolls into the next unit, minimum 1', () => {
  assert.equal(formatBadgeSize(101888), '1M'); // 99.5 KB
  assert.equal(formatBadgeSize(MB), '1M'); // 1024 KB → v=1.0M
  assert.equal(formatBadgeSize(500 * KB), '1M'); // 0.49M rounds down but clamped to 1
  assert.equal(formatBadgeSize(1.6 * MB), '2M');
  assert.equal(formatBadgeSize(2.5 * TB), '3T');
});

test('formatBadgeSize: every result respects the hard 2-codepoint limit', () => {
  const samples = [
    1024, 1536, 9728, 10 * KB, 45 * KB, 99 * KB, 101888, MB, 500 * KB, 1.6 * MB,
    100 * MB, GB, 10 * GB, 99 * GB, TB, 99 * TB, 99.6 * TB, 1234 * TB,
  ];
  for (const s of samples) {
    const b = formatBadgeSize(s);
    assert.ok(b !== undefined, `badge for ${s}`);
    assert.ok([...b].length <= 2, `badge "${b}" for ${s} exceeds 2 codepoints`);
  }
});

test('formatBadgeCircled: 1..50 per unit gets circled digits with visible unit', () => {
  assert.equal(formatBadgeCircled(1024), '①K');
  assert.equal(formatBadgeCircled(12288), '⑫K'); // 12 KB
  assert.equal(formatBadgeCircled(20 * KB), '⑳K');
  assert.equal(formatBadgeCircled(21 * KB), '㉑K');
  assert.equal(formatBadgeCircled(50 * KB), '㊿K');
  assert.equal(formatBadgeCircled(42 * MB), '㊷M');
});

test('formatBadgeCircled: 51..99 falls back to plain digits, roll-up keeps circled', () => {
  assert.equal(formatBadgeCircled(51 * KB), '51');
  assert.equal(formatBadgeCircled(99 * KB), '99');
  assert.equal(formatBadgeCircled(101888), '①M'); // 99.5 KB rolls up
  assert.equal(formatBadgeCircled(2.5 * TB), '③T');
  assert.equal(formatBadgeCircled(0), undefined);
  assert.equal(formatBadgeCircled(1023), undefined);
});

test('formatBadgeEmojiCircle: emoji-presentation circled digits with visible unit', () => {
  assert.equal(formatBadgeEmojiCircle(1024), '①️K'); // ① + VS16, one grapheme + unit
  assert.equal(formatBadgeEmojiCircle(12288), '⑫️K');
  assert.equal(formatBadgeEmojiCircle(20 * KB), '⑳️K');
  assert.equal(formatBadgeEmojiCircle(21 * KB), '2️⃣1️⃣'); // no emoji form above 20
  assert.equal(formatBadgeEmojiCircle(42 * MB), '4️⃣2️⃣');
  assert.equal(formatBadgeEmojiCircle(101888), '①️M');
  assert.equal(formatBadgeEmojiCircle(0), undefined);
  assert.equal(formatBadgeEmojiCircle(1023), undefined);
  for (const s of [1024, 12288, 20 * KB, 21 * KB, 42 * MB, 101888, 200 * 1024 ** 5]) {
    const b = formatBadgeEmojiCircle(s) ?? '';
    assert.ok(b !== '', `emojiCircle badge expected for ${s}`);
    assert.ok(graphemes(b) <= 2, `emojiCircle badge "${b}" exceeds 2 graphemes`);
  }
});

test('formatBadgeKeycap: one decimal via fraction glyph for 1..9.9, integers above', () => {
  assert.equal(formatBadgeKeycap(1024), '1️⃣K'); // exact 1.0 keeps the unit letter
  assert.equal(formatBadgeKeycap(1126), '1️⃣⅒'); // 1.1 KB
  assert.equal(formatBadgeKeycap(6656), '6️⃣½'); // 6.5 KB
  assert.equal(formatBadgeKeycap(6554), '6️⃣⅖'); // 6.4 KB
  assert.equal(formatBadgeKeycap(9 * KB), '9️⃣K');
  assert.equal(formatBadgeKeycap(10189), '1️⃣0️⃣'); // 9.95 KB rounds up to 10
  assert.equal(formatBadgeKeycap(12288), '1️⃣2️⃣');
  assert.equal(formatBadgeKeycap(42 * MB), '4️⃣2️⃣');
  assert.equal(formatBadgeKeycap(101888), '1️⃣M');
  assert.equal(formatBadgeKeycap(0), undefined);
  assert.equal(formatBadgeKeycap(1023), undefined);
  for (const s of [1024, 1126, 6656, 9 * KB, 10189, 12288, 42 * MB, 101888, 200 * 1024 ** 5]) {
    const b = formatBadgeKeycap(s) ?? '';
    assert.ok(b !== '', `keycap badge expected for ${s}`);
    assert.ok(graphemes(b) <= 2, `keycap badge "${b}" exceeds 2 graphemes`);
  }
});

test('formatBadgeWide: fullwidth digits, same shape as standard', () => {
  assert.equal(formatBadgeWide(1024), '１K');
  assert.equal(formatBadgeWide(12288), '１２');
  assert.equal(formatBadgeWide(42 * MB), '４２');
  assert.equal(formatBadgeWide(101888), '１M');
  assert.equal(formatBadgeWide(200 * 1024 ** 5), '９９');
  for (const s of [1024, 9 * KB, 12288, 42 * MB, 101888, 200 * 1024 ** 5]) {
    assert.ok(graphemes(formatBadgeWide(s) ?? '') <= 2);
  }
});

test('clamp bug: >=99.5 of the top unit no longer emits a 3-grapheme badge (would throw)', () => {
  assert.equal(formatBadgeSize(200 * 1024 ** 5), '99');
  assert.equal(formatBadgeCircled(200 * 1024 * 1024 * 1024 * 1024 * 1024), '99');
  assert.ok(graphemes(formatBadgeSize(200 * 1024 ** 5) ?? '') <= 2);
});

test('circled badges stay within the 2-codepoint cap across the scale', () => {
  const samples = [1024, 9 * KB, 12288, 20 * KB, 21 * KB, 50 * KB, 51 * KB, 99 * KB,
    101888, MB, 42 * MB, GB, 10 * GB, TB, 99 * TB, 1234 * TB];
  for (const s of samples) {
    const b = formatBadgeCircled(s);
    assert.ok(b !== undefined, `badge for ${s}`);
    assert.ok([...b].length <= 2, `badge "${b}" for ${s} exceeds 2 codepoints`);
  }
});

test('formatDateTime: stable YYYY-MM-DD HH:mm:ss shape', () => {
  const ms = new Date(2026, 9, 30, 14, 5, 9).getTime();
  assert.match(formatDateTime(ms), /^2026-10-30 14:05:09$/);
  assert.equal(formatDateTime(0), '');
  assert.equal(formatDateTime(Number.NaN), '');
});

test('formatCount: thousands separators', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1024), '1,024');
  assert.equal(formatCount(47857664), '47,857,664');
  assert.equal(formatCount(Number.NaN), '?');
});
