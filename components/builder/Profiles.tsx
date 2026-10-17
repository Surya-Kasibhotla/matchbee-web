'use client';
/* Saved profiles (signed in only): pick one to fill the form, create, edit or delete. Uses /api/profiles. */
import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/lib/builder/resume';

type ClientRow = { name: string; from: string; to: string; tech: string };
const toRows = (p: Profile): ClientRow[] => (p.clients && p.clients.length ? p.clients : [{ name: '', from: '', to: '', tech: [] }]).map(c => ({ name: c.name || '', from: c.from || '', to: c.to || '', tech: (c.tech || []).join(', ') }));

export function ProfileCard({ profiles, sel, onPick, onNew, onEdit, onDelete }: {
  profiles: Profile[]; sel: string; onPick: (id: string) => void; onNew: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="card">
      <h2>Your profiles</h2>
      <p className="hint">Pick a saved profile to fill in your details in one tap.</p>
      <div className="row two">
        <div><label htmlFor="profsel">Use profile</label>
          <select id="profsel" value={sel} onChange={e => onPick(e.target.value)}>
            <option value="">— none (type below) —</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="actions" style={{ margin: 0, alignSelf: 'end' }}>
          <button type="button" onClick={onNew}>New</button><button type="button" disabled={!sel} onClick={onEdit}>Edit</button><button type="button" disabled={!sel} onClick={onDelete}>Delete</button>
        </div>
      </div>
      <p className="note">Change your name or password, or delete your account, on <a href="/account/">My account</a>.</p>
    </div>
  );
}

/** Profile form: label, names, phone, email, role and clients with years and 5 to 10 technologies */
export function ProfileDialog({ open, initial, title, cancelLabel, onSave, onClose }: {
  open: boolean; initial: Profile; title: string; cancelLabel: string; onSave: (p: Profile) => Promise<string | null>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [p, setP] = useState(initial), [rows, setRows] = useState<ClientRow[]>(toRows(initial)), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setP(initial); setRows(toRows(initial)); setErr(''); } }, [open, initial]);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const f = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setP(s => ({ ...s, [k]: e.target.value }));
  const row = (i: number, k: keyof ClientRow) => (e: React.ChangeEvent<HTMLInputElement>) => setRows(r => r.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  async function save() {
    setBusy(true);
    const e = await onSave({ ...p, clients: rows.map(r => ({ name: r.name, from: r.from, to: r.to, tech: r.tech.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) })) });
    setBusy(false); if (e) setErr(e);
  }
  return (
    <dialog ref={ref} aria-labelledby="profT" onClose={onClose}>
      <form method="dialog" className="dlg" autoComplete="off" onSubmit={e => e.preventDefault()}>
        <h2 id="profT">{title}</h2>
        <p className="hint">Optional. Skip anything you like. Saved profiles prefill the form so you do not retype it.</p>
        <label htmlFor="pf-label">Profile name</label><input id="pf-label" placeholder="e.g. Frontend, Full stack, AI/ML" value={p.label} onChange={f('label')} />
        <div className="row two"><div><label htmlFor="pf-first">First name</label><input id="pf-first" placeholder="e.g. Alex" value={p.first} onChange={f('first')} /></div>
          <div><label htmlFor="pf-last">Last name</label><input id="pf-last" placeholder="e.g. Morgan" value={p.last} onChange={f('last')} /></div></div>
        <div className="row two"><div><label htmlFor="pf-phone">Phone</label><input id="pf-phone" type="tel" placeholder="e.g. (555) 123-4567" value={p.phone} onChange={f('phone')} /></div>
          <div><label htmlFor="pf-email">Email</label><input id="pf-email" type="email" placeholder="e.g. alex@email.com" value={p.email} onChange={f('email')} /></div></div>
        <label htmlFor="pf-role">Job role (optional)</label><input id="pf-role" placeholder="e.g. Frontend Engineer" value={p.role} onChange={f('role')} />
        <h3 className="sec">Clients / employers</h3>
        {rows.map((r, i) => (
          <div className="pcl" key={i}>
            <label>Client / employer</label><input placeholder="e.g. Acme Bank" value={r.name} onChange={row(i, 'name')} />
            <div className="row yc"><div><label>From (year)</label><input inputMode="numeric" placeholder="e.g. 2021" value={r.from} onChange={row(i, 'from')} /></div>
              <div><label>To (year or Present)</label><input placeholder="e.g. Present" value={r.to} onChange={row(i, 'to')} /></div></div>
            <label>Technologies used (5 to 10, comma separated)</label><input placeholder="e.g. React, Redux, TypeScript, Jest, Cypress" value={r.tech} onChange={row(i, 'tech')} />
            <div className="actions"><button type="button" onClick={() => setRows(x => x.filter((_, j) => j !== i))}>Remove</button></div>
          </div>
        ))}
        <div className="actions"><button type="button" onClick={() => rows.length < 12 && setRows(x => [...x, { name: '', from: '', to: '', tech: '' }])}>Add client</button></div>
        <p className="note" role="alert">{err}</p>
        <div className="actions"><button type="button" className="pri" disabled={busy} onClick={save}>Save profile</button><button type="button" onClick={onClose}>{cancelLabel}</button></div>
      </form>
    </dialog>
  );
}
