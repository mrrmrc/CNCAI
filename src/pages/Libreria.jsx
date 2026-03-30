import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, FileText, Download, ExternalLink,
  ChevronLeft, ChevronRight, Trash2, Search, ArrowLeft, FolderOpen
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

/* ─── Scheda Categoria (vista scaffale) ─── */
function CardCategoria({ cat, onClick }) {
  const colori = [
    '#c9a84c', '#4c8cc9', '#4cc97a', '#c94c4c',
    '#9a4cc9', '#c97a4c', '#4cbfc9', '#c94c8c'
  ]
  const color = colori[Math.abs(cat.nome.split('').reduce((a,c) => a + c.charCodeAt(0),0)) % colori.length]

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${color}55`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '10px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${color}22` }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FolderOpen size={22} style={{ color }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>{cat.nome}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
            {cat.totale.toLocaleString('it')} {cat.totale === 1 ? 'documento' : 'documenti'}
          </div>
        </div>
        <div style={{
          background: color + '22', color, borderRadius: '20px',
          padding: '4px 10px', fontSize: '12px', fontWeight: '700'
        }}>
          {cat.totale}
        </div>
      </div>
      <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: '100%', opacity: 0.4 }} />
      </div>
    </div>
  )
}

/* ─── Vista documenti di una categoria ─── */
function VistaDocumenti({ categoria, onBack, isAdmin }) {
  const navigate = useNavigate()
  const [documenti, setDocumenti] = useState([])
  const [totale, setTotale] = useState(0)
  const [pagine, setPagine] = useState(1)
  const [pagina, setPagina] = useState(1)
  const [cerca, setCerca] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const carica = useCallback(async (p = 1, q = '') => {
    setLoading(true)
    try {
      const params = { pagina: p, per_pagina: 30, categoria }
      if (q) params.cerca = q
      const r = await api.get('/documenti', { params })
      setDocumenti(r.data.documenti)
      setTotale(r.data.totale)
      setPagine(r.data.pagine)
      setPagina(p)
    } finally {
      setLoading(false)
    }
  }, [categoria])

  useEffect(() => { carica() }, [carica])

  const scarica = async (id, nome) => {
    try {
      const { data } = await api.get(`/originale/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a'); a.href = url
      a.setAttribute('download', nome); document.body.appendChild(a)
      a.click(); document.body.removeChild(a)
    } catch { alert("Impossibile scaricare il file.") }
  }

  const elimina = async (id, nome) => {
    if (!window.confirm(`Eliminare definitivamente "${nome}" e i suoi vettori AI?`)) return
    try {
      await api.delete(`/admin/documenti/${id}`)
      carica(pagina, query)
    } catch { alert("Errore durante l'eliminazione.") }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Scaffale
        </button>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '2px' }}>{categoria}</h2>
          <p style={{ color: 'var(--text2)', fontSize: '13px' }}>{totale.toLocaleString('it')} documenti</p>
        </div>
      </div>

      {/* Ricerca */}
      <form onSubmit={e => { e.preventDefault(); setQuery(cerca); carica(1, cerca) }}
        style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="Cerca in questa categoria..." style={{ paddingLeft: '36px' }} />
        </div>
        <button type="submit" className="btn-secondary">Filtra</button>
        {query && <button type="button" className="btn-secondary" onClick={() => { setCerca(''); setQuery(''); carica(1, '') }}>×</button>}
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <span className="spinner" style={{ width: '28px', height: '28px' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
            {documenti.map(doc => (
              <div key={doc.id} className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <FileText size={18} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.nome_file.replace('.txt', '')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {doc.anteprima}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-secondary btn-sm" onClick={() => navigate(`/documento/${doc.id}`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <ExternalLink size={12} /> Leggi
                  </button>
                  {doc.file_originale && (
                    <button className="btn-secondary btn-sm" onClick={() => scarica(doc.id, doc.nome_file)}
                      style={{ display: 'flex', alignItems: 'center' }}>
                      <Download size={12} />
                    </button>
                  )}
                  {isAdmin && (
                    <button className="btn-secondary btn-sm" onClick={() => elimina(doc.id, doc.nome_file)}
                      style={{ color: '#ff6b6b', borderColor: '#4a2525' }} title="Elimina">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginazione */}
          {pagine > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '28px' }}>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina - 1, query)} disabled={pagina <= 1}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={14} /> Prec
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Pag. {pagina} / {pagine}</span>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina + 1, query)} disabled={pagina >= pagine}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Succ <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Pagina principale: Scaffale Categorie ─── */
export default function Libreria() {
  const { utente } = useAuth()
  const [categorie, setCategorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaSelezionata, setCategoriaSelezionata] = useState(null)
  const [totaleDoc, setTotaleDoc] = useState(0)

  useEffect(() => {
    api.get('/categorie')
      .then(r => {
        setCategorie(r.data)
        setTotaleDoc(r.data.reduce((s, c) => s + c.totale, 0))
      })
      .finally(() => setLoading(false))
  }, [])

  if (categoriaSelezionata) {
    return (
      <VistaDocumenti
        categoria={categoriaSelezionata}
        onBack={() => setCategoriaSelezionata(null)}
        isAdmin={utente?.ruolo === 'admin'}
      />
    )
  }

  return (
    <div>
      {/* Header scaffale */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <BookOpen size={28} style={{ color: 'var(--gold)' }} />
          <h2 style={{ fontSize: '32px' }}>Scaffale Documenti</h2>
        </div>
        <p style={{ color: 'var(--text2)' }}>
          {categorie.length} categorie &nbsp;·&nbsp;{' '}
          {totaleDoc.toLocaleString('it')} documenti totali
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>
          Clicca su una categoria per sfogliare i documenti al suo interno
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <span className="spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      ) : categorie.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px', color: 'var(--text3)' }}>
          <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>Nessuna categoria trovata. Carica i primi documenti.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {categorie.map(cat => (
            <CardCategoria
              key={cat.nome}
              cat={cat}
              onClick={() => setCategoriaSelezionata(cat.nome)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
