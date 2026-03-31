import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, FileText, Download, ExternalLink, Trash2,
  Search, ArrowLeft, FolderOpen, Pencil, Check, X,
  LayoutGrid, List, AlignLeft, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import DocumentoModal from '../components/DocumentoModal'
import api from '../api'

// ─── Card Categoria ───────────────────────────────────────
function CardCategoria({ cat, onClick, isAdmin, onRinomina, onElimina }) {
  const [editing, setEditing] = useState(false)
  const [nuovoNome, setNuovoNome] = useState(cat.nome)

  const colori = ['#c9a84c','#4c8cc9','#4cc97a','#c94c4c','#9a4cc9','#c97a4c','#4cbfc9','#c94c8c']
  const color = colori[Math.abs(cat.nome.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % colori.length]

  const salvaRinomina = async (e) => {
    e.stopPropagation()
    if (!nuovoNome.trim() || nuovoNome.trim() === cat.nome) { setEditing(false); return }
    await onRinomina(cat.nome, nuovoNome.trim())
    setEditing(false)
  }

  const handleElimina = (e) => {
    e.stopPropagation()
    if (window.confirm(`Eliminare la raccolta "${cat.nome}" e tutti i suoi ${cat.totale} documenti?`)) onElimina(cat.nome)
  }

  return (
    <div
      onClick={editing ? undefined : onClick}
      style={{
        position: 'relative',
        background: `linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(255,255,255,0.1) 15%, rgba(255,255,255,0.1) 18%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 85%, rgba(0,0,0,0.5) 100%), ${color}`,
        borderLeft: '1px solid rgba(255,255,255,0.2)',
        borderRight: '2px solid rgba(0,0,0,0.4)',
        borderRadius: '4px 8px 8px 4px',
        padding: '24px 16px',
        cursor: editing ? 'default' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '280px',
        boxShadow: '4px 4px 15px rgba(0,0,0,0.5), inset 2px 0 5px rgba(255,255,255,0.1)',
        overflow: 'hidden'
      }}
      onMouseEnter={e => {
        if (!editing) {
          e.currentTarget.style.transform = 'translateY(-15px) scale(1.02)';
          e.currentTarget.style.boxShadow = '15px 25px 35px rgba(0,0,0,0.7)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '4px 4px 15px rgba(0,0,0,0.5), inset 2px 0 5px rgba(255,255,255,0.1)';
      }}
    >
      {/* Profilo dorato superiore */}
      <div style={{ height: '4px', borderTop: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(0,0,0,0.3)', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)', marginBottom: '10px' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
            <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvaRinomina(e); if (e.key === 'Escape') setEditing(false) }}
              autoFocus style={{ fontSize: '12px', padding: '4px', width: '100%', background: 'rgba(255,255,255,0.9)', color: '#000' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontWeight: '800',
              fontSize: '17px',
              fontFamily: 'Cormorant Garamond, serif',
              color: '#fff',
              lineHeight: '1.2',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {cat.nome.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '12px' }}>
          {cat.totale.toLocaleString('it')} VOL.
        </div>
        
        {/* Controlli Admin (solo su hover o sempre piccoli?) */}
        {isAdmin && !editing && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <button onClick={e => { e.stopPropagation(); setEditing(true) }}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', color: '#fff', padding: '4px' }} title="Rinomina"><Pencil size={12} /></button>
            <button onClick={handleElimina}
              style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', cursor: 'pointer', color: '#f87171', padding: '4px' }} title="Elimina"><Trash2 size={12} /></button>
          </div>
        )}

        {/* Profilo dorato inferiore */}
        <div style={{ height: '4px', borderTop: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(0,0,0,0.3)', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)' }} />
      </div>
    </div>
  )
}

// ─── Vista Documenti ──────────────────────────────────────
function VistaDocumenti({ categoria, onBack, isAdmin }) {
  const navigate = useNavigate()
  const [documenti, setDocumenti] = useState([])
  const [totale, setTotale]       = useState(0)
  const [pagine, setPagine]       = useState(1)
  const [pagina, setPagina]       = useState(1)
  const [cerca, setCerca]         = useState('')
  const [query, setQuery]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [vista, setVista]         = useState('lista')   // 'griglia' | 'lista' | 'compatta'
  const [modalDocId, setModalDocId] = useState(null)

  const carica = useCallback(async (p=1, q='') => {
    setLoading(true)
    try {
      const params = { pagina:p, per_pagina:30, categoria }
      if (q) params.cerca = q
      const r = await api.get('/libreria', { params })
      setDocumenti(r.data.documenti)
      setTotale(r.data.totale)
      setPagine(r.data.pagine)
      setPagina(p)
    } finally { setLoading(false) }
  }, [categoria])

  useEffect(() => { carica() }, [carica])

  const scarica = async (id, nome) => {
    try {
      const { data } = await api.get(`/originale/${id}`, { responseType:'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a'); a.href = url
      a.setAttribute('download', nome); document.body.appendChild(a)
      a.click(); document.body.removeChild(a)
    } catch { alert('Impossibile scaricare il file.') }
  }

  const elimina = async (id, nome) => {
    if (!window.confirm(`Eliminare definitivamente "${nome}"?`)) return
    try { await api.delete(`/admin/documenti/${id}`); carica(pagina, query) }
    catch { alert("Errore durante l'eliminazione.") }
  }

  const BtnVista = ({ id, icon: Icon, title }) => (
    <button
      onClick={() => setVista(id)}
      title={title}
      style={{
        background: vista===id ? 'rgba(201,168,76,0.2)' : 'var(--bg3)',
        border: vista===id ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--border)',
        color: vista===id ? 'var(--gold)' : 'var(--text3)',
        borderRadius:'6px', padding:'7px 10px', cursor:'pointer', display:'flex', alignItems:'center', transition:'0.15s'
      }}
    >
      <Icon size={15} />
    </button>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
        <button onClick={onBack} className="btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <ArrowLeft size={14} /> Scaffale
        </button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:'28px', marginBottom:'2px' }}>{categoria}</h2>
          <p style={{ color:'var(--text2)', fontSize:'13px' }}>{totale.toLocaleString('it')} documenti</p>
        </div>
      </div>

      {/* Barra ricerca + switcher vista */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center' }}>
        <form onSubmit={e => { e.preventDefault(); setQuery(cerca); carica(1, cerca) }} style={{ flex:1, display:'flex', gap:'8px' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca in questa raccolta..." style={{ paddingLeft:'36px', width:'100%', boxSizing:'border-box' }} />
          </div>
          <button type="submit" className="btn-secondary">Filtra</button>
          {query && <button type="button" className="btn-secondary" onClick={() => { setCerca(''); setQuery(''); carica(1,'') }}>×</button>}
        </form>

        {/* Switcher modalità */}
        <div style={{ display:'flex', gap:'4px', background:'var(--bg2)', padding:'4px', borderRadius:'8px', border:'1px solid var(--border)' }}>
          <BtnVista id="lista"    icon={List}        title="Vista lista" />
          <BtnVista id="griglia" icon={LayoutGrid}   title="Vista griglia" />
          <BtnVista id="compatta" icon={AlignLeft}   title="Vista compatta" />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'48px' }}><span className="spinner" style={{ width:'28px', height:'28px' }} /></div>
      ) : (
        <>
          {/* ── LISTA (stile fonti ricerca) ── */}
          {vista === 'lista' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {documenti.map(doc => (
                <div key={doc.id} className="card" style={{ padding:'16px', display:'flex', alignItems:'center', gap:'16px' }}>
                  <FileText size={22} style={{ color:'var(--gold)', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:'600', fontSize:'15px', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {doc.nome_file.replace('.txt','')}
                    </div>
                    {doc.anteprima && (
                      <div style={{ fontSize:'13px', color:'var(--text2)', marginTop:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'80%' }}>
                        {doc.anteprima}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                    <button className="btn-secondary btn-sm" onClick={() => setModalDocId(doc.id)}
                      style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <ExternalLink size={13} /> Leggi
                    </button>
                    {doc.file_originale ? (
                      <button className="btn-secondary btn-sm" onClick={() => scarica(doc.id, doc.nome_file)}
                        style={{ display:'flex', alignItems:'center', gap:'6px' }} title="Scarica originale">
                        <Download size={13} /> Scarica
                      </button>
                    ) : (
                      <span style={{ fontSize:'12px', color:'var(--text3)', fontStyle:'italic', alignSelf:'center' }}>Solo testo</span>
                    )}
                    {isAdmin && (
                      <button className="btn-secondary btn-sm" onClick={() => elimina(doc.id, doc.nome_file)}
                        style={{ color:'#ff6b6b', borderColor:'#4a2525', display:'flex', alignItems:'center' }} title="Elimina">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── GRIGLIA ── */}
          {vista === 'griglia' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'12px' }}>
              {documenti.map(doc => (
                <div key={doc.id} className="card" style={{ padding:'18px', display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:'rgba(201,168,76,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <FileText size={18} style={{ color:'var(--gold)' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:'600', fontSize:'14px', lineHeight:1.3, color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {doc.nome_file.replace('.txt','')}
                      </div>
                    </div>
                  </div>
                  {doc.anteprima && (
                    <div style={{ fontSize:'12px', color:'var(--text3)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {doc.anteprima}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'6px', marginTop:'auto' }}>
                    <button className="btn-secondary btn-sm" onClick={() => setModalDocId(doc.id)}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                      <ExternalLink size={12} /> Leggi
                    </button>
                    {doc.file_originale && (
                      <button className="btn-secondary btn-sm" onClick={() => scarica(doc.id, doc.nome_file)}
                        style={{ display:'flex', alignItems:'center', gap:'4px' }} title="Scarica">
                        <Download size={12} />
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn-secondary btn-sm" onClick={() => elimina(doc.id, doc.nome_file)}
                        style={{ color:'#ff6b6b', borderColor:'#4a2525', display:'flex', alignItems:'center' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── COMPATTA (tabella) ── */}
          {vista === 'compatta' && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
                    {['Documento','Anteprima','Azioni'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documenti.map((doc, i) => (
                    <tr key={doc.id} style={{ borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 16px', width:'30%' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <FileText size={14} style={{ color:'var(--gold)', flexShrink:0 }} />
                          <span style={{ fontSize:'13px', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'260px' }}>
                            {doc.nome_file.replace('.txt','')}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 16px', fontSize:'12px', color:'var(--text3)' }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:'400px' }}>
                          {doc.anteprima || '—'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 16px' }}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button className="btn-secondary btn-sm" onClick={() => setModalDocId(doc.id)}
                            style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'12px' }}>
                            <ExternalLink size={11} /> Leggi
                          </button>
                          {doc.file_originale && (
                            <button className="btn-secondary btn-sm" onClick={() => scarica(doc.id, doc.nome_file)}
                              style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'12px' }}>
                              <Download size={11} />
                            </button>
                          )}
                          {isAdmin && (
                            <button className="btn-secondary btn-sm" onClick={() => elimina(doc.id, doc.nome_file)}
                              style={{ color:'#ff6b6b', borderColor:'#4a2525', display:'flex', alignItems:'center' }}>
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginazione */}
          {pagine > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', marginTop:'28px' }}>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina-1, query)} disabled={pagina<=1}
                style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <ChevronLeft size={14} /> Prec
              </button>
              <span style={{ fontSize:'13px', color:'var(--text2)' }}>
                Pag. {pagina} / {pagine} &nbsp;·&nbsp; {totale.toLocaleString('it')} documenti
              </span>
              <button className="btn-secondary btn-sm" onClick={() => carica(pagina+1, query)} disabled={pagina>=pagine}
                style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                Succ <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal documento */}
      {modalDocId && (
        <DocumentoModal id={modalDocId} query="" onClose={() => setModalDocId(null)} />
      )}
    </div>
  )
}

// ─── Pagina principale: Scaffale ──────────────────────────
export default function Libreria() {
  const { utente } = useAuth()
  const [categorie, setCategorie]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [catSelezionata, setCatSelezionata] = useState(null)
  const [totaleDoc, setTotaleDoc]   = useState(0)

  const caricaCategorie = () => {
    setLoading(true)
    api.get('/categorie')
      .then(r => { setCategorie(r.data); setTotaleDoc(r.data.reduce((s,c) => s+c.totale, 0)) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { caricaCategorie() }, [])

  const handleRinomina = async (vecchio, nuovo) => {
    try {
      await api.put(`/admin/categorie/${encodeURIComponent(vecchio)}`, { nuovo_nome: nuovo })
      caricaCategorie()
    } catch (err) { alert('Errore: ' + (err.response?.data?.detail || err.message)) }
  }

  const handleElimina = async (nome) => {
    try {
      await api.delete(`/admin/categorie/${encodeURIComponent(nome)}`)
      caricaCategorie()
    } catch (err) { alert('Errore: ' + (err.response?.data?.detail || err.message)) }
  }

  const isAdmin = utente?.ruolo === 'admin'

  if (catSelezionata) {
    return <VistaDocumenti categoria={catSelezionata} onBack={() => setCatSelezionata(null)} isAdmin={isAdmin} />
  }

  return (
    <div>
      <div style={{ marginBottom:'32px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
          <BookOpen size={30} style={{ color:'var(--gold)' }} />
          <h2 style={{ fontSize:'34px' }}>Scaffale Documenti</h2>
        </div>
        <p style={{ color:'var(--text2)', fontSize:'15px' }}>
          {categorie.length} raccolte &nbsp;·&nbsp; {totaleDoc.toLocaleString('it')} documenti totali
        </p>
        {isAdmin && (
          <p style={{ fontSize:'13px', color:'var(--text3)', marginTop:'6px' }}>
            ✏️ Clicca la matita per rinominare una raccolta &nbsp;·&nbsp; 🗑️ il cestino per eliminarla
          </p>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'80px' }}>
          <span className="spinner" style={{ width:'32px', height:'32px' }} />
        </div>
      ) : categorie.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'64px', color:'var(--text3)' }}>
          <BookOpen size={48} style={{ opacity:0.3, marginBottom:'16px' }} />
          <p>Nessuna raccolta trovata. Carica i primi documenti.</p>
        </div>
      ) : (
        /* Vista Raccolte (Libri sullo scaffale) */
        <div style={{
          background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.5))',
          padding: '40px 32px',
          borderRadius: '24px',
          borderBottom: '12px solid #1a1a1a',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          minHeight: '600px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            columnGap: '2px',
            rowGap: '60px',
            width: '100%'
          }}>
            {categorie.map(cat => (
              <CardCategoria
                key={cat.nome}
                cat={cat}
                isAdmin={isAdmin}
                onClick={() => setCatSelezionata(cat.nome)}
                onRinomina={handleRinomina}
                onElimina={handleElimina}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
