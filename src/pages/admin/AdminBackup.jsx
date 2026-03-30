import { useState, useEffect } from 'react'
import { Download, RefreshCw, Play, Database } from 'lucide-react'
import api from '../../api'

export default function AdminBackup() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [eseguendo, setEseguendo] = useState(false)
  const [msg, setMsg] = useState('')

  const carica = () => {
    setLoading(true)
    api.get('/admin/backup').then(r => setBackups(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { carica() }, [])

  const eseguiBackup = async () => {
    setEseguendo(true); setMsg('')
    try {
      const r = await api.post('/admin/backup')
      setMsg(r.data.messaggio)
      carica()
    } catch { setMsg('Errore durante il backup') }
    finally { setEseguendo(false) }
  }

  const scarica = (nome) => {
    window.open(`${api.defaults.baseURL}/admin/backup/${nome}`, '_blank')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '32px', marginBottom: '4px' }}>Backup Database</h2>
          <p style={{ color: 'var(--text2)' }}>Backup automatico ogni notte alle 2:00 — retention 7 giorni</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={carica} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} /> Aggiorna
          </button>
          <button className="btn-primary" onClick={eseguiBackup} disabled={eseguendo}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {eseguendo ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <Play size={14} />}
            Backup ora
          </button>
        </div>
      </div>

      {msg && <div className={msg.includes('Errore') ? 'error-msg' : 'success-msg'} style={{ marginBottom: '20px' }}>{msg}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}><span className="spinner" /></div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
            <Database size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>Nessun backup disponibile</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Nome file</th><th>Data</th><th>Dimensione</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{b.nome}</td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>
                    {new Date(b.data).toLocaleString('it')}
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>{b.dimensione_mb} MB</td>
                  <td>
                    <button className="btn-secondary btn-sm" onClick={() => scarica(b.nome)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={13} /> Scarica
                    </button>
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
