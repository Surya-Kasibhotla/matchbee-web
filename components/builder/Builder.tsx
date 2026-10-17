'use client';
/* Resume Builder: form (job description, about you, experience, skills), Generate, and the output panel.
   Nothing is stored in the browser: a refresh starts clean. Signed-in users can keep saved profiles. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { analyzeJd, DOMAINS, type Jd } from '@/lib/builder/jd';
import { blankClient, emptyForm, formProfile, hasDetails, jdFromJob, payload, proj, yearOf, type Ai, type Client, type Form, type Profile } from '@/lib/builder/resume';
import { readFile } from '@/lib/ats/engine';
import { SAMPLES } from '@/lib/samples';
import { MI } from '@/components/Icon';
import { useApp } from '@/components/app/AppProvider';
import type { AtsHandle } from '@/components/ats/AtsPanel';
import { Output, type Tab } from './Output';
import { ProfileCard, ProfileDialog } from './Profiles';

type Parsed = { name: string; email: string; phone: string; location: string; title: string; education: string[]; skills: string[]; experience: { company: string; title: string; from: string; to: string; bullets: string[] }[]; dropped: number };
type Job = { title?: string; company?: string; city?: string; state?: string; remote?: boolean; desc?: string; email?: string; url?: string };
const JOB_ID = /^([a-z]{2}-[a-z0-9]{1,13}|sample-\d{1,3})$/;

function grow(el: HTMLTextAreaElement | null) { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } }
/** Contact details only, for when the AI is unavailable */
function basicParse(t: string): Parsed {
  const first = t.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
  return { name: first.length < 60 && !/[@\d]/.test(first) ? first : '', email: (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0], phone: ((t.match(/\+?\d[\d\s().-]{8,}\d/) || [''])[0]).trim(),
    location: '', title: '', education: [], skills: [], experience: [], dropped: 0 };
}

export function Builder() {
  const { cfg, user, how, version, openAuth } = useApp();
  const [f, setF] = useState<Form>(emptyForm);
  const [facts, setFacts] = useState<Jd['facts']>(undefined), [aiSkills, setAiSkills] = useState<string[] | null>(null), [skStatus, setSkStatus] = useState('');
  const [tech, setTech] = useState<Record<string, 1>>({}); // skills the user stated (profile or uploaded resume): ticked when the job asks for them
  const [tab, setTab] = useState<Tab>('resume'), [gen, setGen] = useState(false), [ai, setAi] = useState<Ai | null>(null), [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false), [busyLabel, setBusyLabel] = useState(''), [note, setNote] = useState(''), [edited, setEdited] = useState<string | null>(null), [jobId, setJobId] = useState('');
  const [jobBar, setJobBar] = useState<{ html: React.ReactNode; warn?: boolean } | null>(null), [pendingJob, setPendingJob] = useState('');
  const [importMsg, setImportMsg] = useState<{ t: string; bad?: boolean }>({ t: '' }), [importing, setImporting] = useState(false), [drop, setDrop] = useState(false);
  const [autoNote, setAutoNote] = useState('Splits your total years across clients, most recent first. Edit any range afterwards.');
  const [profiles, setProfiles] = useState<Profile[]>([]), [sel, setSel] = useState(''), [dlg, setDlg] = useState<{ open: boolean; p: Profile; id: string | null; welcome: boolean }>({ open: false, p: formProfile(emptyForm(), null), id: null, welcome: false });
  const [savePrompt, setSavePrompt] = useState<'none' | 'in' | 'upd' | 'save' | 'done' | string>('none'), [spName, setSpName] = useState(''), [dismissed, setDismissed] = useState('');
  const genCtl = useRef<AbortController | null>(null), autoDone = useRef(''), jdBox = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), ats = useRef<AtsHandle>(null);

  // job description: instant structural read, replaced by the AI skill list a second later
  const local = useMemo(() => analyzeJd(f.jd), [f.jd]);
  const J: Jd = useMemo(() => ({ ...local, skills: aiSkills || local.skills, facts }), [local, aiSkills, facts]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(s => ({ ...s, [k]: v }));
  // tick skills the user already stated, whenever they appear in the job
  useEffect(() => { setF(s => { const have = { ...s.have }; let ch = false; J.skills.forEach(k => { if (tech[k.toLowerCase()] && !have[k]) { have[k] = true; ch = true; } }); return ch ? { ...s, have } : s; }); }, [J.skills, tech]);

  // changes after a generated resume mark it out of date
  const firstRender = useRef(true);
  useEffect(() => { if (firstRender.current) { firstRender.current = false; return; } if (ai) setStale(true); }, [f.name, f.role, f.phone, f.email, f.loc, f.edu, f.years, f.clients, f.have, f.other]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetOutput = useCallback(() => {
    if (genCtl.current) { genCtl.current.abort(); genCtl.current = null; }
    setAi(null); setStale(false); setNote(''); setGen(false); setBusy(false); setEdited(null);
  }, []);

  function setJd(v: string) {
    if (v !== f.jd) { resetOutput(); setAiSkills(null); setFacts(undefined); }
    set('jd', v); setTimeout(() => grow(jdBox.current), 0);
  }

  async function runGenerate(auto: boolean) {
    if (busy) return;
    setAi(null); setStale(false); setNote(''); setEdited(null);
    if ((f.jd || '').trim().length < 40) { setNote('Paste a job description to get AI tailoring. Showing the template version.'); setGen(true); return; }
    setBusy(true); setBusyLabel(auto ? 'Writing draft…' : 'Comparing AI versions…'); // several AIs write a full version: about 30 to 90 seconds
    const ctl = genCtl.current = new AbortController(), t = setTimeout(() => ctl.abort(), 120000); // several AIs write a full resume (8 to 10 bullets per client), which can take over a minute
    try {
      const x = await api<{ resume: Ai; compared?: number }>('POST', '/api/generate', payload(f, J, jobId), ctl.signal);
      if (ctl !== genCtl.current) return;
      if (x.ok && x.j.resume) {
        setAi(x.j.resume);
        setNote(x.j.resume.draft ? 'Draft written from your pasted job description. Nothing here is a fact about you until you review it. Add your details and press Generate to personalise it.'
          : 'Generated with AI from your details' + ((x.j.compared || 0) > 1 ? ' (best of ' + x.j.compared + ' AI versions)' : '') + '. Highlighted lines are suggestions: keep only what is true.');
      } else if (x.status === 401 && x.j.error === 'signin_required') { setNote(x.j.message || ''); openAuth(x.j.message); }
      else setNote((x.status === 429 || x.status === 400) && x.j.message ? x.j.message : 'AI is unavailable right now. Showing the template version.');
    } catch { if (ctl === genCtl.current) setNote('Could not reach the AI service. Showing the template version.'); }
    finally { clearTimeout(t); if (ctl === genCtl.current) { genCtl.current = null; setBusy(false); setGen(true); if (!auto) { document.getElementById('out')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); askSave(); } } }
  }

  // AI skill reader: 1 second after typing stops; writes a first draft automatically once per pasted text
  useEffect(() => {
    const jd = (f.jd || '').trim(); setSkStatus('');
    if (jd.length < 60) return;
    setSkStatus('Reading the text for skills…');
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const x = await api<{ skills: string[]; facts: Jd['facts'] }>('POST', '/api/skills', { jd }, ctl.signal);
        if (x.ok && x.j.skills && x.j.skills.length) {
          setAiSkills(x.j.skills); setFacts(x.j.facts || {}); setSkStatus('Skills found in your text by AI. Tap only the ones you really have.');
          if (autoDone.current !== jd) { autoDone.current = jd; setAutoGen(jd); }
        } else setSkStatus('Showing skills picked out of the text. Tap only the ones you really have.');
      } catch { /* aborted: a newer text is being read */ }
    }, 1000);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [f.jd]);
  const [autoGen, setAutoGen] = useState('');
  useEffect(() => { if (autoGen && autoGen === (f.jd || '').trim() && !busy && !ai && !gen) runGenerate(true); }, [autoGen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- clients ---------- */
  function setCount(n: number) {
    n = Math.max(0, Math.min(12, n || 0));
    setF(s => { const cl = s.clients.slice(0, n); while (cl.length < n) cl.push(blankClient()); return { ...s, count: n ? String(n) : '', clients: cl }; });
  }
  const setClient = (i: number, k: keyof Client, v: string) => setF(s => ({ ...s, clients: s.clients.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  function autoRanges() {
    const T = parseInt(f.years, 10), N = f.clients.length;
    if (!T || !N) { setAutoNote('Enter total years and number of clients first.'); return; }
    const end = new Date().getFullYear(), chunk = T / N;
    setF(s => ({ ...s, clients: s.clients.map((c, i) => ({ ...c, to: i === 0 ? 'Present' : String(end - Math.round(i * chunk)), from: String(end - Math.round((i + 1) * chunk)) })) }));
    setAutoNote('Done. Ranges are split evenly, so edit them to match your real dates.');
  }

  /* ---------- profiles ---------- */
  const selected = profiles.find(p => p.id === sel) || null;
  const loadProfiles = useCallback(async () => { const x = await api<{ profiles: Profile[] }>('GET', '/api/profiles'); const list = x.ok ? x.j.profiles || [] : []; setProfiles(list); return list; }, []);
  function applyProfile(p: Profile) {
    const all: string[] = [], t: Record<string, 1> = {};
    (p.clients || []).forEach(c => (c.tech || []).forEach(x => { const l = x.toLowerCase(); if (!t[l]) { t[l] = 1; all.push(x); } }));
    const yrs = (p.clients || []).map(c => parseInt(c.from, 10)).filter(n => n > 1960);
    setTech(t);
    setF(s => ({ ...s, name: ((p.first || '') + ' ' + (p.last || '')).trim(), phone: p.phone || '', email: p.email || '', role: p.role || '', other: all.join(', '),
      clients: (p.clients || []).map(c => ({ ...blankClient(), name: c.name || '', from: c.from || '', to: c.to || '' })), count: p.clients && p.clients.length ? String(p.clients.length) : '',
      years: yrs.length ? String(Math.max(0, new Date().getFullYear() - Math.min(...yrs))) : s.years }));
  }
  function openProf(p: Profile | null, welcome = false) {
    const base = p || formProfile(emptyForm(), null);
    if (!p && user) { base.email = user.email; base.first = user.first || ''; base.last = user.last || ''; base.label = ''; }
    setDlg({ open: true, p: base, id: p && p.id ? p.id : null, welcome });
  }
  async function saveProf(prof: Profile, id: string | null): Promise<string | null> {
    const x = await api<{ profile: Profile }>(id ? 'PUT' : 'POST', id ? '/api/profiles/' + id : '/api/profiles', { profile: prof });
    if (!x.ok) return x.j.message || 'Could not save.';
    await loadProfiles(); setSel(x.j.profile.id || ''); applyProfile(x.j.profile); return null;
  }
  // sign-in changes: load profiles; offer to fill a first profile after signing in
  useEffect(() => {
    if (!user) { setProfiles([]); setSel(''); return; }
    if (how !== 'init' && how !== 'update' && pendingJob) { loadJob(pendingJob); return; }
    loadProfiles().then(list => { if ((how === 'login' || how === 'signup' || how === 'google') && !list.length) openProf(null, true); });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  // after a manual Generate with typed details: offer to save them as a profile (never saved without a yes)
  function askSave() {
    if (!cfg?.accounts) return;
    const fp = formProfile(f, selected), key = proj(fp);
    if (!hasDetails(fp) || dismissed === key || (selected && proj(selected) === key)) { setSavePrompt('none'); return; }
    setSpName((f.role || '').trim());
    setSavePrompt(!user ? 'in' : selected ? 'upd' : 'save');
  }

  /* ---------- start from an uploaded resume (server copies the facts out word for word: /api/parse-resume) ---------- */
  function importResume(p: Parsed) {
    const jobs = p.experience || [];
    setF(s => {
      const n = { ...s };
      if (p.name) n.name = p.name; if (p.email) n.email = p.email; if (p.phone) n.phone = p.phone; if (p.location) n.loc = p.location;
      if (p.education && p.education.length) n.edu = p.education.join('; ');
      n.role = p.title || (jobs[0] && jobs[0].title) || s.role;
      if (jobs.length) {
        n.clients = jobs.map(c => ({ ...blankClient(), name: c.company || '', role: c.title || '', from: yearOf(c.from) || c.from || '', to: /present|current|now|till|date/i.test(c.to || '') ? 'Present' : yearOf(c.to) || c.to || '', notes: (c.bullets || []).join('\n') }));
        n.count = String(n.clients.length);
        const ys = n.clients.map(c => parseInt(c.from, 10)).filter(x => x > 1960);
        if (ys.length) n.years = String(Math.max(1, new Date().getFullYear() - Math.min(...ys)));
      }
      const other: string[] = []; (p.skills || []).forEach(t => { if ((other.join(', ') + ', ' + t).length <= 300) other.push(t); }); // the server takes 300 characters of other skills
      if (other.length) n.other = other.join(', ');
      return n;
    });
    const t: Record<string, 1> = {}; (p.skills || []).forEach(x => { t[x.toLowerCase()] = 1; }); setTech(t);
    setEdited(null); setGen(true); setTab('resume');
    return { jobs: jobs.length, skills: (p.skills || []).length };
  }
  async function importFile(file?: File | null) {
    if (!file) return; setImporting(true); setImportMsg({ t: 'Reading ' + file.name + '…' });
    try {
      const text = String(await readFile(file) || '').trim();
      if (text.length < 100) throw new Error('We could not find enough text in that file. If it is a scanned image, export a text-based PDF from Word or Google Docs.');
      setImportMsg({ t: 'Copying your details from ' + file.name + '…' });
      const x = await api<{ parsed: Parsed }>('POST', '/api/parse-resume', { resume: text.slice(0, 20000) });
      if (x.ok && x.j.parsed) {
        const n = importResume(x.j.parsed), d = x.j.parsed.dropped;
        setImportMsg({ t: 'Filled in from ' + file.name + ': ' + n.jobs + ' job' + (n.jobs === 1 ? '' : 's') + ' and ' + n.skills + ' skill' + (n.skills === 1 ? '' : 's') + '. Check each section below. Anything we could not copy exactly was left out' + (d ? ' (' + d + ' item' + (d === 1 ? '' : 's') + ')' : '') + '.' });
      } else { importResume(basicParse(text)); setImportMsg({ t: 'The AI is busy, so we filled in your contact details only. Add your jobs below, or try the upload again in a minute.', bad: true }); }
    } catch (e: unknown) { setImportMsg({ t: errMsg(e, 'Could not read that file.'), bad: true }); }
    setImporting(false);
  }

  /* ---------- "Tailor resume to this job" links: /builder/?job=<id> ---------- */
  function applyJob(j: Job, id: string) {
    setJobId(/^sample-/.test(id) ? '' : id); setJd(jdFromJob(j));
    setJobBar({ html: <><b>Tailoring to:</b> {j.title}{j.company ? ' · ' + j.company : ''}{j.url && <> · <a href={j.url} target="_blank" rel="noopener noreferrer">Original listing</a></>}{/^sample-/.test(id) && <> <span className="opt">Sample job</span></>}</> });
  }
  async function loadJob(id: string) {
    if (/^sample-/.test(id)) { const s = (SAMPLES.jobs as (Job & { id: string })[]).find(x => x.id === id); if (s) applyJob(s, id); return; }
    const x = await api<{ job: Job }>('GET', '/api/jobs/item/' + encodeURIComponent(id));
    if (x.ok) { setPendingJob(''); try { sessionStorage.removeItem('mb_job'); } catch { /* ignore */ } applyJob(x.j.job, id); return; }
    if (x.status === 401) {
      setPendingJob(id); try { sessionStorage.setItem('mb_job', id); } catch { /* ignore */ } // survives the Google sign-in round trip
      setJobBar({ html: <>Sign in to tailor your resume to this job. <button type="button" onClick={() => openAuth('Sign in to tailor your resume to this job.')}>Sign in</button></> });
      if (cfg?.accounts) openAuth('Sign in to tailor your resume to this job.'); return;
    }
    setJobBar({ html: x.j.message || 'This job is no longer available.', warn: true });
  }

  /* ---------- start-up: job links, Android share, tab links, header buttons ---------- */
  const started = useRef(false);
  useEffect(() => {
    if (!cfg || started.current) return; started.current = true;
    const q = new URLSearchParams(location.search);
    let id = q.get('job'); try { id = id || sessionStorage.getItem('mb_job'); } catch { /* ignore */ }
    if (id && JOB_ID.test(id)) loadJob(id);
    const shared = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').slice(0, 12000); // "Share to MatchBee" on Android
    if (shared.trim() && (q.has('text') || q.has('title') || q.has('url'))) { history.replaceState(null, '', location.pathname); setJd(shared); }
    const h = location.hash.slice(1) as Tab; if (['intro', 'gaps', 'ats'].includes(h)) { setTab(h); setGen(true); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sample = () => {
      const P = SAMPLES.profile; setJd(SAMPLES.jd); setTech(Object.fromEntries(P.skills.map(k => [k.toLowerCase(), 1])) as Record<string, 1>);
      setF(s => ({ ...s, jd: SAMPLES.jd, name: P.name, role: P.role, phone: P.phone, email: P.email, loc: P.loc, edu: P.edu, years: P.years, other: P.other,
        clients: P.clients.map(c => ({ ...blankClient(), ...c })), count: String(P.clients.length) }));
    };
    const reset = () => { if (!confirm('Clear everything?')) return; try { sessionStorage.removeItem('mb_job'); } catch { /* ignore */ } location.href = location.pathname; };
    const show = () => { if ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'back_forward') location.reload(); };
    window.addEventListener('mb:sample', sample); window.addEventListener('mb:reset', reset); window.addEventListener('pageshow', show);
    return () => { window.removeEventListener('mb:sample', sample); window.removeEventListener('mb:reset', reset); window.removeEventListener('pageshow', show); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // your own words are never flagged; technology names come from the shared dictionary inside the spell checker
  const spellAllow = () => [f.name, f.loc, f.edu, f.role, f.other, ...J.skills, ...f.clients.flatMap(c => [c.name, c.role])].filter(Boolean);

  return (
    <main id="main" className="container app app-page">
      <section>
        {user && <ProfileCard profiles={profiles} sel={sel} onPick={id => { setSel(id); const p = profiles.find(x => x.id === id); if (p) applyProfile(p); }}
          onNew={() => openProf(null)} onEdit={() => selected && openProf(selected)}
          onDelete={async () => { if (!selected || !confirm('Delete the profile "' + selected.label + '"?')) return; await api('DELETE', '/api/profiles/' + selected.id); setSel(''); loadProfiles(); }} />}

        <div className={'card import-card' + (drop ? ' drop' : '')} onDragEnter={e => { e.preventDefault(); setDrop(true); }} onDragOver={e => { e.preventDefault(); setDrop(true); }}
          onDragLeave={e => { e.preventDefault(); setDrop(false); }} onDrop={e => { e.preventDefault(); setDrop(false); importFile(e.dataTransfer?.files[0]); }}>
          <div className="import-row">
            <MI name="doc" />
            <div className="import-txt">
              <h2>Start from your current resume <span className="opt">optional</span></h2>
              <p className="hint">Upload a PDF, DOCX or TXT and we fill in the form below with your name, contact details, jobs, dates, bullets and skills, copied word for word. Then edit anything, or paste a job description to tailor it. You can also drop the file here.</p>
            </div>
            <button type="button" className="pri" disabled={importing} onClick={() => fileInput.current?.click()}>Upload resume</button>
            <input ref={fileInput} type="file" hidden accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {importMsg.t && <p className={'note' + (importMsg.bad ? ' bad' : '')} id="importmsg" role="status">{importMsg.t}</p>}
        </div>

        <div className="card">
          <h2><span className="step">1</span>Job description</h2>
          <p className="hint">Paste anything: WhatsApp post, email, forwarded text. Skills are read from your text and appear in step 4 (the text is sent to the AI to find them).</p>
          {jobBar && <div className={'banner' + (jobBar.warn ? ' warn' : '')} id="jobbar">{jobBar.html}</div>}
          <textarea ref={jdBox} autoComplete="off" id="jd" className="grow" placeholder="Paste the job description here…" value={f.jd} onChange={e => setJd(e.target.value)} />
          <div className="meta">{(() => {
            const fa = J.facts || {}, a: string[] = [], t = fa.title || J.title, l = fa.location || J.loc, ex = fa.experience || J.exp;
            if (t) a.push('Role: ' + t); if (fa.company) a.push('Company: ' + fa.company); if (l) a.push('Location: ' + l); if (ex) a.push('Exp: ' + ex);
            (fa.work_mode ? [fa.work_mode] : J.mode).forEach(x => a.push(x)); (fa.engagement ? [fa.engagement] : J.eng).forEach(x => a.push(x));
            if (fa.rate) a.push('Rate: ' + fa.rate); if (fa.visa_note || J.visa) a.push('Visa: ' + (fa.visa_note || J.visa)); if (fa.contact || J.email) a.push('Send to: ' + (fa.contact || J.email));
            return a.map(x => <span className="tag" key={x}>{x}</span>);
          })()}</div>
        </div>

        <div className="card">
          <h2><span className="step">2</span>About you <span className="opt">Optional</span></h2>
          <div className="row two">
            <div><label htmlFor="name">Full name</label><input id="name" spellCheck={false} autoComplete="off" placeholder="e.g. Alex Morgan" value={f.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label htmlFor="role">Your title</label><input id="role" spellCheck autoComplete="off" placeholder="e.g. Senior Software Engineer" value={f.role} onChange={e => set('role', e.target.value)} /></div>
          </div>
          <div className="row two">
            <div><label htmlFor="phone">Phone</label><input id="phone" spellCheck={false} type="tel" inputMode="tel" autoComplete="off" placeholder="e.g. (555) 123-4567" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label htmlFor="email">Email</label><input id="email" spellCheck={false} type="email" inputMode="email" autoComplete="off" placeholder="e.g. alex@email.com" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          </div>
          <div className="row two">
            <div><label htmlFor="loc">Location</label><input id="loc" spellCheck={false} autoComplete="off" placeholder="e.g. Austin, TX" value={f.loc} onChange={e => set('loc', e.target.value)} /></div>
            <div><label htmlFor="edu">Education</label><input id="edu" spellCheck autoComplete="off" placeholder="e.g. B.S. Computer Science" value={f.edu} onChange={e => set('edu', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <h2><span className="step">3</span>Experience</h2>
          <p className="hint">Tell us how many years and how many clients. We build one block per client.</p>
          <div className="row two">
            <div><label htmlFor="years">Total years of experience</label><input id="years" spellCheck={false} autoComplete="off" inputMode="numeric" placeholder="e.g. 10" value={f.years} onChange={e => set('years', e.target.value)} /></div>
            <div><label htmlFor="count">Clients / employers</label>
              <div className="stepper"><button type="button" aria-label="Fewer" onClick={() => setCount((parseInt(f.count, 10) || 0) - 1)}>−</button>
                <input id="count" spellCheck={false} autoComplete="off" inputMode="numeric" placeholder="e.g. 3" value={f.count} onChange={e => set('count', e.target.value)} onBlur={e => setCount(parseInt(e.target.value, 10))} />
                <button type="button" aria-label="More" onClick={() => setCount((parseInt(f.count, 10) || 0) + 1)}>+</button></div>
            </div>
          </div>
          <div className="actions" style={{ margin: '14px 0 0' }}><button type="button" onClick={autoRanges}>Auto-fill year ranges</button></div>
          <p className="note">{autoNote}</p>
          {f.clients.map((c, i) => (
            <div className="client" key={i}>
              <h3>Client / employer {i + 1}{i === 0 ? ' (most recent)' : ''}</h3>
              <label>Client name</label><input autoComplete="off" spellCheck={false} placeholder="e.g. Acme Bank" value={c.name} onChange={e => setClient(i, 'name', e.target.value)} />
              <div className="row two"><div><label>Your title there</label><input autoComplete="off" spellCheck placeholder="e.g. Software Engineer" value={c.role} onChange={e => setClient(i, 'role', e.target.value)} /></div>
                <div><label>Industry</label><select value={c.domain} onChange={e => setClient(i, 'domain', e.target.value)}>{Object.keys(DOMAINS).map(k => <option key={k} value={k}>{DOMAINS[k]}</option>)}</select></div></div>
              <div className="row yc"><div><label>From (year)</label><input autoComplete="off" inputMode="numeric" placeholder="e.g. 2021" value={c.from} onChange={e => setClient(i, 'from', e.target.value)} /></div>
                <div><label>To (year or Present)</label><input autoComplete="off" placeholder="e.g. Present" value={c.to} onChange={e => setClient(i, 'to', e.target.value)} /></div></div>
              <label>What you did there (optional, one line per bullet)</label>
              <textarea autoComplete="off" spellCheck className="grow" placeholder={'e.g. Built the account dashboard in React\nCut page load time by 30%'} value={c.notes} ref={grow} onChange={e => { setClient(i, 'notes', e.target.value); grow(e.target); }} />
            </div>
          ))}
        </div>

        <div className="card">
          <h2><span className="step">4</span>Your skills</h2>
          <p className="hint">Skills found in the job description appear below. Tap only the ones you really have. Only those go on your resume.</p>
          <div className="chips">{J.skills.length ? J.skills.map(k => (
            <button key={k} type="button" className={'chip' + (f.have[k] ? ' on' : '')} aria-pressed={!!f.have[k]} onClick={() => setF(s => ({ ...s, have: { ...s.have, [k]: !s.have[k] } }))}>{k}</button>
          )) : <span className="hint">Paste a job description to see skills.</span>}</div>
          <p className="note" aria-live="polite">{skStatus}</p>
          <label htmlFor="other">Other skills you have (comma separated)</label>
          <input id="other" spellCheck={false} autoComplete="off" placeholder="e.g. Jest, Cucumber, Git" value={f.other} onChange={e => set('other', e.target.value)} />
        </div>

        <button className="pri" id="gen" type="button" disabled={busy} onClick={() => runGenerate(false)}>{busy ? busyLabel : 'Generate'}</button>
        <div aria-live="polite">
          {savePrompt === 'in' && <p className="banner">Want to reuse these details next time? <button type="button" onClick={() => openAuth()}>Sign in to save</button> <button type="button" onClick={() => { setDismissed(proj(formProfile(f, selected))); setSavePrompt('none'); }}>Not now</button></p>}
          {savePrompt === 'upd' && selected && <p className="banner">You changed the profile &ldquo;{selected.label}&rdquo;. Save the changes? <button type="button" onClick={async () => setSavePrompt((await saveProf(formProfile(f, selected), selected.id!)) || 'done')}>Update it</button> <button type="button" onClick={async () => setSavePrompt((await saveProf({ ...formProfile(f, selected), label: (selected.label + ' (copy)').slice(0, 40) }, null)) || 'done')}>Save as new</button> <button type="button" onClick={() => { setDismissed(proj(formProfile(f, selected))); setSavePrompt('none'); }}>Not now</button></p>}
          {savePrompt === 'save' && <div className="banner">Save these details as a profile so you can prefill next time?<input placeholder="Profile name, e.g. Frontend" value={spName} maxLength={40} onChange={e => setSpName(e.target.value)} />
            <button type="button" onClick={async () => setSavePrompt((await saveProf(formProfile(f, null, spName.trim() || undefined), null)) || 'done')}>Save</button> <button type="button" onClick={() => { setSavePrompt('none'); openProf(formProfile(f, null, spName.trim() || undefined)); }}>Add technologies first</button> <button type="button" onClick={() => { setDismissed(proj(formProfile(f, null))); setSavePrompt('none'); }}>Not now</button></div>}
          {savePrompt === 'done' && <p className="banner">Saved.</p>}
          {!['none', 'in', 'upd', 'save', 'done'].includes(savePrompt) && <p className="banner warn">{savePrompt}</p>}
        </div>
        <p className="gen-note">Generate sends your job description and the details above to this site&apos;s server and AI providers to write your resume. We do not store them. Only profiles you choose to save while signed in are kept. If AI is unavailable you still get a template version.</p>
      </section>

      <Output ref={ats} form={f} J={J} ai={ai} gen={gen} busy={busy} note={note} stale={stale && !!ai} edited={edited} tab={tab}
        setTab={t => { setTab(t); setGen(true); }} setEdited={setEdited} onRefresh={() => runGenerate(false)} spellAllow={spellAllow} />

      <ProfileDialog open={dlg.open} initial={dlg.p} title={dlg.id ? 'Edit profile' : dlg.welcome ? 'Fill your profile (optional)' : 'New profile'} cancelLabel={dlg.welcome ? 'Skip for now' : 'Cancel'}
        onClose={() => setDlg(d => ({ ...d, open: false }))} onSave={async p => { const e = await saveProf(p, dlg.id); if (!e) setDlg(d => ({ ...d, open: false })); return e; }} />
    </main>
  );
}

/** Header buttons: "Try sample data" and "Clear all" */
export function BuilderActions() {
  return (
    <>
      <button type="button" onClick={() => window.dispatchEvent(new Event('mb:sample'))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></svg>Try sample data
      </button>
      <button type="button" className="ghost" onClick={() => window.dispatchEvent(new Event('mb:reset'))}>Clear all</button>
    </>
  );
}
