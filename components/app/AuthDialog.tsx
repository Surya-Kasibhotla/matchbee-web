'use client';
/* Log in / Sign up dialog. Modes: login, signup, forgot, code (ask for an email code), code2 (enter it),
   reset (new password from an emailed link). Talks to /api/auth/* in src/account.js. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, type ApiResult, type Config, type User } from '@/lib/api';
import { BrandMark } from '@/components/Brand';
import { GoogleLogo, Icon } from '@/components/Icon';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'code' | 'code2' | 'reset';
type State = { open: boolean; mode: AuthMode; msg: string; resetToken: string };
type How = 'login' | 'signup';

const TEXT: Record<AuthMode, { t: string; h: string; go: string }> = {
  login: { t: 'Welcome back', h: 'Log in to your saved profiles, job alerts and job-tailored resumes.', go: 'Log in' },
  signup: { t: 'Create your free account', h: 'Save profiles, get job alerts and tailor resumes to real jobs. Free, no card needed.', go: 'Create account' },
  forgot: { t: 'Reset your password', h: 'Enter your account email and we will send you a link to choose a new password.', go: 'Send reset link' },
  code: { t: 'Log in with an email code', h: 'We will email you a 6-digit code. No password needed.', go: 'Email me a code' },
  code2: { t: 'Check your email', h: 'Enter the 6-digit code we sent. It lasts 10 minutes.', go: 'Verify and log in' },
  reset: { t: 'Choose a new password', h: 'Pick a password you do not use anywhere else.', go: 'Save password and log in' },
};

export function AuthDialog({ state, setState, cfg, onUser }: {
  state: State; setState: React.Dispatch<React.SetStateAction<State>>; cfg: Config; onUser: (u: User, how: How) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null), path = usePathname();
  const [f, setF] = useState({ first: '', last: '', email: '', password: '', code: '' });
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ t: string; good?: boolean }>({ t: '' });
  const { mode } = state, T = TEXT[mode], social = (mode === 'login' || mode === 'signup') && cfg.google;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }));
  const go = (m: AuthMode, t = '') => { setState(s => ({ ...s, mode: m })); setNote({ t }); };

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (state.open && !d.open) { d.showModal(); setShow(false); setF(s => ({ ...s, password: '', code: '' })); setNote({ t: state.msg }); if (!cfg.accounts) setNote({ t: 'Accounts are not available right now. Please try again later.' }); }
    if (!state.open && d.open) d.close();
  }, [state.open, state.msg, cfg.accounts]);

  const done = (x: ApiResult<{ user: User }>, how: How) => {
    if (!x.ok) { setNote({ t: x.j.message || 'Something went wrong. Please try again.' }); return; }
    setState(s => ({ ...s, open: false, resetToken: '' })); onUser(x.j.user, how);
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setNote({ t: '' });
    const email = f.email.trim(), pw = f.password;
    if (mode !== 'reset' && !email) return setNote({ t: 'Enter your email address.' });
    if (mode === 'signup' && !f.first.trim()) return setNote({ t: 'Enter your first name.' });
    if ((mode === 'login' || mode === 'signup' || mode === 'reset') && !pw) return setNote({ t: 'Enter your password.' });
    if ((mode === 'signup' || mode === 'reset') && pw.length < 8) return setNote({ t: 'Use at least 8 characters for your password.' });
    setBusy(true);
    try {
      if (mode === 'login') done(await api<{ user: User }>('POST', '/api/auth/login', { email, password: pw }), 'login');
      else if (mode === 'signup') {
        const x = await api<{ user: User }>('POST', '/api/auth/signup', { first: f.first, last: f.last, email, password: pw });
        if (x.status === 409) { go('login', x.j.message); setF(s => ({ ...s, password: '' })); } else done(x, 'signup');
      } else if (mode === 'forgot') {
        const x = await api('POST', '/api/auth/forgot', { email });
        setNote(x.ok ? { t: 'If an account uses that email, a reset link is on its way. Check your inbox and spam folder.', good: true } : { t: x.j.message || 'Could not send the email.' });
      } else if (mode === 'code') {
        const x = await api('POST', '/api/auth/request', { email });
        if (x.ok) go('code2', 'If that address can receive email, a code is on its way.'); else setNote({ t: x.j.message || 'Could not send the code.' });
      } else if (mode === 'code2') done(await api<{ user: User }>('POST', '/api/auth/verify', { email, code: f.code.trim() }), 'login');
      else if (mode === 'reset') done(await api<{ user: User }>('POST', '/api/auth/reset', { token: state.resetToken, password: pw }), 'login');
    } finally { setBusy(false); }
  }
  const shows = (...m: AuthMode[]) => m.includes(mode);

  return (
    <dialog ref={ref} className="auth-dlg" aria-labelledby="authT" onClose={() => setState(s => ({ ...s, open: false }))}>
      <form className="dlg auth" noValidate onSubmit={submit}>
        <button type="button" className="icon-btn dlg-x" aria-label="Close" onClick={() => setState(s => ({ ...s, open: false }))}><Icon name="x" /></button>
        <div className="auth-head"><BrandMark size={44} /><h2 id="authT">{T.t}</h2><p className="hint">{T.h}</p></div>
        {shows('login', 'signup') && (
          <div className="tabs auth-tabs" role="tablist">
            {(['login', 'signup'] as const).map(m => <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'act' : ''} onClick={() => go(m)}>{m === 'login' ? 'Log in' : 'Sign up'}</button>)}
          </div>
        )}
        {social && <a className="btn gbtn" href={'/api/auth/google/start?next=' + encodeURIComponent(path || '/')}><GoogleLogo /><span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span></a>}
        {social && <div className="or"><span>or use your email</span></div>}
        {shows('signup') && (
          <div className="row two">
            <div><label htmlFor="afirst">First name</label><input id="afirst" autoComplete="given-name" maxLength={60} placeholder="Alex" value={f.first} onChange={set('first')} /></div>
            <div><label htmlFor="alast">Last name <span className="opt">optional</span></label><input id="alast" autoComplete="family-name" maxLength={60} placeholder="Morgan" value={f.last} onChange={set('last')} /></div>
          </div>
        )}
        {shows('login', 'signup', 'forgot', 'code', 'code2') && (
          <div><label htmlFor="aemail">Email</label><input id="aemail" type="email" inputMode="email" autoComplete="email" maxLength={120} placeholder="you@email.com" readOnly={mode === 'code2'} value={f.email} onChange={set('email')} /></div>
        )}
        {shows('login', 'signup', 'reset') && (
          <div>
            <div className="lbl-row"><label htmlFor="apass">Password</label>{mode === 'login' && <button type="button" className="lnk" onClick={() => go('forgot')}>Forgot password?</button>}</div>
            <div className="pw">
              <input id="apass" type={show ? 'text' : 'password'} maxLength={128} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
              <button type="button" className="pw-show" aria-controls="apass" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
            </div>
            {mode !== 'login' && <small className="pw-rule">At least 8 characters. A short sentence is easy to remember and hard to guess.</small>}
          </div>
        )}
        {shows('code2') && <div><label htmlFor="acode">6-digit code</label><input id="acode" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="123456" value={f.code} onChange={set('code')} /></div>}
        <p className={'auth-msg' + (note.t ? (note.good ? ' good' : ' bad') : '')} role="alert">{note.t}</p>
        {!(shows('login', 'signup') && !cfg.password) && <button type="submit" className="pri lg block" disabled={busy}>{T.go}</button>}
        <p className="auth-alt">
          {mode === 'login' && cfg.email && <button type="button" className="lnk" onClick={() => go('code')}>Email me a sign-in code instead</button>}
          {shows('forgot', 'code', 'code2', 'reset') && <button type="button" className="lnk" onClick={() => go('login')}>Back to log in</button>}
          {mode === 'login' && <span>New here? <button type="button" className="lnk strong" onClick={() => go('signup')}>Create an account</button></span>}
          {mode === 'signup' && <span>Already have an account? <button type="button" className="lnk strong" onClick={() => go('login')}>Log in</button></span>}
        </p>
        {mode === 'signup' && <p className="note auth-terms">By creating an account you agree to the <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy policy</a>. You can delete your account and data any time.</p>}
      </form>
    </dialog>
  );
}
