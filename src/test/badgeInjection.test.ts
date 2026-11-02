import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFullBadgeColorId, dashedThemeVar, escapeCssContent } from '../badgeInjection.js';
import { formatHumanSize } from '../sizeFormatter.js';

/** A payload's escaped display segment may only contain whitelist literals or `\XX ` escapes. */
const INNER_ALPHABET = /^(?:[A-Za-z0-9 ~%+-]|\\[0-9A-F]{2} )*$/;

test('escapeCssContent: golden values', () => {
  assert.equal(escapeCssContent('1.2 KB'), '1\\2E 2 KB');
  assert.equal(escapeCssContent('a"b'), 'a\\22 b');
  assert.equal(escapeCssContent('~3 MB'), '~3 MB');
  assert.equal(escapeCssContent(''), '');
});

test('escapeCssContent: printable ASCII 0x20..0x7E emits only literals or well-formed escapes', () => {
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    const out = escapeCssContent(String.fromCodePoint(cp));
    assert.match(out, INNER_ALPHABET, `char U+${cp.toString(16)}`);
  }
  // spot checks just outside/inside the whitelist boundary
  assert.equal(escapeCssContent('.'), '\\2E ');
  assert.equal(escapeCssContent('"'), '\\22 ');
  assert.equal(escapeCssContent(';'), '\\3B ');
});

test('escapeCssContent: non-ASCII becomes multi-digit hex escapes', () => {
  assert.equal(escapeCssContent('½'), '\\BD ');
  assert.equal(escapeCssContent('Ⓚ'), '\\24C0 '); // U+24C0, four hex digits
});

test('dashedThemeVar: dots become dashes under the --vscode- prefix', () => {
  assert.equal(dashedThemeVar('list.warningForeground'), '--vscode-list-warningForeground');
  assert.equal(dashedThemeVar('a.b.c'), '--vscode-a-b-c');
  assert.equal(dashedThemeVar('plain'), '--vscode-plain');
});

test('buildFullBadgeColorId: golden payloads', () => {
  assert.equal(
    buildFullBadgeColorId('12 B', 'list.warningForeground'),
    'x); content: "12 B"; color: var(--vscode-list-warningForeground); z: z',
  );
  assert.equal(
    buildFullBadgeColorId('1.2 KB', undefined),
    'x); content: "1\\2E 2 KB"; color: inherit; z: z',
  );
  assert.equal(buildFullBadgeColorId('', 'x.id'), undefined);
  assert.equal(buildFullBadgeColorId('   ', 'x.id'), undefined, 'whitespace-only display is empty');
});

test('buildFullBadgeColorId: structural invariants across the size × color matrix', () => {
  const bytesSamples = [0, 1, 999, 1023, 1024, 1536, 999999, 1048576, 3.7e9, 1e12];
  const colorIds = [undefined, 'list.errorForeground'] as const;
  for (const bytes of bytesSamples) {
    for (const colorId of colorIds) {
      const display = formatHumanSize(bytes);
      const payload = buildFullBadgeColorId(display, colorId);
      assert.ok(payload !== undefined, `payload expected for ${bytes}B / ${colorId}`);
      assert.ok(payload.startsWith('x); content: "'), `prefix for ${bytes}B: ${payload}`);
      assert.ok(payload.endsWith('; z: z'), `suffix for ${bytes}B: ${payload}`);
      assert.equal((payload.match(/"/g) ?? []).length, 2, `exactly two quotes for ${bytes}B`);
      const m = /^x\); content: "([^"]*)"; color: (.+); z: z$/.exec(payload);
      assert.ok(m, `shape for ${bytes}B / ${colorId}: ${payload}`);
      const inner = m[1];
      assert.ok(!inner.includes('.'), `no literal dot for ${bytes}B: ${JSON.stringify(inner)}`);
      assert.match(inner, INNER_ALPHABET, `inner alphabet for ${bytes}B: ${JSON.stringify(inner)}`);
      assert.ok(!/\\(?![0-9A-F]{2} )/.test(inner), `escapes well-formed for ${bytes}B: ${JSON.stringify(inner)}`);
      assert.equal(
        m[2],
        colorId === undefined ? 'inherit' : 'var(--vscode-list-errorForeground)',
        `color clause for ${bytes}B / ${colorId}`,
      );
    }
  }
});
