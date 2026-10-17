// After `next build` (static export): Next 16 saves page-segment data as out/<page>/__next.<seg>/__PAGE__.txt,
// but the browser prefetches it as out/<page>/__next.<seg>.__PAGE__.txt. Plain static hosts (Cloudflare assets,
// scripts/serve.ts) do not translate one into the other, so this writes flat copies under the requested names.
import { readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../out/', import.meta.url));
if (!existsSync(OUT)) { console.error('out/ not found: run next build first'); process.exit(1); }
let n = 0;
function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith('__next.')) flatten(p); else walk(p);
  }
}
// every file under a __next.<seg> folder -> sibling file named __next.<seg>.<path with dots>
function flatten(segDir: string): void {
  const parent = dirname(segDir), base = segDir.slice(parent.length + 1), files: string[] = [];
  const list = (d: string): void => { for (const x of readdirSync(d)) { const q = join(d, x); if (statSync(q).isDirectory()) list(q); else files.push(q); } };
  list(segDir);
  for (const file of files) { copyFileSync(file, join(parent, base + '.' + relative(segDir, file).split(/[\\/]/).join('.'))); n++; }
}
walk(OUT);
console.log(`postbuild: ${n} prefetch file(s) copied to flat names`);
