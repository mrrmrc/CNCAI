import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../../api'

export default function AdminLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)

  const carica = (p = 1) => {
    setLoading(true)
    api.get('/admin/log', { params: { pagina: p, per_pagina: 50 } })
      .then(r => { setLogs(r.data); setPagina(p) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { carica() }, [])

  const azioneColor = (azione) => {
    if (azione === 'login') return 'var(--green)'
    if (azione === 'ricerca') return 'var(--gold)'
    return 'var(--text2)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '32px' }}>Log Accessi</h2>
        <button className="btn-secondary" onClick={() => carica(1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={14} /> Aggiorna
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}><span className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data / Ora</th>
                <th>Utente</th>
                <th>Azione</th>
                <th>IP</th>
                <th>Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td style={{ fontSize: '13px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {new Date(log.creato_il).toLocaleString('it')}
                  </td>
                  <td style={{ fontWeight: '500' }}>{log.username || '—'}</td>
                  <td>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: azioneColor(log.azione), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {log.azione}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'monospace' }}>{log.ip}</td>
                  <td style={{ fontSize: '13px', color: 'var(--text2)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.dettagli || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginazione */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
        {pagina > 1 && (
          <button className="btn-secondary btn-sm" onClick={() => carica(pagina - 1)}>← Precedente</button>
        )}
        <span style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--text2)' }}>Pagina {pagina}</span>
        {logs.length === 50 && (
          <button className="btn-secondary btn-sm" onClick={() => carica(pagina + 1)}>Successiva →</button>
        )}
      </div>
    </div>
  )
}
