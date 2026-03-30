import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../api'

export default function Libreria() {
  const [documenti, setDocumenti] = useState([])
  const [totale, setTotale] = useState(0)
  const [pagine, setPagine] = useState(1)
  const [pagina, setPagina] = useState(1)
  const [cerca, setCerca] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const carica = async (p = 1, q = query) => {
    setLoading(true)
    try {
      const params = { pagina: p, per_pagina: 30 }
      if (q) params.cerca = q
      const r = await api.get('/documenti', { params })
      setDocumenti(r.data.documenti)
      setTotale(r.data.totale)
      setPagine(r.data.pagine)
      setPagina(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carica() }, [])

  const handleCerca = (e) => {
    e.preventDefault()
    setQuery(cerca)
    carica(1, cerca)
  }

  const scaricaOriginale = (id) => {
    window.open(`${api.defaults.baseURL}/originale/${id}`, '_blank')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '32px', marginBottom: '4px' }}>Libreria Documenti</h2>
          <p style={{ color: 'var(--text2)' }}>{totale.toLocaleString('it')} documenti nell'archivio</p>
        </div>
      </div>

      {/* Ricerca */}
      <form onSubmit={handleCerca} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca per nome o contenuto..." style={{ paddingLeft: '40px' }} />
        </div>
        <button type="submit" className="btn-secondary">Filtra</button>
        {query && <button type="button" className="btn-secondary" onClick={() => { setCerca(''); setQuery(''); carica(1, '') }}>Azzera</button>}
      </form>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <span className="spinner" style={{ width: '28px', height: '28px' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {documenti.map(doc => (
              <div key={doc.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <FileText size={20} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.nome_file.replace('.txt', '')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {doc.anteprima}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary btn-sm" onClick={() => navigate(`/documento/${doc.id}`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <ExternalLink size={13} /> Leggi
                  </button>
                  {doc.file_originale && (
                    <button className="btn-secondary btn-sm" onClick={() => scaricaOriginale(doc.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginazione */}
          {pagine > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '32px' }}>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina - 1)} disabled={pagina <= 1}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={14} /> Precedente
              </button>
              <span style={{ color: 'var(--text2)', fontSize: '14px' }}>Pagina {pagina} di {pagine}</span>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina + 1)} disabled={pagina >= pagine}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Successiva <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
