"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const badgeInjection_js_1 = require("../badgeInjection.js");
const sizeFormatter_js_1 = require("../sizeFormatter.js");
/** A payload's escaped display segment may only contain whitelist literals or `\XX ` escapes. */
const INNER_ALPHABET = /^(?:[A-Za-z0-9 ~%+-]|\\[0-9A-F]{2} )*$/;
(0, node_test_1.test)('escapeCssContent: golden values', () => {
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('1.2 KB'), '1\\2E 2 KB');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('a"b'), 'a\\22 b');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('~3 MB'), '~3 MB');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)(''), '');
});
(0, node_test_1.test)('escapeCssContent: printable ASCII 0x20..0x7E emits only literals or well-formed escapes', () => {
    for (let cp = 0x20; cp <= 0x7e; cp++) {
        const out = (0, badgeInjection_js_1.escapeCssContent)(String.fromCodePoint(cp));
        strict_1.default.match(out, INNER_ALPHABET, `char U+${cp.toString(16)}`);
    }
    // spot checks just outside/inside the whitelist boundary
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('.'), '\\2E ');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('"'), '\\22 ');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)(';'), '\\3B ');
});
(0, node_test_1.test)('escapeCssContent: non-ASCII becomes multi-digit hex escapes', () => {
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('½'), '\\BD ');
    strict_1.default.equal((0, badgeInjection_js_1.escapeCssContent)('Ⓚ'), '\\24C0 '); // U+24C0, four hex digits
});
(0, node_test_1.test)('dashedThemeVar: dots become dashes under the --vscode- prefix', () => {
    strict_1.default.equal((0, badgeInjection_js_1.dashedThemeVar)('list.warningForeground'), '--vscode-list-warningForeground');
    strict_1.default.equal((0, badgeInjection_js_1.dashedThemeVar)('a.b.c'), '--vscode-a-b-c');
    strict_1.default.equal((0, badgeInjection_js_1.dashedThemeVar)('plain'), '--vscode-plain');
});
(0, node_test_1.test)('buildFullBadgeColorId: golden payloads', () => {
    strict_1.default.equal((0, badgeInjection_js_1.buildFullBadgeColorId)('12 B', 'list.warningForeground'), 'x); content: "12 B"; color: var(--vscode-list-warningForeground); z: z');
    strict_1.default.equal((0, badgeInjection_js_1.buildFullBadgeColorId)('1.2 KB', undefined), 'x); content: "1\\2E 2 KB"; color: inherit; z: z');
    strict_1.default.equal((0, badgeInjection_js_1.buildFullBadgeColorId)('', 'x.id'), undefined);
    strict_1.default.equal((0, badgeInjection_js_1.buildFullBadgeColorId)('   ', 'x.id'), undefined, 'whitespace-only display is empty');
});
(0, node_test_1.test)('buildFullBadgeColorId: structural invariants across the size × color matrix', () => {
    const bytesSamples = [0, 1, 999, 1023, 1024, 1536, 999999, 1048576, 3.7e9, 1e12];
    const colorIds = [undefined, 'list.errorForeground'];
    for (const bytes of bytesSamples) {
        for (const colorId of colorIds) {
            const display = (0, sizeFormatter_js_1.formatHumanSize)(bytes);
            const payload = (0, badgeInjection_js_1.buildFullBadgeColorId)(display, colorId);
            strict_1.default.ok(payload !== undefined, `payload expected for ${bytes}B / ${colorId}`);
            strict_1.default.ok(payload.startsWith('x); content: "'), `prefix for ${bytes}B: ${payload}`);
            strict_1.default.ok(payload.endsWith('; z: z'), `suffix for ${bytes}B: ${payload}`);
            strict_1.default.equal((payload.match(/"/g) ?? []).length, 2, `exactly two quotes for ${bytes}B`);
            const m = /^x\); content: "([^"]*)"; color: (.+); z: z$/.exec(payload);
            strict_1.default.ok(m, `shape for ${bytes}B / ${colorId}: ${payload}`);
            const inner = m[1];
            strict_1.default.ok(!inner.includes('.'), `no literal dot for ${bytes}B: ${JSON.stringify(inner)}`);
            strict_1.default.match(inner, INNER_ALPHABET, `inner alphabet for ${bytes}B: ${JSON.stringify(inner)}`);
            strict_1.default.ok(!/\\(?![0-9A-F]{2} )/.test(inner), `escapes well-formed for ${bytes}B: ${JSON.stringify(inner)}`);
            strict_1.default.equal(m[2], colorId === undefined ? 'inherit' : 'var(--vscode-list-errorForeground)', `color clause for ${bytes}B / ${colorId}`);
        }
    }
});
