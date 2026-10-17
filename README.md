# MatchBee website

The pages of MatchBee: resume builder, ATS checker, job alerts, account. Paste a job description, enter your details (every field optional), and get a tailored resume, a phone-call intro script and a gap report.

**Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4, built as a static export (every page is pre-rendered HTML) and served by Cloudflare Workers. Node 22.18+.

All AI, accounts and data live in the separate **API** (`matchbee-api`, the backend repo). This site calls it at `/api/*` on the same address: on Cloudflare the Worker in `worker.ts` passes those requests to the API Worker through a service binding, so there is one address and one sign-in cookie.

## Run locally

Start the API first (in the backend repo: `npm install`, `cp .env.example .env`, `npm run dev`, which listens on port 8787). Then here:

```bash
npm install
npm run dev                 # http://localhost:3000 with live reload; /api is sent to the API on :8787
npm run build               # pre-renders every page into out/
npm start                   # serves out/ like Cloudflare does, /api sent to the API (http://localhost:3000)
npm test                    # page, Worker and dictionary tests (the page test needs npm run build once)
npm run typecheck
```

`API_URL` changes where `/api` goes (default `http://127.0.0.1:8787`), for both `npm run dev` and `npm start`.

## Deploy (Cloudflare)

Deploy the API first: this Worker's service binding needs `matchbee-api` to exist.

```bash
npx wrangler login
npm run deploy              # builds out/ and deploys the Worker "matchbee" (https://matchbee.hireloop.workers.dev)
npm run preview             # or: a private preview link, without making it live
```

**Automatic deploys:** `.github/workflows/deploy.yml` typechecks, builds and tests every push and pull request, and deploys every push to `main` that passes. It needs the repository secrets `CLOUDFLARE_API_TOKEN` (Cloudflare -> My Profile -> API Tokens -> template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare -> Workers & Pages, "Account ID"), under GitHub -> Settings -> Secrets and variables -> Actions.

Static files are served free and unlimited without running the Worker; only `/api/*`, `/healthz` and the Google verification file run `worker.ts`. Page security headers come from `public/_headers`. No secrets are needed here: every key lives in the API.

## Layout

```
app/                       Next.js pages (App Router): page.tsx (home), builder/, ats/, jobs/, account/, privacy/, terms/,
                           layout.tsx (header, footer, sign-in on every page), sitemap.ts, robots.ts
app/globals.css            Tailwind theme + utilities, and the MatchBee tokens as Tailwind colours (bg-surface, text-mut, ...)
app/design.css             MatchBee component styles (buttons, cards, resume paper, ATS, dialogs, print) in Tailwind's components layer
components/                Header, Footer, PageHead, landing/Sections, app/AppProvider (settings, user, sign-in dialog),
                           builder/ (Builder, Output, Profiles), ats/ (AtsPanel, AtsPage), jobs/JobsPage, account/AccountView
lib/site.ts                brand name, menus, footer, page titles and ALL marketing copy (edit this to rename or reword)
lib/samples.ts             dummy data behind the "Try sample data" buttons (fictional people and companies)
lib/api.ts                 calls to the API (same address)
lib/tech.ts                the technology dictionary, loaded from the API (GET /api/tech-terms)
lib/ats/engine.ts          ATS analysis (file reading, dates, tech timeline, spelling, score), runs in the browser
lib/builder/               jd.ts (job description reader), resume.ts (resume preview, phone intro, request, profiles)
lib/spell.ts               dictionary spell check (public/vendor/nspell + public/vendor/dict-en, loaded on "Check spelling")
lib/meta.ts                page titles, descriptions, canonical, social and structured-data tags from lib/site.ts
public/                    icons, og-image.png, manifest, sw.js, theme.js, _headers (security headers), vendor/ (pdf.js, nspell, dictionary)
scripts/postbuild.ts       fixes Next 16 prefetch file names after the build      scripts/serve.ts  npm start
worker.ts                  Cloudflare Worker: /api/* and /healthz to the API binding, everything else static files
test/                      built pages, the Worker's routing, the vendored spell dictionary
```

Three files stay JavaScript on purpose: `public/sw.js` and `public/theme.js` are loaded by browsers as they are, and `postcss.config.mjs` because Next.js does not read a TypeScript PostCSS config.

## Changing the site

- **Words, menus, footer, page titles:** `lib/site.ts`. `{brand}`, `{email}` and `{year}` are filled in everywhere. Run `npm run dev` to see changes live.
- **Rename the brand:** `brand.name` (and `brand.accent`, the part in honey colour) in `lib/site.ts`, then `public/manifest.webmanifest`, and `BRAND_NAME` in the API's `wrangler.toml` (email sender name).
- **Add a tool to the menu, footer and landing cards:** add an entry to `tools` in `lib/site.ts`.
- **Reorder or remove landing sections:** edit `pages.home.sections`. Each name maps to a component in `components/landing/Sections.tsx`.
- **New page:** add `app/<name>/page.tsx` (copy `app/privacy/page.tsx`), add `pages.<name>` to `lib/site.ts`, and use `pageMeta('<name>', '/<name>/')` for its Google tags. Add it to `app/sitemap.ts` if Google should index it.
- **Styling:** use Tailwind utility classes in components; the MatchBee colours are available as `bg-brand`, `text-brand-text`, `bg-surface`, `text-mut`, `border-line` and so on, and follow light/dark mode.
- **Google search tags:** each page's `title` and `description` in `lib/site.ts` are its Google result; canonical, social and structured-data tags, `sitemap.xml` and `robots.txt` are generated at build time. `noindex: true` keeps a page out of Google. Set `NEXT_PUBLIC_SITE_URL` when the domain changes. The share image is `public/og-image.png` (1200×630).
- Items marked `PLACEHOLDER` in `lib/site.ts` (the contact email) are dummy values to replace before launch.
- Terms (`/terms/`) and Privacy (`/privacy/`) come from `pages.terms` and `pages.privacy` in `lib/site.ts`. They are templates marked `draft: true`: have them reviewed before launch.

## Upload and edit a resume

The builder has an **Upload resume** card (PDF, DOCX or TXT, or drop the file on it). The file is read in the browser (`readFile` in `lib/ats/engine.ts`) and the text goes to the API (`POST /api/parse-resume`), which keeps only values that appear in the resume. The resume preview is editable: click any text. Edits are kept when you switch tabs or change the form, until you press **Discard my edits** or generate again. Print, Copy and Download use the edited version.

## Spell check and the tech dictionary

- While typing, the browser's own spell check is on for titles, education and bullet notes, and off for names, contact details and skills.
- **Check spelling** on the resume runs a real US English dictionary (Hunspell from SCOWL, `public/vendor/dict-en`, MIT/BSD) with nspell (`public/vendor/nspell`, MIT), loaded only when pressed. Nothing is sent anywhere. Click a marked word for suggestions, Ignore, or Ignore everywhere. Marks never reach Print, Copy or Download, or your saved edits.
- Technology names (so "Kubernetes" is not flagged), the ATS keyword list and the ATS "technology timeline" release years all come from the API's dictionary (`lib/tech.ts`, loaded once per page). The API keeps the only copy and learns new names daily. If the API cannot be reached those checks are skipped; everything else still works.

## Nothing is saved in the browser

Refreshing or reopening the page starts with an empty form (autocomplete off, back/forward cache reloads). The only things kept in the browser are the light/dark theme choice (`mb_theme`), plus per-tab `sessionStorage` for the feature flags and a job you are about to tailor a resume to.

## Install on Android and Share from WhatsApp

The site is an installable app (manifest, icons, minimal service worker that caches nothing). On Android Chrome open the site, menu, **Install app**. Once installed, "MatchBee" appears in the Share sheet, so a job post in WhatsApp or email can be shared straight into the text box. iOS later.
