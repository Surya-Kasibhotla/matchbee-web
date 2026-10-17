import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('the vendored dictionary flags real typos and suggests fixes; tech words added to it pass', () => {
  type NSpell = { correct(w: string): boolean; suggest(w: string): string[]; add(w: string): void };
  const ctx: { nspell?: (d: { aff: string; dic: string }) => NSpell } = {}; vm.runInNewContext(fs.readFileSync(new URL('../public/vendor/nspell/nspell.min.js', import.meta.url), 'utf8'), ctx);
  assert.ok(ctx.nspell);
  const sp = ctx.nspell({ aff: fs.readFileSync(new URL('../public/vendor/dict-en/en.aff', import.meta.url), 'utf8'), dic: fs.readFileSync(new URL('../public/vendor/dict-en/en.dic', import.meta.url), 'utf8') });
  assert.ok(sp.correct('experience') && sp.correct('responsibilities') && sp.correct('optimized'));
  assert.ok(!sp.correct('performace')); assert.equal(sp.suggest('performace')[0], 'performance');
  assert.ok(!sp.correct('Kubernetes')); sp.add('Kubernetes'); assert.ok(sp.correct('Kubernetes'));
});
