import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Edit2, Check, X, Eye, ChevronDown, ChevronUp, RefreshCw, LogIn, Search as SearchIcon, KeyRound } from 'lucide-react'
import api from '../../api'

const RUOLO_COLOR = { admin: '#c9a84c', user: '#4c9ac9' }

function LogUtente({ utenteId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/log', { params: { utente_filtro: utenteId, per_pagina: 50 } })
      .then(r => setLogs(r.data))
      .finally(() => setLoading(false))
  }, [utenteId])

  const azioneColor = (a) => a === 'login' ? '#4CAF50' : a === 'ricerca' ? '#c9a84c' : '#aaa'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Log attività utente</h3>
          <button className="btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <div style={{ padding: '40px', textAlign: 'center' }}><span className="spinner" /></div> : (
            <table>
              <thead>
                <tr>
                  <th>Data / Ora</th>
                  <th>Azione</th>
                  <th>IP</th>
                  <th>Dettagli</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>Nessuna attività registrata</td></tr>
                ) : logs.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{new Date(l.creato_il).toLocaleString('it')}</td>
                    <td><span style={{ fontSize: '11px', fontWeight: 700, color: azioneColor(l.azione), textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l.azione}</span></td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{l.ip}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.dettagli || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function EditUtente({ u, onSave, onClose }) {
  const [form, setForm] = useState({
    email: u.email || '',
    note: u.note || '',
    ruolo: u.ruolo,
    password: '',
    attivo: u.attivo
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const salva = async () => {
    setSaving(true); setErr('')
    try {
      const payload = { ruolo: form.ruolo, attivo: form.attivo, email: form.email, note: form.note }
      if (form.password) payload.password = form.password
      await api.put(`/admin/utenti/${u.id}`, payload)
      onSave()
    } catch { setErr('Errore nel salvataggio') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>✏️ Modifica: <span style={{ color: 'var(--gold)' }}>{u.username}</span></h3>
          <button className="btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@esempio.it" />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>Note interne</label>
            <input type="text" value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="Es: Equipe Roma, ospite evento..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>Ruolo</label>
              <select value={form.ruolo} onChange={e => setForm({...form, ruolo: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>Stato Account</label>
              <select value={form.attivo ? 'true' : 'false'} onChange={e => setForm({...form, attivo: e.target.value === 'true'})}>
                <option value="true">✅ Attivo</option>
                <option value="false">🚫 Disabilitato</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>
              <KeyRound size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Nuova Password (lasciar vuoto per non cambiare)
            </label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" />
          </div>
        </div>

        {err && <div className="error-msg" style={{ marginTop: '12px' }}>{err}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn-primary" onClick={salva} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {saving ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <Check size={14} />} Salva Modifiche
          </button>
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUtenti() {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuovo, setNuovo] = useState({ username: '', password: '', email: '', ruolo: 'user', note: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [editUtente, setEditUtente] = useState(null)
  const [logUtente, setLogUtente] = useState(null)
  const [cerca, setCerca] = useState('')

  const carica = () => {
    setLoading(true)
    api.get('/admin/utenti').then(r => setUtenti(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { carica() }, [])

  const creaUtente = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    try {
      await api.post('/admin/utenti', nuovo)
      setMsg(`✅ Utente "${nuovo.username}" creato con successo. Può già effettuare il login.`)
      setNuovo({ username: '', password: '', email: '', ruolo: 'user', note: '' })
      carica()
    } catch (err) {
      setError(`❌ ${err.response?.data?.detail || 'Errore nella creazione utente'}`)
    }
  }

  const elimina = async (u) => {
    if (!window.confirm(`⚠️ Eliminare l'utente "${u.username}" definitivamente?`)) return
    await api.delete(`/admin/utenti/${u.id}`)
    carica()
  }

  const utentiFiltrati = utenti.filter(u =>
    !cerca || u.username.toLowerCase().includes(cerca.toLowerCase()) || (u.email || '').toLowerCase().includes(cerca.toLowerCase())
  )

  return (
    <div>
      <h2 style={{ fontSize: '32px', marginBottom: '24px' }}>Gestione Utenti</h2>

      {/* Crea nuovo utente */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} style={{ color: 'var(--gold)' }} /> Nuovo Utente
        </h3>
        <form onSubmit={creaUtente} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Username *</label>
            <input value={nuovo.username} onChange={e => setNuovo({...nuovo, username: e.target.value})} required placeholder="nome.cognome" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Password *</label>
            <input type="password" value={nuovo.password} onChange={e => setNuovo({...nuovo, password: e.target.value})} required placeholder="Minimo 6 caratteri" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Email</label>
            <input type="email" value={nuovo.email} onChange={e => setNuovo({...nuovo, email: e.target.value})} placeholder="email@esempio.it" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Ruolo</label>
            <select value={nuovo.ruolo} onChange={e => setNuovo({...nuovo, ruolo: e.target.value})}>
              <option value="user">User (solo lettura)</option>
              <option value="admin">Admin (accesso totale)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Note interne</label>
            <input value={nuovo.note} onChange={e => setNuovo({...nuovo, note: e.target.value})} placeholder="Equipe Roma, ospite..." />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Crea Utente</button>
          </div>
        </form>
        {msg && <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(72,199,142,0.12)', border: '1px solid rgba(72,199,142,0.3)', borderRadius: '8px', fontSize: '13px', color: '#48c78e' }}>{msg}</div>}
        {error && <div className="error-msg" style={{ marginTop: '12px' }}>{error}</div>}
      </div>

      {/* Ricerca + lista */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca per username o email..." style={{ paddingLeft: '34px' }} />
          </div>
          <button className="btn-secondary" onClick={carica} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Aggiorna
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{utentiFiltrati.length} utenti</span>
        </div>

        {loading ? <div style={{ padding: '32px', textAlign: 'center' }}><span className="spinner" /></div> : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Note</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th>Creato il</th>
                <th>Ultimo Accesso</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {utentiFiltrati.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: '600' }}>{u.username}</td>
                  <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{u.email || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text3)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.note || '—'}</td>
                  <td><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: RUOLO_COLOR[u.ruolo] + '30', color: RUOLO_COLOR[u.ruolo] }}>{u.ruolo}</span></td>
                  <td><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: u.attivo ? 'rgba(72,199,142,0.15)' : 'rgba(255,107,107,0.15)', color: u.attivo ? '#48c78e' : '#ff6b6b' }}>{u.attivo ? '✅ Attivo' : '🚫 Disattivo'}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{u.creato_il ? new Date(u.creato_il).toLocaleDateString('it') : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{u.ultimo_accesso ? new Date(u.ultimo_accesso).toLocaleString('it') : <span style={{ color: 'var(--text3)' }}>Mai</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn-secondary btn-sm" onClick={() => setEditUtente(u)} title="Modifica utente" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit2 size={12} /> Modifica
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => setLogUtente(u)} title="Vedi log attività" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Eye size={12} /> Log
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => elimina(u)} title="Elimina utente"
                        style={{ color: '#ff6b6b', borderColor: '#4a2525' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editUtente && <EditUtente u={editUtente} onSave={() => { setEditUtente(null); carica() }} onClose={() => setEditUtente(null)} />}
      {logUtente && <LogUtente utenteId={logUtente.id} onClose={() => setLogUtente(null)} />}
    </div>
  )
}
