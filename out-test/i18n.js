"use strict";
/**
 * Tooltip / status-bar strings. Pure module — no vscode import (unit-testable).
 * Selection rule: VSCode display language starting with "zh" (zh-cn, zh-tw, …)
 * gets Chinese; everything else falls back to English.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStrings = loadStrings;
const en = {
    size: (human, bytes) => `Size: ${human} (${bytes} bytes)`,
    modified: (dt) => `Modified: ${dt}`,
    created: (dt) => `Created: ${dt}`,
    readonlyAttr: () => 'Attributes: read-only',
    folder: () => 'Folder',
    symlink: (target) => `Symlink → ${target}`,
    linkSize: (bytes) => `Link size: ${bytes} bytes`,
    contents: (files, dirs, partial) => `Contents: ${files} files, ${dirs} folders${partial ? ' (partial)' : ''}`,
    totalSize: (human, bytes) => `Total size: ${human} (${bytes} bytes)`,
    statusbarTooltip: (fsPath, human) => `${fsPath}\nSize: ${human}`,
};
const zh = {
    size: (human, bytes) => `大小: ${human}（${bytes} 字节）`,
    modified: (dt) => `修改时间: ${dt}`,
    created: (dt) => `创建时间: ${dt}`,
    readonlyAttr: () => '属性: 只读',
    folder: () => '文件夹',
    symlink: (target) => `符号链接 → ${target}`,
    linkSize: (bytes) => `链接大小: ${bytes} 字节`,
    contents: (files, dirs, partial) => `内容: ${files} 个文件, ${dirs} 个文件夹${partial ? '（部分统计）' : ''}`,
    totalSize: (human, bytes) => `总大小: ${human}（${bytes} 字节）`,
    statusbarTooltip: (fsPath, human) => `${fsPath}\n大小: ${human}`,
};
function loadStrings(language) {
    return language.toLowerCase().startsWith('zh') ? zh : en;
}
