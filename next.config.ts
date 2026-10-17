import type { NextConfig } from 'next';

// Production: a static export (out/) of pre-rendered HTML pages, served by Cloudflare Workers assets.
// The API is the separate backend (its own Worker, reached through a service binding), so pages cost nothing to serve.
// Development: `npm run dev` here, with the backend running (`npm run dev` in backend/, port 8787); /api is proxied to it.
const dev = process.env.NODE_ENV !== 'production';
const API = (process.env.API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

const config: NextConfig = {
  output: dev ? undefined : 'export',
  trailingSlash: true,          // /builder/ -> builder/index.html, same addresses as before
  skipTrailingSlashRedirect: dev, // let POST /api/generate reach the API in dev without a redirect
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  ...(dev ? {
    async rewrites() {
      return [
        { source: '/api/:path*', destination: API + '/api/:path*' },
        { source: '/healthz', destination: API + '/healthz' },
      ];
    },
  } : {}),
};

export default config;
