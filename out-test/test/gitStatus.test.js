"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GitStatusWatcher unit tests: Status→letter golden table, rebuild precedence
 * (merge > workingTree > untracked > index; later groups never overwrite),
 * win32 case-insensitive lookup, and the missing-git-extension path.
 * Runs under plain node:test with a stubbed 'vscode' module (same style as
 * smoke.test.ts) — gitStatus.ts only touches vscode.extensions at runtime.
 */
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const nodeModule = __importStar(require("node:module"));
const moduleLoad = () => nodeModule.Module._load;
/** Install a vscode stub whose vscode.git exports are controllable per test. */
function installVscodeStub() {
    const origLoad = moduleLoad();
    const state = { gitExports: undefined };
    const stub = {
        extensions: {
            getExtension: (id) => id === 'vscode.git' && state.gitExports !== undefined
                ? { activate: async () => state.gitExports }
                : undefined,
        },
    };
    const patched = function patchedLoad(request, parent, isMain) {
        if (request === 'vscode')
            return stub;
        return origLoad(request, parent, isMain);
    };
    nodeModule.Module._load = patched;
    return { setGitExports: (e) => (state.gitExports = e) };
}
const stub = installVscodeStub();
// loaded AFTER the stub hook is in place; compiles to CJS so require is available
const gitStatusModule = require('../gitStatus.js');
const { GitStatusWatcher, statusLetter } = gitStatusModule;
const changeOf = (c) => ({
    uri: { fsPath: c.fsPath },
    status: c.status,
});
/** One mock repository: mutable change groups + manual onDidChange fire. */
function makeRepo(root = 'C:/r') {
    const groups = {
        merge: [],
        wt: [],
        untracked: [],
        index: [],
    };
    const listeners = [];
    const repo = {
        rootUri: { fsPath: root },
        state: {
            get mergeChanges() {
                return groups.merge.map(changeOf);
            },
            get workingTreeChanges() {
                return groups.wt.map(changeOf);
            },
            get untrackedChanges() {
                return groups.untracked.map(changeOf);
            },
            get indexChanges() {
                return groups.index.map(changeOf);
            },
            onDidChange: (f) => {
                listeners.push(f);
                return { dispose: () => { } };
            },
        },
    };
    return {
        repo,
        groups,
        fire: () => {
            for (const f of [...listeners])
                f();
        },
    };
}
/** Mock git API capturing open/close events. */
function makeApi(repos) {
    let onOpen;
    let onClose;
    const api = {
        repositories: repos,
        onDidOpenRepository: (f) => {
            onOpen = f;
            return { dispose: () => { } };
        },
        onDidCloseRepository: (f) => {
            onClose = f;
            return { dispose: () => { } };
        },
    };
    return {
        api,
        open: (r) => onOpen?.(r),
        close: (r) => onClose?.(r),
    };
}
const attachTyped = (w, api) => w.attach(api);
(0, node_test_1.test)('letter mapping covers all 19 Status values (golden table)', () => {
    const expected = [
        'M', // 0 INDEX_MODIFIED
        'A', // 1 INDEX_ADDED
        'D', // 2 INDEX_DELETED
        'R', // 3 INDEX_RENAMED
        'C', // 4 INDEX_COPIED
        'M', // 5 MODIFIED
        'D', // 6 DELETED
        'U', // 7 UNTRACKED
        'I', // 8 IGNORED — vscode.git getStatusLetter shows "I" (aligned in v0.5.2)
        'A', // 9 INTENT_TO_ADD
        'R', // 10 INTENT_TO_RENAME
        'T', // 11 TYPE_CHANGED
        '!', // 12 ADDED_BY_US
        '!', // 13 ADDED_BY_THEM
        '!', // 14 DELETED_BY_US
        '!', // 15 DELETED_BY_THEM
        '!', // 16 BOTH_ADDED
        '!', // 17 BOTH_DELETED
        '!', // 18 BOTH_MODIFIED
    ];
    for (let i = 0; i < expected.length; i++) {
        strict_1.default.equal(statusLetter(i), expected[i], `status ${i}`);
    }
    strict_1.default.equal(statusLetter(19), undefined, 'out of range → no letter');
    strict_1.default.equal(statusLetter(-1), undefined, 'negative → no letter');
});
(0, node_test_1.test)('rebuild precedence: merge beats workingTree; later groups never overwrite', () => {
    const repo = makeRepo();
    // same path in every group — the merge letter must win
    repo.groups.merge.push({ fsPath: 'C:/r/conflict.txt', status: 18 }); // BOTH_MODIFIED → !
    repo.groups.wt.push({ fsPath: 'C:/r/conflict.txt', status: 5 }); // MODIFIED → M (must lose)
    // workingTree beats untracked and index
    repo.groups.wt.push({ fsPath: 'C:/r/mod.txt', status: 5 });
    repo.groups.untracked.push({ fsPath: 'C:/r/mod.txt', status: 7 }); // U must lose
    repo.groups.index.push({ fsPath: 'C:/r/mod.txt', status: 1 }); // A must lose
    // index-only path keeps its letter
    repo.groups.index.push({ fsPath: 'C:/r/staged.txt', status: 1 });
    // IGNORED carries "I" since v0.5.2 — the first group wins like any other letter
    repo.groups.wt.push({ fsPath: 'C:/r/skip.txt', status: 8 });
    repo.groups.index.push({ fsPath: 'C:/r/skip.txt', status: 1 });
    let fired = 0;
    const w = new GitStatusWatcher(() => fired++);
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.getLetter('C:/r/conflict.txt'), '!', 'merge letter wins over workingTree');
    strict_1.default.equal(w.getLetter('C:/r/mod.txt'), 'M', 'workingTree beats untracked and index');
    strict_1.default.equal(w.getLetter('C:/r/staged.txt'), 'A', 'index-only path keeps its letter');
    strict_1.default.equal(w.getLetter('C:/r/skip.txt'), 'I', 'IGNORED letter wins by group order (workingTree beats index)');
    strict_1.default.equal(w.getLetter('C:/r/absent.txt'), undefined, 'unknown path → undefined');
    strict_1.default.ok(fired > 0, 'rebuild completion must fire the change callback');
    // a state change re-rebuilds: clearing merge leaves the workingTree letter
    repo.groups.merge.length = 0;
    repo.fire();
    strict_1.default.equal(w.getLetter('C:/r/conflict.txt'), 'M', 'after merge resolves, workingTree letter shows');
    strict_1.default.ok(fired > 1, 'state change must re-fire the callback');
    w.dispose();
});
(0, node_test_1.test)('late-opened repositories are picked up; closed ones drop out', () => {
    const { api, open, close } = makeApi([]);
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, api);
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/late/file.txt', status: 5 });
    open(repo.repo);
    strict_1.default.equal(w.getLetter('C:/late/file.txt'), 'M', 'open event must wire the new repo');
    close(repo.repo);
    strict_1.default.equal(w.getLetter('C:/late/file.txt'), undefined, 'close event must drop the repo');
    w.dispose();
});
(0, node_test_1.test)('lookup normalizes case on win32 (same rule as fileStatCache keyOf)', () => {
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/Repo/Case.TXT', status: 5 });
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.getLetter('C:/Repo/Case.TXT'), 'M', 'exact spelling hits');
    if (process.platform === 'win32') {
        strict_1.default.equal(w.getLetter('c:/repo/case.txt'), 'M', 'lower-cased spelling hits too');
    }
    w.dispose();
});
(0, node_test_1.test)('missing/disabled git extension: start() stays silent, letters stay off', async () => {
    // stub.getExtension returns undefined (gitExports never set)
    const w = new GitStatusWatcher(() => { });
    await strict_1.default.doesNotReject(() => w.start());
    strict_1.default.equal(w.getLetter('C:/r/anything.txt'), undefined);
    w.dispose();
});
(0, node_test_1.test)('start() wires a live git extension end-to-end through vscode.extensions', async () => {
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/live/mod.txt', status: 5 });
    stub.setGitExports({ getAPI: () => makeApi([repo.repo]).api });
    const w = new GitStatusWatcher(() => { });
    await strict_1.default.doesNotReject(() => w.start());
    strict_1.default.equal(w.getLetter('C:/live/mod.txt'), 'M', 'letters flow from the activated git API');
    w.dispose();
});
(0, node_test_1.test)('isClean: file inside a repo without any letter is clean; letter/root/outside are not', () => {
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/r/dirty.txt', status: 5 });
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.isClean('C:/r/clean.txt'), true, 'inside repo, no letter → clean');
    strict_1.default.equal(w.isClean('C:/r/dirty.txt'), false, 'any status letter → not clean');
    strict_1.default.equal(w.isClean('C:/elsewhere/x.txt'), false, 'outside every repo → not clean');
    strict_1.default.equal(w.isClean('C:/r'), false, 'the repo root itself is not a clean file path');
    if (process.platform === 'win32') {
        strict_1.default.equal(w.isClean('c:/R/CLEAN.TXT'), true, 'case-normalized lookup, same keyOf rule');
    }
    w.dispose();
});
(0, node_test_1.test)('isClean: repo-root prefix must not over-match sibling directories (tight boundary)', () => {
    const first = makeRepo('C:/r');
    const second = makeRepo('C:/rFoo'); // sibling whose path merely starts with "C:/r"
    second.groups.wt.push({ fsPath: 'C:/rFoo/dirty.txt', status: 5 });
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([first.repo, second.repo]).api);
    strict_1.default.equal(w.isClean('C:/rFoo/clean.txt'), true, 'clean file in the second repo');
    strict_1.default.equal(w.isClean('C:/rFoo/dirty.txt'), false, 'lettered file in the second repo');
    strict_1.default.equal(w.isClean('C:/rFooX/clean.txt'), false, '"repoFoo" is not inside "repo" (prefix guard)');
    strict_1.default.equal(w.isClean('C:/r/clean.txt'), true, 'first repo still matches');
    w.dispose();
});
(0, node_test_1.test)('v0.5.3 insideRepo/coversWorkspaceRoot: file-level vs folder-level containment', () => {
    const repo = makeRepo('C:/r');
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.insideRepo('C:/r/f.txt'), true, 'file under the root is inside');
    strict_1.default.equal(w.insideRepo('C:/r'), false, 'the root itself is not strictly inside');
    strict_1.default.equal(w.insideRepo('C:/rFoo/f.txt'), false, 'sibling prefix must not match');
    strict_1.default.equal(w.coversWorkspaceRoot('C:/r'), true, 'a workspace folder equal to the root IS covered');
    strict_1.default.equal(w.coversWorkspaceRoot('C:/r/sub'), true, 'folder under the root is covered');
    strict_1.default.equal(w.coversWorkspaceRoot('C:/rFoo'), false, 'sibling folder is not covered');
    strict_1.default.equal(w.coversWorkspaceRoot('C:/nowhere'), false, 'unrelated folder is not covered');
    w.dispose();
});
(0, node_test_1.test)('v0.5.7 perf: rebuild with unchanged letters does not fire the refresh callback', () => {
    const r = makeRepo();
    let fires = 0;
    const w = new GitStatusWatcher(() => {
        fires += 1;
    });
    attachTyped(w, makeApi([r.repo]).api);
    r.groups.wt.push({ fsPath: 'C:/r/m.txt', status: 5 }); // MODIFIED
    r.fire();
    strict_1.default.equal(fires, 1, 'first letter build fires once');
    r.fire();
    r.fire();
    strict_1.default.equal(fires, 1, 'identical state re-fires must not trigger full refreshes');
    r.groups.wt.push({ fsPath: 'C:/r/u.txt', status: 7 }); // UNTRACKED
    r.fire();
    strict_1.default.equal(fires, 2, 'a real letter change fires again');
    w.dispose();
});
(0, node_test_1.test)('v0.5.8 getGitColorId: status → gitDecoration color id, same keyOf as getLetter', () => {
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/r/mod.txt', status: 5 }); // MODIFIED
    repo.groups.untracked.push({ fsPath: 'C:/r/new.txt', status: 7 }); // UNTRACKED
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.getGitColorId('C:/r/mod.txt'), 'gitDecoration.modifiedResourceForeground');
    strict_1.default.equal(w.getGitColorId('C:/r/new.txt'), 'gitDecoration.untrackedResourceForeground');
    strict_1.default.equal(w.getGitColorId('C:/r/absent.txt'), undefined, 'letterless path → no color');
    if (process.platform === 'win32') {
        strict_1.default.equal(w.getGitColorId('c:/R/MOD.TXT'), 'gitDecoration.modifiedResourceForeground', 'case-normalized lookup, same keyOf rule as letters');
    }
    w.dispose();
});
(0, node_test_1.test)('v0.6.0 letterColorId: repo+letter → gitDecoration id; letterless/outside → undefined', () => {
    const repo = makeRepo();
    repo.groups.wt.push({ fsPath: 'C:/r/mod.txt', status: 5 }); // MODIFIED
    const w = new GitStatusWatcher(() => { });
    attachTyped(w, makeApi([repo.repo]).api);
    strict_1.default.equal(w.letterColorId('C:/r/mod.txt'), 'gitDecoration.modifiedResourceForeground', 'lettered path inside the repo → the git status color');
    strict_1.default.equal(w.letterColorId('C:/r/clean.txt'), undefined, 'inside the repo but letterless → undefined');
    strict_1.default.equal(w.letterColorId('C:/elsewhere/x.txt'), undefined, 'outside every repo → undefined (pure-size row)');
    if (process.platform === 'win32') {
        strict_1.default.equal(w.letterColorId('c:/R/MOD.TXT'), 'gitDecoration.modifiedResourceForeground', 'case-normalized lookup, same keyOf rule as letters');
    }
    w.dispose();
});
