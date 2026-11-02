"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * i18n selection and badge-color mapping (pure modules).
 */
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const i18n_js_1 = require("../i18n.js");
const badgeColors_js_1 = require("../badgeColors.js");
(0, node_test_1.test)('loadStrings: zh* variants share the Chinese table, others fall back to English', () => {
    const zh = (0, i18n_js_1.loadStrings)('zh-cn');
    strict_1.default.strictEqual(zh, (0, i18n_js_1.loadStrings)('zh-tw'));
    strict_1.default.strictEqual(zh, (0, i18n_js_1.loadStrings)('zh-CN'));
    const en = (0, i18n_js_1.loadStrings)('en');
    strict_1.default.strictEqual(en, (0, i18n_js_1.loadStrings)('en-US'));
    strict_1.default.strictEqual(en, (0, i18n_js_1.loadStrings)('fr'));
    strict_1.default.strictEqual(en, (0, i18n_js_1.loadStrings)(''));
    strict_1.default.notStrictEqual(zh, en);
});
(0, node_test_1.test)('loadStrings: rendered lines match each locale exactly', () => {
    strict_1.default.equal((0, i18n_js_1.loadStrings)('en').size('6 KB', '6,144'), 'Size: 6 KB (6,144 bytes)');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').size('6 KB', '6,144'), '大小: 6 KB（6,144 字节）');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('en').contents('12', '3', false), 'Contents: 12 files, 3 folders');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').contents('12', '3', true), '内容: 12 个文件, 3 个文件夹（部分统计）');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').totalSize('1.5 MB', '1,572,864'), '总大小: 1.5 MB（1,572,864 字节）');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').readonlyAttr(), '属性: 只读');
    strict_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').symlink('../x'), '符号链接 → ../x');
});
(0, node_test_1.test)('badge colors: every option maps to a ThemeColor id except "default"', () => {
    strict_1.default.equal((0, badgeColors_js_1.resolveBadgeColorId)('default'), undefined);
    strict_1.default.equal((0, badgeColors_js_1.resolveBadgeColorId)('brightCyan'), 'terminal.ansiBrightCyan');
    strict_1.default.equal((0, badgeColors_js_1.resolveBadgeColorId)('orange'), 'charts.orange');
    strict_1.default.equal((0, badgeColors_js_1.resolveBadgeColorId)('no-such-color'), undefined);
    for (const opt of badgeColors_js_1.BADGE_COLOR_OPTIONS) {
        if (opt === 'default')
            continue;
        strict_1.default.ok((0, badgeColors_js_1.resolveBadgeColorId)(opt), `option ${opt} must map to a ThemeColor id`);
    }
});
(0, node_test_1.test)('colorBySize buckets: green below 1 MB, yellow MBs, red GB+', () => {
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(0), 'terminal.ansiBrightGreen');
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(500 * 1024), 'terminal.ansiBrightGreen');
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(1024 * 1024), 'terminal.ansiBrightYellow');
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(500 * 1024 * 1024), 'terminal.ansiBrightYellow');
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(1024 * 1024 * 1024), 'terminal.ansiBrightRed');
    strict_1.default.equal((0, badgeColors_js_1.resolveSizeBucketColorId)(5 * 1024 * 1024 * 1024), 'terminal.ansiBrightRed');
});
