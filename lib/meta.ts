import type { Metadata } from 'next';
import { SITE, type PageKey } from './site';
import { fill, SITE_URL } from './text';

type P = { title?: string; description?: string; sub?: string; noindex?: boolean; crumb?: string; h1?: string };

/** Title, description, canonical, social and robots tags for a page, from SITE.pages[key] */
export function pageMeta(key: PageKey, path: string): Metadata {
  const p = SITE.pages[key] as P, title = fill(p.title), description = fill(p.description || p.sub);
  return {
    title: { absolute: title }, description, alternates: { canonical: path },
    openGraph: { title, description, url: path }, twitter: { title, description },
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Breadcrumb structured data: Home > page */
export function crumbLd(key: PageKey, path: string) {
  const p = SITE.pages[key] as P;
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: fill(p.crumb || p.h1), item: SITE_URL + path }] };
}

/** "This is a free web app" structured data for the tool pages */
export function appLd(key: PageKey, path: string) {
  const p = SITE.pages[key] as P;
  return { '@context': 'https://schema.org', '@type': 'WebApplication', name: fill(p.h1), url: SITE_URL + path, applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (web browser)', description: fill(p.description), isPartOf: { '@type': 'WebSite', name: SITE.brand.name, url: SITE_URL + '/' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
}
