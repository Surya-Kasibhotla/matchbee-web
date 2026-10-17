'use client';
/* App-wide state: server settings and feature flags (/api/config), the signed-in user (/api/me) and the sign-in dialog.
   useApp() gives { cfg, user, how, version, openAuth, closeAuth, setUser, logout }.
   "how" says why the user last changed: init | login | signup | google | logout | update. Pages watch `version`.
   Links: #login and #signup open the dialog; #reset=<token> (from the reset email) opens "choose a new password". */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type Config, type User } from '@/lib/api';
import { AuthDialog, type AuthMode } from './AuthDialog';

type How = 'init' | 'login' | 'signup' | 'google' | 'logout' | 'update';
type Dialog = { open: boolean; mode: AuthMode; msg: string; resetToken: string };
type Ctx = {
  cfg: Config | null; user: User | null; ready: boolean; how: How; version: number;
  openAuth: (msg?: string, mode?: AuthMode) => void; closeAuth: () => void;
  setUser: (u: User | null, how: How) => void; logout: () => Promise<void>;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside AppProvider'); return c; };

const OFF: Config = { accounts: false, password: false, reset: false, google: false, email: false, features: {} };
function applyFeatures(f: Record<string, boolean>) {
  Object.keys(f || {}).forEach(k => document.documentElement.classList.toggle('f-' + k, !!f[k]));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [how, setHow] = useState<How>('init');
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>({ open: false, mode: 'login', msg: '', resetToken: '' });

  const setUser = useCallback((u: User | null, h: How) => { setUserState(u); setHow(h); setVersion(v => v + 1); }, []);
  const openAuth = useCallback((msg = '', mode: AuthMode = 'login') => setDialog(d => ({ ...d, open: true, msg, mode })), []);
  const closeAuth = useCallback(() => setDialog(d => ({ ...d, open: false })), []);
  const logout = useCallback(async () => { await api('POST', '/api/auth/logout', {}); setUser(null, 'logout'); }, [setUser]);

  // classes other markup and CSS rely on: has-accounts, signed-in, f-<feature>
  useEffect(() => { document.documentElement.classList.toggle('signed-in', !!user); }, [user]);

  useEffect(() => {
    try { const v: unknown = JSON.parse(sessionStorage.getItem('mb_features') || '{}'); if (v && typeof v === 'object') applyFeatures(Object.fromEntries(Object.entries(v).map(([k, on]) => [k, on === true]))); } catch { /* private mode */ }
    let alive = true;
    (async () => {
      const x = await api<Config>('GET', '/api/config');
      if (!alive) return;
      const c = x.ok ? { ...OFF, ...x.j } : OFF;
      setCfg(c); applyFeatures(c.features); document.documentElement.classList.toggle('has-accounts', !!c.accounts);
      try { sessionStorage.setItem('mb_features', JSON.stringify(c.features || {})); } catch { /* ignore */ }
      const q = location.search, via: How = q.includes('signin=ok') ? 'google' : 'init';
      if (q.includes('signin=')) history.replaceState(null, '', location.pathname + location.hash);
      let u: User | null = null;
      if (c.accounts) { const m = await api<{ user: User | null }>('GET', '/api/me'); u = m.ok ? m.j.user : null; }
      if (!alive) return;
      setUser(u, via); setReady(true);
      if (q.includes('signin=failed')) openAuth('Google sign-in did not complete. Please try again.');
    })();
    return () => { alive = false; };
  }, [setUser, openAuth]);

  // #login, #signup, #reset=<token>
  useEffect(() => {
    if (!ready) return;
    const fromHash = () => {
      const h = location.hash, m = h.match(/^#reset=([a-f0-9]{48})$/);
      if (m) { history.replaceState(null, '', location.pathname + location.search); setDialog({ open: true, mode: 'reset', msg: '', resetToken: m[1] }); return; }
      if (h === '#login' || h === '#signup') { history.replaceState(null, '', location.pathname + location.search); if (!user) openAuth('', h.slice(1) as AuthMode); }
    };
    fromHash(); window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [ready, user, openAuth]);

  const value = useMemo<Ctx>(() => ({ cfg, user, ready, how, version, openAuth, closeAuth, setUser, logout }), [cfg, user, ready, how, version, openAuth, closeAuth, setUser, logout]);
  return (
    <AppCtx.Provider value={value}>
      {children}
      <AuthDialog state={dialog} setState={setDialog} cfg={cfg || OFF} onUser={(u, h) => setUser(u, h)} />
    </AppCtx.Provider>
  );
}
