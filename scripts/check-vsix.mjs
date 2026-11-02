#!/usr/bin/env node
// check-vsix.mjs — verify the contents of a packaged .vsix (a zip archive).
// Usage: node scripts/check-vsix.mjs <path.vsix>
// Lists entries via bsdtar (ships with Windows 10+ in System32, reads zip
// natively), then asserts a PASS/FAIL checklist; exits 1 on any FAIL.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function fail(msg) {
  console.error('error: ' + msg);
  process.exit(2);
}

const arg = process.argv[2];
if (!arg) fail('usage: node scripts/check-vsix.mjs <path.vsix>');
const vsix = path.resolve(arg);
if (!existsSync(vsix)) fail('file not found: ' + vsix);

// On Windows always use the System32 bsdtar — MSYS/GNU tar (likely earlier in
// a Git-Bash PATH) cannot read zip. Elsewhere plain `tar` (bsdtar on macOS).
const tarExe =
  process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : 'tar';

let listing;
try {
  listing = execFileSync(tarExe, ['-tf', vsix], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  fail('tar -tf failed: ' + err.message);
}

// VSIX layout: extension payloads live under `extension/`; the manifest and
// content types sit at the archive root. Strip the prefix so the checklist is
// written against the package root (what .vscodeignore governs).
const entries = listing
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((e) => (e.startsWith('extension/') ? e.slice('extension/'.length) : e))
  .filter(Boolean);

// vsce normalizes well-known files when packaging (readme/changelog lower-cased,
// LICENSE → LICENSE.txt), so each required item accepts its normalized aliases.
const required = [
  { label: 'package.json', names: ['package.json'] },
  { label: 'out/extension.js', names: ['out/extension.js'] },
  { label: 'README.md', names: ['README.md', 'readme.md'] },
  { label: 'CHANGELOG.md', names: ['CHANGELOG.md', 'changelog.md'] },
  { label: 'LICENSE', names: ['LICENSE', 'LICENSE.txt', 'license.txt'] },
  { label: 'assets/icon.png', names: ['assets/icon.png'] },
  { label: 'package.nls.json', names: ['package.nls.json'] },
  { label: 'package.nls.zh-cn.json', names: ['package.nls.zh-cn.json'] },
  { label: 'SUPPORT.md', names: ['SUPPORT.md', 'support.md'] },
];

const bannedPrefixes = ['node_modules', 'src', 'out-test', 'test'];
const isBanned = (e) =>
  bannedPrefixes.some((p) => e === p || e.startsWith(p + '/')) ||
  e.endsWith('.map') ||
  e.endsWith('.vsix') ||
  e === 'package-lock.json';

let failures = 0;
for (const f of required) {
  const ok = f.names.some((n) => entries.includes(n));
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  contains ' + f.label);
}

const banned = entries.filter(isBanned);
if (banned.length === 0) {
  console.log(
    'PASS  no banned entries (node_modules|src|out-test|test/**, *.map, *.vsix, package-lock.json)'
  );
} else {
  failures++;
  console.log('FAIL  banned entries found:');
  for (const e of banned) console.log('      - ' + e);
}

console.log(
  '\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAIL') + ' — ' + entries.length + ' entries checked'
);
process.exit(failures === 0 ? 0 : 1);
