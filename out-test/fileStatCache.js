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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStatService = void 0;
/**
 * Thin stat/folder-size service with an in-memory cache.
 *
 * Cache policy (per requirements): NO persistent cache. Only in-memory entries for
 * paths VSCode has actually asked about (visible Explorer items) plus computed
 * folder sizes. Every FileSystemWatcher event invalidates the affected path and
 * all cached folder sizes that contain it; the next decoration request re-stats
 * from disk — always fresh, never stale.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Global cap on in-flight lstat/readdir across ALL walks of one service.
 *  v0.6.4: this was the per-walk batch size — N concurrently kicked folder
 *  rows each ran their own 64-way walk, an N×64 IO burst on startup. */
const WALK_CONCURRENCY = 64;
/** Hard cap on visited entries per folder — protects against pathological trees. */
const MAX_WALK_ENTRIES = 200_000;
/**
 * FIFO counting semaphore shared by every folder walk of one FileStatService.
 * release() hands the slot straight to the queue head — the woken waiter does
 * NOT re-increment, so it can never be overtaken by a fresh acquire between
 * its wake-up and its resumption (strict FIFO). Callers must release in a
 * `finally`, which keeps reject paths from leaking slots.
 */
class WalkGate {
    limit;
    /** live holders; also counts handed-over slots during the wake-up window */
    active = 0;
    highWater = 0;
    queue = [];
    constructor(limit) {
        this.limit = limit;
    }
    async acquire() {
        if (this.active < this.limit) {
            this.active += 1;
            if (this.active > this.highWater)
                this.highWater = this.active;
            return;
        }
        // woken by release(), which reserved this very slot — do not increment
        await new Promise((resolve) => this.queue.push(resolve));
    }
    release() {
        const next = this.queue.shift();
        if (next) {
            next(); // slot transferred; `active` intentionally unchanged
            return;
        }
        this.active -= 1;
    }
    /** Test probe: live occupancy + high-water mark (drains to 0 when idle). */
    stats() {
        return { inFlight: this.active, peak: this.highWater };
    }
}
/**
 * Normalize cache keys: Windows paths are case-insensitive — `C:\Foo` and `c:\foo`
 * are the same file, so both cache storage and invalidation must use one spelling,
 * otherwise an event spelled differently would miss the cached entry.
 */
const keyOf = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
class FileStatService {
    folderIgnore;
    maxEntries;
    statCache = new Map();
    folderCache = new Map();
    inflightFolders = new Map();
    /** concurrent stat() misses for the same path share one lstat (scroll re-renders) */
    inflightStats = new Map();
    /** normalized key → path as first seen (VSCode decoration cache keys on the original casing) */
    originalPaths = new Map();
    /** v0.6.4: every walkDir lstat/readdir queues on this service-wide gate */
    walkGate = new WalkGate(WALK_CONCURRENCY);
    /** Test probe: gate occupancy + high-water mark (≤WALK_CONCURRENCY, drains to 0). */
    get walkGateStats() {
        return this.walkGate.stats();
    }
    constructor(folderIgnore = new Set(), maxEntries = MAX_WALK_ENTRIES) {
        this.folderIgnore = folderIgnore;
        this.maxEntries = maxEntries;
    }
    /** Replace the ignore list (settings change at runtime — no restart). */
    updateIgnore(folderIgnore) {
        this.folderIgnore = folderIgnore;
    }
    /** lstat (does not follow symlinks — we show the link itself). undefined on any fs error.
     *  Concurrent misses for the same path share a single lstat (the Explorer re-queries
     *  rows while scrolling; without dedupe each render pass re-issued cold lstats). */
    async stat(fsPath) {
        const key = keyOf(fsPath);
        const cached = this.statCache.get(key);
        if (cached)
            return cached;
        const inflight = this.inflightStats.get(key);
        if (inflight)
            return inflight;
        const p = (async () => {
            try {
                const st = await fs.promises.lstat(fsPath);
                const info = {
                    size: st.size,
                    mtimeMs: st.mtimeMs,
                    birthtimeMs: st.birthtimeMs,
                    isDirectory: st.isDirectory(),
                    isSymbolicLink: st.isSymbolicLink(),
                    // owner-write bit cleared ⇔ Windows read-only attribute
                    readonly: (st.mode & 0o222) === 0,
                };
                this.statCache.set(key, info);
                return info;
            }
            catch {
                return undefined;
            }
        })();
        this.inflightStats.set(key, p);
        void p.finally(() => {
            this.inflightStats.delete(key);
        });
        return p;
    }
    /** Read the target of a symlink (raw string, may be relative). undefined on failure. */
    async symlinkTarget(fsPath) {
        try {
            return await fs.promises.readlink(fsPath);
        }
        catch {
            return undefined;
        }
    }
    /**
     * Startup warmup: stat the first directory level of a workspace root into the
     * cache so the Explorer's first paint has warm entries. Files only, no
     * recursion; any error is swallowed (warmup is best-effort, never fatal).
     */
    async primeRoot(rootFsPath) {
        let files;
        try {
            const entries = await fs.promises.readdir(rootFsPath, { withFileTypes: true });
            files = entries.filter((e) => e.isFile()).map((e) => path.join(rootFsPath, e.name));
        }
        catch {
            return; // unreadable root — nothing to warm
        }
        // v0.6.4: stat in batches of 64, yielding to the event loop between batches
        // so a huge root no longer competes with VSCode's own startup IO at full
        // parallelism. Total behavior unchanged — every file still ends up warm.
        const yieldTurn = () => new Promise((resolve) => globalThis.setImmediate(resolve));
        for (let i = 0; i < files.length; i += WALK_CONCURRENCY) {
            await Promise.all(files.slice(i, i + WALK_CONCURRENCY).map((f) => this.stat(f)));
            if (i + WALK_CONCURRENCY < files.length)
                await yieldTurn();
        }
    }
    /** Cached folder total WITHOUT triggering a walk (undefined if none yet). */
    peekFolderSize(fsPath) {
        return this.folderCache.get(keyOf(fsPath));
    }
    /**
     * Recursive folder size. Concurrent calls for the same path share one walk.
     * Symlinked directories are NOT followed (loop safety); ignored names are skipped
     * and flagged via `partial`.
     */
    folderSize(fsPath) {
        const key = keyOf(fsPath);
        const cached = this.folderCache.get(key);
        if (cached)
            return Promise.resolve(cached);
        const inflight = this.inflightFolders.get(key);
        if (inflight)
            return inflight;
        const p = this.walkDir(fsPath)
            .then((info) => {
            // re-check: an invalidate() during the walk means this result is stale
            if (!this.inflightFolders.has(key))
                return undefined;
            this.folderCache.set(key, info);
            this.originalPaths.set(key, fsPath);
            return info;
        })
            .catch(() => undefined)
            .finally(() => {
            this.inflightFolders.delete(key);
        });
        this.inflightFolders.set(key, p);
        return p;
    }
    async walkDir(root) {
        const result = { bytes: 0, files: 0, dirs: 0, partial: false, errored: 0 };
        let visited = 0;
        let stop = false; // only the entry cap may abort the walk
        const queue = [root];
        // v0.6.4: every fs op of every walk passes the shared gate; the finally
        // guarantees release on the reject path too (no slot leak → no deadlock).
        const gated = async (task) => {
            await this.walkGate.acquire();
            try {
                return await task();
            }
            finally {
                this.walkGate.release();
            }
        };
        while (queue.length > 0 && !stop) {
            const batch = queue.splice(0, WALK_CONCURRENCY);
            const statted = await Promise.all(batch.map(async (p) => {
                try {
                    return { p, st: await gated(() => fs.promises.lstat(p)) };
                }
                catch {
                    result.errored++;
                    return undefined;
                }
            }));
            const dirPending = [];
            for (const item of statted) {
                if (!item)
                    continue;
                if (++visited > this.maxEntries) {
                    result.partial = true; // entry cap: result is a lower bound
                    stop = true;
                    break;
                }
                if (item.st.isDirectory()) {
                    result.dirs++;
                    result.bytes += item.st.size;
                    dirPending.push(item.p);
                }
                else {
                    result.files++;
                    result.bytes += item.st.size;
                }
            }
            if (stop)
                break;
            // read children of directories found in this batch, in parallel
            const childLists = await Promise.all(dirPending.map(async (dir) => {
                if (this.folderIgnore.has(path.basename(dir))) {
                    // skipped subtree: result stays a lower bound but the walk continues
                    result.partial = true;
                    return [];
                }
                try {
                    const children = await gated(() => fs.promises.readdir(dir));
                    return children.map((c) => path.join(dir, c));
                }
                catch {
                    result.errored++;
                    return [];
                }
            }));
            for (const children of childLists)
                queue.push(...children);
        }
        return result;
    }
    /**
     * Invalidate a changed path plus every cached folder size whose subtree contains it.
     * @returns all invalidated folder paths (callers fire decoration changes for them).
     */
    invalidate(fsPath) {
        const key = keyOf(fsPath);
        this.statCache.delete(key);
        const affected = [];
        for (const dir of this.folderCache.keys()) {
            if (key === dir || key.startsWith(dir + path.sep)) {
                this.folderCache.delete(dir); // safe during Map key iteration
                affected.push(this.originalPaths.get(dir) ?? dir);
            }
        }
        // a walk in flight for an invalidated folder must not cache its stale result
        for (const dir of affected)
            this.inflightFolders.delete(dir);
        return affected;
    }
    clear() {
        this.statCache.clear();
        this.folderCache.clear();
        this.originalPaths.clear();
    }
}
exports.FileStatService = FileStatService;
