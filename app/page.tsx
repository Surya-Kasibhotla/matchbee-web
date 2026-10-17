import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { fill, SITE_URL } from '@/lib/text';
import { LandingPage, faqForSchema } from '@/components/landing/Sections';
import { JsonLd } from '@/components/JsonLd';

const P = SITE.pages.home;
export const metadata: Metadata = {
  title: { absolute: fill(P.title) }, description: fill(P.description), alternates: { canonical: '/' },
  openGraph: { title: fill(P.title), description: fill(P.description), url: '/' }, twitter: { title: fill(P.title), description: fill(P.description) },
};

export default function Home() {
  const faq = faqForSchema();
  return (
    <>
      <LandingPage />
      <JsonLd data={[
        { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.brand.name, url: SITE_URL + '/', description: fill(P.description) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: SITE.brand.name, url: SITE_URL + '/', applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)',
          description: fill(P.description), image: SITE_URL + '/og-image.png', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          featureList: SITE.tools.filter(t => !(t as { feature?: string }).feature).map(t => fill(t.name) + ': ' + fill(t.desc)) },
        ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((i: { q: string; a: string }) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) }] : []),
      ]} />
    </>
  );
}
