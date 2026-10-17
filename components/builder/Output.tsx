'use client';
/* Builder output: tabs for the resume (editable in place), phone intro, gap report and ATS check. */
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { errMsg } from '@/lib/api';
import type { Jd } from '@/lib/builder/jd';
import { introParts, introText, resumeHTML, type Ai, type Form } from '@/lib/builder/resume';
import { AtsPanel, type AtsHandle } from '@/components/ats/AtsPanel';

export type Tab = 'resume' | 'intro' | 'gaps' | 'ats';
const TABS: [Tab, string][] = [['resume', 'Resume'], ['intro', 'Phone intro'], ['gaps', 'Gap report'], ['ats', 'ATS check']];

/** The paper's HTML without spelling marks (what gets saved as your edits) */
function cleanHTML(p: HTMLElement) {
  const c = p.cloneNode(true) as HTMLElement;
  c.querySelectorAll('mark.sp').forEach(m => m.replaceWith(document.createTextNode(m.textContent || '')));
  return c.innerHTML;
}
function copyText(txt: string, btn: HTMLButtonElement) {
  const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1200); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
}
/** [bracketed] parts are things only the user knows: highlighted */
const Marked = ({ t }: { t: string }) => <>{t.split(/(\[[^\]]*\])/g).map((x, i) => (x.startsWith('[') ? <mark key={i}>{x}</mark> : x))}</>;

type Props = {
  form: Form; J: Jd; ai: Ai | null; gen: boolean; busy: boolean; note: string; stale: boolean; edited: string | null; tab: Tab;
  setTab: (t: Tab) => void; setEdited: (h: string | null) => void; onRefresh: () => void; spellAllow: () => string[];
};

export const Output = forwardRef<AtsHandle, Props>(function Output(props, atsRef) {
  const { form, J, ai, gen, note, stale, edited, tab, setTab, setEdited, onRefresh, spellAllow } = props;
  const paper = useRef<HTMLDivElement>(null);
  const [spellMsg, setSpellMsg] = useState(''), [spelling, setSpelling] = useState(false), [reviewed, setReviewed] = useState(false);
  const html = resumeHTML(form, J, ai), shown = edited ?? html;
  useEffect(() => { setReviewed(false); setSpellMsg(''); }, [ai]);

  // put the resume into the editable paper, unless what is there already matches (keeps the caret and spelling marks)
  useLayoutEffect(() => {
    const p = paper.current; if (!p) return;
    if (cleanHTML(p) !== shown) p.innerHTML = shown;
  }, [shown, tab, gen]);

  const save = () => { const p = paper.current; if (p) setEdited(cleanHTML(p)); };
  async function spell() {
    const p = paper.current; if (!p) return; setSpelling(true); setSpellMsg('Checking spelling…');
    try {
      const S = await import('@/lib/spell');
      S.onFix(root => { if (root === paper.current) { save(); const left = root.querySelectorAll('mark.sp').length; setSpellMsg(left ? left + ' left to check.' : 'All marked words checked.'); } });
      const n = await S.check(p, spellAllow());
      setSpellMsg(n ? n + ' possible spelling mistake' + (n === 1 ? '' : 's') + ' marked. Click a marked word for suggestions.' : 'No spelling mistakes found.');
    } catch (e: unknown) { setSpellMsg(errMsg(e, 'The spell checker could not load.')); }
    setSpelling(false);
  }
  async function out(kind: 'print' | 'copy' | 'doc', btn: HTMLButtonElement) {
    const p = paper.current; if (!p) return;
    if (ai && ai.draft && !reviewed && p.querySelector('.sug,.dr') && !confirm('This draft still has highlighted lines you have not reviewed. Continue anyway?')) return;
    (await import('@/lib/spell')).clear(p); // marks never reach the printout or download
    if (kind === 'print') window.print();
    if (kind === 'copy') copyText(p.innerText.replace(/✕/g, ''), btn);
    if (kind === 'doc') {
      const doc = '<html><head><meta charset="utf-8"><title>Resume</title></head><body><div class="paper">' + p.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '') + '</div></body></html>';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'application/msword' })); a.download = 'resume.doc'; document.body.appendChild(a); a.click(); a.remove();
    }
  }
  function paperClick(e: React.MouseEvent) {
    const b = (e.target as HTMLElement).closest('button.x'); if (!b) return;
    b.closest('li')?.remove(); save();
  }
  function keepDraft() {
    const p = paper.current; if (!p) return;
    p.querySelectorAll('.sug,.dr').forEach(x => x.classList.remove('sug', 'dr')); p.querySelectorAll('.x').forEach(x => x.remove());
    setReviewed(true); save();
  }

  const banners = (
    <>
      {note && <p className="banner">{note}</p>}
      {ai && ai.warnings && ai.warnings.length > 0 && <div className="banner warn"><strong>Please review:</strong><ul>{ai.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      {ai && ai.draft && !reviewed && (
        <div className="banner warn"><strong>Draft from the job description.</strong> Highlighted skills and lines are suggestions, not facts about you. Delete (✕) or edit anything you cannot back up, and fill in the [brackets].
          <div className="actions" style={{ margin: '8px 0 0' }}><button type="button" onClick={keepDraft}>I have reviewed it, keep what is left</button></div></div>
      )}
      {ai && stale && <p className="banner" id="stale">You changed your details, so this may be out of date. <button type="button" onClick={onRefresh}>Update now</button></p>}
    </>
  );
  const ip = introParts(form, J, ai);
  const have = J.skills.filter(k => form.have[k]), gaps = J.skills.filter(k => !form.have[k]);

  return (
    <section className="outwrap" id="out">
      <div className="card">
        <div className="tabs" id="outtabs" role="tablist">
          {TABS.map(([t, label]) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'act' : ''} onClick={() => setTab(t)}>{label}</button>)}
        </div>
        <div id="view">
          {tab === 'resume' && (!gen ? <p className="empty">Fill in what you like (everything is optional) and tap Generate.<br />Or press <b>Try sample data</b> above to see an example.</p> : (
            <>
              {banners}
              <div className="actions">
                <button type="button" className="pri" onClick={e => out('print', e.currentTarget)}>Print / Save PDF</button>
                <button type="button" onClick={e => out('copy', e.currentTarget)}>Copy text</button>
                <button type="button" onClick={e => out('doc', e.currentTarget)}>Download .doc</button>
                <button type="button" disabled={spelling} onClick={spell}>Check spelling</button>
              </div>
              {spellMsg && <p className="note" id="spellmsg" role="status">{spellMsg}</p>}
              <p className="legend"><span className="edit-pill">✎ Click any text to edit</span> Highlighted lines are suggestions: edit or remove (✕) anything that is not true for you. Your edits are kept when you switch tabs.</p>
              {edited != null && <p className="banner" id="editbar">You edited this resume by hand, so changes in the form above do not show here. <button type="button" onClick={() => setEdited(null)}>Discard my edits</button></p>}
              <div className="paper" id="paper" ref={paper} contentEditable suppressContentEditableWarning spellCheck onInput={save} onClick={paperClick} />
            </>
          ))}
          {tab === 'intro' && (
            <>
              {banners}
              <div className="actions"><button type="button" onClick={e => copyText(introText(ip), e.currentTarget)}>Copy all</button></div>
              <h3 className="sec">Opening script</h3><div className="script">&ldquo;<Marked t={ip.opener} />&rdquo;</div>
              {ip.points.length > 0 && <><h3 className="sec">About your current project</h3><ol className="ql">{ip.points.map((x, i) => <li key={i}><Marked t={x} /></li>)}</ol>
                <p className="note">Fill in the [brackets] with your real details. Lines starting [Only if true] name a tool you did not list: say them only if you have used it.</p></>}
              {ip.questions.length > 0 && <><h3 className="sec">Questions to ask the recruiter</h3><ol className="ql">{ip.questions.map((q, i) => <li key={i}>{q}</li>)}</ol></>}
              {ip.qa.length > 0 && <><h3 className="sec">If they ask you</h3>{ip.qa.map((x, i) => <div className="qa" key={i}><strong>{x.q}</strong><div><Marked t={x.a} /></div></div>)}</>}
              {!ip.ai && <p className="note">This is the basic version. Press Generate to have the AI write a script and questions from your pasted text.</p>}
            </>
          )}
          {tab === 'gaps' && (
            <>
              {banners}
              {!J.skills.length ? <p className="empty">Paste a JD to see which required skills you have and which you are missing.</p> : (
                <>
                  <p><strong>Match: {have.length} of {J.skills.length} JD skills ({Math.round(100 * have.length / J.skills.length)}%)</strong></p>
                  <p><strong>You have:</strong> {have.length ? have.join(', ') : 'none ticked yet'}</p>
                  <p className="gap"><strong>Not on your resume:</strong> {gaps.length ? gaps.join(', ') : 'none'}</p>
                  {ai && ai.gap_notes && ai.gap_notes.length > 0 && <p><strong>Requirements to ask about:</strong> {ai.gap_notes.join(', ')}</p>}
                  <p className="note">Only add a missing skill if you have really used it. Otherwise ask the recruiter how much the role depends on it.</p>
                </>
              )}
            </>
          )}
          <div hidden={tab !== 'ats'}>
            <AtsPanel ref={atsRef} jd={form.jd} skills={J.skills}
              jdNote={(has, n) => has ? 'Keywords are matched against your job description in step 1 (' + n + ' skills).' : 'Tip: paste a job description in step 1 to also get a keyword match score.'} />
          </div>
        </div>
      </div>
    </section>
  );
});
