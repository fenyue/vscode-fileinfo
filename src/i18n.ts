/**
 * Tooltip / status-bar strings. Pure module — no vscode import (unit-testable).
 * Selection rule: VSCode display language starting with "zh" (zh-cn, zh-tw, …)
 * gets Chinese; everything else falls back to English.
 */

export interface FileInfoStrings {
  /** "Size: 1.2 KB (1,230 bytes)" / “大小: 1.2 KB（1,230 字节）” */
  readonly size: (human: string, bytes: string) => string;
  readonly modified: (dt: string) => string;
  readonly created: (dt: string) => string;
  readonly readonlyAttr: () => string;
  readonly folder: () => string;
  readonly symlink: (target: string) => string;
  readonly linkSize: (bytes: string) => string;
  /** "Contents: 12 files, 3 folders" — suffix marks a partial (lower-bound) walk */
  readonly contents: (files: string, dirs: string, partial: boolean) => string;
  readonly totalSize: (human: string, bytes: string) => string;
  readonly statusbarTooltip: (fsPath: string, human: string) => string;
}

const en: FileInfoStrings = {
  size: (human, bytes) => `Size: ${human} (${bytes} bytes)`,
  modified: (dt) => `Modified: ${dt}`,
  created: (dt) => `Created: ${dt}`,
  readonlyAttr: () => 'Attributes: read-only',
  folder: () => 'Folder',
  symlink: (target) => `Symlink → ${target}`,
  linkSize: (bytes) => `Link size: ${bytes} bytes`,
  contents: (files, dirs, partial) =>
    `Contents: ${files} files, ${dirs} folders${partial ? ' (partial)' : ''}`,
  totalSize: (human, bytes) => `Total size: ${human} (${bytes} bytes)`,
  statusbarTooltip: (fsPath, human) => `${fsPath}\nSize: ${human}`,
};

const zh: FileInfoStrings = {
  size: (human, bytes) => `大小: ${human}（${bytes} 字节）`,
  modified: (dt) => `修改时间: ${dt}`,
  created: (dt) => `创建时间: ${dt}`,
  readonlyAttr: () => '属性: 只读',
  folder: () => '文件夹',
  symlink: (target) => `符号链接 → ${target}`,
  linkSize: (bytes) => `链接大小: ${bytes} 字节`,
  contents: (files, dirs, partial) =>
    `内容: ${files} 个文件, ${dirs} 个文件夹${partial ? '（部分统计）' : ''}`,
  totalSize: (human, bytes) => `总大小: ${human}（${bytes} 字节）`,
  statusbarTooltip: (fsPath, human) => `${fsPath}\n大小: ${human}`,
};

export function loadStrings(language: string): FileInfoStrings {
  return language.toLowerCase().startsWith('zh') ? zh : en;
}
