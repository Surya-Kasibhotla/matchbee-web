import { SITE } from '@/lib/site';
import { fill } from '@/lib/text';

type Section = { h: string; p?: string[]; list?: string[] };
type LegalData = { draft?: boolean; updated?: string; intro?: string; sections: Section[] };

/** Terms and Privacy body from SITE.pages[page].legal */
export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const L = (SITE.pages[page] as { legal: LegalData }).legal;
  return (
    <main id="main" className="container legal app-page">
      <div className="card">
        {L.draft && <p className="banner warn draft">Draft template. Have it reviewed by a qualified lawyer before launch, then set <code>draft: false</code> in lib/site.ts.</p>}
        {L.updated && <p className="note" style={{ marginTop: 0 }}>Last updated {fill(L.updated)}</p>}
        {L.intro && <p>{fill(L.intro)}</p>}
        {L.sections.map(s => (
          <section key={s.h}>
            <h2>{fill(s.h)}</h2>
            {(s.p || []).map(t => <p key={t}>{fill(t)}</p>)}
            {s.list && <ul>{s.list.map(i => <li key={i}>{fill(i)}</li>)}</ul>}
          </section>
        ))}
      </div>
    </main>
  );
}
