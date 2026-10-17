/* ATS engine: reads an uploaded resume (PDF, DOCX, TXT) in the browser and scores it. Runs entirely in the browser.
   Moved from the old public/ats.js; logic unchanged. The results panel is components/ats/AtsPanel.tsx.
   Exports: readFile(file) -> Promise<text>, analyze(text, { jdSkills, extraSpelling, today, tech }), jdKeywords(jd, tech).
   tech is the dictionary from the API (lib/tech.ts); without it the technology checks are skipped. */
import type { TechData, TimelineRow } from '../tech.ts';

export type Severity = 'error' | 'warn' | 'info';
export type Category = 'spelling' | 'dates' | 'tech' | 'keywords' | 'impact' | 'format';
export type Issue = { cat: Category; sev: Severity; msg: string; line: string; fix: string };
export type Part = { key: string; label: string; max: number; got: number };
export type Result = {
  score: number; rating: 'Excellent' | 'Good' | 'Fair' | 'Needs work'; parts: Part[]; issues: Issue[];
  keywords: { matched: string[]; missing: string[]; pct: number } | null;
  stats: { words: number; bullets: number; quantified: number; roles: number };
};
export type AiReview = { spelling: { word: string; fix: string }[]; phrasing: { text: string; fix: string }[]; suggestions: string[] };
export type Tech = { name: string; year: number; re: RegExp; hint: string };
export type AnalyzeOptions = { jdSkills?: string[]; extraSpelling?: { word: string; fix: string }[]; today?: Date; tech?: TechData };

type Ym = { y: number; m: number };
type When = Ym & { exact: boolean; present?: boolean };
type Role = { start: When; end: When; line: number; raw: string; text: string; sec: string; block: string };
type HeadKey = 'summary' | 'experience' | 'education' | 'skills' | 'certs' | 'projects';

/* ---------- File reading ---------- */
const MAX_BYTES = 5 * 1024 * 1024;
function readFile(file: File | null | undefined): Promise<string> {
  if(!file)return Promise.reject(new Error('No file selected.'));
  if(file.size>MAX_BYTES)return Promise.reject(new Error('That file is over 5 MB. Please upload a smaller PDF or DOCX.'));
  const n=(file.name||'').toLowerCase();
  if(/\.txt$/.test(n)||file.type==='text/plain')return file.text();
  if(/\.docx$/.test(n))return file.arrayBuffer().then(readDocx);
  if(/\.pdf$/.test(n)||file.type==='application/pdf')return file.arrayBuffer().then(readPdf);
  if(/\.doc$/.test(n))return Promise.reject(new Error('Old .doc files cannot be read. Save it as .docx or PDF and upload again.'));
  return Promise.reject(new Error('Please upload a PDF, DOCX or TXT file.'));
}

// Minimal ZIP reader: finds one entry and inflates it with the browser's DecompressionStream.
function unzipEntry(buf: ArrayBuffer, name: string): Promise<string> {
  const v=new DataView(buf); let eocd=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){if(v.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)return Promise.reject(new Error('This DOCX file looks damaged.'));
  const count=v.getUint16(eocd+10,true), dec=new TextDecoder(); let p=v.getUint32(eocd+16,true);
  for(let k=0;k<count;k++){
    if(v.getUint32(p,true)!==0x02014b50)break;
    const method=v.getUint16(p+10,true), csize=v.getUint32(p+20,true), nlen=v.getUint16(p+28,true), xlen=v.getUint16(p+30,true), clen=v.getUint16(p+32,true), off=v.getUint32(p+42,true);
    const fname=dec.decode(new Uint8Array(buf,p+46,nlen));
    if(fname===name){
      const start=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true), data=new Uint8Array(buf,start,csize);
      if(method===0)return Promise.resolve(dec.decode(data));
      if(method!==8||typeof DecompressionStream==='undefined')return Promise.reject(new Error('This browser cannot open DOCX files. Upload a PDF instead.'));
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    p+=46+nlen+xlen+clen;
  }
  return Promise.reject(new Error('This does not look like a Word document.'));
}
function readDocx(buf: ArrayBuffer): Promise<string> {
  return unzipEntry(buf,'word/document.xml').then(xml => {
    const doc=new DOMParser().parseFromString(xml,'application/xml'), out: string[]=[];
    const paras=doc.getElementsByTagNameNS('*','p');
    for(let i=0;i<paras.length;i++){
      const p=paras[i], list=p.getElementsByTagNameNS('*','numPr').length>0; let line='';
      const walk=(n: Element): void => {
        for(let c=n.firstElementChild;c;c=c.nextElementSibling){
          const ln=c.localName;
          if(ln==='t')line+=c.textContent;
          else if(ln==='tab')line+='\t';
          else if(ln==='br'||ln==='cr')line+='\n';
          else if(ln!=='p'&&ln!=='pPr'&&ln!=='rPr'&&ln!=='instrText')walk(c);
        }
      };
      walk(p);
      out.push((list&&line.trim()?'• ':'')+line);
    }
    return out.join('\n');
  });
}

// The parts of pdf.js used here (loaded at run time from /vendor/pdfjs, so there are no bundled types)
type PdfTextItem = { str?: string; transform: number[]; width?: number; hasEOL?: boolean };
type PdfPage = { getTextContent(): Promise<{ items: PdfTextItem[] }> };
type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage> };
type PdfLib = { GlobalWorkerOptions: { workerSrc: string }; getDocument(src: { data: Uint8Array; isEvalSupported: boolean }): { promise: Promise<PdfDoc> } };
let pdfLib: Promise<PdfLib> | null = null;
function loadPdfLib(): Promise<PdfLib> {
  const url='/vendor/pdfjs/pdf.min.mjs'; // a variable, so neither the bundler nor tsc tries to resolve it
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url).then((m: PdfLib) => { m.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.mjs'; return m; });
}
function readPdf(buf: ArrayBuffer): Promise<string> {
  pdfLib=pdfLib||loadPdfLib();
  return pdfLib.then(lib => lib.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise).then(doc => {
    const pages: Promise<{ items: PdfTextItem[] }>[]=[];
    for(let i=1;i<=doc.numPages;i++)pages.push(doc.getPage(i).then(pg => pg.getTextContent()));
    return Promise.all(pages).then(all => all.map(tc => {
      let s='', lastY: number | null=null, lastEnd: number | null=null;
      tc.items.forEach(it => {
        if(typeof it.str!=='string')return;
        const x=it.transform[4], y=it.transform[5];
        if(lastY!==null&&Math.abs(y-lastY)>2){s+='\n';lastEnd=null}
        else if(lastEnd!==null&&x-lastEnd>1&&!/\s$/.test(s)&&!/^\s/.test(it.str))s+=' ';
        s+=it.str; lastY=y; lastEnd=x+(it.width||0);
        if(it.hasEOL){s+='\n';lastY=null;lastEnd=null}
      });
      return s;
    }).join('\n'));
  });
}

/* ---------- Reference data ---------- */
// Technology first-release years from the API dictionary, compiled once per list (earliest public release; conservative so real resumes are not flagged wrongly)
let compiledFrom: TimelineRow[] | null = null, compiled: Tech[] = [];
function techOf(timeline: TimelineRow[]): Tech[] {
  if (timeline !== compiledFrom) {
    compiled = [];
    for (const t of timeline) { try { compiled.push({name:t[0],year:t[1],re:new RegExp('(?<![A-Za-z0-9_])(?:'+t[2]+')(?![A-Za-z0-9_])',t[3]?'g':'gi'),hint:t[4]||''}); } catch { /* a bad pattern skips that one row */ } }
    compiledFrom = timeline;
  }
  return compiled;
}

// Common resume misspellings -> correction
const MISSPELL: Record<string, string>={};
('accomodate:accommodate acheive:achieve acheived:achieved acheivement:achievement acheivements:achievements accross:across adress:address agressive:aggressive '+
 'aquire:acquire aquired:acquired arguement:argument assesment:assessment availible:available begining:beginning beleive:believe benifit:benefit buisness:business calender:calendar '+
 'catagory:category cheif:chief collegue:colleague collegues:colleagues comming:coming commited:committed commitee:committee competant:competent completly:completely concious:conscious '+
 'definately:definitely definitly:definitely dependancy:dependency dependancies:dependencies desicion:decision develope:develop developement:development developped:developed '+
 'devloped:developed devlopment:development enviroment:environment enviroments:environments equiptment:equipment excellant:excellent existance:existence experiance:experience '+
 'experienc:experience expierence:experience familar:familiar finaly:finally foward:forward fullfil:fulfill goverment:government gaurantee:guarantee guidence:guidance happend:happened '+
 'immediatly:immediately implemantation:implementation implmentation:implementation implemention:implementation implimented:implemented implmented:implemented independant:independent '+
 'infomation:information intergration:integration intergrated:integrated knowlege:knowledge knowledgable:knowledgeable liason:liaison libary:library maintainance:maintenance '+
 'maintenence:maintenance managment:management manger:manager millenium:millennium neccessary:necessary necesary:necessary noticable:noticeable occassion:occasion occured:occurred '+
 'occurence:occurrence orginal:original paralel:parallel perfomance:performance performace:performance persue:pursue posession:possession prefered:preferred priviledge:privilege '+
 'proffesional:professional profesional:professional programing:programming publically:publicly reccomend:recommend recomend:recommend recieve:receive recieved:received '+
 'refered:referred relevent:relevant reponsible:responsible resposible:responsible responsibilites:responsibilities responsiblities:responsibilities resturant:restaurant '+
 'scalibility:scalability scaleable:scalable seperate:separate seperated:separated sucessful:successful succesful:successful successfull:successful sucessfully:successfully '+
 'succesfully:successfully supervisior:supervisor suport:support supress:suppress techinal:technical techincal:technical technolgy:technology tecnology:technology threshhold:threshold '+
 'tommorow:tomorrow transfered:transferred truely:truly untill:until usefull:useful wich:which writting:writing acheiving:achieving coordinted:coordinated '+
 'stratergy:strategy straregy:strategy analyitcs:analytics anaytics:analytics databse:database databsae:database stakeholers:stakeholders stakholders:stakeholders requirments:requirements '+
 'requirment:requirement deployement:deployment deployemnt:deployment applicaton:application applicaitons:applications archtecture:architecture architecure:architecture '+
 'kubernates:Kubernetes kuberentes:Kubernetes kubernets:Kubernetes jenkin:Jenkins postgress:Postgres terrafrom:Terraform pyhton:Python pytohn:Python javscript:JavaScript javasript:JavaScript '+
 'typscript:TypeScript angualr:Angular recat:React mircoservices:microservices microservies:microservices microserivces:microservices').split(' ').forEach(p => {const a=p.split(':');MISSPELL[a[0]]=a[1]});
// Technology names with the wrong capitalisation (only flagged when written exactly like this)
const CASING: Record<string, string>={Javascript:'JavaScript',javascript:'JavaScript',Typescript:'TypeScript',typescript:'TypeScript',Github:'GitHub',github:'GitHub',Gitlab:'GitLab',Nodejs:'Node.js',NodeJs:'Node.js',nodejs:'Node.js',
 Mysql:'MySQL',mysql:'MySQL',Postgresql:'PostgreSQL',postgresql:'PostgreSQL',Mongodb:'MongoDB',mongodb:'MongoDB',Jquery:'jQuery',JQuery:'jQuery',Linkedin:'LinkedIn',Pyspark:'PySpark',
 Graphql:'GraphQL',GraphQl:'GraphQL',Devops:'DevOps',Restful:'RESTful',Tensorflow:'TensorFlow',Pytorch:'PyTorch',Fastapi:'FastAPI',Springboot:'Spring Boot',Dynamodb:'DynamoDB',
 Bigquery:'BigQuery',Powerbi:'Power BI',Sagemaker:'SageMaker',Mlflow:'MLflow',Openai:'OpenAI',Langchain:'LangChain',Macos:'macOS',Ios:'iOS',Iphone:'iPhone',Xcode:'Xcode',Sql:'SQL',Aws:'AWS',Gcp:'GCP',Html:'HTML',Css:'CSS',Json:'JSON',Api:'API',Apis:'APIs'};

const VERBS=('achieved accelerated architected automated built championed collaborated configured consolidated created cut decreased defined delivered deployed designed developed directed '+
 'drove eliminated enabled engineered enhanced established executed expanded generated grew guided implemented improved increased integrated introduced launched led maintained managed '+
 'mentored migrated modernized monitored negotiated optimized orchestrated owned partnered pioneered planned produced programmed reduced redesigned refactored resolved restructured '+
 'saved scaled secured shipped simplified spearheaded standardized streamlined supported tested trained transformed troubleshot upgraded wrote analyzed authored coordinated '+
 'created debugged documented evaluated facilitated identified initiated investigated leveraged modeled prototyped published rebuilt released reviewed validated').split(' ');
const WEAK=/^(responsible for|worked on|helped|assisted|involved in|duties included|participated in|tasked with|worked with|handled)\b/i;

const MON: Record<string, number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const MONTH='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const DATE='(?:'+MONTH+",?\\s*'?\\d{2,4}|(?:0?[1-9]|1[0-2])[\\/.-](?:19|20)\\d{2}|(?:19|20)\\d{2}[\\/.-](?:0[1-9]|1[0-2])(?!\\d)|(?:19|20)\\d{2})";
const NOW='(?:present|current(?:ly)?|now|till\\s*date|to\\s*date|today|ongoing|date)';
const RANGE=new RegExp('('+DATE+')\\s*(?:-|–|—|~|to|until|till|through|thru)\\s*('+DATE+'|'+NOW+')(?![\\w])','gi');
const RANGE1=new RegExp(RANGE.source,'i'); // non-global copy for plain tests

const HEAD: [HeadKey, RegExp][]=[['summary',/^(professional\s+|career\s+|executive\s+)?(summary|profile|objective|overview|about me)$/i],
 ['experience',/^(professional\s+|work\s+|relevant\s+|employment\s+|career\s+)?(experience|employment(\s+history)?|work\s+history|career\s+history|project\s+experience)$/i],
 ['education',/^(education|academic(s|\s+background|\s+qualifications?)?|qualifications?|education\s*(&|and)\s*(training|certifications?))$/i],
 ['skills',/^((technical|core|key|professional)\s+)?(skills|skill\s+set|competencies|technologies|tech\s+stack|expertise|tools(\s*(&|and)\s*technologies)?)$/i],
 ['certs',/^(certifications?|licenses?(\s*(&|and)\s*certifications?)?|courses|training)$/i],
 ['projects',/^((key|personal|academic)\s+)?projects$/i]];

/* ---------- Helpers ---------- */
function esc(s: string): string {return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function clip(s: string, n: number): string {s=String(s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s}
function parseDate(s: string, isEnd: boolean, now: Ym): When | null {
  s=s.trim(); let m: RegExpMatchArray | null;
  if(new RegExp('^'+NOW+'$','i').test(s))return {y:now.y,m:now.m,present:true,exact:true};
  if((m=s.match(new RegExp('^('+MONTH+")[,\\s]*'?(\\d{2,4})$",'i')))){
    let y=+m[2]; if(m[2].length===2)y+=(y<=now.y%100+1?2000:1900);
    return {y:y,m:MON[m[1].slice(0,3).toLowerCase()],exact:true};
  }
  if((m=s.match(/^(\d{1,2})[\/.-](\d{4})$/)))return {y:+m[2],m:+m[1],exact:true};
  if((m=s.match(/^(\d{4})[\/.-](\d{1,2})$/)))return {y:+m[1],m:+m[2],exact:true};
  if((m=s.match(/^(\d{4})$/)))return {y:+m[1],m:isEnd?12:1,exact:false};
  return null;
}
function fmtD(d: When): string {return d.present?'Present':(d.exact?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.m-1]+' ':'')+d.y}
function mi(d: Ym): number {return d.y*12+d.m-1}
function dateStyle(s: string): 'numeric' | 'year' | 'month' | null {return /^\d{1,2}[\/.-]\d{4}$|^\d{4}[\/.-]\d{1,2}$/.test(s.trim())?'numeric':/^\d{4}$/.test(s.trim())?'year':new RegExp('^'+NOW+'$','i').test(s.trim())?null:'month'}

/* ---------- Analysis ---------- */
function analyze(input: string, opt: AnalyzeOptions = {}): Result {
  const TECH = techOf(opt.tech ? opt.tech.timeline : []);
  const today=opt.today||new Date(), now: Ym={y:today.getFullYear(),m:today.getMonth()+1};
  const text=String(input||'').replace(/\r\n?/g,'\n').replace(/[   ]/g,' ');
  const lines=text.split('\n'), issues: Issue[]=[], words=(text.match(/[A-Za-z][A-Za-z'’-]*/g)||[]);
  function add(cat: Category, sev: Severity, msg: string, line?: string, fix?: string): void {issues.push({cat:cat,sev:sev,msg:msg,line:line?clip(line,140):'',fix:fix||''})}

  // Sections
  const sec: string[]=[], found: Partial<Record<HeadKey, 1>>={}; let current='header';
  lines.forEach((l,i) => {
    const t=l.replace(/[:|•\-–—_*#]+\s*$/,'').replace(/^[\s•\-–—_*#]+/,'').trim();
    if(t&&t.length<=48){for(const [key,re] of HEAD){if(re.test(t)){current=key;found[key]=1;break}}}
    sec[i]=current;
  });
  const hasHeads=Object.keys(found).length>0;

  // Contact
  const email=/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text), phone=/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b|\+\d[\d\s-]{9,15}\d/.test(text), linkedin=/linkedin\.com\/in\//i.test(text);
  if(!email)add('format','error','No email address found. Recruiters and ATS need it to contact you.');
  if(!phone)add('format','warn','No phone number found.');
  if(!linkedin)add('format','info','Add your LinkedIn profile URL (linkedin.com/in/…). Many recruiters check it.');

  if(!found.experience&&hasHeads)add('format','warn','No "Experience" heading found. ATS look for standard section names like "Experience" or "Work Experience".');
  if(!found.skills)add('format','warn','No "Skills" section found. A plain list of skills helps ATS keyword matching.');
  if(!found.education)add('format','info','No "Education" heading found. Add one even if it is short.');
  if(!found.summary)add('format','info','Consider a 2-3 line summary at the top with your title and strongest skills.');

  // Readability of the extracted text
  const bad=(text.match(/[�-]/g)||[]).length;
  if(text.trim().length<200)add('format','error','Very little text could be read from this file. If it is a scanned image, ATS cannot read it either. Export it from Word or Google Docs as a text-based PDF.');
  else if(bad/text.length>0.01)add('format','warn','Some characters could not be read (unusual fonts or symbols). ATS may garble them too. Use a standard font like Calibri, Arial or Garamond.');
  const wc=words.length;
  if(wc>=200&&wc<350)add('format','info','The resume is short ('+wc+' words). Add more detail about what you did and the results.');
  if(wc>1300)add('format','info','The resume is long ('+wc+' words). Aim for 2 pages: trim older roles to 2-3 bullets each.');

  // Date ranges -> roles
  const roles: Role[]=[], styles: Record<string, number>={};
  lines.forEach((l,i) => {
    RANGE.lastIndex=0; let m: RegExpExecArray | null;
    while((m=RANGE.exec(l))){
      const a=parseDate(m[1],false,now), b=parseDate(m[2],true,now); if(!a||!b)continue;
      let st=dateStyle(m[1]); if(st)styles[st]=(styles[st]||0)+1; st=dateStyle(m[2]); if(st)styles[st]=(styles[st]||0)+1;
      roles.push({start:a,end:b,line:i,raw:m[0],text:l,sec:sec[i],block:''});
    }
  });
  const jobs=roles.filter(r => !hasHeads||!/^(education|certs|skills)$/.test(r.sec));
  jobs.forEach((r,k) => {
    const next=k+1<jobs.length?jobs[k+1].line:lines.length;
    r.block=lines.slice(r.line,next).filter((x,j) => r.line+j===r.line||sec[r.line+j]===r.sec).join('\n');
  });
  roles.forEach(r => {
    const a=r.start,b=r.end;
    if(a.y<1960)add('dates','warn','A date looks like a typo ('+a.y+').',r.text);
    if(mi(b)<mi(a)&&!b.present)add('dates','error','End date ('+fmtD(b)+') is before the start date ('+fmtD(a)+').',r.text,'Swap or correct the dates.');
    if(a.y>now.y||(a.exact&&a.y===now.y&&a.m>now.m))add('dates','error','Start date '+fmtD(a)+' is in the future.',r.text);
    if(!b.present&&(b.y>now.y||(b.exact&&b.y===now.y&&b.m>now.m)))add('dates','error','End date '+fmtD(b)+' is in the future.',r.text,'Use "Present" for a role you are still in.');
  });
  const cur=jobs.filter(r => r.end.present);
  if(cur.length>1)add('dates','warn',cur.length+' roles are marked as current (Present). That is fine for concurrent jobs, otherwise add an end date.',cur.map(r => r.raw).join(' · '));
  // order, overlap, gaps (chronological view)
  const sorted=jobs.filter(r => r.end.present||mi(r.end)>=mi(r.start)).sort((x,y) => mi(x.start)-mi(y.start));
  const listedDesc=jobs.every((r,k) => k===0||mi(r.start)<=mi(jobs[k-1].start));
  if(jobs.length>1&&!listedDesc)add('dates','info','Roles are not in reverse-chronological order. ATS and recruiters expect the most recent job first.');
  for(let k=1;k<sorted.length;k++){
    const p=sorted[k-1],q=sorted[k];
    if(p.end.present)continue;
    const exact=p.end.exact&&q.start.exact;
    const ov=exact?mi(p.end)-mi(q.start):(p.end.y-q.start.y)*12;
    const gap=exact?mi(q.start)-mi(p.end)-1:(q.start.y-p.end.y-1)*12;
    if(ov>1)add('dates','warn','Two roles overlap by about '+(exact?ov+' months':(ov/12)+' year(s)')+': '+p.raw+' and '+q.raw+'. Fine if both were real at the same time, otherwise fix the dates.',q.text);
    if(gap>=6)add('dates','info','Gap of about '+(gap>=12?Math.round(gap/12*10)/10+' years':gap+' months')+' between '+fmtD(p.end)+' and '+fmtD(q.start)+'. Be ready to explain it, or add what you did.',q.text);
  }
  const nStyles=Object.keys(styles).length;
  if(nStyles>1)add('dates','info','Dates use mixed formats ('+Object.keys(styles).map(s => s==='month'?'"Jan 2020"':s==='numeric'?'"01/2020"':'"2020"').join(', ')+'). Pick one format, e.g. "Jan 2020 – Mar 2023".');
  // claimed years vs dates
  const cm=text.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\.?\s+(?:of\s+)?(?:total\s+|overall\s+|professional\s+|industry\s+|IT\s+|hands-on\s+|progressive\s+)?(?:experience|exp\b)/i);
  if(cm&&jobs.length){
    const first=Math.min(...jobs.map(r => mi(r.start))), last=Math.max(...jobs.map(r => mi(r.end)));
    const span=Math.round((last-first+1)/12*10)/10, claim=+cm[1];
    if(claim>span+1)add('dates','warn','Your summary says '+claim+'+ years of experience, but the dates listed cover about '+span+' years.',cm[0],'Add the missing earlier roles or adjust the number.');
  }

  // Technology timeline
  const techSeen: Record<string, 1>={};
  jobs.forEach(r => {
    if(r.end.present)return;
    TECH.forEach(t => {
      t.re.lastIndex=0; const m=t.re.exec(r.block); if(!m)return;
      if(r.end.y<t.year){
        const key=t.name+'|'+r.line; if(techSeen[key])return; techSeen[key]=1;
        const ln=r.block.split('\n').find(x => {t.re.lastIndex=0;return t.re.test(x)})||r.text;
        add('tech','error',t.name+' was first released in '+t.year+', but it is listed under a role that ended in '+r.end.y+' ('+r.raw+').',ln,t.hint||'Remove it from this role or correct the dates.');
      }
    });
  });
  // "N years of X" claims longer than X has existed
  TECH.forEach(t => {
    const src=t.re.source, fl=t.re.flags.replace('g','');
    // "8 years of React", "8+ yrs hands-on experience with React", "React (8 years)", "React: 8 yrs"
    const r1=new RegExp('(\\d{1,2})\\s*\\+?\\s*(?:years|yrs)\\.?\\s+(?:of\\s+)?(?:(?:hands-on|professional|strong|solid|deep)\\s+)?(?:experience\\s+)?(?:(?:in|with|using|on|working\\s+with)\\s+)?'+src,fl+'g');
    const r2=new RegExp(src+'\\s*[(:\\-–—]\\s*(\\d{1,2})\\s*\\+?\\s*(?:years|yrs)',fl+'g');
    const max=now.y-t.year;
    [r1,r2].forEach(re => {
      let m: RegExpExecArray | null;
      while((m=re.exec(text))){
        const n=+m[1]; if(n>max&&n<60&&!techSeen['y|'+t.name]){techSeen['y|'+t.name]=1;add('tech','error','Claims '+n+' years of '+t.name+', but it has only existed since '+t.year+' (about '+max+' years).',m[0],'Lower the number to what is possible.')}
      }
    });
  });

  // Spelling and polish
  const seenW: Record<string, 1>={};
  lines.forEach(l => {
    (l.match(/[A-Za-z][A-Za-z'’]*/g)||[]).forEach(w => {
      const lw=w.toLowerCase();
      if(MISSPELL[lw]&&!seenW[lw]){seenW[lw]=1;add('spelling','error','"'+w+'" looks misspelled.',l,MISSPELL[lw])}
    });
    Object.keys(CASING).forEach(w => {
      if(seenW['c|'+w])return;
      if(new RegExp('(?<![A-Za-z0-9.@/])'+esc(w)+'(?![A-Za-z0-9])').test(l)&&!/https?:|www\.|@/.test(l)){seenW['c|'+w]=1;add('spelling','info','"'+w+'" is usually written "'+CASING[w]+'".',l,CASING[w])}
    });
    const rep=l.match(/\b([A-Za-z]{2,})\s+\1\b/i);
    if(rep&&!seenW['r|'+rep[1].toLowerCase()]){seenW['r|'+rep[1].toLowerCase()]=1;add('spelling','warn','Repeated word: "'+rep[0]+'".',l,rep[1])}
  });
  (opt.extraSpelling||[]).forEach(s => {
    const lw=String(s.word).toLowerCase(); if(seenW[lw])return; seenW[lw]=1;
    const ln=lines.find(l => new RegExp('(?<![A-Za-z])'+esc(s.word)+'(?![A-Za-z])','i').test(l))||'';
    add('spelling','error','"'+s.word+'" looks misspelled.',ln,s.fix);
  });

  // Bullets and impact
  const bullets: string[]=[];
  lines.forEach((l,i) => {
    const t=l.trim(); if(t.length<25)return;
    const isB=/^[•\-*▪●◦–·➢✓>]\s*/.test(t)||(sec[i]==='experience'&&!RANGE1.test(t)&&t.length>40);
    if(isB)bullets.push(t.replace(/^[•\-*▪●◦–·➢✓>]\s*/,''));
  });
  const quant=bullets.filter(b => /\d|%|\$/.test(b)).length;
  const strong=bullets.filter(b => {const w=(b.match(/^[A-Za-z]+/)||[''])[0].toLowerCase();return VERBS.indexOf(w)>=0}).length;
  const weak=bullets.filter(b => WEAK.test(b));
  const firstP=bullets.filter(b => /^(I|My|We)\b/.test(b));
  if(!bullets.length&&text.trim().length>=200)add('impact','warn','No bullet points found. Use short bullets for each role so ATS and recruiters can scan them.');
  if(bullets.length&&quant/bullets.length<0.3)add('impact','warn','Only '+quant+' of '+bullets.length+' bullets include a number. Add results such as %, $, time saved, users or team size.');
  if(weak.length)add('impact','info',weak.length+' bullet'+(weak.length>1?'s start':' starts')+' with a weak phrase like "Responsible for" or "Worked on". Start with an action verb instead (Built, Led, Reduced…).',weak[0]);
  if(firstP.length)add('impact','info','Avoid "I", "my" or "we" in bullets. Start with the action.',firstP[0]);

  // Keyword match against the job description
  let kw: Result['keywords']=null;
  const jdSkills=(opt.jdSkills||[]).filter(Boolean);
  if(jdSkills.length){
    const spaced=' '+text.toLowerCase().replace(/[^a-z0-9+#]+/g,' ')+' ', compact=text.toLowerCase().replace(/[^a-z0-9+#]+/g,'');
    const matched: string[]=[],missing: string[]=[];
    jdSkills.forEach(s => {
      const k=s.toLowerCase().replace(/[^a-z0-9+#]+/g,' ').trim(); if(!k)return;
      const c=k.replace(/ /g,''), hit=spaced.indexOf(' '+k+' ')>=0||(c.length>=5&&compact.indexOf(c)>=0)||(/s$/.test(k)&&spaced.indexOf(' '+k.slice(0,-1)+' ')>=0)||spaced.indexOf(' '+k+'s ')>=0;
      (hit?matched:missing).push(s);
    });
    kw={matched:matched,missing:missing,pct:matched.length/Math.max(1,matched.length+missing.length)};
    if(missing.length)add('keywords',kw.pct<0.5?'warn':'info','Missing '+missing.length+' keyword'+(missing.length>1?'s':'')+' from the job description. Add the ones you really have, using the same wording as the job post.');
  }

  // Score
  const n=(c: Category, s?: Severity): number => issues.filter(x => x.cat===c&&(!s||x.sev===s)).length;
  const parts: Part[]=[];
  if(kw)parts.push({key:'keywords',label:'Keyword match',max:30,got:Math.round(30*Math.min(1,kw.pct/0.85))});
  parts.push({key:'sections',label:'Sections',max:15,got:(found.experience||(!hasHeads&&jobs.length)?6:0)+(found.skills?4:0)+(found.education?3:0)+(found.summary?2:0)});
  parts.push({key:'contact',label:'Contact info',max:10,got:(email?4:0)+(phone?4:0)+(linkedin?2:0)});
  const qr=bullets.length?quant/bullets.length:0, vr=bullets.length?strong/bullets.length:0;
  parts.push({key:'impact',label:'Impact & wording',max:15,got:bullets.length?Math.round(8*Math.min(1,qr/0.4)+7*Math.min(1,vr/0.6)):0});
  const fmt=(text.trim().length>=200?2:0)+(bullets.length?3:0)+(wc>=350&&wc<=1300?5:wc>=200?3:0)-(bad/Math.max(1,text.length)>0.01?2:0);
  parts.push({key:'format',label:'Readability',max:10,got:Math.max(0,fmt)});
  const spellPen=Math.min(8,2*n('spelling','error')+n('spelling','warn')+0.5*Math.min(4,n('spelling','info')));
  const datePen=4*n('dates','error')+1.5*n('dates','warn'), techPen=4*n('tech','error');
  parts.push({key:'accuracy',label:'Accuracy (spelling, dates, tech)',max:20,got:Math.max(0,Math.round(20-spellPen-datePen-techPen))});
  let got=0,max=0; parts.forEach(p => {got+=p.got;max+=p.max});
  let score=Math.round(got/max*100);
  if(text.trim().length<200)score=Math.min(score,20);

  const rank: Record<Severity, number>={error:0,warn:1,info:2};
  issues.sort((a,b) => rank[a.sev]-rank[b.sev]);
  return {score:score,rating:score>=85?'Excellent':score>=70?'Good':score>=50?'Fair':'Needs work',parts:parts,issues:issues,keywords:kw,
    stats:{words:wc,bullets:bullets.length,quantified:quant,roles:jobs.length}};
}

/* ---------- Keywords from a job description (used when the AI skill reader is unavailable) ---------- */
function jdKeywords(jd: string, tech: TechData): string[] {
  const TECH = techOf(tech.timeline);
  const out: string[]=[], seen: Record<string, 1>={};
  function add(n: string): void {const k=n.toLowerCase();if(!seen[k]){seen[k]=1;out.push(n)}}
  TECH.forEach(t => {t.re.lastIndex=0;if(t.re.test(jd))add(t.name)});
  tech.names.forEach(n => {if(new RegExp('(?<![A-Za-z0-9+#])'+esc(n)+'(?![A-Za-z0-9+#])',/^[A-Z+#]{2,}$/.test(n)||n.length<=3?'':'i').test(jd))add(n)}); // short names like Go: exact case only
  return out.slice(0,40);
}


export { readFile, analyze, jdKeywords };
