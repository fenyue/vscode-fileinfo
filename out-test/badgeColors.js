"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BADGE_COLOR_OPTIONS = void 0;
exports.resolveBadgeColorId = resolveBadgeColorId;
exports.resolveSizeBucketColorId = resolveSizeBucketColorId;
/**
 * Badge color option → ThemeColor id (pure mapping, unit-testable).
 *
 * Note: VSCode applies a FileDecoration's color to the WHOLE explorer label
 * (file name included), not just the badge — "default" opts out of tinting.
 * ANSI "bright" colors are defined by all default themes and adapt to
 * light/dark variants; charts.* are the standard chart palette ids.
 */
exports.BADGE_COLOR_OPTIONS = [
    'default',
    'brightCyan',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'orange',
    'blue',
    'purple',
];
const THEME_COLOR_IDS = {
    brightCyan: 'terminal.ansiBrightCyan',
    brightGreen: 'terminal.ansiBrightGreen',
    brightYellow: 'terminal.ansiBrightYellow',
    brightBlue: 'terminal.ansiBrightBlue',
    brightMagenta: 'terminal.ansiBrightMagenta',
    orange: 'charts.orange',
    blue: 'charts.blue',
    purple: 'charts.purple',
};
/** undefined for "default" (and any unknown value) — no ThemeColor is set. */
function resolveBadgeColorId(option) {
    return THEME_COLOR_IDS[option];
}
/**
 * colorBySize mode: green = KB-and-below, yellow = MB, red = GB+. ANSI bright
 * colors exist in every default theme and adapt to light/dark. Glanceable
 * magnitude without reading the badge at all.
 */
function resolveSizeBucketColorId(bytes) {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;
    if (bytes < MB)
        return 'terminal.ansiBrightGreen';
    if (bytes < GB)
        return 'terminal.ansiBrightYellow';
    return 'terminal.ansiBrightRed';
}
