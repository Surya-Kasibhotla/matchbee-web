import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.ts';

// A stand-in for a Cloudflare binding that records what it was asked for
const binding = (name: string) => { const seen: string[] = []; return { seen, fetch: async (r: Request) => { seen.push(new URL(r.url).pathname); return new Response(name); } }; };

test('the website Worker sends /api and /healthz to the API binding, files to the assets, and answers the Google file', async () => {
  const API = binding('api'), ASSETS = binding('assets'), env = { API, ASSETS, GOOGLE_SITE_VERIFICATION: 'google123' };
  const get = (p: string) => worker.fetch(new Request('https://site.example' + p), env);
  assert.equal(await (await get('/api/config')).text(), 'api');
  assert.equal(await (await get('/healthz')).text(), 'api');
  assert.equal(await (await get('/builder/')).text(), 'assets');
  assert.equal(await (await get('/google123.html')).text(), 'google-site-verification: google123.html');
  assert.deepEqual(API.seen, ['/api/config', '/healthz']); assert.deepEqual(ASSETS.seen, ['/builder/']);
  assert.equal((await worker.fetch(new Request('https://site.example/api/me'), { ASSETS })).status, 503); // binding missing: a clear error
});
