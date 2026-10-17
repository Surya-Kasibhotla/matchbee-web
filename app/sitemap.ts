import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { SITE_URL } from '@/lib/text';

export const dynamic = 'force-static';

// Pages Google should index. Pages with noindex: true in lib/site.ts (account, jobs while the feature is off) are left out.
const PAGES: [key: keyof typeof SITE.pages, path: string, priority: number][] = [['home', '/', 1], ['builder', '/builder/', 0.9], ['ats', '/ats/', 0.9], ['jobs', '/jobs/', 0.6], ['privacy', '/privacy/', 0.3], ['terms', '/terms/', 0.3]];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.filter(([k]) => !(SITE.pages[k] as { noindex?: boolean }).noindex).map(([, path, priority]) => ({ url: SITE_URL + path, lastModified: new Date(), priority }));
}
