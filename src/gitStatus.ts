/**
 * Read-only git status letters, sourced from the built-in vscode.git extension.
 *
 * v0.5.0 limitation fixed here: our "full" badge rides in the ThemeColor id and
 * cascades over the git letter in the decoration content — so a modified file's
 * "M" disappeared. Instead of fighting the cascade we re-add the letter to the
 * injected text (provider prepends it: "M  1.2 KB").
 *
 * Strictly read-only: only repository state arrays are consumed. No write API
 * (stage/commit/checkout/...) is ever touched. Any failure (git extension
 * missing/disabled, no repositories) degrades to "no letters", never an error.
 */
import * as vscode from 'vscode';

/** Letter per git API Status value — numbers verified against vscode.git's
 *  const enum Status (values 0..18; workspace ref tmp/vs-git-api-git.d.ts:87). */
const STATUS_LETTERS: readonly (string | undefined)[] = [
  'M', // 0  INDEX_MODIFIED
  'A', // 1  INDEX_ADDED
  'D', // 2  INDEX_DELETED
  'R', // 3  INDEX_RENAMED
  'C', // 4  INDEX_COPIED
  'M', // 5  MODIFIED
  'D', // 6  DELETED
  'U', // 7  UNTRACKED
  'I', // 8 IGNORED — vscode.git getStatusLetter shows "I" (aligned in v0.5.2)
  'A', // 9  INTENT_TO_ADD
  'R', // 10 INTENT_TO_RENAME
  'T', // 11 TYPE_CHANGED
  '!', // 12 ADDED_BY_US   (merge conflicts share the "!" marker)
  '!', // 13 ADDED_BY_THEM
  '!', // 14 DELETED_BY_US
  '!', // 15 DELETED_BY_THEM
  '!', // 16 BOTH_ADDED
  '!', // 17 BOTH_DELETED
  '!', // 18 BOTH_MODIFIED
];

/** Status number → status letter; unknown statuses yield undefined. IGNORED
 *  yields 'I' (v0.5.2, mirrors vscode.git's getStatusLetter). */
export function statusLetter(status: number): string | undefined {
  return STATUS_LETTERS[status];
}

/** Theme color id per git API Status value — mirrors vscode.git's
 *  getStatusColor (extensions/git/src/repository.ts) so a lettered badge
 *  renders in exactly the color the theme assigns to that git state. */
const STATUS_COLOR_IDS: readonly (string | undefined)[] = [
  'gitDecoration.stageModifiedResourceForeground', // 0  INDEX_MODIFIED
  'gitDecoration.addedResourceForeground', // 1  INDEX_ADDED
  'gitDecoration.stageDeletedResourceForeground', // 2  INDEX_DELETED
  'gitDecoration.renamedResourceForeground', // 3  INDEX_RENAMED
  'gitDecoration.renamedResourceForeground', // 4  INDEX_COPIED
  'gitDecoration.modifiedResourceForeground', // 5  MODIFIED
  'gitDecoration.deletedResourceForeground', // 6  DELETED
  'gitDecoration.untrackedResourceForeground', // 7  UNTRACKED
  'gitDecoration.ignoredResourceForeground', // 8  IGNORED
  'gitDecoration.addedResourceForeground', // 9  INTENT_TO_ADD
  'gitDecoration.renamedResourceForeground', // 10 INTENT_TO_RENAME
  'gitDecoration.modifiedResourceForeground', // 11 TYPE_CHANGED
  'gitDecoration.conflictingResourceForeground', // 12 ADDED_BY_US
  'gitDecoration.conflictingResourceForeground', // 13 ADDED_BY_THEM
  'gitDecoration.conflictingResourceForeground', // 14 DELETED_BY_US
  'gitDecoration.conflictingResourceForeground', // 15 DELETED_BY_THEM
  'gitDecoration.conflictingResourceForeground', // 16 BOTH_ADDED
  'gitDecoration.conflictingResourceForeground', // 17 BOTH_DELETED
  'gitDecoration.conflictingResourceForeground', // 18 BOTH_MODIFIED
];

/** Status number → the theme color id vscode.git itself uses for that state. */
export function statusColorId(status: number): string | undefined {
  return STATUS_COLOR_IDS[status];
}

/**
 * Same normalization as FileStatService's private keyOf (win32 lower-cases):
 * git URIs and decoration URIs may spell the same file with different casing.
 */
const keyOf = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p);

/** Minimal structural view of the vscode.git exported API (no type dependency). */
interface GitChangeLike {
  readonly uri: { readonly fsPath: string };
  readonly status: number;
}
interface GitRepoStateLike {
  readonly mergeChanges: readonly GitChangeLike[];
  readonly indexChanges: readonly GitChangeLike[];
  readonly workingTreeChanges: readonly GitChangeLike[];
  readonly untrackedChanges: readonly GitChangeLike[];
  readonly onDidChange: vscode.Event<void>;
}
interface GitRepoLike {
  readonly rootUri: { readonly fsPath: string };
  readonly state: GitRepoStateLike;
}
interface GitApiLike {
  readonly repositories: readonly GitRepoLike[];
  readonly onDidOpenRepository: vscode.Event<GitRepoLike>;
  readonly onDidCloseRepository: vscode.Event<GitRepoLike>;
}
interface GitExtensionLike {
  getAPI(version: number): GitApiLike;
}

/**
 * Tracks repository state changes and maintains a flat path → letter map.
 * Fire-and-forget lifecycle: start() never throws and never blocks the caller.
 */
export class GitStatusWatcher {
  private readonly letters = new Map<string, string>();
  /** keyOf(fsPath) → gitDecoration theme color id for that status (v0.5.8). */
  private readonly colors = new Map<string, string>();
  private readonly repos: GitRepoLike[] = [];
  private readonly repoSubs = new Map<GitRepoLike, vscode.Disposable>();
  private apiSubs: vscode.Disposable[] = [];

  constructor(private readonly onChanged: () => void) {}

  /** Resolve the git extension and start listening. Best-effort, silent on failure. */
  async start(): Promise<void> {
    try {
      const gitExt = vscode.extensions.getExtension<GitExtensionLike>('vscode.git');
      if (!gitExt) return; // git extension missing or disabled — stay silent
      const api = (await gitExt.activate()).getAPI(1);
      this.attach(api);
    } catch {
      // activation/API failure must never surface — letters just stay off
    }
  }

  /** Wire to a git API instance (split out so tests can inject a mock). */
  attach(api: GitApiLike): void {
    if (this.apiSubs.length > 0) return; // idempotent: one lifetime per watcher
    for (const repo of api.repositories) this.addRepo(repo);
    this.apiSubs = [
      api.onDidOpenRepository((repo) => this.addRepo(repo)),
      api.onDidCloseRepository((repo) => this.removeRepo(repo)),
    ];
  }

  getLetter(fsPath: string): string | undefined {
    return this.letters.get(keyOf(fsPath));
  }

  /** The gitDecoration theme color id for this path's status (v0.5.8) — the
   *  badge payload uses it so lettered rows render in the theme's git color. */
  getGitColorId(fsPath: string): string | undefined {
    return this.colors.get(keyOf(fsPath));
  }

  /** Theme color id for the letter of fsPath (v0.6.0 git gating): inside a repo
   *  with a letter → the gitDecoration id for that status (getGitColorId);
   *  outside any repo or letterless → undefined. `''` (a status with no table
   *  color) normalizes to undefined so the provider falls back cleanly. */
  letterColorId(fsPath: string): string | undefined {
    if (!this.insideRepo(fsPath)) return undefined;
    if (this.getLetter(fsPath) === undefined) return undefined;
    return this.getGitColorId(fsPath) || undefined;
  }

  /** Normalized containment on keyOf'd, forward-slashed paths: strict=true
   *  requires p strictly under root (file-level check); strict=false also
   *  accepts equality (workspace-folder coverage check). */
  private static under(p: string, root: string, strict: boolean): boolean {
    const prefixed = root.endsWith('/') ? root : `${root}/`;
    return strict ? p.startsWith(prefixed) : p === root || p.startsWith(prefixed);
  }

  /**
   * True when fsPath lies strictly under a subscribed repository root (the root
   * itself does not count). Prefix matching runs on the keyOf'd root with a
   * trailing separator, so a sibling directory ("repoFoo" vs root "repo") never
   * matches; both slash styles are normalized for the containment check.
   * Extracted in v0.5.3; since v0.6.0 it also gates letterColorId (letters only
   * exist where a repo covers the path).
   */
  insideRepo(fsPath: string): boolean {
    const p = keyOf(fsPath).replace(/\\/g, '/');
    return this.repos.some((repo) =>
      GitStatusWatcher.under(p, keyOf(repo.rootUri.fsPath).replace(/\\/g, '/'), true),
    );
  }

  /**
   * True when fsPath EQUALS or lies under a subscribed repository root — the
   * folder-level coverage test (a folder that is itself a repo root is covered,
   * unlike the file-level insideRepo; reported by the diagnose command).
   */
  coversWorkspaceRoot(fsPath: string): boolean {
    const p = keyOf(fsPath).replace(/\\/g, '/');
    return this.repos.some((repo) =>
      GitStatusWatcher.under(p, keyOf(repo.rootUri.fsPath).replace(/\\/g, '/'), false),
    );
  }

  /**
   * True when fsPath lies inside a repo and carries no status letter — the
   * "clean file" condition for the ✓ badge (v0.5.3: built on insideRepo).
   */
  isClean(fsPath: string): boolean {
    return this.getLetter(fsPath) === undefined && this.insideRepo(fsPath);
  }

  /** Diagnostics: how many repositories the watcher is attached to. */
  get repoCount(): number {
    return this.repos.length;
  }

  /** Diagnostics: subscribed repository roots (original spelling). */
  get repoRoots(): string[] {
    return this.repos.map((r) => r.rootUri.fsPath);
  }

  dispose(): void {
    for (const sub of this.apiSubs) sub.dispose();
    this.apiSubs = [];
    for (const sub of this.repoSubs.values()) sub.dispose();
    this.repoSubs.clear();
    this.repos.length = 0;
    this.letters.clear();
    this.colors.clear();
  }

  private addRepo(repo: GitRepoLike): void {
    if (this.repoSubs.has(repo)) return;
    this.repos.push(repo);
    this.repoSubs.set(repo, repo.state.onDidChange(() => this.rebuild()));
    this.rebuild();
  }

  private removeRepo(repo: GitRepoLike): void {
    const i = this.repos.indexOf(repo);
    if (i >= 0) this.repos.splice(i, 1);
    this.repoSubs.get(repo)?.dispose();
    this.repoSubs.delete(repo);
    this.rebuild();
  }

  /**
   * Rebuild the path → letter map. Groups are written in the documented order
   * (merge, workingTree, untracked, index) and a later group never overwrites
   * an earlier letter for the same path — net precedence: merge > workingTree >
   * untracked > index.
   */
  private rebuild(): void {
    const next = new Map<string, string>();
    const nextColors = new Map<string, string>();
    for (const repo of this.repos) {
      const s = repo.state;
      GitStatusWatcher.addChanges(next, nextColors, s.mergeChanges);
      GitStatusWatcher.addChanges(next, nextColors, s.workingTreeChanges);
      GitStatusWatcher.addChanges(next, nextColors, s.untrackedChanges);
      GitStatusWatcher.addChanges(next, nextColors, s.indexChanges);
    }
    // git re-statuses constantly (fs watchers, autofetch); only a real letter
    // change justifies a full provider.fire(undefined) decoration refresh
    const changed =
      next.size !== this.letters.size || [...next].some(([k, v]) => this.letters.get(k) !== v);
    if (!changed) return;
    this.letters.clear();
    for (const [k, v] of next) this.letters.set(k, v);
    this.colors.clear();
    for (const [k, v] of nextColors) this.colors.set(k, v);
    this.onChanged();
  }

  private static addChanges(
    into: Map<string, string>,
    colors: Map<string, string>,
    changes: readonly GitChangeLike[],
  ): void {
    for (const c of changes) {
      const letter = statusLetter(c.status);
      if (letter === undefined) continue;
      const key = keyOf(c.uri.fsPath);
      if (!into.has(key)) {
        into.set(key, letter);
        colors.set(key, statusColorId(c.status) ?? '');
      }
    }
  }
}
