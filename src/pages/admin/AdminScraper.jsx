import { useState, useEffect } from 'react'
import { Globe, Play, Loader, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import api from '../../api'

export default function AdminScraper() {
  const [url, setUrl]               = useState('')
  const [titolo, setTitolo]         = useState('')
  const [profondita, setProfondita] = useState(2)
  const [maxPagine, setMaxPagine]   = useState(200)
  const [loading, setLoading]       = useState(false)
  const [logs, setLogs]             = useState([])
  const [risultato, setRisultato]   = useState(null)   // { pagine_indicizzate, errori, dominio }
  const [storico, setStorico]       = useState([])
  const [loadingStorico, setLoadingStorico] = useState(true)

  const [scraperStatus, setScraperStatus] = useState({ attivo: false, pagine: 0, errori: 0, log: [], dominio: "" })

  useEffect(() => { caricaStorico() }, [])

  // Polling avanzamento scraper
  useEffect(() => {
    let interval;
    if (loading || scraperStatus.attivo) {
      interval = setInterval(() => {
        api.get('/admin/scraper-status')
          .then(r => {
            setScraperStatus(r.data)
            setLogs(r.data.log || [])
            if (!r.data.attivo && loading) {
              setLoading(false)
              setRisultato({ pagine_indicizzate: r.data.pagine, errori: r.data.errori, dominio: r.data.dominio })
              caricaStorico()
            }
          })
          .catch(() => {})
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [loading, scraperStatus.attivo])

  const caricaStorico = () => {
    setLoadingStorico(true)
    api.get('/admin/scraper')
      .then(r => setStorico(Array.isArray(r.data) ? r.data : []))
      .catch(console.error)
      .finally(() => setLoadingStorico(false))
  }

  const avviaScansione = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setLogs(["Inizializzazione..."])
    setRisultato(null)

    const urlNorm = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

    try {
      await api.post('/admin/scraper', {
        url: urlNorm,
        titolo: titolo.trim(),
        profondita: Number(profondita),
        max_pagine: Number(maxPagine),
      })
      // Il polling gestirà il resto
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      setLogs([`❌ Errore: ${msg}`])
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <h2 style={{ fontSize: '28px', margin: 0 }}>Web Scraper</h2>
        </div>
        <p style={{ color: 'var(--text2)', margin: 0 }}>
          Scansiona un sito web e indicizza le pagine nell'archivio per la ricerca AI
        </p>
      </div>

      {/* Form */}
      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <form onSubmit={avviaScansione}>
          <div style={{ display: 'grid', gap: '20px' }}>

            {/* TITOLO / CATEGORIA */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Titolo Raccolta / Categoria
              </label>
              <input
                type="text"
                value={titolo}
                onChange={e => setTitolo(e.target.value)}
                placeholder="Es: Catechesi 2024 (Opzionale)"
                disabled={loading}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '15px' }}
              />
            </div>

            {/* URL */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                URL del sito
              </label>
              <div style={{ position: 'relative' }}>
                <Globe size={15} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text3)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.camminoneocatecumenale.it"
                  disabled={loading}
                  style={{ paddingLeft: '40px', width: '100%', boxSizing: 'border-box', fontSize: '15px' }}
                />
              </div>
            </div>

            {/* Parametri */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Profondità <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '400' }}>(1–5)</span>
                </label>
                <input type="number" min={1} max={5} value={profondita}
                  onChange={e => setProfondita(e.target.value)} disabled={loading}
                  style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Max pagine
                </label>
                <input type="number" min={1} max={500} value={maxPagine}
                  onChange={e => setMaxPagine(e.target.value)} disabled={loading}
                  style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={loading || !url.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '15px' }}>
                {loading
                  ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scansione in corso...</>
                  : <><Play size={16} /> Avvia Scansione</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Log / risultato */}
      {(loading || logs.length > 0) && (
        <div className="card" style={{ padding: '0', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loading
                ? <Loader size={14} style={{ color: 'var(--gold)', animation: 'spin 1s linear infinite' }} />
                : risultato
                  ? <CheckCircle size={14} style={{ color: '#4ade80' }} />
                  : <XCircle size={14} style={{ color: '#f87171' }} />}
              <span style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>
                {loading ? 'Scansione in corso...' : risultato ? 'Completata' : 'Errore'}
              </span>
            </div>
            {risultato && (
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <span style={{ color: '#4ade80' }}>✅ {risultato.pagine_indicizzate} pagine</span>
                {risultato.errori > 0 && <span style={{ color: '#f87171' }}>⚠ {risultato.errori} errori</span>}
              </div>
            )}
          </div>
          <div style={{ background: '#0d1117', fontFamily: "'Courier New', monospace", fontSize: '12px', lineHeight: '1.7', padding: '16px 20px', maxHeight: '360px', overflowY: 'auto', color: '#c9d1d9' }}>
            {loading && (
              <div style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '10px', height: '10px' }} /> La scansione è in corso sul server, attendi...
              </div>
            )}
            {logs.map((riga, i) => (
              <div key={i} style={{
                color: riga.startsWith('ERR') ? '#f87171'
                  : riga.startsWith('OK') ? '#4ade80'
                  : '#c9d1d9'
              }}>
                <span style={{ color: '#6e7681', marginRight: '8px', userSelect: 'none' }}>{String(i + 1).padStart(3, '0')}</span>
                {riga}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storico scansioni */}
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
          Siti già scansionati
        </h3>

        {loadingStorico ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <span className="spinner" style={{ width: '24px', height: '24px' }} />
          </div>
        ) : storico.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>
            <Globe size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ margin: 0 }}>Nessuna scansione precedente</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                  {['Dominio', 'URL', 'Pagine', 'Data'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storico.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--gold)', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={13} style={{ flexShrink: 0 }} />
                        {s.dominio}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text2)', maxWidth: '240px' }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--text2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <ExternalLink size={11} style={{ flexShrink: 0 }} />{s.url}
                      </a>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: '12px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>
                        {s.pagine_indicizzate}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={11} />
                        {new Date(s.ultimo_scraping).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
