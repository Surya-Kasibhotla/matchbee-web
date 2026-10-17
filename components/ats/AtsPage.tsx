'use client';
/* /ats/ page: the ATS panel plus an optional job description box.
   Keywords appear at once from the built-in list (jdKeywords); the AI skill reader (/api/skills) adds more about a second later. */
import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/lib/site';
import { SAMPLES } from '@/lib/samples';
import { jdKeywords } from '@/lib/ats/engine';
import { api } from '@/lib/api';
import { useTech } from '@/lib/tech';
import { fill } from '@/lib/text';
import { MI, Icon } from '@/components/Icon';
import { AtsPanel, type AtsHandle } from './AtsPanel';

function grow(el: HTMLTextAreaElement | null) { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } }

export function AtsPage() {
  const [jd, setJd] = useState(''), [skills, setSkills] = useState<string[]>([]), [status, setStatus] = useState('');
  const panel = useRef<AtsHandle>(null), box = useRef<HTMLTextAreaElement>(null), main = useRef<HTMLElement>(null);
  const tech = useTech(); // keywords from the dictionary appear once it has loaded

  useEffect(() => {
    const t = jd.trim().length >= 40 ? jd.slice(0, 12000) : '';
    const local = t ? jdKeywords(t, tech) : [];
    setSkills(local); setStatus(t ? (local.length ? 'Found ' + local.length + ' skills. Reading the text for more…' : 'Reading the text for skills…') : '');
    if (!t) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const x = await api<{ skills?: string[] }>('POST', '/api/skills', { jd: t }, ctl.signal), j = x.ok ? x.j : null;
        if (j && j.skills && j.skills.length) { // AI skills first, then any built-in matches the AI missed
          const seen = new Set<string>(), all = [...j.skills, ...local].filter(k => { const l = k.toLowerCase(); if (seen.has(l)) return false; seen.add(l); return true; }).slice(0, 40);
          setSkills(all); setStatus('Found ' + all.length + ' skills.');
        } else setStatus(local.length ? 'Found ' + local.length + ' skills.' : '');
      } catch { /* aborted or offline: keep the built-in list */ }
    }, 900);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [jd, tech]);

  // "Try a sample resume" lives in the page header (PageHead); it dispatches this event
  useEffect(() => {
    const run = () => { panel.current?.check(SAMPLES.resume, 'sample-resume.txt (dummy data)'); main.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    window.addEventListener('mb:atssample', run); return () => window.removeEventListener('mb:atssample', run);
  }, []);

  return (
    <main id="main" ref={main} className="container ats-layout app-page">
      <section className="card" aria-live="polite">
        <AtsPanel ref={panel} jd={jd} skills={skills} jdNote={(has, n) => has ? 'Keywords are matched against your job description (' + n + ' skills).' : 'Add a job description to also get a keyword match score.'} />
      </section>
      <aside className="ats-side">
        <div className="card">
          <h2>Job description <span className="opt">Optional</span></h2>
          <p className="hint">Paste the job you are applying for to see which keywords your resume is missing.</p>
          <textarea ref={box} id="atsjd" className="grow" placeholder="Paste the job description here…" autoComplete="off" value={jd} onChange={e => { setJd(e.target.value); grow(e.target); }} />
          <div className="actions" style={{ margin: '10px 0 0' }}><button type="button" className="ghost" onClick={() => { setJd(SAMPLES.jd); setTimeout(() => grow(box.current), 0); }}>Use a sample job description</button></div>
          <p className="note" aria-live="polite">{status}</p>
          <div className="chips">{skills.map(k => <span className="tag" key={k}>{k}</span>)}</div>
        </div>
        <div className="card">
          <h2>What we check</h2>
          <ul className="what">{(SITE.pages.ats.what || []).map((w: { icon: string; text: string }) => <li key={w.text}><MI name={w.icon} /><span>{fill(w.text)}</span></li>)}</ul>
        </div>
      </aside>
    </main>
  );
}

/** Header button: "Try a sample resume" */
export function AtsSampleButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event('mb:atssample'))}><Icon name="spark" />Try a sample resume</button>;
}
