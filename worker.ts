// Cloudflare Worker for the website. The pages are static files (./out, served by the assets layer without running this code,
// with headers from public/_headers). This Worker only runs for the paths in run_worker_first (wrangler.toml):
// /api/* and /healthz go to the API Worker through the service binding API, so the site and the API share one address
// and the sign-in cookie; the Google Search Console file is answered here so the assets layer cannot redirect it.

/** A Cloudflare service or assets binding */
type Fetcher = { fetch(request: Request): Promise<Response> };
type Env = { API?: Fetcher; ASSETS?: Fetcher; GOOGLE_SITE_VERIFICATION?: string };

const notFound = (msg: string, status = 404) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const gsv = env.GOOGLE_SITE_VERIFICATION;
    if (gsv && pathname === '/' + gsv + '.html') return new Response('google-site-verification: ' + gsv + '.html', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (pathname === '/healthz' || pathname.startsWith('/api/')) return env.API ? env.API.fetch(request) : notFound('api_not_bound', 503);
    return env.ASSETS ? env.ASSETS.fetch(request) : notFound('not_found');
  },
};
