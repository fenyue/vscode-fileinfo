"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const sizeFormatter_js_1 = require("../sizeFormatter.js");
const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
const TB = 1024 * 1024 * 1024 * 1024;
(0, node_test_1.test)('formatHumanSize: bytes below 1 KB are shown verbatim', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(0), '0 B');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(1), '1 B');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(745), '745 B');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(1023), '1023 B');
});
(0, node_test_1.test)('formatHumanSize: exactly two decimals above 1 KB, B stays integer', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(KB), '1.00 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(1536), '1.50 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(20.5 * KB), '20.50 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(6 * KB), '6.00 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(1229), '1.20 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(12345), '12.06 KB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(MB), '1.00 MB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(2 * MB), '2.00 MB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(4718592), '4.50 MB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(GB), '1.00 GB');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(TB), '1.00 TB');
});
(0, node_test_1.test)('formatHumanSize: degenerate values are defensive, not throwing', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(-5), '-5 B');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(Number.NaN), '?');
    strict_1.default.equal((0, sizeFormatter_js_1.formatHumanSize)(Number.POSITIVE_INFINITY), '?');
});
(0, node_test_1.test)('formatBadgeSize: below 1 KB has no badge', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(0), undefined);
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(1), undefined);
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(1023), undefined);
});
(0, node_test_1.test)('formatBadgeSize: 1..9.5 range gets value+unit in two chars', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(KB), '1K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(1536), '2K'); // 1.5 rounds up
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(9 * KB), '9K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(1.5 * MB), '2M');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(3.4 * GB), '3G');
});
(0, node_test_1.test)('formatBadgeSize: 9.5..99.5 range gets two plain digits', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(9728), '10'); // 9.5 KB → 10
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(45 * KB), '45');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(99 * KB), '99');
});
(0, node_test_1.test)('formatBadgeSize: >=99.5 rolls into the next unit, minimum 1', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(101888), '1M'); // 99.5 KB
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(MB), '1M'); // 1024 KB → v=1.0M
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(500 * KB), '1M'); // 0.49M rounds down but clamped to 1
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(1.6 * MB), '2M');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(2.5 * TB), '3T');
});
(0, node_test_1.test)('formatBadgeSize: every result respects the hard 2-codepoint limit', () => {
    const samples = [
        1024, 1536, 9728, 10 * KB, 45 * KB, 99 * KB, 101888, MB, 500 * KB, 1.6 * MB,
        100 * MB, GB, 10 * GB, 99 * GB, TB, 99 * TB, 99.6 * TB, 1234 * TB,
    ];
    for (const s of samples) {
        const b = (0, sizeFormatter_js_1.formatBadgeSize)(s);
        strict_1.default.ok(b !== undefined, `badge for ${s}`);
        strict_1.default.ok([...b].length <= 2, `badge "${b}" for ${s} exceeds 2 codepoints`);
    }
});
(0, node_test_1.test)('formatBadgeCircled: 1..50 per unit gets circled digits with visible unit', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(1024), '①K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(12288), '⑫K'); // 12 KB
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(20 * KB), '⑳K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(21 * KB), '㉑K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(50 * KB), '㊿K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(42 * MB), '㊷M');
});
(0, node_test_1.test)('formatBadgeCircled: 51..99 falls back to plain digits, roll-up keeps circled', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(51 * KB), '51');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(99 * KB), '99');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(101888), '①M'); // 99.5 KB rolls up
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(2.5 * TB), '③T');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(0), undefined);
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(1023), undefined);
});
(0, node_test_1.test)('formatBadgeEmojiCircle: emoji-presentation circled digits with visible unit', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(1024), '①️K'); // ① + VS16, one grapheme + unit
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(12288), '⑫️K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(20 * KB), '⑳️K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(21 * KB), '2️⃣1️⃣'); // no emoji form above 20
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(42 * MB), '4️⃣2️⃣');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(101888), '①️M');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(0), undefined);
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeEmojiCircle)(1023), undefined);
    for (const s of [1024, 12288, 20 * KB, 21 * KB, 42 * MB, 101888, 200 * 1024 ** 5]) {
        const b = (0, sizeFormatter_js_1.formatBadgeEmojiCircle)(s) ?? '';
        strict_1.default.ok(b !== '', `emojiCircle badge expected for ${s}`);
        strict_1.default.ok(graphemes(b) <= 2, `emojiCircle badge "${b}" exceeds 2 graphemes`);
    }
});
(0, node_test_1.test)('formatBadgeKeycap: one decimal via fraction glyph for 1..9.9, integers above', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(1024), '1️⃣K'); // exact 1.0 keeps the unit letter
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(1126), '1️⃣⅒'); // 1.1 KB
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(6656), '6️⃣½'); // 6.5 KB
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(6554), '6️⃣⅖'); // 6.4 KB
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(9 * KB), '9️⃣K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(10189), '1️⃣0️⃣'); // 9.95 KB rounds up to 10
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(12288), '1️⃣2️⃣');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(42 * MB), '4️⃣2️⃣');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(101888), '1️⃣M');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(0), undefined);
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeKeycap)(1023), undefined);
    for (const s of [1024, 1126, 6656, 9 * KB, 10189, 12288, 42 * MB, 101888, 200 * 1024 ** 5]) {
        const b = (0, sizeFormatter_js_1.formatBadgeKeycap)(s) ?? '';
        strict_1.default.ok(b !== '', `keycap badge expected for ${s}`);
        strict_1.default.ok(graphemes(b) <= 2, `keycap badge "${b}" exceeds 2 graphemes`);
    }
});
(0, node_test_1.test)('formatBadgeWide: fullwidth digits, same shape as standard', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeWide)(1024), '１K');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeWide)(12288), '１２');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeWide)(42 * MB), '４２');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeWide)(101888), '１M');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeWide)(200 * 1024 ** 5), '９９');
    for (const s of [1024, 9 * KB, 12288, 42 * MB, 101888, 200 * 1024 ** 5]) {
        strict_1.default.ok(graphemes((0, sizeFormatter_js_1.formatBadgeWide)(s) ?? '') <= 2);
    }
});
(0, node_test_1.test)('clamp bug: >=99.5 of the top unit no longer emits a 3-grapheme badge (would throw)', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeSize)(200 * 1024 ** 5), '99');
    strict_1.default.equal((0, sizeFormatter_js_1.formatBadgeCircled)(200 * 1024 * 1024 * 1024 * 1024 * 1024), '99');
    strict_1.default.ok(graphemes((0, sizeFormatter_js_1.formatBadgeSize)(200 * 1024 ** 5) ?? '') <= 2);
});
(0, node_test_1.test)('circled badges stay within the 2-codepoint cap across the scale', () => {
    const samples = [1024, 9 * KB, 12288, 20 * KB, 21 * KB, 50 * KB, 51 * KB, 99 * KB,
        101888, MB, 42 * MB, GB, 10 * GB, TB, 99 * TB, 1234 * TB];
    for (const s of samples) {
        const b = (0, sizeFormatter_js_1.formatBadgeCircled)(s);
        strict_1.default.ok(b !== undefined, `badge for ${s}`);
        strict_1.default.ok([...b].length <= 2, `badge "${b}" for ${s} exceeds 2 codepoints`);
    }
});
(0, node_test_1.test)('formatDateTime: stable YYYY-MM-DD HH:mm:ss shape', () => {
    const ms = new Date(2026, 9, 30, 14, 5, 9).getTime();
    strict_1.default.match((0, sizeFormatter_js_1.formatDateTime)(ms), /^2026-10-30 14:05:09$/);
    strict_1.default.equal((0, sizeFormatter_js_1.formatDateTime)(0), '');
    strict_1.default.equal((0, sizeFormatter_js_1.formatDateTime)(Number.NaN), '');
});
(0, node_test_1.test)('formatCount: thousands separators', () => {
    strict_1.default.equal((0, sizeFormatter_js_1.formatCount)(0), '0');
    strict_1.default.equal((0, sizeFormatter_js_1.formatCount)(999), '999');
    strict_1.default.equal((0, sizeFormatter_js_1.formatCount)(1024), '1,024');
    strict_1.default.equal((0, sizeFormatter_js_1.formatCount)(47857664), '47,857,664');
    strict_1.default.equal((0, sizeFormatter_js_1.formatCount)(Number.NaN), '?');
});
