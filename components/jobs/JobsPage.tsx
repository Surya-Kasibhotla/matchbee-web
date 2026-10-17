'use client';
/* /jobs/: job alert preferences, a preview of matches, the full job description and "Report this listing".
   Signed out, or with no job source connected, it shows the sample listings from lib/samples.ts.
   Hidden ("coming soon") unless the server has FEATURE_JOBS=1. Uses /api/jobs/* in src/jobs/routes.js. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SAMPLES } from '@/lib/samples';
import { Icon, MI } from '@/components/Icon';
import { useApp } from '@/components/app/AppProvider';

// US states, job types, report reasons and source credits come from the server (/api/jobs/config, src/jobs/), so the page keeps no copy of them
type JobsConfig = { sources: string[]; whatsapp: boolean; states: Record<string, string>; types: [string, string][]; reasons: [string, string][]; credits: Record<string, { credit: string }> };
const NO_CONFIG: JobsConfig = { sources: [], whatsapp: false, states: {}, types: [], reasons: [], credits: {} };

type Prefs = { titles: string[]; skills: string[]; states: string[]; remote: boolean; types: string[]; frequency: 'daily' | 'weekly' | 'off'; whatsapp: { on: boolean; phone: string; consent: boolean } };
type Job = { id: string; src: string; title: string; company?: string; city?: string; state?: string; remote?: boolean; desc?: string; url?: string; email?: string; salary?: string; type?: string; posted?: number; days?: number };
const split = (v: string, max: number) => { const seen = new Set<string>(); return String(v || '').split(/[,;\n]+/).map(s => s.trim()).filter(s => { const k = s.toLowerCase(); if (!s || seen.has(k)) return false; seen.add(k); return true; }).slice(0, max); };
const where = (j: Job) => [j.city, j.state].filter(Boolean).join(', ') + (j.remote ? (j.city || j.state ? ' · ' : '') + 'Remote' : '');
const when = (t?: number) => { if (!t) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d + ' days ago'; };
const snippet = (t?: string) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 200 ? t.slice(0, 197).replace(/\s+\S*$/, '') + '…' : t; };
const tailor = (j: Job) => '/builder/?job=' + encodeURIComponent(j.id);
const samples = (): Job[] => (SAMPLES.jobs as Job[]).map(j => ({ ...j, posted: Date.now() - (j.days || 0) * 864e5 }));

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return ref;
}

export function JobsPage() {
  const { cfg: appCfg, user, ready, version, openAuth } = useApp();
  const on = !!appCfg?.features?.jobs;
  const [titles, setTitles] = useState(''), [skills, setSkills] = useState(''), [states, setStates] = useState<string[]>([]), [remote, setRemote] = useState(false);
  const [types, setTypes] = useState<string[]>([]), [frequency, setFrequency] = useState<Prefs['frequency']>('daily');
  const [wa, setWa] = useState({ on: false, phone: '', consent: false });
  const [cfg, setCfg] = useState<JobsConfig>(NO_CONFIG), [saved, setSaved] = useState(false), [pendingSave, setPendingSave] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean }>({ t: '' }), [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(samples), [sample, setSample] = useState(true), [banner, setBanner] = useState<{ t: string; warn?: boolean } | null>({ t: 'Sample matches (dummy data).' }), [searching, setSearching] = useState(false);
  const [current, setCurrent] = useState<Job | null>(null), [report, setReport] = useState<Job | null>(null);
  const [repReason, setRepReason] = useState(''), [repNote, setRepNote] = useState(''), [repMsg, setRepMsg] = useState(''), [repBusy, setRepBusy] = useState(false);
  const jobDlg = useDialog(!!current), repDlg = useDialog(!!report);

  const read = (): Prefs => ({ titles: split(titles, 3), skills: split(skills, 15), states, remote, types, frequency, whatsapp: wa });
  function fillPrefs(p: Prefs) {
    setTitles(p.titles.join(', ')); setSkills(p.skills.join(', ')); setStates(p.states); setRemote(!!p.remote); setTypes(p.types); setFrequency(p.frequency);
    setWa({ on: !!p.whatsapp?.on, phone: p.whatsapp?.phone || '', consent: !!p.whatsapp?.consent });
  }
  function showSamples(note: string) { setSample(true); setJobs(samples()); setBanner({ t: note }); }
  async function preview(P = read()) {
    if (!user || !cfg.sources.length) { showSamples(!user ? 'Sample matches (dummy data). Sign in and save your alert to see live jobs.' : 'Sample matches (dummy data). No job source is connected on this server yet.'); return; }
    if (!P.titles.length && !P.skills.length) { setMsg({ t: 'Add at least one job title or skill to preview.', bad: true }); return; }
    setSearching(true); setBanner(null);
    const x = await api<{ jobs: Job[] }>('POST', '/api/jobs/preview', { prefs: P }); setSearching(false);
    if (!x.ok) { setJobs([]); setBanner({ t: x.j.message || 'Could not load matches right now.', warn: true }); return; }
    setSample(false); setJobs(x.j.jobs || []);
  }
  async function save() {
    const P = read();
    if (!P.titles.length && !P.skills.length) { setMsg({ t: 'Add at least one job title or skill.', bad: true }); return; }
    if (!user) { setPendingSave(true); openAuth('Create a free account (or log in) so we can email your matches.', 'signup'); return; }
    setSaving(true); setMsg({ t: 'Saving…' });
    const x = await api<{ prefs: Prefs }>('PUT', '/api/jobs/prefs', { prefs: P }); setSaving(false);
    if (!x.ok) { setMsg({ t: x.j.message || 'Could not save your alert.', bad: true }); return; }
    setSaved(true); fillPrefs(x.j.prefs);
    setMsg({ t: P.frequency === 'off' ? 'Saved. Alerts are paused.' : 'Saved. Your first email arrives with the next ' + P.frequency + ' run.' + (P.whatsapp.on && !cfg.whatsapp ? ' WhatsApp will start once it is available.' : '') });
    if (!jobs.length || sample) preview(x.j.prefs);
  }

  // feature on: job sources and WhatsApp availability; ?report=<id> from an alert email
  useEffect(() => {
    if (!on) return;
    api<JobsConfig>('GET', '/api/jobs/config').then(x => { if (x.ok) setCfg({ ...NO_CONFIG, ...x.j }); });
    const rep = new URLSearchParams(location.search).get('report');
    if (rep && /^[a-z]{2}-[a-z0-9]{1,13}$/.test(rep)) { history.replaceState(null, '', location.pathname); setReport({ id: rep, src: '', title: 'Listing from your job alert email' }); }
  }, [on]);
  // sign-in changes: load the saved alert; finish a save that needed an account
  useEffect(() => {
    if (!on || !ready) return;
    if (!user) { setSaved(false); showSamples('Sample matches (dummy data). Sign in and save your alert to see live jobs.'); return; }
    api<{ prefs: Prefs | null }>('GET', '/api/jobs/prefs').then(x => {
      if (x.ok && x.j.prefs) { setSaved(true); fillPrefs(x.j.prefs); preview(x.j.prefs); }
      if (pendingSave) { setPendingSave(false); save(); }
    });
  }, [version, on, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // full description for real listings (Adzuna gives a snippet in search results)
  useEffect(() => {
    if (!current || sample || !user) return;
    api<{ job: Job }>('GET', '/api/jobs/item/' + encodeURIComponent(current.id)).then(x => { if (x.ok && x.j.job.desc) setCurrent(c => (c && c.id === current.id ? { ...c, desc: x.j.job.desc } : c)); });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openReport(j: Job) { setCurrent(null); setReport(j); setRepReason(''); setRepNote(''); setRepMsg(''); setRepBusy(false); }
  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!repReason) { setRepMsg('Choose what is wrong with this listing.'); return; }
    if (/^sample-/.test(report?.id || '')) { setRepMsg('Thanks. This is sample data, so nothing was sent.'); return; }
    setRepBusy(true); const x = await api('POST', '/api/jobs/report', { id: report?.id, reason: repReason, note: repNote }); setRepBusy(false);
    setRepMsg(x.ok ? 'Thanks. We will review it, and listings reported by several people stop being sent.' : x.j.message || 'Could not send the report.');
    if (x.ok) setTimeout(() => setReport(null), 1600);
  }

  const st = !user ? ['Not set up', 'mid'] : !saved ? ['Not saved yet', 'mid'] : [frequency === 'off' ? 'Paused' : frequency === 'weekly' ? 'On · weekly' : 'On · daily', frequency === 'off' ? 'mid' : 'ok'];
  const credit = (src: string) => (cfg.credits[src] && cfg.credits[src].credit) || '', STATES = cfg.states;
  const used = [...new Set(jobs.map(j => j.src))].map(credit).filter(Boolean).join(' · ');

  return (
    <main id="main" className="container app-page">
      <div className="card soon" data-feature-off="jobs">
        <MI name="bell" />
        <h2>Job alerts are coming soon</h2>
        <p className="hint">We are getting daily job matches ready. Meanwhile, tailor your resume or check your ATS score.</p>
        <div className="actions" style={{ justifyContent: 'center' }}><Link className="btn pri" href="/builder/">Build my resume</Link><Link className="btn" href="/ats/">Check my ATS score</Link></div>
      </div>

      <div className="jobs-layout" data-feature="jobs">
        <section className="card jobs-form" aria-labelledby="alertT">
          <div className="jf-head"><h2 id="alertT">Your job alert</h2><span className={'pill ' + st[1]}>{st[0]}</span></div>
          {!user && <p className="hint">Create a free account to get matches by email. You can try a preview below first.</p>}
          <label htmlFor="jtitles">Job titles</label>
          <input id="jtitles" autoComplete="off" placeholder="e.g. React Developer, Frontend Engineer" value={titles} onChange={e => setTitles(e.target.value)} />
          <p className="note" style={{ marginTop: 6 }}>Up to 3, separated by commas.</p>
          <label htmlFor="jskills">Key skills <span className="opt">Optional</span></label>
          <input id="jskills" autoComplete="off" placeholder="e.g. TypeScript, GraphQL, AWS" value={skills} onChange={e => setSkills(e.target.value)} />
          <fieldset className="fs">
            <legend>Where</legend>
            <label className="check"><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} /> Remote jobs (anywhere in the US)</label>
            <div className="state-add"><select aria-label="Add a US state" value="" disabled={states.length >= 5} onChange={e => { const c = e.target.value; if (c && !states.includes(c) && states.length < 5) setStates([...states, c]); }}>
              <option value="">{Object.keys(STATES).length ? 'Add a US state…' : 'Loading states…'}</option>{Object.keys(STATES).map(c => <option key={c} value={c}>{STATES[c]}</option>)}</select></div>
            <div className="chips">{states.map(c => <button key={c} type="button" className="chip on" aria-label={'Remove ' + STATES[c]} onClick={() => setStates(states.filter(x => x !== c))}>{STATES[c]} ×</button>)}</div>
            <p className="note" style={{ marginTop: 6 }}>Up to 5 states. Leave empty and untick Remote to search the whole US.</p>
          </fieldset>
          <fieldset className="fs">
            <legend>Job type <span className="opt">Optional</span></legend>
            <div className="checks">{cfg.types.map(([v, l]) => <label className="check" key={v}><input type="checkbox" checked={types.includes(v)} onChange={e => setTypes(e.target.checked ? [...types, v] : types.filter(x => x !== v))} /> {l}</label>)}</div>
          </fieldset>
          <fieldset className="fs">
            <legend>How often</legend>
            <div className="seg" role="radiogroup">{(['daily', 'weekly', 'off'] as const).map(v => <label key={v}><input type="radio" name="jfreq" checked={frequency === v} onChange={() => setFrequency(v)} /><span>{v === 'off' ? 'Paused' : v[0].toUpperCase() + v.slice(1)}</span></label>)}</div>
          </fieldset>
          <fieldset className="fs">
            <legend>Send to</legend>
            <p className="sendto"><span className="ico"><Icon name="mail" /></span><span>{user ? user.email : 'Your account email (sign in first)'}</span></p>
            <div className="wa">
              <label className="check"><input type="checkbox" disabled={!cfg.whatsapp} checked={wa.on} onChange={e => setWa({ ...wa, on: e.target.checked })} /> WhatsApp too {!cfg.whatsapp && <span className="pill mid">Coming soon</span>}</label>
              {wa.on && <div>
                <label htmlFor="waPhone">WhatsApp number</label><input id="waPhone" type="tel" inputMode="tel" placeholder="+1 555 123 4567" value={wa.phone} onChange={e => setWa({ ...wa, phone: e.target.value })} />
                <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={wa.consent} onChange={e => setWa({ ...wa, consent: e.target.checked })} /> I agree to receive job alerts on WhatsApp. I can stop them any time.</label>
              </div>}
            </div>
          </fieldset>
          <div className="actions" style={{ margin: '18px 0 0' }}>
            <button type="button" className="pri" disabled={saving} onClick={save}>{user ? (saved ? 'Save changes' : 'Save & turn on alerts') : 'Create account & turn on alerts'}</button>
            <button type="button" onClick={() => preview()}>Preview matches</button>
          </div>
          <p className={'note' + (msg.bad ? ' bad' : '')} role="status">{msg.t}</p>
          <p className="note">We only email jobs that match what you choose. Every email has a one-click unsubscribe link. See our <a href="/privacy/">Privacy policy</a>.</p>
        </section>

        <section className="card jobs-list" aria-labelledby="matchT">
          <div className="jf-head"><h2 id="matchT">Matches</h2><span className="note" style={{ margin: 0 }}>{searching ? 'Searching…' : jobs.length ? jobs.length + ' job' + (jobs.length > 1 ? 's' : '') : ''}</span></div>
          {banner && <p className={'banner' + (banner.warn ? ' warn' : '')}>{banner.t}</p>}
          <div className="jlist" aria-live="polite">
            {searching ? <><div className="skel" /><div className="skel" /><div className="skel" /></> : !jobs.length ? <p className="empty">No matching jobs posted in the last few days. Try another title, add a state, or include remote jobs.</p> : jobs.map(j => (
              <article className="jcard" key={j.id}>
                <div className="jc-main">
                  <h3><button type="button" className="jc-title" onClick={() => setCurrent(j)}>{j.title}</button></h3>
                  <p className="jc-meta">{[j.company, where(j)].filter(Boolean).join(' · ')}</p>
                  <p className="jc-tags">{j.type && <span className="tag">{j.type}</span>}{j.salary && <span className="tag">{j.salary}</span>}{j.posted && <span className="tag muted">{when(j.posted)}</span>}</p>
                  <p className="jc-snip">{snippet(j.desc)}</p>
                </div>
                <div className="jc-act"><a className="btn pri" href={tailor(j)}>Tailor resume</a><button type="button" onClick={() => setCurrent(j)}>View job description</button></div>
                <p className="jc-credit">{credit(j.src)} · <a href={j.url} target="_blank" rel="noopener noreferrer">Original listing</a> · <button type="button" className="lnk" onClick={() => openReport(j)}>Report</button></p>
              </article>
            ))}
          </div>
          <p className="note">{used}{sample || !used ? '' : '. We link to each original listing; apply on the employer or source site.'}</p>
        </section>
      </div>

      <dialog ref={jobDlg} aria-labelledby="jobT" className="wide" onClose={() => setCurrent(null)}>
        {current && <div className="dlg">
          <div className="jd-top"><div><h2 id="jobT">{current.title}</h2><p className="jd-meta">{[current.company, where(current), current.type, current.salary, when(current.posted)].filter(Boolean).join(' · ')}</p></div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => setCurrent(null)}><Icon name="x" /></button></div>
          <div className="jd-cta"><a className="btn pri" href={tailor(current)}>Tailor resume to this job</a><a className="btn" href={current.url || '#'} target="_blank" rel="noopener noreferrer">View &amp; apply on original site</a></div>
          {current.email && <p className="note">Contact: {current.email}</p>}
          <div className="jd-text">{current.desc}</div>
          <div className="jd-foot"><span>{credit(current.src)}</span><button type="button" className="lnk" onClick={() => openReport(current)}>Report this listing</button></div>
          <div className="jd-cta bottom"><a className="btn pri" href={tailor(current)}>Tailor resume to this job</a></div>
        </div>}
      </dialog>

      <dialog ref={repDlg} aria-labelledby="repT" onClose={() => setReport(null)}>
        <form className="dlg" autoComplete="off" onSubmit={sendReport}>
          <h2 id="repT">Report this listing</h2>
          <p className="hint">{report ? [report.title, report.company].filter(Boolean).join(' · ') : ''}</p>
          <fieldset className="fs" style={{ marginTop: 0 }}>
            <legend>What is wrong?</legend>
            {cfg.reasons.map(([v, l]) => <label className="check" key={v}><input type="radio" name="rep" checked={repReason === v} onChange={() => setRepReason(v)} /> {l}</label>)}
          </fieldset>
          <label htmlFor="repNote">Details <span className="opt">Optional</span></label>
          <textarea id="repNote" rows={3} maxLength={500} placeholder="Anything that helps us check it" value={repNote} onChange={e => setRepNote(e.target.value)} />
          <p className="note" role="status">{repMsg}</p>
          <div className="actions" style={{ marginTop: 12 }}><button type="submit" className="pri" disabled={repBusy}>Send report</button><button type="button" onClick={() => setReport(null)}>Cancel</button></div>
        </form>
      </dialog>
    </main>
  );
}
