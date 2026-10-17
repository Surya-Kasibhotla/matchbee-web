/* Resume Builder logic with no UI: the form's shape, the resume preview (HTML string, so it can be edited in place),
   the phone intro, the request sent to /api/generate, and saved-profile helpers. */
import { DOMAINS, TEMPL, type Jd } from './jd';

export type Client = { name: string; role: string; from: string; to: string; domain: string; notes: string };
export type Form = { jd: string; name: string; role: string; phone: string; email: string; loc: string; edu: string; years: string; count: string; clients: Client[]; have: Record<string, boolean>; other: string };
export type Bullet = { text: string; source: string; flags?: string[] };
export type Ai = {
  draft?: boolean; summary?: string; skills?: string[]; skill_groups?: { name: string; items: string[] }[];
  experience?: { client: string; bullets: Bullet[] }[]; intro?: string; gap_notes?: string[];
  questions_to_ask?: string[]; screening_qa?: { q: string; a: string }[]; warnings?: string[];
};
export type Profile = { id?: string; label: string; first: string; last: string; phone: string; email: string; role: string; clients: { name: string; from: string; to: string; tech: string[] }[]; updated?: number };

export const blankClient = (): Client => ({ name: '', role: '', from: '', to: '', domain: 'other', notes: '' });
export const emptyForm = (): Form => ({ jd: '', name: '', role: '', phone: '', email: '', loc: '', edu: '', years: '', count: '', clients: [], have: {}, other: '' });

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const ph = (v: string, p: string) => (v && v.trim() ? esc(v.trim()) : '<span class="ph">' + esc(p) + '</span>');
export const listJoin = (a: string[]) => (a.length < 2 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
export const splitName = (n: string) => { n = (n || '').trim(); const i = n.indexOf(' '); return i < 0 ? { first: n, last: '' } : { first: n.slice(0, i), last: n.slice(i + 1).trim() }; };
export const yearOf = (v: string) => { const m = String(v || '').match(/(?:19|20)\d{2}/); return m ? m[0] : ''; };

/** Skills that go on the resume: ticked job skills plus "other skills" */
export function haveSkills(f: Form, J: Jd) {
  const s = J.skills.filter(k => f.have[k]);
  (f.other || '').split(',').forEach(x => { x = x.trim(); if (x && !s.includes(x)) s.push(x); });
  return s;
}
const titleOf = (f: Form) => (f.role || '').trim() || 'Software Engineer';
const yearsTxt = (f: Form) => { const y = parseInt(f.years, 10); return y ? String(y) : '[X]'; };
const range = (c: Client) => (c.from || c.to ? esc(c.from || '') + ' – ' + esc(c.to || 'Present') : '<span class="ph">YYYY – YYYY</span>');

function bulletsFor(c: Client, skills: string[]) {
  const out: { t: string; s: boolean; f?: string[] }[] = [];
  (c.notes || '').split('\n').forEach(l => { l = l.replace(/^[-•*\s]+/, '').trim(); if (l) out.push({ t: l, s: false }); });
  if (out.length) return out;
  (TEMPL[c.domain] || TEMPL.other).forEach(x => out.push({ t: x, s: true }));
  if (skills.length) out.splice(1, 0, { t: 'Used ' + listJoin(skills.slice(0, 4)) + ' to build, test and maintain production features.', s: true });
  return out;
}

/** The resume preview as HTML (inner content of .paper). Highlighted .sug lines are suggestions with a remove (✕) button. */
export function resumeHTML(f: Form, J: Jd, ai: Ai | null) {
  const skills = haveSkills(f, J), cl = f.clients;
  const doms: string[] = []; cl.forEach(c => { const d = DOMAINS[c.domain]; if (c.domain !== 'other' && d && !doms.includes(d)) doms.push(d.split(' / ')[0].toLowerCase()); });
  let sum = titleOf(f) + ' with ' + yearsTxt(f) + '+ years of experience' + (doms.length ? ' delivering applications across ' + listJoin(doms) : ' delivering enterprise applications') +
    (skills.length ? '. Hands-on with ' + listJoin(skills.slice(0, 6)) + '.' : '. [Add your key skills in section 4.]');
  const dr = !!(ai && ai.draft);
  const list = dr && !cl.length && ai!.experience ? ai!.experience.map(e => ({ ...blankClient(), name: e.client })) : cl;
  if (ai && ai.summary) sum = ai.summary;
  const shown = ai && ai.skills && ai.skills.length ? ai.skills : skills;
  let h = '<h1>' + ph(f.name, 'Your Name') + '</h1>' +
    '<div class="contact">' + ph(f.phone, '(555) 123-4567') + ' · ' + ph(f.email, 'you@email.com') + ' · ' + ph(f.loc, 'City, ST') + '</div>' +
    '<h2>Summary</h2><div' + (dr ? ' class="dr"' : '') + '>' + esc(sum) + '</div><h2>Skills</h2>' +
    (dr && ai!.skill_groups && ai!.skill_groups.length
      ? ai!.skill_groups.map(g => '<div class="dr"><strong>' + esc(g.name) + ':</strong> ' + esc(g.items.join(', ')) + '</div>').join('')
      : '<div>' + (shown.length ? esc(shown.join(' · ')) : '<span class="ph">Tap your skills in section 4</span>') + '</div>') +
    '<h2>Experience</h2>';
  if (!list.length) h += '<div class="ph">Set the number of clients in section 3 to add experience blocks.</div>';
  list.forEach((c, ci) => {
    const bl = ai && ai.experience && ai.experience[ci] ? ai.experience[ci].bullets.map(b => ({ t: b.text, s: b.source !== 'user', f: b.flags || [] })) : bulletsFor(c, skills);
    h += '<div class="job"><span>' + ph(c.name, 'Client Name') + '</span><span>' + range(c) + '</span></div><p class="role">' + ph(c.role || (f.role || '').trim(), 'Job Title') + '</p><ul>' +
      bl.map(b => b.s
        ? '<li class="sug"' + (b.f && b.f.length ? ' title="' + esc('Check: ' + b.f.join('; ')) + '"' : '') + '>' + esc(b.t) + (b.f && b.f.length ? ' <span class="chk">check</span>' : '') + ' <button class="x" type="button" title="Remove" aria-label="Remove suggestion">✕</button></li>'
        : '<li>' + esc(b.t) + '</li>').join('') + '</ul>';
  });
  return h + '<h2>Education</h2><div>' + ph(f.edu, 'Degree, University, Year') + '</div>';
}

/** Phone intro: the AI's version when there is one, otherwise a basic script from the form */
export function introParts(f: Form, J: Jd, ai: Ai | null) {
  if (ai && ai.intro) return { opener: ai.intro, questions: ai.questions_to_ask || [], qa: ai.screening_qa || [], ai: true };
  const fa = J.facts || {}, skills = haveSkills(f, J), names = f.clients.filter(c => c.name.trim()).map(c => c.name.trim());
  const gaps = J.skills.filter(k => !f.have[k]).slice(0, 3), title = fa.title || J.title, loc = fa.location || J.loc, t = titleOf(f);
  let s = 'Hi, this is ' + ((f.name || '').trim() || '[Your Name]') + '. ' + "I'm calling about the " + (title || '[role]') + ' role' + (loc ? ' (' + loc + ')' : '') + '. ' +
    "I'm " + (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t.toLowerCase() + ' with ' + yearsTxt(f) + '+ years of experience' + (names.length ? ', working with ' + listJoin(names) : '') +
    ', building ' + (skills.length ? 'applications with ' + listJoin(skills.slice(0, 5)) : '[your key skills]') + '.';
  if (/\b(ai|ml|machine learning|deep learning|llms?|gen(erative)? ?ai|nlp|data scien\w*)\b/i.test(f.jd || '')) s += ' [Add your real AI/ML work here in one sentence, or delete this.]';
  if (gaps.length) s += " I'd like to understand how heavily the role leans on " + listJoin(gaps) + '.';
  s += ' Could you tell me about the team and what the first few months would look like?';
  return { opener: s, questions: ['Is the role onsite, hybrid or remote, and is it W2 or C2C?', 'What does the day-to-day work look like?', 'What is the interview process and timeline?'], qa: [] as { q: string; a: string }[], ai: false };
}
export function introText(p: ReturnType<typeof introParts>) {
  let t = '"' + p.opener + '"';
  if (p.questions.length) t += '\n\nQuestions to ask the recruiter:\n' + p.questions.map((q, i) => i + 1 + '. ' + q).join('\n');
  if (p.qa.length) t += '\n\nIf they ask you:\n' + p.qa.map(x => 'Q: ' + x.q + '\nA: ' + x.a).join('\n\n');
  return t;
}

/** Body of POST /api/generate */
export const payload = (f: Form, J: Jd, jobId: string) => ({
  jd: f.jd, job_id: jobId || undefined,
  profile: { name: f.name, role: f.role, years: f.years, skills_have: J.skills.filter(k => f.have[k]), other_skills: f.other,
    clients: f.clients.map(c => ({ name: c.name, role: c.role, from: c.from, to: c.to, industry: DOMAINS[c.domain] || '', notes: c.notes })) },
});

/** The form as a saved profile (technologies kept from the profile it came from) */
export function formProfile(f: Form, old: Profile | null, label?: string): Profile {
  const n = splitName(f.name), techBy: Record<string, string[]> = {};
  if (old) (old.clients || []).forEach(c => { techBy[(c.name || '').toLowerCase()] = c.tech || []; });
  return { label: label || (old && old.label) || (f.role || '').trim() || 'My profile', first: n.first, last: n.last, phone: f.phone, email: f.email, role: f.role,
    clients: f.clients.filter(c => c.name.trim()).map(c => ({ name: c.name, from: c.from, to: c.to, tech: techBy[c.name.trim().toLowerCase()] || [] })) };
}
/** Comparable view of the details a profile holds (to know whether anything changed) */
export const proj = (o: Partial<Profile>) => JSON.stringify([(o.first || '').trim(), (o.last || '').trim(), (o.phone || '').trim(), (o.email || '').trim(), (o.role || '').trim(),
  (o.clients || []).filter(c => (c.name || '').trim()).map(c => [(c.name || '').trim(), (c.from || '').trim(), (c.to || '').trim()])]);
export const hasDetails = (p: Profile) => !!(p.first || p.last || p.phone || p.email || p.role || (p.clients || []).length);

/** Job from a job alert, as a job description */
export function jdFromJob(j: { title?: string; company?: string; city?: string; state?: string; remote?: boolean; desc?: string; email?: string }) {
  const place = [j.city, j.state].filter(Boolean).join(', ') + (j.remote ? (j.city || j.state ? ' (Remote)' : 'Remote') : '');
  return [j.title, j.company, place].filter(Boolean).join('\n') + '\n\n' + (j.desc || '') + (j.email ? '\n\nContact: ' + j.email : '');
}
