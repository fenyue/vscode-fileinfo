"use strict";
/**
 * Pure size/date formatting helpers. No vscode imports — unit-testable with plain node.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHumanSize = formatHumanSize;
exports.formatBadgeSize = formatBadgeSize;
exports.formatBadgeCircled = formatBadgeCircled;
exports.formatBadgeWide = formatBadgeWide;
exports.formatBadgeEmojiCircle = formatBadgeEmojiCircle;
exports.formatBadgeKeycap = formatBadgeKeycap;
exports.formatDateTime = formatDateTime;
exports.formatCount = formatCount;
const BADGE_UNITS = ['K', 'M', 'G', 'T', 'P'];
const HUMAN_UNITS = ['KB', 'MB', 'GB', 'TB', 'PB'];
/**
 * Human-readable size: integer bytes below 1 KB ("745 B" — bytes are the exact
 * value), exactly two decimals for every larger unit ("6.00 KB", "20.50 KB")
 * so columns align and precision is uniform. Deterministic output (no locale),
 * suitable for tooltips and tests.
 */
function formatHumanSize(bytes) {
    if (!Number.isFinite(bytes))
        return '?';
    if (bytes < 0)
        return `-${formatHumanSize(-bytes)}`;
    if (bytes < 1024)
        return `${Math.round(bytes)} B`;
    let v = bytes / 1024;
    let ui = 0;
    while (v >= 1024 && ui < HUMAN_UNITS.length - 1) {
        v /= 1024;
        ui++;
    }
    // exactly 2 decimals for every non-B unit: "1.00 KB", "20.50 KB", "12.30 MB"
    return `${v.toFixed(2)} ${HUMAN_UNITS[ui]}`;
}
/**
 * Compact Explorer badge, max 2 codepoints (hard VSCode limit — longer badges throw).
 *   < 1 KB        → undefined (too small to be worth a badge)
 *   1–9.5 KB      → "1K".."9K"          (value + unit letter)
 *   9.5–99.5 KB   → "10".."99"          (two digits, unit implied)
 *   99.5 KB–1.5MB → "1M"                (rolls into the next unit, rounded)
 * Exact value always lives in the tooltip.
 */
function formatBadgeSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024)
        return undefined;
    let v = bytes / 1024;
    let ui = 0;
    while (v >= 1024 && ui < BADGE_UNITS.length - 1) {
        v /= 1024;
        ui++;
    }
    const r = Math.round(v);
    if (r <= 9)
        return `${r}${BADGE_UNITS[ui]}`;
    if (r <= 99)
        return `${r}`;
    // 99.5..1023 of current unit: express in the next unit, rounded, min 1
    if (ui < BADGE_UNITS.length - 1) {
        return `${Math.max(1, Math.round(v / 1024))}${BADGE_UNITS[ui + 1]}`;
    }
    return '99'; // ≥99.5 of the top unit — clamp (a trailing unit letter would exceed 2 graphemes)
}
/** Enclosed alphanumerics: ①..⑳ (U+2460), ㉑..㉟ (U+3251), ㊱..㊿ (U+32B1) — 1..50 in ONE codepoint. */
const CIRCLED = (() => {
    const out = [];
    for (let n = 0x2460; n <= 0x2473; n++)
        out.push(String.fromCodePoint(n));
    for (let n = 0x3251; n <= 0x325f; n++)
        out.push(String.fromCodePoint(n));
    for (let n = 0x32b1; n <= 0x32bf; n++)
        out.push(String.fromCodePoint(n));
    return out;
})();
/** Shared magnitude math for both badge styles. */
function magnitude(bytes) {
    let v = bytes / 1024;
    let ui = 0;
    while (v >= 1024 && ui < BADGE_UNITS.length - 1) {
        v /= 1024;
        ui++;
    }
    return { r: Math.round(v), v, ui };
}
/**
 * Circled variant: value 1..50 of a unit renders as unit + TWO digits in two
 * codepoints ("⑫K" = 12K, "㊷M" = 42M) — kills the "42 = KB or MB?" ambiguity
 * of the plain style. 51..99 falls back to plain digits; ≥99.5 rolls up as usual.
 */
function formatBadgeCircled(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024)
        return undefined;
    const { r, v, ui } = magnitude(bytes);
    if (r <= 50)
        return `${CIRCLED[r - 1]}${BADGE_UNITS[ui]}`;
    if (r <= 99)
        return `${r}`;
    if (ui < BADGE_UNITS.length - 1) {
        return `${CIRCLED[Math.max(1, Math.round(v / 1024)) - 1]}${BADGE_UNITS[ui + 1]}`;
    }
    return '99';
}
/** Fullwidth digits (U+FF10-FF19) — CJK-width glyphs, noticeably wider than ASCII. */
const FULLWIDTH = '０１２３４５６７８９';
/** Fullwidth style: same information as standard, wider and easier to read. */
function formatBadgeWide(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024)
        return undefined;
    const { r, v, ui } = magnitude(bytes);
    if (r <= 9)
        return `${FULLWIDTH[r]}${BADGE_UNITS[ui]}`;
    if (r <= 99)
        return `${FULLWIDTH[Math.floor(r / 10)]}${FULLWIDTH[r % 10]}`;
    if (ui < BADGE_UNITS.length - 1) {
        return `${FULLWIDTH[Math.max(1, Math.round(v / 1024))]}${BADGE_UNITS[ui + 1]}`;
    }
    return '９９';
}
/** Emoji keycap digit 4️⃣ = digit + VS16 + U+20E3 — a SINGLE grapheme cluster (UAX29),
 *  so "4️⃣K" is 2 graphemes and passes FileDecoration.validate, while rendering far
 *  larger than circled numerals. */
const keycap = (d) => `${d}\uFE0F\u20E3`;
/** Vulgar fractions, index = tenths digit (nearest-tenth mapping; ⅓≈0.33, ⅔≈0.67, ⅞≈0.9).
 *  Each is ONE codepoint/grapheme, so keycap+fraction carries one decimal place. */
const TENTHS = ['', '⅒', '⅕', '⅓', '⅖', '½', '⅗', '⅔', '⅘', '⅞'];
/**
 * Emoji-presentation circled digits: ①..⑳ (U+2460-2473) carry Emoji=Yes /
 * Emoji_Presentation=No — appending VS16 switches them to full emoji size
 * (large colored circle on Windows/Chromium) while staying ONE grapheme, so
 * "⑫️K" = 12K keeps a visible unit letter. ㉑-㊿ have no emoji form: 21..99
 * falls back to keycap pairs.
 */
const emojiCircle = (d) => `${CIRCLED[d - 1]}\uFE0F`;
function formatBadgeEmojiCircle(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024)
        return undefined;
    const { r, v, ui } = magnitude(bytes);
    if (r <= 20)
        return `${emojiCircle(r)}${BADGE_UNITS[ui]}`;
    if (r <= 99)
        return `${keycap(Math.floor(r / 10))}${keycap(r % 10)}`;
    if (ui < BADGE_UNITS.length - 1) {
        return `${emojiCircle(Math.max(1, Math.round(v / 1024)))}${BADGE_UNITS[ui + 1]}`;
    }
    return `${keycap(9)}${keycap(9)}`;
}
/** Keycap style, precision-first: 1..9.9 shows one decimal via a fraction glyph and
 *  must drop the unit letter (2-grapheme budget) — the unit is conveyed by the
 *  colorBySize bucket; 10..99 shows two integer keycaps; whole 1..9 keeps the unit. */
function formatBadgeKeycap(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024)
        return undefined;
    const { v, ui } = magnitude(bytes);
    if (v < 9.95) {
        let ip = Math.floor(v); // 1..9 (v >= 1 because bytes >= 1024)
        let t = Math.round((v - ip) * 10); // tenths digit, 0..10
        if (t === 10) {
            ip += 1;
            t = 0;
        }
        if (ip <= 9)
            return t === 0 ? `${keycap(ip)}${BADGE_UNITS[ui]}` : `${keycap(ip)}${TENTHS[t]}`;
        return `${keycap(1)}${keycap(0)}`; // 9.95..9.99 rounds to 10
    }
    if (v < 99.5) {
        const r = Math.round(v);
        return `${keycap(Math.floor(r / 10))}${keycap(r % 10)}`;
    }
    if (ui < BADGE_UNITS.length - 1) {
        return `${keycap(Math.max(1, Math.round(v / 1024)))}${BADGE_UNITS[ui + 1]}`;
    }
    return `${keycap(9)}${keycap(9)}`;
}
/** Locale-independent "YYYY-MM-DD HH:mm:ss". Empty string for invalid/non-positive timestamps. */
function formatDateTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0)
        return '';
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/** Thousands-separated integer, e.g. 47857664 → "47,857,664". */
function formatCount(n) {
    if (!Number.isFinite(n))
        return '?';
    const s = String(Math.round(Math.abs(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
