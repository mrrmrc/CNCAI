import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Download, ExternalLink } from 'lucide-react'
import Highlighter from 'react-highlight-words'
import DocumentoModal from '../components/DocumentoModal'
import api from '../api'

export default function Ricerca() {
  const [domanda, setDomanda] = useState('')
  const [risultato, setRisultato] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalDocId, setModalDocId] = useState(null)
  const [categorieDisponibili, setCategorieDisponibili] = useState([])
  const [selectedCats, setSelectedCats] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/categorie').then(r => setCategorieDisponibili(r.data)).catch(console.error)
  }, [])

  const toggleCategory = (cat) => {
    if (selectedCats.includes(cat)) setSelectedCats(selectedCats.filter(c => c !== cat))
    else setSelectedCats([...selectedCats, cat])
  }

  const cerca = async (e) => {
    e.preventDefault()
    if (!domanda.trim()) return
    setError(''); setLoading(true); setRisultato(null)
    try {
      const payload = { testo: domanda }
      if (selectedCats.length > 0) payload.categorie = selectedCats
      const r = await api.post('/cerca', payload)
      setRisultato(r.data)
    } catch {
      setError('Errore durante la ricerca. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const scaricaOriginale = async (id, nome) => {
    try {
      const { data } = await api.get(`/originale/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', nome || `documento_${id}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error("Errore download", e)
      alert("Impossibile scaricare l'originale. Potrebbe non essere disponibile.")
    }
  }

  const renderRispostaConLink = (testo, fonti) => {
    const paroleDomanda = domanda.split(/\s+/).filter(p => p.length > 2);

    if (!fonti || fonti.length === 0) {
      return (
        <Highlighter
          searchWords={paroleDomanda}
          autoEscape={true}
          textToHighlight={testo}
          highlightStyle={{ background: 'yellow', color: '#000', fontWeight: 'bold' }}
        />
      );
    }
    
    // Ordiniamo le fonti per lunghezza del nome decrescente per evitare match parziali errati
    const fontiOrdinate = [...fonti].sort((a, b) => b.nome.length - a.nome.length);
    let parti = [testo];
    
    fontiOrdinate.forEach(fonte => {
      const nomeSenzaExt = fonte.nome.replace('.txt', '');
      const nuoveParti = [];
      
      parti.forEach(parte => {
        if (typeof parte !== 'string') {
          nuoveParti.push(parte);
          return;
        }
        
        const chunks = parte.split(nomeSenzaExt);
        chunks.forEach((chunk, i) => {
          nuoveParti.push(chunk);
          if (i < chunks.length - 1) {
            nuoveParti.push(
              <span 
                key={`${fonte.id}-${i}`}
                onClick={() => setModalDocId(fonte.id)}
                style={{ 
                  color: '#0056b3', 
                  textDecoration: 'underline', 
                  cursor: 'pointer', 
                  fontWeight: '700' 
                }}
              >
                {nomeSenzaExt}
              </span>
            );
          }
        });
      });
      parti = nuoveParti;
    });
    
    return parti.map((parte, index) => {
      if (typeof parte === 'string') {
        return (
          <Highlighter
            key={`highlight-${index}`}
            searchWords={paroleDomanda}
            autoEscape={true}
            textToHighlight={parte}
            highlightStyle={{ background: 'yellow', color: '#000', fontWeight: 'bold' }}
          />
        );
      }
      return parte;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>Ricerca nell'Archivio</h2>
        <p style={{ color: 'var(--text2)' }}>Fai una domanda in linguaggio naturale — l'AI cercherà tra {' '}
          <strong style={{ color: 'var(--text)' }}>5.787 documenti storici</strong>
        </p>
      </div>

      {/* Form ricerca */}
      <form onSubmit={cerca} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={domanda}
            onChange={e => setDomanda(e.target.value)}
            placeholder="Es: missioni in Peru, lettere di Kiko, documenti sul matrimonio..."
            style={{ paddingLeft: '40px' }}
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || !domanda.trim()}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : <Search size={16} />}
          {loading ? 'Ricerca...' : `Cerca ${selectedCats.length > 0 ? '(' + selectedCats.length + ')' : ''}`}
        </button>
      </form>

      {/* Filtri Categoria */}
      {categorieDisponibili.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '13px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showFilters ? 'Nascondi Filtri di Esclusione' : 'Escludi/Includi Categorie Fonti ▾'}
          </button>
          {showFilters && (
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text3)', width: '100%', marginBottom: '4px' }}>Se non selezioni nulla, l'AI cercherà in tutti gli Archivi RAG liberamente. Se selezioni, ignorerà il resto.</span>
              {categorieDisponibili.map(cat => (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', background: selectedCats.includes(cat) ? 'var(--gold)' : 'var(--bg3)', color: selectedCats.includes(cat) ? '#000' : 'var(--text)', padding: '6px 14px', borderRadius: '16px', border: '1px solid var(--border)', transition: '0.2s', fontWeight: selectedCats.includes(cat) ? 'bold' : 'normal' }}>
                  <input type="checkbox" checked={selectedCats.includes(cat)} onChange={() => toggleCategory(cat)} style={{ display: 'none' }} />
                  {cat}
                </label>
              ))}
              {selectedCats.length > 0 && (
                <button type="button" onClick={() => setSelectedCats([])} style={{ background: 'none', border: 'none', color: '#ff6b6b', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto', alignSelf: 'center', textDecoration: 'underline' }}>
                  Azzera Filtri
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <span className="spinner" style={{ width: '32px', height: '32px' }} />
          <p style={{ marginTop: '16px', color: 'var(--text2)' }}>
            L'AI sta analizzando i documenti...<br />
            <span style={{ fontSize: '13px', color: 'var(--text3)' }}>Può richiedere 10-30 secondi</span>
          </p>
        </div>
      )}

      {/* Errore */}
      {error && <div className="error-msg" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Risultato */}
      {risultato && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Risposta AI */}
          <div className="card" style={{ background: 'white', color: '#000000', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gold)' }} />
              <span style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>
                Risposta AI
              </span>
            </div>
            <div style={{ lineHeight: '1.9', whiteSpace: 'pre-wrap', fontSize: '1.3em', fontWeight: '700', fontFamily: "'Cormorant Garamond', serif", color: '#000000' }}>
              {renderRispostaConLink(risultato.risposta, risultato.fonti)}
            </div>
          </div>

          {/* Fonti */}
          {risultato.fonti?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
                Documenti Fonte ({risultato.fonti.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {risultato.fonti.map((fonte, i) => (
                  <div key={i} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <FileText size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fonte.nome.replace('.txt', '')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                        Rilevanza: {Math.round(fonte.similarita * 100)}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setModalDocId(fonte.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <ExternalLink size={13} /> Vedi
                      </button>
                      {fonte.file_originale && (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => scaricaOriginale(fonte.id, fonte.nome)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Download size={13} /> Originale
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal / Popup Documento */}
      {modalDocId && (
        <DocumentoModal
          id={modalDocId}
          query={domanda}
          onClose={() => setModalDocId(null)}
        />
      )}

      {/* Placeholder iniziale */}
      {!risultato && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text3)' }}>
          <Search size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>Inserisci una domanda per iniziare la ricerca</p>
        </div>
      )}
    </div>
  )
}
