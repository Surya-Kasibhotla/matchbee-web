/* Landing page sections. Each takes its data from SITE.pages.home in lib/site.ts.
   The order comes from SITE.pages.home.sections; sections with feature: 'jobs' only show when that feature is on. */
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { fill, Rich } from '@/lib/text';
import { MI } from '@/components/Icon';

type Home = typeof SITE.pages.home;
type Btn = { label: string; href: string };
type Point = { icon: string; title: string; text: string };
type Heading = { kicker?: string; title: string; lead?: string };
const B = ({ b, cls = '' }: { b?: Btn; cls?: string }) => (b ? <Link className={'btn ' + cls} href={b.href}>{fill(b.label)}</Link> : null);
const feat = (o: { feature?: string }) => (o && o.feature ? { 'data-feature': o.feature } : {});
const tool = (id: string) => SITE.tools.find(t => t.id === id);

function Head({ d }: { d: Heading }) {
  return <div className="sec-head">{d.kicker && <span className="kicker">{fill(d.kicker)}</span>}<h2>{fill(d.title)}</h2>{d.lead && <p>{fill(d.lead)}</p>}</div>;
}
function Checklist({ points }: { points: Point[] }) {
  return <ul className="checklist">{points.map(p => <li key={p.title}><MI name={p.icon} /><span><b>{fill(p.title)}</b><span>{fill(p.text)}</span></span></li>)}</ul>;
}

function Hero({ d }: { d: Home['hero'] }) {
  const a = d.art;
  return (
    <section className="hero">
      <div className="container hero-in">
        <div>
          <span className="eyebrow"><i>✦</i>{fill(d.eyebrow)}</span>
          <h1><Rich text={d.title} /></h1>
          <p className="lead">{fill(d.lead)}</p>
          <div className="cta-row"><B b={d.primary} cls="pri lg" /><B b={d.secondary} cls="lg" /></div>
          <ul className="ticks">{d.ticks.map(t => <li key={t}>{fill(t)}</li>)}</ul>
        </div>
        <div className="art" aria-hidden="true">
          <div className="sheet"><div className="nm" /><div className="ct" />
            <div className="hd" /><div className="ln m" /><div className="ln s" /><div className="hd" /><div className="ln m hl" /><div className="ln" /><div className="ln s" /><div className="ln m hl" />
            <div className="hd" /><div className="ln s" /><div className="ln m" /></div>
          <div className="float score"><div className="ring ok" style={{ ['--p' as string]: a.score }}><span>{a.score}</span></div><div><b>{fill(a.rating)}</b><small>{fill(a.file)}</small></div></div>
          <div className="float checks">{a.checks.map(c => <div key={c.text}><span className={'dot ' + (c.ok ? 'ok' : 'no')}>{c.ok ? '✓' : '!'}</span>{fill(c.text)}</div>)}</div>
          {a.badge && <div className="float tag1"><span className="dot ok">✓</span>{fill(a.badge)}</div>}
        </div>
      </div>
    </section>
  );
}

function Strip({ d }: { d: Home['strip'] }) {
  return <section className="strip"><div className="container strip-in">{d.map(i => <div key={i.title}><MI name={i.icon} /><span><b>{fill(i.title)}</b>{fill(i.text)}</span></div>)}</div></section>;
}

function Tools({ d }: { d: Home['tools'] }) {
  const f = d.feature, ft = f && tool(f.tool);
  return (
    <section className="section" id="tools">
      <div className="container">
        <Head d={d} />
        <div className="tools">
          {f && ft && (
            <Link className="tool feature" href={ft.href}>
              {f.badge && <span className="badge">{fill(f.badge)}</span>}
              <div><MI name={ft.icon} /><h3>{fill(f.title)}</h3><p>{fill(f.text)}</p>
                <ul>{f.points.map(p => <li key={p}>{fill(p)}</li>)}</ul><span className="more">Open {fill(ft.name)} →</span></div>
              <div className="mini">{f.demo.map(r => <div className="row-i" key={r.k}><span>{fill(r.k)}</span><span className={'pill ' + r.s}>{fill(r.v)}</span></div>)}</div>
            </Link>
          )}
          {SITE.tools.filter(t => !f || t.id !== f.tool).map(t => (
            <Link className="tool" href={t.href} key={t.id} {...feat(t)}><MI name={t.icon} /><h3>{fill(t.name)}</h3><p>{fill(t.desc)}</p><span className="more">Open →</span></Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function How({ d }: { d: Home['how'] }) {
  return <section className="section alt" id={d.id || 'how'}><div className="container"><Head d={d} /><div className="steps">{d.steps.map(s => <div className="step-c" key={s.title}><h3>{fill(s.title)}</h3><p>{fill(s.text)}</p></div>)}</div></div></section>;
}

function Checks({ d }: { d: Home['checks'] }) {
  return (
    <section className="section" id={d.id || 'checks'}>
      <div className="container split">
        <div><span className="kicker">{fill(d.kicker)}</span><h2>{fill(d.title)}</h2><p>{fill(d.lead)}</p><Checklist points={d.points} />{d.cta && <div className="cta-row"><B b={d.cta} cls="pri" /></div>}</div>
        <div className="tool" style={{ padding: 24 }}>
          <div className="ats-score" style={{ marginBottom: 12 }}><div className="ring mid" style={{ ['--p' as string]: 64 }}><span>64</span><small>/ 100</small></div>
            <div className="ats-meta"><div className="ats-rating mid">Fair</div><div className="note">sample-resume.pdf · 4 roles · 11 bullets</div></div></div>
          <ul className="issues">
            <li className="sev-error"><div>Kubernetes was first released in 2014, but it is listed under a role that ended in 2012.</div><q>• Deployed checkout pages on Kubernetes</q></li>
            <li className="sev-error"><div>&quot;performace&quot; looks misspelled. <span className="fix">→ performance</span></div></li>
            <li className="sev-warn"><div>Two roles overlap by about 3 months.</div></li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// Job alerts promo: a mock digest email built from d.demo
function Alerts({ d }: { d: Home['alerts'] }) {
  return (
    <section className="section alt" id={d.id || 'alerts'}>
      <div className="container split">
        <div><span className="kicker">{fill(d.kicker)}</span><h2>{fill(d.title)}</h2><p>{fill(d.lead)}</p><Checklist points={d.points} />{d.cta && <div className="cta-row"><B b={d.cta} cls="pri" /></div>}</div>
        <div className="mail-mock" aria-hidden="true">
          <div className="mm-top"><span className="mm-dot" /><span className="mm-dot" /><span className="mm-dot" /><span className="mm-from">{SITE.brand.name} · Job alerts</span></div>
          <div className="mm-body"><b className="mm-subj">{fill(d.demo.subject)}</b><small>{fill(d.demo.based)}</small>
            {d.demo.jobs.map(j => <div className="mm-job" key={j.title}><b>{fill(j.title)}</b><span>{fill(j.meta)}</span><div className="mm-btns"><i className="pri">Build resume for this job</i><i>View &amp; apply</i></div></div>)}</div>
        </div>
      </div>
    </section>
  );
}

function Privacy({ d }: { d: Home['privacy'] }) {
  return <section className="section" id={d.id || 'privacy'}><div className="container"><Head d={d} /><div className="steps">{d.points.map(p => <div className="step-c nonum" key={p.title}><MI name={p.icon} /><h3>{fill(p.title)}</h3><p>{fill(p.text)}</p></div>)}</div></div></section>;
}

function Faq({ d }: { d: Home['faq'] }) {
  return (
    <section className="section alt" id={d.id || 'faq'}>
      <div className="container"><Head d={d} />
        <div className="faq">{d.items.map((i: FaqItem, k) => <details key={i.q} {...feat(i)} open={k === 0}><summary>{fill(i.q)}</summary><p>{fill(i.a)}</p></details>)}</div>
      </div>
    </section>
  );
}

type FaqItem = { q: string; a: string; feature?: string };

function Cta({ d }: { d: Home['cta'] }) {
  return <section className="section"><div className="container"><div className="cta-band"><h2>{fill(d.title)}</h2><p>{fill(d.lead)}</p><div className="cta-row"><B b={d.primary} cls="lg" /><B b={d.secondary} cls="ghost lg" /></div></div></div></section>;
}

// One section by its key in SITE.pages.home.sections (an unknown key shows nothing)
function Section({ k }: { k: string }): React.ReactNode {
  const h = SITE.pages.home;
  switch (k) {
    case 'hero': return <Hero d={h.hero} />;
    case 'strip': return <Strip d={h.strip} />;
    case 'tools': return <Tools d={h.tools} />;
    case 'how': return <How d={h.how} />;
    case 'checks': return <Checks d={h.checks} />;
    case 'alerts': return <div data-feature={h.alerts.feature}><Alerts d={h.alerts} /></div>;
    case 'privacy': return <Privacy d={h.privacy} />;
    case 'faq': return <Faq d={h.faq} />;
    case 'cta': return <Cta d={h.cta} />;
    default: return null;
  }
}

/** The landing page: renders SITE.pages.home.sections in order */
export function LandingPage() {
  return <main id="main">{SITE.pages.home.sections.map(k => <Section key={k} k={k} />)}</main>;
}

/** FAQ entries for the FAQPage structured data (flagged answers are hidden on the page, so they are left out) */
export const faqForSchema = () => SITE.pages.home.faq.items.filter((i: FaqItem) => !i.feature).map(i => ({ q: fill(i.q), a: fill(i.a) }));
