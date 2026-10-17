'use client';
/* Site header: logo, menu (from lib/site.ts), theme switch, call to action and the account area.
   Signed out: Log in / Sign up. Signed in: avatar menu with name, email, My account, Saved profiles, Log out. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/lib/site';
import { fill } from '@/lib/text';
import { BrandMark, Wordmark } from './Brand';
import { Icon, MI } from './Icon';
import { useApp } from './app/AppProvider';

const feat = (o: { feature?: string }) => (o.feature ? { 'data-feature': o.feature } : {});

function initials(u: { first: string; last: string; email: string }) {
  const a = ((u.first || '').charAt(0) + (u.last || '').charAt(0)).toUpperCase();
  return a || (u.email || '?').charAt(0).toUpperCase();
}

export function Header() {
  const here = usePathname(), { cfg, user, openAuth, logout } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // close open menus on outside click, Escape, or navigation
  useEffect(() => {
    const close = (e: Event) => root.current?.querySelectorAll('details[open]').forEach(d => { if (!(e.target instanceof Node && d.contains(e.target))) (d as HTMLDetailsElement).open = false; });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { root.current?.querySelectorAll('details[open]').forEach(d => ((d as HTMLDetailsElement).open = false)); setNavOpen(false); } };
    document.addEventListener('click', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, []);
  useEffect(() => { setNavOpen(false); }, [here]);
  useEffect(() => { document.body.classList.toggle('nav-open', navOpen); }, [navOpen]);

  function toggleTheme() {
    const r = document.documentElement, dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    r.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('mb_theme', dark ? 'light' : 'dark'); } catch { /* ignore */ }
  }
  const showCta = SITE.cta && SITE.cta.href !== here && !(cfg?.accounts && !user);

  return (
    <div ref={root}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site">
        <div className="container site-in">
          <Link className="brand" href="/" aria-label={SITE.brand.name + ' home'}><BrandMark /><Wordmark /></Link>
          <nav className="nav" id="nav" aria-label="Main">
            {SITE.nav.map(n => 'menu' in n && n.menu === 'tools' ? (
              <details className="menu" key={n.label}>
                <summary>{fill(n.label)}</summary>
                <div className="menu-pop">
                  {SITE.tools.map(t => (
                    <Link key={t.id} href={t.href} {...feat(t)}><MI name={t.icon} /><span><b>{fill(t.name)}</b><small>{fill(t.desc)}</small></span></Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link key={n.label} href={(n as { href: string }).href} {...feat(n as { feature?: string })} aria-current={(n as { href: string }).href === here ? 'page' : undefined}>{fill(n.label)}</Link>
            ))}
          </nav>
          <div className="site-actions">
            <button type="button" className="icon-btn" aria-label="Switch light or dark theme" onClick={toggleTheme}><Icon name="moon" /></button>
            {showCta && <Link className="btn pri hide-sm hcta" href={SITE.cta.href}>{fill(SITE.cta.label)}</Link>}
            {cfg?.accounts && !user && (
              <div className="acct-out">
                <button type="button" className="ghost login-btn" onClick={() => openAuth('', 'login')}>Log in</button>
                <button type="button" className="pri" onClick={() => openAuth('', 'signup')}>Sign up</button>
              </div>
            )}
            {user && (
              <details className="menu acct-menu">
                <summary className="avatar-btn" aria-label="Your account"><span className="avatar">{initials(user)}</span></summary>
                <div className="menu-pop acct-pop">
                  <div className="acct-id"><span className="avatar lg">{initials(user)}</span><span><b>{(user.first + ' ' + user.last).trim() || 'Your account'}</b><small>{user.email}</small></span></div>
                  <Link href="/account/"><Icon name="user" />My account</Link>
                  <Link href="/builder/"><Icon name="doc" />Saved profiles</Link>
                  <Link href="/jobs/" data-feature="jobs"><Icon name="bell" />Job alerts</Link>
                  <button type="button" className="acct-logout" onClick={() => logout()}><Icon name="out" />Log out</button>
                </div>
              </details>
            )}
            <button type="button" className="icon-btn navtoggle" aria-label="Open menu" aria-expanded={navOpen} aria-controls="nav" onClick={() => setNavOpen(o => !o)}><Icon name="menu" /></button>
          </div>
        </div>
      </header>
    </div>
  );
}
