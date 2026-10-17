'use client';
/* /account/: details, password, email confirmation, log out and delete. Uses /api/me* in src/account.js. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { Icon, MI } from '@/components/Icon';
import { useApp } from '@/components/app/AppProvider';

const since = (ms: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '');
const initials = (u: User) => (((u.first || '').charAt(0) + (u.last || '').charAt(0)).toUpperCase() || u.email.charAt(0).toUpperCase());
type Note = { t: string; bad?: boolean };
const NoteText = ({ n }: { n: Note }) => <span className={'note' + (n.bad ? ' bad' : '')} role="status">{n.t}</span>;

export function AccountView() {
  const { cfg, user, ready, openAuth, setUser, logout } = useApp();
  const [first, setFirst] = useState(''), [last, setLast] = useState('');
  const [cur, setCur] = useState(''), [pw, setPw] = useState('');
  const [nameNote, setNameNote] = useState<Note>({ t: '' }), [pwNote, setPwNote] = useState<Note>({ t: '' }), [vNote, setVNote] = useState<Note>({ t: '' });
  const [code, setCode] = useState(''), [codeSent, setCodeSent] = useState(false), [busy, setBusy] = useState('');
  const [profiles, setProfiles] = useState<number | null>(null);
  const [del, setDel] = useState(false), [word, setWord] = useState('');

  useEffect(() => { if (user) { setFirst(user.first || ''); setLast(user.last || ''); } }, [user]);
  useEffect(() => { if (!user) return; api<{ profiles: unknown[] }>('GET', '/api/profiles').then(x => setProfiles(x.ok ? (x.j.profiles || []).length : null)); }, [user]);

  if (!ready) return <main id="main" className="container acct-page app-page"><div className="card acct-gate"><p className="hint">Loading…</p></div></main>;
  if (!user) return (
    <main id="main" className="container acct-page app-page">
      <div className="card acct-gate">
        <span className="avatar xl" aria-hidden="true"><Icon name="user" /></span>
        <h2>{cfg?.accounts ? 'Log in to see your account' : 'Accounts are not available right now'}</h2>
        <p className="hint">Your saved profiles, job alerts and sign-in settings live here.</p>
        {cfg?.accounts && <div className="actions"><button type="button" className="pri" onClick={() => openAuth('', 'login')}>Log in</button><button type="button" onClick={() => openAuth('', 'signup')}>Create an account</button></div>}
      </div>
    </main>
  );

  const ways = [user.password && 'Password', user.google && 'Google', !user.password && !user.google && 'Email code'].filter(Boolean) as string[];
  async function saveName(e: React.FormEvent) {
    e.preventDefault(); if (!first.trim()) return setNameNote({ t: 'Enter your first name.', bad: true });
    setBusy('name'); const x = await api<{ user: User }>('PUT', '/api/me', { first, last }); setBusy('');
    if (!x.ok) return setNameNote({ t: x.j.message || 'Could not save.', bad: true });
    setUser(x.j.user, 'update'); setNameNote({ t: 'Saved.' });
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (user!.password && !cur) return setPwNote({ t: 'Enter your current password.', bad: true });
    if (pw.length < 8) return setPwNote({ t: 'Use at least 8 characters.', bad: true });
    setBusy('pw'); const x = await api<{ user: User }>('POST', '/api/me/password', { current: cur, password: pw }); setBusy('');
    if (!x.ok) return setPwNote({ t: x.j.message || 'Could not save.', bad: true });
    setCur(''); setPw(''); setUser(x.j.user, 'update'); setPwNote({ t: 'Password saved.' });
  }
  async function sendCode() {
    setBusy('v'); const x = await api('POST', '/api/me/verify/send', {}); setBusy('');
    if (!x.ok) return setVNote({ t: x.j.message || 'Could not send the code.', bad: true });
    setCodeSent(true); setVNote({ t: 'Code sent. Check your inbox and spam folder.' });
  }
  async function verify() {
    setBusy('v'); const x = await api<{ user: User }>('POST', '/api/me/verify', { code: code.trim() }); setBusy('');
    if (!x.ok) return setVNote({ t: x.j.message || 'That code is wrong or has expired.', bad: true });
    setUser(x.j.user, 'update');
  }
  async function remove() {
    setBusy('del'); const x = await api('POST', '/api/me/delete', {});
    if (x.ok) { location.href = '/'; return; } setBusy('');
  }

  return (
    <main id="main" className="container acct-page app-page">
      <section className="card acct-hero">
        <span className="avatar xl" aria-hidden="true">{initials(user)}</span>
        <div>
          <h2>{(user.first + ' ' + user.last).trim() || 'Your account'}</h2>
          <p className="note">{user.email}{user.created ? ' · Member since ' + since(user.created) : ''}</p>
          <p className="acct-badges">{ways.map(w => <span className="pill" key={w}>{w}</span>)}<span className={'pill ' + (user.verified ? 'ok' : 'warn')}>{user.verified ? 'Email confirmed' : 'Email not confirmed'}</span></p>
        </div>
      </section>

      {!user.verified && (
        <div className="banner warn" id="verifyBox">
          <b>Confirm your email address.</b> We need to know {user.email} is yours before we send you job alerts.
          {cfg?.email ? (!codeSent
            ? <div className="actions"><button type="button" className="pri" disabled={busy === 'v'} onClick={sendCode}>Email me a code</button></div>
            : <div className="row two"><div><label htmlFor="vCode">6-digit code</label><input id="vCode" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="123456" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); verify(); } }} /></div>
                <div className="actions" style={{ alignSelf: 'end', margin: 0 }}><button type="button" className="pri" disabled={busy === 'v'} onClick={verify}>Confirm</button></div></div>)
            : <p className="note">Email confirmation is not turned on yet. Signing in with Google using this address also confirms it.</p>}
          {vNote.t && <p className={'note' + (vNote.bad ? ' bad' : '')} role="alert">{vNote.t}</p>}
        </div>
      )}

      <section className="card">
        <h2>Your details</h2>
        <form noValidate onSubmit={saveName}>
          <div className="row two">
            <div><label htmlFor="nFirst">First name</label><input id="nFirst" autoComplete="given-name" maxLength={60} value={first} onChange={e => setFirst(e.target.value)} /></div>
            <div><label htmlFor="nLast">Last name</label><input id="nLast" autoComplete="family-name" maxLength={60} value={last} onChange={e => setLast(e.target.value)} /></div>
          </div>
          <label htmlFor="nEmail">Email</label><input id="nEmail" type="email" disabled value={user.email} />
          <p className="note">Your email is your login, so it cannot be changed here.</p>
          <div className="actions"><button type="submit" className="pri" disabled={busy === 'name'}>Save details</button><NoteText n={nameNote} /></div>
        </form>
      </section>

      <section className="card">
        <h2>{user.password ? 'Change password' : 'Add a password'}</h2>
        <p className="hint">{user.password ? 'Use at least 8 characters.' : 'You sign in with ' + (user.google ? 'Google' : 'an email code') + ' now. Add a password to also log in with your email and password.'}</p>
        <form noValidate onSubmit={savePw}>
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          {user.password && <><label htmlFor="pwCur">Current password</label><input id="pwCur" type="password" autoComplete="current-password" maxLength={128} value={cur} onChange={e => setCur(e.target.value)} /></>}
          <label htmlFor="pwNew">New password</label><input id="pwNew" type="password" autoComplete="new-password" maxLength={128} placeholder="At least 8 characters" value={pw} onChange={e => setPw(e.target.value)} />
          <div className="actions"><button type="submit" className="pri" disabled={busy === 'pw'}>Save password</button><NoteText n={pwNote} /></div>
          <p className="note">Saving a new password signs you out on your other devices.</p>
        </form>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <ul className="acct-links">
          <li><Link href="/builder/"><MI name="doc" /><span><b>Saved profiles</b><small>{profiles == null ? 'Profiles that prefill the Resume Builder' : profiles ? profiles + ' saved profile' + (profiles === 1 ? '' : 's') : 'No saved profiles yet'}</small></span></Link></li>
          <li data-feature="jobs"><Link href="/jobs/"><MI name="bell" /><span><b>Job alerts</b><small>What we search for and how often we email you</small></span></Link></li>
        </ul>
      </section>

      <section className="card danger-zone">
        <h2>Log out or delete your account</h2>
        <div className="actions"><button type="button" onClick={() => logout()}>Log out</button><button type="button" className="danger" onClick={() => setDel(true)}>Delete my account</button></div>
        {del && (
          <div>
            <p className="banner warn">This deletes your account, every saved profile, your job alerts and sent-job history. It cannot be undone. Type <b>DELETE</b> to confirm.</p>
            <div className="row two"><div><label htmlFor="delWord">Type DELETE</label><input id="delWord" autoComplete="off" value={word} onChange={e => setWord(e.target.value)} /></div>
              <div className="actions" style={{ alignSelf: 'end', margin: 0 }}><button type="button" className="danger" disabled={word.trim() !== 'DELETE' || busy === 'del'} onClick={remove}>Delete everything</button><button type="button" onClick={() => { setDel(false); setWord(''); }}>Cancel</button></div></div>
          </div>
        )}
      </section>
    </main>
  );
}
