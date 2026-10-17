import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/text';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account/'] }], sitemap: SITE_URL + '/sitemap.xml' };
}
