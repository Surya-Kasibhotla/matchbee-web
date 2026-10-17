import { SITE } from './site';

/** Fills {brand}, {email} and {year} in config text. */
export function fill(s?: string | null): string {
  return String(s ?? '')
    .replace(/\{brand\}/g, SITE.brand.name)
    .replace(/\{email\}/g, SITE.brand.email || '')
    .replace(/\{year\}/g, String(new Date().getFullYear()));
}

/** Config text that may use <em> for emphasis (and nothing else). */
export function Rich({ text }: { text?: string }) {
  const parts = fill(text).split(/(<em>[\s\S]*?<\/em>)/g);
  return <>{parts.map((p, i) => (p.startsWith('<em>') ? <em key={i}>{p.slice(4, -5)}</em> : p))}</>;
}

/** Site address for canonical links, sitemap and social previews. Set NEXT_PUBLIC_SITE_URL when the domain changes. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://matchbee.hireloop.workers.dev').replace(/\/+$/, '');
