import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Download, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
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
  const [suggerimento, setSuggerimento] = useState(null)   // testo corretto dall'AI
  const [checkingSpell, setCheckingSpell] = useState(false)
  const spellTimerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/categorie')
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : []
        setCategorieDisponibili(data)
        // Di default seleziona tutte le categorie
        setSelectedCats(data.map(c => c.nome))
      })
      .catch(console.error)
  }, [])

  // Debounce: controlla ortografia 1.5s dopo che l'utente smette di digitare
  useEffect(() => {
    setSuggerimento(null)
    if (!domanda || domanda.trim().length < 5) return

    if (spellTimerRef.current) clearTimeout(spellTimerRef.current)

    spellTimerRef.current = setTimeout(async () => {
      try {
        setCheckingSpell(true)
        const res = await api.post('/correggi', { testo: domanda })
        if (res.data.modificato && res.data.corretto !== domanda) {
          setSuggerimento(res.data.corretto)
        }
      } catch {
        // Ignora errori silenziosamente (non blocca l'UX)
      } finally {
        setCheckingSpell(false)
      }
    }, 500)

    return () => clearTimeout(spellTimerRef.current)
  }, [domanda])

  const accettaSuggerimento = () => {
    setDomanda(suggerimento)
    setSuggerimento(null)
  }

  const ignoraSuggerimento = () => {
    setSuggerimento(null)
  }

  const toggleCategory = (nome) => {
    if (selectedCats.includes(nome)) setSelectedCats(selectedCats.filter(c => c !== nome))
    else setSelectedCats([...selectedCats, nome])
  }

  const cerca = async (e) => {
    e.preventDefault()
    if (!domanda.trim()) return
    setError(''); setLoading(true); setRisultato(null); setSuggerimento(null)
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
      const { data, headers } = await api.get(`/originale/${id}`, { responseType: 'blob' })
      const contentType = headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      // Usa il nome_file originale o componi un nome di fallback
      const nomeFile = nome || `documento_${id}`
      link.setAttribute('download', nomeFile)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Errore download", e)
      if (e.response?.status === 404) {
        alert("Questo documento non ha un file allegato né testo disponibile per il download.")
      } else {
        alert("Errore durante il download. Riprova.")
      }
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
      <form onSubmit={cerca} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '18px', color: 'var(--text3)', pointerEvents: 'none' }} />
          <textarea
            value={domanda}
            onChange={e => setDomanda(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cerca(e) } }}
            placeholder="Scrivi la tua domanda o parola chiave... (Invio per cercare, Shift+Invio per andare a capo)"
            disabled={loading}
            rows={3}
            spellCheck={true}
            autoCorrect="on"
            autoCapitalize="sentences"
            lang="it"
            style={{
              paddingLeft: '40px',
              paddingTop: '14px',
              paddingBottom: '14px',
              paddingRight: '16px',
              width: '100%',
              resize: 'vertical',
              minHeight: '80px',
              fontFamily: 'inherit',
              fontSize: '15px',
              boxSizing: 'border-box',
              lineHeight: '1.6'
            }}
          />
        </div>

        {/* Banner correttore ortografico AI */}
        {checkingSpell && (
          <div style={{ fontSize: '12px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
            <span className="spinner" style={{ width: '10px', height: '10px', flexShrink: 0 }} />
            Verifica ortografia...
          </div>
        )}
        {suggerimento && !checkingSpell && (
          <div style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid var(--gold)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '14px'
          }}>
            <span style={{ color: 'var(--gold)', flexShrink: 0, marginTop: '1px' }}>✏️</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: 'var(--text2)' }}>Forse intendevi: </span>
              <em style={{ color: 'var(--text)', fontStyle: 'normal', fontWeight: '600' }}>"{suggerimento}"</em>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button type="button" onClick={accettaSuggerimento}
                style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>
                Usa questo
              </button>
              <button type="button" onClick={ignoraSuggerimento}
                style={{ background: 'none', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                Ignora
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={loading || !domanda.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
            {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : <Search size={16} />}
            {loading ? 'Ricerca in corso...' : `Cerca ${selectedCats.length > 0 ? '(' + selectedCats.length + ' fonti)' : ''}`}
          </button>
        </div>
      </form>

      {/* Filtri Categoria */}
      {categorieDisponibili.length > 0 && (

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '13px', color: 'var(--gold)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fonti di Ricerca Attive:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text3)', width: '100%', marginBottom: '4px' }}>L'AI cercherà le risposte solo all'interno delle categorie selezionate qui sotto.</span>
            {categorieDisponibili.map(cat => (
              <label key={cat.nome} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', background: selectedCats.includes(cat.nome) ? 'var(--gold)' : 'var(--bg3)', color: selectedCats.includes(cat.nome) ? '#000' : 'var(--text)', padding: '6px 14px', borderRadius: '16px', border: '1px solid var(--border)', transition: '0.2s', fontWeight: selectedCats.includes(cat.nome) ? 'bold' : 'normal' }}>
                <input type="checkbox" checked={selectedCats.includes(cat.nome)} onChange={() => toggleCategory(cat.nome)} style={{ display: 'none' }} />
                {cat.nome} <span style={{ fontSize: '10px', opacity: 0.7 }}>({cat.totale})</span>
              </label>
            ))}
            {selectedCats.length < categorieDisponibili.length && (
              <button type="button" onClick={() => setSelectedCats(categorieDisponibili.map(c => c.nome))} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto', alignSelf: 'center', textDecoration: 'underline' }}>
                Seleziona Tutte
              </button>
            )}
          </div>
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
          <div className="card" style={{ background: 'var(--bg2)', padding: '32px', border: '1px solid var(--gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gold)' }} />
              <span style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)' }}>
                Risposta AI
              </span>
            </div>
            <div style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '16px', color: '#ffffff' }}>
              {renderRispostaConLink(risultato.risposta, risultato.fonti)}
            </div>
            {risultato.fonti?.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: 'var(--text2)' }}>
                <strong style={{ color: 'var(--gold)' }}>Documenti consultati dall'AI:</strong>{' '}
                {risultato.fonti.map((f, i) => (
                  <span key={i}>
                    <span onClick={() => setModalDocId(f.id)} style={{ color: 'var(--gold)', textDecoration: 'underline', cursor: 'pointer' }}>
                      {f.nome.replace('.txt', '')}
                    </span>
                    {i < risultato.fonti.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
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
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => scaricaOriginale(fonte.id, fonte.nome)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Scarica il file originale"
                      >
                        <Download size={13} /> Scarica originale
                      </button>
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
