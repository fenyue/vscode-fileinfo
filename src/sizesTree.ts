/**
 * "File Sizes" TreeView — the full-size display the built-in Explorer cannot
 * offer (its decoration badges are hard-capped at 2 codepoints by VSCode).
 * Docked at the bottom of the Explorer sidebar. Every row's description slot
 * carries the full human-readable size ("1.2 KB", "100 B"); folders show lazy
 * recursive totals; children: folders (alphabetical) then files (size desc).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileStatService, type FolderSizeInfo, type StatInfo } from './fileStatCache';
import type { FileInfoStrings } from './i18n';
import { formatCount, formatHumanSize } from './sizeFormatter';

export interface SizeTreeEntry {
  readonly fsPath: string;
  readonly name: string;
  readonly isDirectory: boolean;
  /** workspace roots render expanded — sizes are visible the moment the view opens */
  readonly expandedByDefault?: boolean;
  /** plain files */
  readonly sizeBytes?: number;
  /** folders — present once the recursive total is computed (explicit-undefined allowed) */
  readonly folderInfo?: FolderSizeInfo | undefined;
}

const stableId = (fsPath: string): string =>
  process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;

export class FileSizesTree implements vscode.TreeDataProvider<SizeTreeEntry> {
  private readonly emitter = new vscode.EventEmitter<SizeTreeEntry | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  /** folder totals already demanded (avoids re-kicking per refresh) */
  private readonly demanded = new Set<string>();

  constructor(
    private readonly stats: FileStatService,
    private readonly strings: FileInfoStrings,
  ) {}

  /** Testable core: children of a directory — folders (alpha) then files (size desc). */
  async childrenOf(dir: string): Promise<SizeTreeEntry[]> {
    let names: string[];
    try {
      names = await fs.promises.readdir(dir);
    } catch {
      return [];
    }
    const statted = await Promise.all(
      names.map(async (name) => {
        const p = path.join(dir, name);
        const st = await this.stats.stat(p);
        return st ? { name, p, st } : undefined;
      }),
    );
    interface Child {
      name: string;
      p: string;
      st: StatInfo;
    }
    const folders = statted
      .filter((x): x is Child => x !== undefined && x.st.isDirectory)
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = statted
      .filter((x): x is Child => x !== undefined && !x.st.isDirectory)
      .sort((a, b) => b.st.size - a.st.size);
    return [
      ...folders.map((x) => ({
        fsPath: x.p,
        name: x.name,
        isDirectory: true,
        folderInfo: this.stats.peekFolderSize(x.p),
      })),
      ...files.map((x) => ({ fsPath: x.p, name: x.name, isDirectory: false, sizeBytes: x.st.size })),
    ];
  }

  getTreeItem(entry: SizeTreeEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(
      entry.name,
      entry.isDirectory
        ? entry.expandedByDefault
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    item.id = stableId(entry.fsPath); // stable id → expansion survives refreshes
    item.description = this.descriptionFor(entry);
    item.iconPath = entry.isDirectory ? new vscode.ThemeIcon('folder') : new vscode.ThemeIcon('file');
    const tip = this.tooltipFor(entry);
    if (tip !== undefined) item.tooltip = tip;
    if (!entry.isDirectory) {
      item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(entry.fsPath)] };
    }
    return item;
  }

  async getChildren(entry?: SizeTreeEntry): Promise<SizeTreeEntry[]> {
    if (entry === undefined) {
      const roots = vscode.workspace.workspaceFolders ?? [];
      return roots.map((wf) => ({
        fsPath: wf.uri.fsPath,
        name: wf.name,
        isDirectory: true,
        expandedByDefault: true, // open the panel → sizes are immediately visible
        folderInfo: this.stats.peekFolderSize(wf.uri.fsPath),
      }));
    }
    if (!entry.isDirectory) return [];
    const children = await this.childrenOf(entry.fsPath);
    // folder totals are demanded off the hot path — expanding a huge tree never blocks
    for (const c of children) {
      if (c.isDirectory) this.demandFolderSize(c);
    }
    return children;
  }

  /** Watcher hook: invalidated dirs must recompute; whole visible tree re-renders. */
  refresh(invalidatedDirs: readonly string[]): void {
    for (const d of invalidatedDirs) this.demanded.delete(stableId(d));
    this.emitter.fire(undefined);
  }

  private descriptionFor(entry: SizeTreeEntry): string {
    if (entry.isDirectory) {
      if (entry.folderInfo) {
        return formatHumanSize(entry.folderInfo.bytes) + (entry.folderInfo.partial ? '+' : '');
      }
      return '…'; // total demanded on render, row updates when it lands
    }
    return formatHumanSize(entry.sizeBytes ?? 0);
  }

  private tooltipFor(entry: SizeTreeEntry): string | undefined {
    if (entry.isDirectory) {
      if (!entry.folderInfo) return undefined;
      return [
        this.strings.contents(formatCount(entry.folderInfo.files), formatCount(entry.folderInfo.dirs), entry.folderInfo.partial),
        this.strings.totalSize(formatHumanSize(entry.folderInfo.bytes), formatCount(entry.folderInfo.bytes)),
      ].join('\n');
    }
    if (entry.sizeBytes === undefined) return undefined;
    return this.strings.size(formatHumanSize(entry.sizeBytes), formatCount(entry.sizeBytes));
  }

  private demandFolderSize(entry: SizeTreeEntry): void {
    const key = stableId(entry.fsPath);
    if (this.demanded.has(key)) return;
    this.demanded.add(key);
    void this.stats.folderSize(entry.fsPath).then((info) => {
      // re-render the row with the landed total (id stability keeps expansion)
      this.emitter.fire({ ...entry, folderInfo: info ?? this.stats.peekFolderSize(entry.fsPath) });
    });
  }
}
