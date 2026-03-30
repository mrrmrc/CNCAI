import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Edit2, Check, X } from 'lucide-react'
import api from '../../api'

export default function AdminUtenti() {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuovo, setNuovo] = useState({ username: '', password: '', ruolo: 'user' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const carica = () => {
    api.get('/admin/utenti').then(r => setUtenti(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { carica() }, [])

  const creaUtente = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    try {
      await api.post('/admin/utenti', nuovo)
      setMsg('Utente creato con successo')
      setNuovo({ username: '', password: '', ruolo: 'user' })
      carica()
    } catch { setError('Errore nella creazione utente') }
  }

  const toggleAttivo = async (u) => {
    await api.put(`/admin/utenti/${u.id}`, { attivo: !u.attivo })
    carica()
  }

  const elimina = async (id) => {
    if (!confirm('Eliminare questo utente?')) return
    await api.delete(`/admin/utenti/${id}`)
    carica()
  }

  return (
    <div>
      <h2 style={{ fontSize: '32px', marginBottom: '24px' }}>Gestione Utenti</h2>

      {/* Crea nuovo utente */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} style={{ color: 'var(--gold)' }} /> Nuovo Utente
        </h3>
        <form onSubmit={creaUtente} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Username</label>
            <input value={nuovo.username} onChange={e => setNuovo({...nuovo, username: e.target.value})} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Password</label>
            <input type="password" value={nuovo.password} onChange={e => setNuovo({...nuovo, password: e.target.value})} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)' }}>Ruolo</label>
            <select value={nuovo.ruolo} onChange={e => setNuovo({...nuovo, ruolo: e.target.value})}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Crea</button>
        </form>
        {msg && <div className="success-msg" style={{ marginTop: '12px' }}>{msg}</div>}
        {error && <div className="error-msg" style={{ marginTop: '12px' }}>{error}</div>}
      </div>

      {/* Lista utenti */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '32px', textAlign: 'center' }}><span className="spinner" /></div> : (
          <table>
            <thead>
              <tr><th>Username</th><th>Ruolo</th><th>Stato</th><th>Ultimo accesso</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {utenti.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: '500' }}>{u.username}</td>
                  <td><span className={`badge badge-${u.ruolo}`}>{u.ruolo}</span></td>
                  <td>
                    <span className={`badge badge-${u.attivo ? 'ok' : 'err'}`}>
                      {u.attivo ? 'Attivo' : 'Disabilitato'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>
                    {u.ultimo_accesso ? new Date(u.ultimo_accesso).toLocaleString('it') : 'Mai'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary btn-sm" onClick={() => toggleAttivo(u)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {u.attivo ? <><X size={12} /> Disabilita</> : <><Check size={12} /> Attiva</>}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => elimina(u.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
    </div>
  )
}
