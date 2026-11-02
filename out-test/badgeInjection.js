"use strict";
/**
 * "full" badge format payload builder — pure functions, no vscode import.
 *
 * VSCode renders a FileDecoration's color by splicing ThemeColor.id straight
 * into a CSS rule: `content: "<badge>"; color: var(--vscode-<id, dots→dashes>);`.
 * The id is NOT sanitized (only dots become dashes), so a crafted id can close
 * the var( early and emit a second `content:` declaration that cascades over
 * the original 2-grapheme badge. Payload shape:
 *   x); content: "<escaped display>"; color: var(--vscode-<dashed>); z: z
 * The trailing `z: z` is a sacrificial declaration absorbing both rule-tail
 * shapes (`)` / `, inherit)`). The badge field itself stays the compact
 * ≤2-grapheme form as a fallback if a future VSCode sanitizes color ids.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeCssContent = escapeCssContent;
exports.dashedThemeVar = dashedThemeVar;
exports.buildFullBadgeColorId = buildFullBadgeColorId;
/** Per-codepoint whitelist kept verbatim inside the CSS string literal. */
const SAFE_LITERAL = /[A-Za-z0-9 ~%+-]/;
/**
 * Escape arbitrary text for a CSS `content: "..."` literal: whitelisted ASCII
 * passes through, every other code point becomes `\XX ` (uppercase hex, min 2
 * digits; the trailing space terminates the escape and is swallowed by the
 * CSS tokenizer, so the rendered text is the original character).
 */
function escapeCssContent(s) {
    let out = '';
    for (const c of s) {
        if (SAFE_LITERAL.test(c)) {
            out += c;
            continue;
        }
        const cp = c.codePointAt(0);
        if (cp === undefined)
            break; // unreachable: for..of never yields empty chunks
        out += `\\${cp.toString(16).toUpperCase().padStart(2, '0')} `;
    }
    return out;
}
/** ThemeColor.id → CSS custom property name, mirroring VSCode's own rewrite. */
function dashedThemeVar(themeColorId) {
    return `--vscode-${themeColorId.replace(/\./g, '-')}`;
}
/**
 * Build the injected ThemeColor.id payload, or undefined when there is nothing
 * to display (caller falls back to the plain color id). themeColorId undefined
 * → `color: inherit` (keep the theme's own label color).
 */
function buildFullBadgeColorId(display, themeColorId) {
    if (display.trim() === '')
        return undefined;
    const color = themeColorId === undefined ? 'inherit' : `var(${dashedThemeVar(themeColorId)})`;
    return `x); content: "${escapeCssContent(display)}"; color: ${color}; z: z`;
}
