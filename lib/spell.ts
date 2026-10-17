/* Dictionary spell check for the resume preview. Uses the US English Hunspell dictionary (/vendor/dict-en) with
   nspell (/vendor/nspell), both loaded only when "Check spelling" is pressed. Runs in the browser: no text is sent anywhere.
   check(root, allowWords) -> number of marked words; clear(root); onFix(fn) after a word is changed.
   Not flagged: words with digits, ALL-CAPS, camelCase, the allow list (skills, names, tech terms), and capitalised words
   in the middle of a sentence (usually names of people, companies or products).
   Page listeners are attached on first use (pages are pre-rendered on the server, where there is no document). */
import { loadTech } from './tech.ts';

/** The parts of nspell used here (loaded as a browser global from /vendor/nspell/nspell.min.js) */
interface NSpell { correct(word: string): boolean; suggest(word: string): string[]; add(word: string): NSpell }
declare global { interface Window { nspell?: (dict: { aff: string; dic: string }) => NSpell } }

let sp: NSpell | null = null, loading: Promise<NSpell> | null = null, pop: HTMLDivElement | null = null;
const ignored = new Set<string>(), fixFns: ((root: HTMLElement) => void)[] = [];
// Everyday resume words a general dictionary lacks. Technology names are NOT listed here: they come from the API's
// dictionary (base names plus the names learned daily, lib/tech.ts).
const EXTRA = ('fullstack microservice codebase codebases monorepo repo repos refactor refactored refactoring containerized containerised dockerized '
  + 'onboarding offboarding upskill upskilled upskilling mentees async webhook webhooks toolchain toolchains observability failover uptime hackathon hackathons '
  + 'chatbot chatbots dataset datasets workflow workflows ecommerce fintech healthtech edtech insurtech agentic mvp kpi kpis okr okrs roi '
  + 'scalability scalable performant reusability reusable modularized modularity tokenization tokenized vectorized embeddings inference finetuned finetuning '
  + 'sprint sprints restful cybersecurity pentest pentesting sla slas runbook runbooks playbook playbooks stakeholder cross-functional').split(' ');

function ensureLib(): Promise<void> {
  if (window.nspell) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/vendor/nspell/nspell.min.js'; s.onload = () => ok(); s.onerror = () => no(new Error('Could not load the spell checker.')); document.head.appendChild(s); });
}
async function fetchText(u: string): Promise<string> { const r = await fetch(u); if (!r.ok) throw new Error('Could not load the dictionary.'); return r.text(); }

export function load(): Promise<NSpell> {
  if (sp) return Promise.resolve(sp);
  if (loading) return loading;
  loading = (async () => {
    await ensureLib();
    const [aff, dic, tech] = await Promise.all([fetchText('/vendor/dict-en/en.aff'), fetchText('/vendor/dict-en/en.dic'), loadTech()]);
    const make = window.nspell; if (!make) throw new Error('Could not load the spell checker.');
    const s = make({ aff, dic });
    for (const t of EXTRA.concat(tech.names)) for (const w of String(t).split(/[^A-Za-z'’]+/)) if (w.length > 1) { s.add(w); s.add(w.toLowerCase()); }
    sp = s; return s;
  })().catch((e: unknown) => { loading = null; throw e; });
  return loading;
}
function unwrap(m: Element): Text { const t = document.createTextNode(m.textContent || ''); m.replaceWith(t); return t; }
export function clear(root: HTMLElement | null): void { if (!root) return; root.querySelectorAll('mark.sp').forEach(unwrap); root.normalize(); closePop(); }

// Is this word worth checking? (position in the text decides whether a capital letter means a name)
function worth(w: string, atStart: boolean, allow: Set<string>): boolean {
  if (w.length < 3 || /\d/.test(w) || ignored.has(w.toLowerCase()) || allow.has(w.toLowerCase())) return false;
  if (w === w.toUpperCase()) return false;                    // AWS, SQL
  if (/[a-z][A-Z]/.test(w)) return false;                     // TypeScript, PySpark
  if (/^[A-Z]/.test(w) && !atStart) return false;             // capital mid-sentence: a name
  return true;
}
export async function check(root: HTMLElement, allowList: string[] = []): Promise<number> {
  listen();
  const s = await load();
  clear(root);
  const allow = new Set<string>(); for (const x of allowList) for (const w of String(x).toLowerCase().split(/[^a-z']+/)) if (w) allow.add(w);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest('button,.chk,.ph,mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes: Text[] = []; let n: Node | null; while ((n = walker.nextNode())) if (n instanceof Text) nodes.push(n);
  let count = 0;
  for (const node of nodes) {
    const text = node.nodeValue || '', re = /[A-Za-z][A-Za-z'’]*[A-Za-z]/g, first = node.previousSibling == null;
    let m: RegExpExecArray | null, last = 0, frag: DocumentFragment | null = null;
    while ((m = re.exec(text))) {
      const w = m[0].replace(/['’]s$/i, ''), pre = text.slice(0, m.index);
      const atStart = (first && !pre.trim()) || /[.!?:•·–—-]\s*$/.test(pre); // first word of a line or sentence
      if (!worth(w, atStart, allow) || s.correct(w) || s.correct(w.toLowerCase())) continue;
      frag = frag || document.createDocumentFragment();
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mk = document.createElement('mark'); mk.className = 'sp'; mk.textContent = m[0]; mk.title = 'Possible spelling mistake: click for suggestions';
      frag.appendChild(mk); last = m.index + m[0].length; count++;
    }
    if (frag) { frag.appendChild(document.createTextNode(text.slice(last))); node.replaceWith(frag); }
  }
  return count;
}

/* suggestions popover */
function closePop(): void { if (pop) { pop.remove(); pop = null; } }
const keepCase = (from: string, to: string): string => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
function openPop(mk: HTMLElement): void {
  closePop();
  const word = mk.textContent || '', list = sp ? sp.suggest(word.replace(/['’]s$/i, '')).slice(0, 5) : [];
  const box = document.createElement('div'); box.className = 'sp-pop'; box.setAttribute('role', 'menu');
  const head = document.createElement('div'); head.className = 'sp-h'; head.textContent = list.length ? 'Did you mean' : 'No suggestions'; box.appendChild(head);
  for (const sug of list) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.fix = sug; b.textContent = sug; box.appendChild(b); }
  const row = document.createElement('div'); row.className = 'sp-row';
  for (const [v, label] of [['1', 'Ignore'], ['all', 'Ignore everywhere']]) { const b = document.createElement('button'); b.type = 'button'; b.dataset.ig = v; b.textContent = label; row.appendChild(b); }
  box.appendChild(row); document.body.appendChild(box); pop = box;
  const r = mk.getBoundingClientRect();
  box.style.top = (window.scrollY + r.bottom + 6) + 'px';
  box.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - box.offsetWidth - 8)) + 'px';
  box.addEventListener('mousedown', e => e.preventDefault()); // keep the resume's text selection
  box.addEventListener('click', e => {
    const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return;
    const root = (mk.closest('[contenteditable]') || mk.parentElement); if (!(root instanceof HTMLElement)) return;
    if (b.dataset.fix !== undefined) { const t = unwrap(mk); t.nodeValue = (t.nodeValue || '').replace(word.replace(/['’]s$/i, ''), keepCase(word, b.dataset.fix)); }
    else if (b.dataset.ig === 'all') { const lw = word.toLowerCase(); ignored.add(lw.replace(/['’]s$/, '')); root.querySelectorAll('mark.sp').forEach(x => { if ((x.textContent || '').toLowerCase() === lw) unwrap(x); }); }
    else unwrap(mk);
    root.normalize(); closePop(); for (const f of fixFns) { try { f(root); } catch { /* a listener failing must not break the others */ } }
  });
}
let listening = false;
export function listen(): void {
  if (listening || typeof document === 'undefined') return; listening = true;
  document.addEventListener('click', e => {
    const mk = e.target instanceof Element ? e.target.closest('mark.sp') : null; if (mk instanceof HTMLElement) { openPop(mk); return; }
    if (pop && !(e.target instanceof Node && pop.contains(e.target))) closePop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', closePop);
}
export function onFix(f: (root: HTMLElement) => void): void { fixFns.push(f); }
