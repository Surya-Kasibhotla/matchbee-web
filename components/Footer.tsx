import Link from 'next/link';
import { SITE } from '@/lib/site';
import { fill } from '@/lib/text';
import { BrandMark } from './Brand';

type L = { label: string; href: string; feature?: string };

export function Footer() {
  const F = SITE.footer;
  return (
    <footer className="foot">
      <div className="container">
        <div className="foot-in">
          <div><Link className="brand" href="/"><BrandMark /><span>{SITE.brand.name}</span></Link><p>{fill(SITE.brand.tagline)}</p></div>
          {F.columns.map(c => {
            const links: L[] = c.links === 'tools' ? SITE.tools.map(t => ({ label: t.name, href: t.href, feature: (t as { feature?: string }).feature })) : (c.links as L[]);
            return (
              <div key={c.title}>
                <h4>{fill(c.title)}</h4>
                <ul>{links.map(l => <li key={l.href + l.label} {...(l.feature ? { 'data-feature': l.feature } : {})}><Link href={l.href}>{fill(l.label)}</Link></li>)}</ul>
              </div>
            );
          })}
        </div>
        <div className="foot-bot"><span>{fill(F.legal)}</span><span>Made for job seekers. Nothing is stored unless you save it.</span></div>
      </div>
    </footer>
  );
}
