'use client';
/* ATS results panel, used by the /ats/ page and the builder's ATS tab.
   Upload (or paste) a resume -> instant built-in score (lib/ats/engine.js) -> the AI spelling and wording review
   (/api/ats) is merged in when it arrives. Parents can start a check with ref.current.check(text, name). */
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { analyze, readFile, type AiReview, type Issue } from '@/lib/ats/engine';
import { api } from '@/lib/api';
import { useTech } from '@/lib/tech';

const GROUPS: [Issue['cat'], string][] = [['spelling', 'Spelling & typos'], ['dates', 'Dates'], ['tech', 'Technology timeline'], ['keywords', 'Keywords'], ['impact', 'Content & impact'], ['format', 'Format & contact']];
const AIMSG: Record<string, string> = {
  busy: 'Running the AI spelling and wording review…', done: 'Includes the AI spelling and wording review.', off: 'AI review is not set up on this server. Built-in checks only.',
  limit: 'AI review limit reached. Built-in checks only.', fail: 'AI review is unavailable right now. Built-in checks only.',
};
export type AtsHandle = { check: (text: string, name: string) => void };
type Props = { jd: string; skills: string[]; jdNote: (hasJd: boolean, n: number) => string };

function IssueItem({ i }: { i: Issue }) {
  const short = !!i.fix && i.fix.length <= 32 && !/\.$/.test(i.fix); // single-word fixes get an arrow chip, sentences a note
  return (
    <li className={'sev-' + i.sev}>
      <div>{i.msg}{short && <> <span className="fix">→ {i.fix}</span></>}</div>
      {i.fix && !short && <div className="fixnote">{i.fix}</div>}
      {i.line && <q>{i.line}</q>}
    </li>
  );
}

export const AtsPanel = forwardRef<AtsHandle, Props>(function AtsPanel({ jd, skills, jdNote }, ref) {
  const [text, setText] = useState(''), [name, setName] = useState(''), [err, setErr] = useState('');
  const [ai, setAi] = useState<AiReview | null>(null), [aiState, setAiState] = useState('');
  const [busy, setBusy] = useState(false), [over, setOver] = useState(false), [paste, setPaste] = useState('');
  const seq = useRef(0), fileInput = useRef<HTMLInputElement>(null);
  const hasJd = jd.trim().length >= 40, jdText = hasJd ? jd.slice(0, 12000) : '';

  // recomputed whenever the resume, the job's skills or the AI review change
  const tech = useTech();
  const res = useMemo(() => (text ? analyze(text, { jdSkills: hasJd ? skills : [], extraSpelling: ai ? ai.spelling : [], tech }) : null), [text, hasJd, skills, ai, tech]);

  async function check(t: string, n: string) {
    t = String(t || ''); setText(t); setName(n); setErr(''); setAi(null);
    const my = ++seq.current;
    if (t.trim().length < 100) { setText(''); setErr('There is not enough text to check. Upload the full resume or paste all of it.'); return; }
    setAiState('busy');
    try {
      const r = await api<{ review?: AiReview }>('POST', '/api/ats', { resume: t.slice(0, 20000), jd: jdText });
      if (my !== seq.current) return;
      if (r.ok && r.j.review) { setAi(r.j.review); setAiState('done'); } else setAiState(r.status === 503 ? 'off' : r.status === 429 ? 'limit' : 'fail');
    } catch { if (my === seq.current) setAiState('fail'); }
  }
  useImperativeHandle(ref, () => ({ check }));

  async function onFile(f?: File | null) {
    if (!f) return; setBusy(true); setErr('');
    try { const t = await readFile(f); setBusy(false); check(t, f.name); }
    catch (e: unknown) {
      setBusy(false);
      const name = e instanceof Error ? e.name : '', msg = e instanceof Error ? e.message : ''; // pdf.js errors are Error subclasses named *Exception
      setErr(name === 'PasswordException' ? 'This PDF is password-protected. Remove the password and upload it again.'
        : msg && !/Exception$/.test(name) ? msg : 'Could not read that file. Try saving it again as PDF or DOCX.');
    }
  }
  const clear = () => { seq.current++; setText(''); setAi(null); setErr(''); setAiState(''); };
  const tone = res ? (res.score >= 85 ? 'ok' : res.score >= 70 ? 'good' : res.score >= 50 ? 'mid' : 'low') : '';

  return (
    <>
      <div className="ats-up">
        <label className={'drop' + (busy ? ' busy' : '') + (over ? ' over' : '')} htmlFor="atsfile"
          onDragEnter={e => { e.preventDefault(); setOver(true); }} onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
          onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer?.files[0]); }}>
          <input ref={fileInput} type="file" id="atsfile" className="vh" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="drop-ico" aria-hidden="true" />
          {/* looks and acts like a button; the whole box is the click and drop target */}
          <span className="btn pri drop-btn" aria-hidden="true">{busy ? 'Reading your resume…' : res ? 'Upload a different resume' : 'Upload resume'}</span>
          <span>or drag and drop it here · PDF, DOCX or TXT · up to 5 MB</span>
        </label>
        <details className="paste">
          <summary>Or paste the resume text</summary>
          <textarea id="atspaste" rows={8} placeholder="Paste the full text of your resume…" value={paste} onChange={e => setPaste(e.target.value)} />
          <div className="actions" style={{ margin: '10px 0 0' }}><button type="button" className="pri" onClick={() => check(paste, 'Pasted text')}>Check pasted text</button></div>
        </details>
        <p className="note">{jdNote(hasJd && skills.length > 0, hasJd ? skills.length : 0)} Your file is read in your browser. Only its text is sent for the AI spelling review, and it is not stored.</p>
      </div>
      {err && <p className="banner warn">{err}</p>}
      {!res ? (!busy && <p className="empty">Upload a resume to get an ATS score, spelling fixes, date checks and a technology timeline check.</p>) : (
        <>
          <div className="ats-score">
            <div className={'ring ' + tone} style={{ ['--p' as string]: res.score }} role="img" aria-label={'ATS score ' + res.score + ' out of 100'}><span>{res.score}</span><small>/ 100</small></div>
            <div className="ats-meta">
              <div className={'ats-rating ' + tone}>{res.rating}</div>
              <div className="note">{name} · {res.stats.words} words · {res.stats.roles} roles · {res.stats.bullets} bullets</div>
              <p className={'note ai-' + aiState}>{AIMSG[aiState] || ''}</p>
              <div className="actions" style={{ margin: '6px 0 0' }}><button type="button" onClick={clear}>Remove</button></div>
            </div>
          </div>
          <div className="ats-bars">
            {res.parts.map(p => {
              const pc = Math.round(p.got / p.max * 100);
              return <div className="bar" key={p.key}><div className="bar-top"><span>{p.label}</span><b>{p.got} / {p.max}</b></div><div className="track"><i className={pc >= 80 ? 'ok' : pc >= 50 ? 'mid' : 'low'} style={{ width: pc + '%' }} /></div></div>;
            })}
          </div>
          {GROUPS.map(([cat, label]) => {
            if (cat === 'keywords' && !res.keywords) return null;
            const items = res.issues.filter(i => i.cat === cat), errs = items.filter(i => i.sev === 'error').length;
            return (
              <section className="ats-group" key={cat}>
                <h3>{label}<span className={'cnt ' + (errs ? 'bad' : items.length ? 'mid' : 'ok')}>{items.length || '✓'}</span></h3>
                {cat === 'keywords' && res.keywords && (
                  <>
                    <p className="note" style={{ marginTop: 0 }}>{res.keywords.matched.length} of {res.keywords.matched.length + res.keywords.missing.length} job keywords found.</p>
                    <div className="chips kw">{res.keywords.matched.map(k => <span className="tag hit" key={'h' + k}>✓ {k}</span>)}{res.keywords.missing.map(k => <span className="tag miss" key={'m' + k}>{k}</span>)}</div>
                  </>
                )}
                {items.length ? <ul className="issues">{items.map((i, k) => <IssueItem key={k} i={i} />)}</ul> : cat !== 'keywords' && <p className="ok-line">No problems found.</p>}
              </section>
            );
          })}
          {ai && (ai.phrasing.length > 0 || ai.suggestions.length > 0) && (
            <section className="ats-group">
              <h3>AI suggestions<span className="cnt mid">{ai.phrasing.length + ai.suggestions.length}</span></h3>
              <ul className="issues">
                {ai.phrasing.map((p, k) => <li className="sev-info" key={'p' + k}><div>Reword <span className="fix">→ {p.fix}</span></div><q>{p.text}</q></li>)}
                {ai.suggestions.map((s, k) => <li className="sev-info" key={'s' + k}><div>{s}</div></li>)}
              </ul>
            </section>
          )}
          <p className="note">The score is an estimate. Real ATS products differ, but they all reward clear sections, matching keywords and accurate dates.</p>
        </>
      )}
    </>
  );
});
