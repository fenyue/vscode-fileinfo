/**
 * Entry point. Wires FileDecorationProvider + FileSystemWatcher + status bar.
 *
 * Real-time update path:
 *   fs event (create/change/delete) → invalidate caches for that path (and folder
 *   sizes containing it) → debounce 100ms → fire onDidChangeFileDecorations →
 *   VSCode re-queries decorations for visible items → fresh stat from disk.
 */
import * as vscode from 'vscode';
import { FileInfoDecorationProvider, type FileInfoConfig } from './decorationProvider';
import { FileStatService } from './fileStatCache';
import { GitStatusWatcher } from './gitStatus';
import { loadStrings } from './i18n.js';
import { formatDateTime, formatHumanSize } from './sizeFormatter';
import { FileSizesTree } from './sizesTree';

const CONFIG_SECTION = 'showfilesize';
const REFRESH_DEBOUNCE_MS = 100;

function readConfig(): FileInfoConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    badgeEnabled: cfg.get<boolean>('badge.enabled', true),
    folderSizeEnabled: cfg.get<boolean>('folderSize.enabled', false),
    badgeColor: cfg.get<string>('badge.color', 'brightCyan'),
    badgeFormat: cfg.get<'standard' | 'circled' | 'wide' | 'keycap' | 'emojiCircle' | 'full'>('badge.format', 'full'),
    colorBySize: cfg.get<boolean>('badge.colorBySize', true),
    gitStatus: cfg.get<'all' | 'changed' | 'off'>('badge.gitStatus', 'all'),
  };
}

function readFolderIgnore(): Set<string> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const list = cfg.get<string[]>('folderSize.ignore', ['node_modules', '.git']);
  return new Set(list.filter((s) => typeof s === 'string' && s.length > 0));
}

/** Public extension surface — consumed by integration tests. */
export interface FileInfoApi {
  readonly provider: FileInfoDecorationProvider;
  readonly sizesTree: FileSizesTree;
  /** diagnostic access for the integration suite (letters, colors, coverage) */
  readonly statusSource: GitStatusWatcher;
}

export function activate(context: vscode.ExtensionContext): FileInfoApi {
  const stats = new FileStatService(readFolderIgnore());
  // display language only changes via restart — activate-time read is sufficient
  const strings = loadStrings(vscode.env.language);
  // git letters feed the "full" badge text; rebuild completion refreshes decorations.
  // v0.6.0: the watcher IS the status source — rows no repo covers stay pure size.
  const gitStatus = new GitStatusWatcher(() => provider.fire(undefined));
  const provider = new FileInfoDecorationProvider(stats, readConfig(), strings, gitStatus);
  const sizesTree = new FileSizesTree(stats, strings);

  // ---- real-time refresh: watcher → invalidate → debounce → fire ----------------
  let pending = new Set<string>();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const flushPending = (): void => {
    const affected: vscode.Uri[] = [];
    const invalidatedDirs: string[] = [];
    for (const p of pending) {
      for (const dir of stats.invalidate(p)) {
        affected.push(vscode.Uri.file(dir));
        invalidatedDirs.push(dir);
      }
      affected.push(vscode.Uri.file(p));
    }
    pending = new Set();
    provider.fire(affected);
    sizesTree.refresh(invalidatedDirs);
    updateStatusItem();
  };

  const onFsEvent = (uri: vscode.Uri): void => {
    if (uri.scheme !== 'file') return;
    pending.add(uri.fsPath);
    if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(flushPending, REFRESH_DEBOUNCE_MS);
  };

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidCreate(onFsEvent);
  watcher.onDidChange(onFsEvent);
  watcher.onDidDelete(onFsEvent);

  // ---- config / workspace changes → full refresh --------------------------------
  const onConfigChanged = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration(CONFIG_SECTION)) return;
    provider.updateConfig(readConfig()); // provider must see new settings, not the startup snapshot
    stats.updateIgnore(readFolderIgnore()); // ignore list is a startup snapshot too
    stats.clear(); // folderSize.ignore may have changed
    provider.fire(undefined); // refresh all decorations with new settings
    updateStatusItem();
  });
  const onWorkspaceFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    stats.clear();
    provider.fire(undefined);
  });

  // ---- diagnostics: end-to-end badge trace for the active file -------------------
  // Single-click a file in the Explorer (opens it as a preview), then run
  // "File Info: Diagnose Badge". Reports every routing fact the badge depends on.
  const diagnose = vscode.commands.registerCommand('showfilesize.diagnose', async () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri || uri.scheme !== 'file') {
      void vscode.window.showInformationMessage('fileinfo diagnose: no file active (single-click a file first)');
      return;
    }
    const cfg = readConfig();
    let providerLine: string;
    try {
      const deco = await provider.provideFileDecoration(uri);
      providerLine = deco
        ? `provider: badge=${deco.badge ?? '∅'} payload=${((deco.color as unknown as { id?: string }).id ?? '∅').slice(0, 90)}`
        : 'provider: undefined (no decoration returned)';
    } catch (err) {
      providerLine = `provider: THREW ${err instanceof Error ? err.message : String(err)}`;
    }
    const report = [
      `fileinfo v${context.extension.packageJSON.version}`,
      `file: ${uri.fsPath}`,
      `config: format=${cfg.badgeFormat ?? '∅(default full)'} gitStatus=${cfg.gitStatus ?? 'all'} badgeEnabled=${cfg.badgeEnabled} colorBySize=${cfg.colorBySize}`,
      `git: repos=${gitStatus.repoCount} roots=[${gitStatus.repoRoots.join(', ')}] coversRoot=${gitStatus.coversWorkspaceRoot(uri.fsPath)} insideRepo=${gitStatus.insideRepo(uri.fsPath)} letter=${gitStatus.getLetter(uri.fsPath) ?? '∅'} isClean=${gitStatus.isClean(uri.fsPath)} gitColor=${gitStatus.letterColorId(uri.fsPath) ?? '∅'}`,
      providerLine,
    ].join('\n');
    const pick = await vscode.window.showInformationMessage(report, { modal: true }, 'Copy');
    if (pick === 'Copy') await vscode.env.clipboard.writeText(report);
  });

  // ---- status bar: exact size of the active editor's file ------------------------
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 500);
  const statusEnabled = (): boolean =>
    vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('statusbar.enabled', true);

  const updateStatusItem = (): void => {
    const editor = vscode.window.activeTextEditor;
    const uri = editor?.document.uri;
    if (!statusEnabled() || !uri || uri.scheme !== 'file') {
      statusItem.hide();
      return;
    }
    void stats.stat(uri.fsPath).then((st) => {
      if (!st) {
        statusItem.hide();
        return;
      }
      statusItem.text = `$(database) ${formatHumanSize(st.size)} · ${formatDateTime(st.mtimeMs)}`;
      statusItem.tooltip = strings.statusbarTooltip(uri.fsPath, formatHumanSize(st.size));
      statusItem.show();
    });
  };
  const onActiveEditorChanged = vscode.window.onDidChangeActiveTextEditor(() => updateStatusItem());
  updateStatusItem();

  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(provider),
    vscode.window.registerTreeDataProvider('showfilesize.sizes', sizesTree),
    diagnose,
    watcher,
    onConfigChanged,
    onWorkspaceFoldersChanged,
    onActiveEditorChanged,
    statusItem,
    provider,
    gitStatus,
    {
      dispose: (): void => {
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        stats.clear();
      },
    },
  );

  // ---- startup warmup: fire-and-forget, never blocks the sync registration path.
  // Link the git extension for status letters, then prime first-level entries of
  // each workspace root so the Explorer's first paint finds warm caches. There is
  // no settle deadline anymore (v0.6.0): until git answers — or forever, if it is
  // broken or wedged — uncovered rows simply show the plain size with no color.
  void gitStatus.start();
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    void stats.primeRoot(folder.uri.fsPath);
  }

  return { provider, sizesTree, statusSource: gitStatus };
}

export function deactivate(): void {
  // all disposables are registered on context.subscriptions
}
