import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSiteServer } from '../scripts/serve.ts';

// Pages are the Next.js build (npm run build -> out/). Skipped until it has been built once.
const built = existsSync(new URL('../out/index.html', import.meta.url));

async function boot(): Promise<{ base: string; close: () => void }> {
  const srv = createSiteServer('http://127.0.0.1:9'); // pages only: no API behind it
  await new Promise<void>(ok => srv.listen(0, '127.0.0.1', () => ok()));
  const a = srv.address(); if (!a || typeof a === 'string') throw new Error('not listening');
  return { base: 'http://127.0.0.1:' + a.port, close: () => { srv.close(); } };
}

test('built pages: real content and Google tags in the HTML, security headers, traversal blocked', { skip: !built && 'run npm run build first' }, async () => {
  const a = await boot();
  const r = await fetch(a.base + '/'); assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/); assert.equal(r.headers.get('x-frame-options'), 'DENY');
  const home = await r.text();
  assert.match(home, /<h1>Land more interviews/); assert.match(home, /MatchBee/); // pre-rendered: Google gets the text, not an empty shell
  for (const [pg, h1] of [['/builder/', 'Resume Builder'], ['/ats/', 'ATS Resume Checker'], ['/account/', 'My account'], ['/privacy/', 'Privacy policy'], ['/terms/', 'Terms of use'], ['/jobs/', 'Job Alerts']]) {
    const x = await fetch(a.base + pg); assert.equal(x.status, 200, pg);
    const t = await x.text(); assert.match(t, new RegExp('<h1>' + h1 + '</h1>'), pg); assert.match(t, /<link rel="canonical" href="https:\/\/[^"]+"/, pg);
  }
  assert.match(await (await fetch(a.base + '/account/')).text(), /<meta name="robots" content="noindex/); // private page
  for (const f of ['/og-image.png', '/robots.txt', '/theme.js', '/vendor/pdfjs/pdf.min.mjs', '/vendor/nspell/nspell.min.js', '/vendor/dict-en/en.dic', '/privacy/__next.privacy.__PAGE__.txt']) assert.equal((await fetch(a.base + f)).status, 200, f);
  const sm = await fetch(a.base + '/sitemap.xml'); assert.match(sm.headers.get('content-type') || '', /xml/); const smt = await sm.text();
  assert.match(smt, /\/ats\//); assert.doesNotMatch(smt, /\/account\//); // private page stays out of Google
  const red = await fetch(a.base + '/builder', { redirect: 'manual' }); assert.equal(red.status, 301); assert.equal(red.headers.get('location'), '/builder/');
  assert.ok([403, 404].includes((await fetch(a.base + '/..%2fpackage.json')).status));
  assert.equal((await fetch(a.base + '/package.json')).status, 404);
  assert.equal((await fetch(a.base + '/.env')).status, 404);
  assert.equal((await fetch(a.base + '/_headers')).status, 404);
  assert.equal((await fetch(a.base + '/index.html')).status, 200);
  assert.equal((await fetch(a.base + '/api/config')).status, 502); // /api goes to the API, never to a file
  a.close();
});

