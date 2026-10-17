/* Job description reading for the Resume Builder: instant skill extraction from the text (the AI list replaces it
   about a second later), job facts (title, location, years, engagement, work mode), industries and template bullets. */

export type JdFacts = { title?: string; company?: string; location?: string; work_mode?: string; engagement?: string; experience?: string; rate?: string; contact?: string; visa_note?: string };
export type Jd = { skills: string[]; title: string; exp: string; loc: string; email: string; eng: string[]; mode: string[]; visa: string; facts?: JdFacts };

/* Skills are read from the pasted text itself. No skill names are hard-coded: the AI extracts them, and this
   structural extractor (capitalisation, acronyms, symbols, context words) shows instant results while the AI works. */
const STOP = new Set(('the and for with you your our are will this that from have has not but all any can may use using must should work working team teams role job company client years year experience strong knowledge understanding ability skills required preferred plus including include senior junior lead remote hybrid onsite contract full time part location position title rate hiring urgent requirement requirements responsibilities responsibility description minimum maximum good great excellent solid proven hands based high large scale enterprise business product products solution solutions support build design develop implement create manage maintain provide ensure across within such other new etc also well both each more most least one two three degree bachelor master computer science engineering related field please send share resume email contact visa citizen citizens only direct opportunity group center excellence organization function functions standards policies guidelines processes process specific core objective objectives project projects collect gather compliance regulatory risk role seeking looking candidate candidates ideal join help drive deliver lead leading level levels using used use able need needs needed day days month months week weeks hour hours automate monitor improve collaborate enable document review optimize troubleshoot participate partner analyze write conduct drive own act assist coordinate bachelor bachelors masters phd degree').split(' ').concat(['bachelor’s', 'master’s', "bachelor's", "master's"]));
const NOT_SKILL = /^(IT|C2C|W2|1099|GC|USC|EAD|OPT|CPT|TN|H1B|H4|ASAP|USA|US|EST|CST|PST|MST|NYC|AM|PM|II|III|IV|PHD|MBA|VP|CEO|CTO|HR|NA|OK|ID)$/i;
const LABEL = /^\W*(location|client|rate|role|position|title|job title|hiring|contact|email|visa|duration|type|work mode|engagement|company|salary|pay)\s*[:\-–]/i;
const shape = (w: string): boolean => /^[A-Z][A-Z0-9]{1,7}$/.test(w) || /[a-z][A-Z]/.test(w) || (/[.+#]/.test(w) && w.length > 2 && /[A-Za-z]{2}/.test(w));

export function heuristicSkills(source: string): string[] {
  const text = String(source).replace(/&amp;|\bamp;/g, '&');
  const out: string[] = [], seen = new Set<string>();
  const add = (raw: string) => { const t = raw.replace(/^[\W_]+|[.,;:)\]]+$/g, '').trim(), k = t.toLowerCase(); if (t.length < 2 || t.length > 30 || seen.has(k) || STOP.has(k) || NOT_SKILL.test(t)) return; seen.add(k); out.push(t); };
  for (const line of text.split('\n')) {
    if (LABEL.test(line) || /@/.test(line)) continue;
    // 1. words that look like technology names by their shape: AWS, PySpark, Node.js, C++, CI/CD
    const re = /[A-Za-z][A-Za-z0-9]*(?:[.+#\/][A-Za-z0-9]+)*(?:\+\+|#|\+)?/g; let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const w = m[0], parts = w.split('/');
      if (parts.length > 1 && !parts.every(x => /^[A-Z]{2,3}$/.test(x))) { parts.forEach(x => { if (shape(x) || /^[A-Z][a-z]{2,}$/.test(x)) add(x); }); continue; }
      if (shape(w)) add(w);
    }
    // 2. named after "e.g.", "such as", "including", "like"
    const ex = /(?:e\.g\.|such as|including|like)\s+([A-Z][\w.+#]*(?:\s+[A-Z][\w.+#]*)?)/g; let q: RegExpExecArray | null;
    while ((q = ex.exec(line))) add(q[1]);
    // 3. enumerations like "Machine learning, Deep Learning and Data science"
    const items = line.split(/\s*(?:,|;|•|\band\b|\bor\b|&)\s*/);
    if (items.length >= 3) for (const raw of items) {
      const it = raw.replace(/^[\s•*\-–·\d.)(]+/, '').replace(/^(such as|e\.g\.|including|like|with|using|in|of)\s+/i, '');
      const w = it.split(/\s+/).filter(Boolean);
      if (w.length >= 1 && w.length <= 3 && /^[A-Z]/.test(w[0]) && !STOP.has(w[0].toLowerCase()) && !/[.:!?]$/.test(it) && w.every(x => !STOP.has(x.toLowerCase()) || /^(of|and)$/i.test(x))) add(it);
    }
  }
  return out.slice(0, 30);
}

export const DOMAINS: Record<string, string> = { banking: 'Banking / Finance', healthcare: 'Healthcare', insurance: 'Insurance', retail: 'Retail / E-commerce', telecom: 'Telecom', tech: 'Technology', other: 'Other' };
export const TEMPL: Record<string, string[]> = {
  banking: ['Built secure, audit-ready features for customer-facing banking applications in a regulated environment.', 'Integrated user interfaces with services for accounts, transactions and alerts.', 'Worked with product, security and QA teams to deliver releases on schedule.'],
  healthcare: ['Built member, provider or claims-facing features that handle sensitive data in line with HIPAA requirements.', 'Integrated applications with backend services and APIs for eligibility, claims and care data.', 'Worked with product, compliance and QA teams to deliver reliable releases.'],
  insurance: ['Delivered policy, quote or claims workflow features for enterprise insurance platforms.', 'Integrated applications with backend services and third-party APIs.', 'Partnered with product and QA teams to ship reliable releases.'],
  retail: ['Delivered customer-facing shopping and checkout features on high-traffic platforms.', 'Integrated applications with catalog, order and payment services.', 'Worked with product and QA teams to ship reliable releases.'],
  telecom: ['Delivered account, billing and usage features for large-scale telecom platforms.', 'Integrated applications with backend services and APIs.', 'Worked with cross-functional teams to ship reliable releases.'],
  tech: ['Delivered production features for scalable software products.', 'Integrated applications with backend services and APIs.', 'Worked with product and QA teams to ship reliable releases.'],
  other: ['Delivered production features for enterprise applications.', 'Integrated applications with backend services and APIs.', 'Worked with cross-functional teams to ship reliable releases.'],
};

const clean = (s: string): string => String(s || '').replace(/[^\w\s\/&\-–\.,\(\)\+|:#@]/g, ' ').replace(/\s+/g, ' ').trim();
export function analyzeJd(t: string): Jd {
  const skills = heuristicSkills(t);
  let title = '';
  const m = t.match(/(?:job\s*title|role\s*name|position\s*(?:title|name)?|job\s*role|title|role)\s*[:\-–—]+\s*([^\n]+)/i);
  if (m) title = clean(m[1]);
  else for (const line of t.split('\n')) { const l = clean(line); if (l.length > 6 && l.indexOf('@') < 0) { title = l; break; } }
  title = title.replace(/#/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(we.?re|we are|am|now)?\s*hiring\s*[:|\-–]*\s*/i, '').split(' | ')[0].replace(/\s*[-–]\s*direct client$/i, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const exp = (t.match(/(\d+\s*\+?\s*(?:-|–|to)?\s*\d*\+?\s*(?:years|yrs))/i) || [])[1] || '';
  const loc = clean((t.match(/(?:location|📍)\s*[:\-–]?\s*([^\n]{3,60})/i) || [])[1] || '');
  const email = ((t.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0]).replace(/\.$/, '');
  const eng: string[] = []; if (/c2c|corp.to.corp/i.test(t)) eng.push('C2C'); if (/\bw2\b/i.test(t)) eng.push('W2'); if (/full.?time|fte/i.test(t)) eng.push('Full-time'); if (/contract/i.test(t)) eng.push('Contract');
  const mode: string[] = []; if (/\bremote\b/i.test(t)) mode.push('Remote'); if (/\bhybrid\b/i.test(t)) mode.push('Hybrid'); if (/on-?site/i.test(t)) mode.push('Onsite');
  const visa = (t.match(/((?:h1b|h-1b|usc|us citizens?|green card|\bgc\b)[^\n]{0,50})/i) || [])[1] || '';
  return { skills, title, exp, loc, email, eng, mode, visa: clean(visa) };
}
