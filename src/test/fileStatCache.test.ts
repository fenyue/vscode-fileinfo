/**
 * FileStatService behavior tests against a real temp tree: folder totals,
 * ignore list, prefix invalidation, and Windows case-insensitive key handling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStatService } from '../fileStatCache.js';

const IS_WIN = process.platform === 'win32';

function makeTree(): string {
  // root/
  //   a.txt (100 B)   b.bin (2048 B)   sub/ c.txt (10 B)   sub/deep/ d.txt (1 B)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-stat-'));
  fs.writeFileSync(path.join(root, 'a.txt'), Buffer.alloc(100));
  fs.writeFileSync(path.join(root, 'b.bin'), Buffer.alloc(2048));
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'c.txt'), Buffer.alloc(10));
  fs.mkdirSync(path.join(root, 'sub', 'deep'));
  fs.writeFileSync(path.join(root, 'sub', 'deep', 'd.txt'), Buffer.alloc(1));
  return root;
}

test('folderSize aggregates files, dirs and bytes of a real tree', async () => {
  const root = makeTree();
  try {
    const svc = new FileStatService(new Set());
    const info = await svc.folderSize(root);
    assert.equal(info?.files, 4);
    assert.equal(info?.dirs, 3); // root itself + sub + deep
    assert.equal(info?.bytes, 100 + 2048 + 10 + 1);
    assert.equal(info?.partial, false);
    assert.equal(info?.errored, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('folderSize skips ignored names and flags partial', async () => {
  const root = makeTree();
  fs.mkdirSync(path.join(root, 'sub', 'node_modules'));
  fs.writeFileSync(path.join(root, 'sub', 'node_modules', 'huge.js'), Buffer.alloc(50_000));
  try {
    const svc = new FileStatService(new Set(['node_modules']));
    const info = await svc.folderSize(root);
    assert.equal(info?.partial, true);
    assert.equal(info?.files, 4); // huge.js not counted
    assert.equal(info?.bytes, 100 + 2048 + 10 + 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('invalidate of a nested file drops the enclosing folder size and reports it', async () => {
  const root = makeTree();
  try {
    const svc = new FileStatService(new Set());
    await svc.folderSize(root);
    const affected = svc.invalidate(path.join(root, 'sub', 'c.txt'));
    assert.deepEqual(affected, [root], 'ancestor folder must be reported invalidated');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('invalidate returns the folder path in its original casing', async () => {
  // Windows-only meaningfulness: cache keys are lowercased, but the event
  // consumers need the path exactly as VSCode spelled it.
  const root = makeTree();
  try {
    const svc = new FileStatService(new Set());
    await svc.folderSize(root);
    const probe = IS_WIN
      ? root.toUpperCase() + path.sep + 'sub' + path.sep + 'c.txt'
      : path.join(root, 'sub', 'c.txt');
    const affected = svc.invalidate(probe);
    assert.equal(affected.length, 1);
    assert.equal(affected[0], root, 'original root casing must survive invalidation');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stat reads real files; cache hit keeps working after invalidate of other paths', async () => {
  const root = makeTree();
  try {
    const svc = new FileStatService(new Set());
    const st = await svc.stat(path.join(root, 'a.txt'));
    assert.equal(st?.size, 100);
    assert.equal(st?.isDirectory, false);
    svc.invalidate(path.join(root, 'b.bin'));
    const again = await svc.stat(path.join(root, 'a.txt'));
    assert.equal(again?.size, 100);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('non-ASCII (CJK) file names stat and invalidate correctly', async () => {
  const root = makeTree();
  const cjkName = '中文文件·测试.txt';
  const file = path.join(root, cjkName);
  fs.writeFileSync(file, Buffer.alloc(3_000));
  try {
    const svc = new FileStatService(new Set());
    const st = await svc.stat(file);
    assert.equal(st?.size, 3_000);
    const info = await svc.folderSize(root);
    assert.equal(info?.files, 5); // 4 from makeTree + the CJK file
    const affected = svc.invalidate(file);
    assert.deepEqual(affected, [root]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('v0.5.7 perf: concurrent stat() misses share a single lstat', async () => {
  const real = fs.promises.lstat.bind(fs.promises);
  let calls = 0;
  (fs.promises as { lstat: unknown }).lstat = (p: string) => {
    calls += 1;
    return real(p);
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-dedupe-'));
  const file = path.join(dir, 'f.bin');
  fs.writeFileSync(file, Buffer.alloc(10, 1));
  try {
    const svc = new FileStatService();
    const [a, b, c] = await Promise.all([svc.stat(file), svc.stat(file), svc.stat(file)]);
    assert.equal(calls, 1, `three concurrent misses must share one lstat, got ${calls}`);
    assert.equal(a?.size, 10);
    assert.equal(b?.size, 10);
    assert.equal(c?.size, 10);
    assert.equal(calls, 1, 'cache hit afterwards issues no lstat');
  } finally {
    (fs.promises as { lstat: unknown }).lstat = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v0.6.4: walk gate caps fs concurrency across parallel walks and drains to zero', async () => {
  // slow lstat just enough that three walks genuinely overlap; count live ops
  const real = fs.promises.lstat.bind(fs.promises);
  let live = 0;
  let fsPeak = 0;
  (fs.promises as { lstat: unknown }).lstat = (p: string) => {
    live += 1;
    if (live > fsPeak) fsPeak = live;
    return new Promise((resolve) => {
      setTimeout(() => {
        live -= 1;
        resolve(real(p));
      }, 5);
    });
  };
  const mkRoot = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gate-'));
    for (let i = 0; i < 70; i += 1) fs.writeFileSync(path.join(root, `f${i}.bin`), Buffer.alloc(10, 1));
    return root;
  };
  const roots = [mkRoot(), mkRoot(), mkRoot()];
  try {
    const svc = new FileStatService(new Set());
    // 3 walks × 71 gated lstats each: ungated this would burst toward 3×64=192
    await Promise.all(roots.map((r) => svc.folderSize(r)));
    const gate = svc.walkGateStats;
    assert.ok(gate.peak <= 64, `gate high-water must stay ≤64, got ${gate.peak}`);
    assert.ok(fsPeak <= 64, `fs-level concurrency must stay ≤64, got ${fsPeak}`);
    assert.ok(fsPeak > 8, `walks must actually overlap (fs peak ${fsPeak})`);
    assert.equal(gate.inFlight, 0, 'gate must drain to zero after all walks finish (no slot leak)');
    // the gate must not change walk results
    for (const r of roots) {
      const info = await svc.folderSize(r);
      assert.equal(info?.files, 70);
      assert.equal(info?.partial, false);
      assert.equal(info?.errored, 0);
    }
  } finally {
    (fs.promises as { lstat: unknown }).lstat = real;
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
});

test('v0.6.4: primeRoot yields between 64-entry batches and warms every entry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-prime-'));
  const total = 100; // 2 batches: 64 + 36 → at least one inter-batch yield
  for (let i = 0; i < total; i += 1) fs.writeFileSync(path.join(root, `f${i}.bin`), Buffer.alloc(10, 1));

  const real = fs.promises.lstat.bind(fs.promises);
  let lstats = 0;
  (fs.promises as { lstat: unknown }).lstat = (p: string) => {
    lstats += 1;
    return real(p);
  };
  const realSetImmediate = globalThis.setImmediate.bind(globalThis) as (...args: unknown[]) => unknown;
  let yields = 0;
  type SetImmediateLike = (fn: (...args: unknown[]) => void, ...rest: unknown[]) => unknown;
  (globalThis as unknown as { setImmediate: SetImmediateLike }).setImmediate = (fn, ...rest) => {
    yields += 1;
    return realSetImmediate(fn, ...rest);
  };
  try {
    const svc = new FileStatService(new Set());
    await svc.primeRoot(root);
    assert.ok(yields >= 1, `prime of ${total} entries must yield between batches, got ${yields}`);
    assert.equal(lstats, total, `every entry stat'ed exactly once, got ${lstats}`);
    // warmed: stat of every entry is served from cache — no new lstat
    for (let i = 0; i < total; i += 1) await svc.stat(path.join(root, `f${i}.bin`));
    assert.equal(lstats, total, 'warmed entries must be served from cache');
  } finally {
    (globalThis as unknown as { setImmediate: (...args: unknown[]) => unknown }).setImmediate =
      realSetImmediate as unknown as (...args: unknown[]) => unknown;
    (fs.promises as { lstat: unknown }).lstat = real;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
