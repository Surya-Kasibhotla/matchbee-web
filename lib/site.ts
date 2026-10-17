/* Site configuration and page content: brand, menus, footer and ALL marketing copy.
   Items with feature: 'jobs' only show when the server has FEATURE_JOBS=1.
   "{brand}", "{email}" and "{year}" are filled in by fill(). Items marked PLACEHOLDER are dummy values to replace before launch. */
export const SITE = {
  brand: {
    name: 'MatchBee',
    accent: 'Bee', // part of the name shown in the honey colour
    tagline: 'AI resume tools that tailor every application and never invent your experience.',
    email: 'support@example.com', // PLACEHOLDER
  },

  // Tools appear in the "AI Tools" menu, the footer and the landing page cards
  tools: [
    { id: 'builder', name: 'Resume Builder', href: '/builder/', icon: 'doc', desc: 'Turn any job description into a tailored resume.' },
    { id: 'ats', name: 'ATS Resume Checker', href: '/ats/', icon: 'gauge', desc: 'Get a score plus spelling, date and tech-timeline checks.' },
    { id: 'jobs', feature: 'jobs', name: 'Job Alerts', href: '/jobs/', icon: 'bell', desc: 'The latest matching US jobs, emailed to you every day.' },
    { id: 'intro', name: 'Phone Intro Script', href: '/builder/#intro', icon: 'phone', desc: 'A short opener for your next recruiter call.' },
    { id: 'gaps', name: 'Gap Report', href: '/builder/#gaps', icon: 'search', desc: 'See which job requirements you have not covered.' },
  ],

  nav: [
    { label: 'AI Tools', menu: 'tools' },
    { label: 'Job Alerts', href: '/jobs/', feature: 'jobs' },
    { label: 'How it works', href: '/#how' },
    { label: 'FAQ', href: '/#faq' },
  ],
  cta: { label: 'Build my resume', href: '/builder/' },

  footer: {
    columns: [
      { title: 'AI Tools', links: 'tools' },
      { title: 'Resources', links: [
        { label: 'How it works', href: '/#how' },
        { label: 'What the ATS check looks for', href: '/#checks' },
        { label: 'FAQ', href: '/#faq' },
      ] },
      { title: 'Company', links: [
        { label: 'Privacy policy', href: '/privacy/' },
        { label: 'Terms of use', href: '/terms/' },
        { label: 'Report a listing', href: '/jobs/', feature: 'jobs' },
        { label: 'Contact us', href: 'mailto:support@example.com' }, // PLACEHOLDER
      ] },
    ],
    legal: '© {year} {brand}. All rights reserved.',
  },

  pages: {
    home: {
      // title and description are what Google shows in results; npm run seo copies them into each page's <head>
      title: '{brand}: Free AI Resume Builder and ATS Resume Checker',
      description: 'Free AI resume builder and ATS resume checker. Paste any job description to get a tailored, ATS-friendly resume, a recruiter phone intro and a gap report.',
      sections: ['hero', 'strip', 'tools', 'how', 'alerts', 'checks', 'privacy', 'faq', 'cta'],
      hero: {
        eyebrow: 'Free AI resume tools',
        title: 'Land more interviews with a resume <em>tailored to every job</em>',
        lead: 'Paste a job description, add what you have really done, and get an ATS-friendly resume, a recruiter phone intro and an honest gap report in seconds.',
        primary: { label: 'Build my resume', href: '/builder/' },
        secondary: { label: 'Check my ATS score', href: '/ats/' },
        ticks: ['No sign-up needed', 'Nothing invented', 'PDF, DOCX and TXT'],
        art: { score: 92, rating: 'Excellent', file: 'alex-morgan-resume.pdf', badge: '12 keywords matched',
          checks: [{ ok: true, text: 'No spelling mistakes' }, { ok: true, text: 'Dates are consistent' }, { ok: false, text: 'GraphQL missing from skills' }] },
      },
      strip: [
        { icon: 'zap', title: 'Results in seconds', text: 'Resume, intro and gap report at once' },
        { icon: 'shield', title: 'Never invents facts', text: 'Every claim comes from your details' },
        { icon: 'lock', title: 'Private by default', text: 'Nothing is stored unless you save it' },
        { icon: 'gauge', title: 'ATS-ready', text: 'Clear sections and matched keywords' },
      ],
      tools: {
        kicker: 'AI Tools',
        title: 'Everything you need for the next application',
        lead: 'Four focused tools that work together. Use one, or use them all on the same job description.',
        feature: {
          tool: 'ats', badge: 'New',
          title: 'ATS Resume Checker',
          text: 'Upload your resume and see exactly what an applicant tracking system and a recruiter will notice.',
          points: ['Score out of 100 with a clear breakdown', 'Spelling, repeated words and tech-name casing', 'Dates that overlap, run backwards or sit in the future', 'Technologies listed before they existed'],
          demo: [{ k: 'Keyword match', v: '24 / 30', s: 'ok' }, { k: 'Spelling', v: '2 typos', s: 'mid' }, { k: 'Date check', v: 'End before start', s: 'no' }, { k: 'Tech timeline', v: 'Kubernetes in 2012', s: 'no' }],
        },
      },
      how: {
        id: 'how', kicker: 'How it works', title: 'From job post to tailored resume in three steps',
        steps: [
          { title: 'Paste the job description', text: 'Any format works: email, WhatsApp forward or a job board post. We pick out the role, skills and requirements.' },
          { title: 'Add what you have really done', text: 'Your clients, years and the skills you actually have. Everything is optional, so add as much or as little as you like.' },
          { title: 'Get your resume and prep', text: 'A tailored resume, a phone intro and a gap report. Then run the ATS check before you apply.' },
        ],
      },
      alerts: {
        id: 'alerts', feature: 'jobs', kicker: 'Job alerts', title: 'Fresh US jobs in your inbox every morning',
        lead: 'Tell us the roles and places you want. We search the latest postings across the US and email you the best matches, each with a one-click tailored resume.',
        points: [
          { icon: 'search', title: 'Matched to you', text: 'Job titles and skills you choose, ranked by how well each posting fits.' },
          { icon: 'pin', title: 'Any US state, or remote', text: 'Pick up to five states, remote-only, or the whole country.' },
          { icon: 'doc', title: 'Build a resume for any job', text: 'Every job in the email has a button that opens the builder with that job description loaded.' },
        ],
        cta: { label: 'Set up job alerts', href: '/jobs/' },
        demo: {
          subject: '6 new React Developer jobs for you', based: 'React Developer · Texas · Remote',
          jobs: [
            { title: 'Senior React Developer', meta: 'Northwind Bank · Austin, TX · $135k–$160k' },
            { title: 'Frontend Engineer (React)', meta: 'Contoso Health · Remote · Contract' },
            { title: 'React Developer', meta: 'Fabrikam Retail · Dallas, TX · Today' },
          ],
        },
      },
      checks: {
        id: 'checks', kicker: 'ATS checks', title: 'Catch the mistakes recruiters notice first',
        lead: 'The checker reads your resume the way screening software does, then points to the exact line to fix.',
        points: [
          { icon: 'type', title: 'Spelling and polish', text: 'Common resume misspellings, repeated words and tech names like "Javascript" written wrongly.' },
          { icon: 'calendar', title: 'Date mismatches', text: 'Roles that overlap, end before they start, sit in the future or do not add up to the years you claim.' },
          { icon: 'clock', title: 'Technology timeline', text: 'Tools listed in a role that ended before they were released, or "15 years of React" when React is younger.' },
          { icon: 'key', title: 'Keyword match', text: 'Which skills from the job description are on your resume and which are missing.' },
        ],
        cta: { label: 'Check my resume', href: '/ats/' },
      },
      faq: {
        id: 'faq', kicker: 'FAQ', title: 'Questions, answered',
        items: [
          { q: 'Is {brand} free?', a: 'Yes. You can build and check resumes without creating an account. Signing in only lets you save profiles to reuse later.' },
          { q: 'Will the AI make up experience for me?', a: 'No. A built-in guard removes employers, numbers, tools or results you did not give us. Suggested lines are highlighted so you can review or delete them.' },
          { q: 'Do you store my resume or job description?', a: 'No. They are sent to the AI provider to produce your results and are not stored. Only profiles you choose to save while signed in are kept, and you can delete them at any time.' },
          { feature: 'jobs', q: 'How do job alerts work?', a: 'Create a free account, choose job titles, skills and US states (or remote), and pick daily or weekly. We search the latest postings and email you new matches only. Every email has a one-click unsubscribe link.' },
          { q: 'What is an ATS?', a: 'An applicant tracking system is the software employers use to collect and filter applications. It reads your resume as text, so clear section names, standard dates and matching keywords matter.' },
          { q: 'Which files can the ATS checker read?', a: 'PDF, DOCX and TXT up to 5 MB, or you can paste the text. Scanned image PDFs cannot be read by most ATS either, so export a text-based PDF from Word or Google Docs.' },
          { q: 'How accurate is the ATS score?', a: 'It is an estimate. Every ATS product scores differently, but they all reward clear sections, matching keywords, accurate dates and readable text, which is what the score measures.' },
        ],
      },
      privacy: {
        id: 'privacy', kicker: 'Privacy', title: 'Your details stay yours',
        lead: 'Built so you can use it without handing over your career history.',
        points: [
          { icon: 'lock', title: 'Nothing stored by default', text: 'Job descriptions, resumes and form details are used to produce your results and then discarded.' },
          { icon: 'shield', title: 'No invented experience', text: 'Output is checked against what you entered. Anything you did not give us is removed or flagged.' },
          { icon: 'doc', title: 'Files read in your browser', text: 'Uploaded resumes are opened on your device. Only the extracted text is sent for the AI review.' },
        ],
      },
      cta: {
        title: 'Your next resume is a paste away',
        lead: 'Start with a job description. No account, no credit card, nothing stored.',
        primary: { label: 'Build my resume', href: '/builder/' },
        secondary: { label: 'Check my ATS score', href: '/ats/' },
      },
    },

    builder: {
      title: 'Free AI Resume Builder for Any Job Description · {brand}',
      description: 'Build a tailored, ATS-friendly resume from any job description in seconds. A free AI resume builder that never invents experience. No sign-up needed.',
      crumb: 'Resume Builder',
      h1: 'Resume Builder',
      sub: 'Paste a job description and add your details. Everything is optional. You get a resume, phone intro, gap report and ATS check.',
      actions: [
        { id: 'sample', label: 'Try sample data', icon: 'spark' },
        { id: 'reset', label: 'Clear all', kind: 'ghost' },
      ],
    },

    privacy: {
      title: 'Privacy policy · {brand}', crumb: 'Privacy', h1: 'Privacy policy',
      description: 'How {brand} handles your resume, job descriptions and account details: what we store, what we never keep, and how to delete your data.',
      sub: 'What we collect, what we do not keep, and the choices you have.',
      legal: {
        draft: true, updated: 'October 2026',
        intro: '{brand} helps you write resumes, check them for ATS issues and, if you choose, get job alerts by email. This policy explains how your information is handled.',
        sections: [
          { h: 'What we do not store', p: ['Job descriptions, resume text and form details you enter to build or check a resume are sent to our server and an AI provider to produce your results, and are not stored afterwards. Resume files you upload to the ATS checker are opened in your browser; only the extracted text is sent for the AI spelling review.'] },
          { h: 'What we store when you create an account', list: [
            'Your email address and your first and last name.',
            'If you create a password: a one-way hash of it (never the password itself). If you sign in with Google: that your account uses Google.',
            'Profiles you choose to save, so you do not retype your details.',
            'Job alert preferences: job titles, skills, states, job types, how often to email you and, if you opt in, a WhatsApp number.',
            'Which jobs we have already emailed you, so you never get the same job twice.',
            'How many job-tailored resumes you have built, if a plan limit applies.',
          ] },
          { h: 'Reports about listings', p: ['When you report a listing we store the reason, any note you add and a one-way code derived from your connection, so one person cannot report the same listing many times. We do not store your IP address.'] },
          { h: 'Who processes your information', list: [
            'AI providers that write and review resume text (for example Groq, Cerebras or OpenRouter, depending on configuration). Their own terms and retention rules apply to the text they receive.',
            'Our email provider, which delivers sign-in codes and job alert emails.',
            'Job sources (Adzuna, JSearch on RapidAPI and USAJOBS). We send them search terms such as a job title and a state, never your name or email.',
            'Our hosting provider, which runs the site and its database.',
          ] },
          { h: 'Cookies and browser storage', p: ['We use one sign-in cookie to keep you signed in, and a short-lived cookie during Google sign-in. Password reset links are sent by email, work once and expire after 30 minutes. Your browser also remembers your light or dark theme choice, and for the current tab only, which features are switched on and a job you were about to tailor a resume to. We do not use advertising or tracking cookies.'] },
          { h: 'Your choices', list: [
            'Every job alert email has a one-click unsubscribe link. You can also pause or change alerts on the Job Alerts page.',
            'You can change your name or password, or delete your account, at any time on the My account page. Deleting it removes your profiles, alert preferences and alert history.',
            'You can use the Resume Builder and ATS checker without an account.',
          ] },
          { h: 'Contact', p: ['Questions about privacy: {email}.'] },
        ],
      },
    },

    terms: {
      title: 'Terms of use · {brand}', crumb: 'Terms', h1: 'Terms of use',
      description: 'The terms for using {brand}, the free AI resume builder, ATS resume checker and job alerts.',
      sub: 'The rules for using {brand}.',
      legal: {
        draft: true, updated: 'October 2026',
        intro: 'By using {brand} you agree to these terms. If you do not agree, please do not use the service.',
        sections: [
          { h: 'The service', p: ['{brand} provides AI-assisted tools to draft resumes, check them for common ATS issues and, where offered, email job listings that match your preferences. The service is provided as is. We do not guarantee interviews, offers or that any listing is still open.'] },
          { h: 'Your resume is your responsibility', p: ['AI suggestions can be wrong. Review everything before you use it, remove anything that is not true, and make sure your resume accurately describes your experience. Suggested lines are highlighted so you can check them.'] },
          { h: 'Job listings come from third parties', list: [
            'Listings come from job sources such as Adzuna, JSearch and USAJOBS. Each listing is credited to its source and links to the original posting. Apply on the original site.',
            'We do not verify employers or recruiters and we are not party to any job application. Listings are not exclusive to {brand}.',
            'Never pay to apply for a job or share bank details with a recruiter. If a listing looks wrong, use "Report this listing". Listings reported by several people stop being sent.',
          ] },
          { h: 'Acceptable use', list: [
            'Do not scrape, overload or try to break the service, or use it to send spam.',
            'Do not upload content you do not have the right to use, or content that is unlawful.',
            'One account per person. We may limit or close accounts that misuse the service.',
          ] },
          { h: 'Plans and limits', p: ['Some features may have limits, for example a number of job-tailored resumes per month on the free plan. We will show any limit in the product before it applies to you.'] },
          { h: 'Changes', p: ['We may update these terms. If a change is significant we will tell signed-in users by email or on the site before it takes effect.'] },
          { h: 'Contact', p: ['Questions about these terms: {email}.'] },
        ],
      },
    },

    account: {
      title: 'My account · {brand}',
      noindex: true, // private page: kept out of Google
      crumb: 'My account',
      h1: 'My account',
      sub: 'Your details, how you sign in, and your data.',
      actions: [],
    },
    jobs: {
      title: 'Job Alerts · {brand}',
      description: 'Get the latest matching US jobs by email, each with a button to tailor your resume to that job.',
      noindex: true, // FEATURE_JOBS is off, so the page only says "coming soon". Remove when job alerts launch, then npm run seo
      crumb: 'Job Alerts',
      h1: 'Job Alerts',
      sub: 'Tell us what you are looking for. We find the latest matching jobs across the US and email them to you, each with a button to build a tailored resume.',
      actions: [],
    },

    ats: {
      title: 'Free ATS Resume Checker: Score and Fix Your Resume · {brand}',
      description: 'Free ATS resume checker. Upload a PDF, DOCX or TXT resume for an ATS score, spelling fixes, date checks and the keywords missing for the job.',
      crumb: 'ATS Resume Checker',
      h1: 'ATS Resume Checker',
      sub: 'Upload your resume for an ATS score, spelling fixes, date checks and a technology timeline check. Add a job description to see missing keywords.',
      actions: [{ id: 'atssample', label: 'Try a sample resume', icon: 'spark' }],
      what: [
        { icon: 'type', text: 'Spelling, repeated words and tech-name casing' },
        { icon: 'calendar', text: 'Overlapping, backwards and future dates' },
        { icon: 'clock', text: 'Technologies listed before they existed' },
        { icon: 'key', text: 'Keywords from the job description' },
        { icon: 'doc', text: 'Sections, contact details and bullet quality' },
      ],
    },
  },
};

export type Site = typeof SITE;
export type PageKey = keyof typeof SITE.pages;
