import { useState, useEffect } from 'react'
import { X, Download, FileText } from 'lucide-react'
import Highlighter from 'react-highlight-words'
import api from '../api'

export default function DocumentoModal({ id, query, onClose }) {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  const parole = query ? query.split(/\s+/).filter(p => p.length > 2) : []

  useEffect(() => {
    api.get(`/documento/${id}`)
      .then(r => setDoc(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const scaricaOriginale = async () => {
    try {
      const { data, headers } = await api.get(`/originale/${id}`, { responseType: 'blob' })
      const contentType = headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc?.nome_file || `documento_${id}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Errore download originale", e)
      alert("Impossibile scaricare l'originale. Il file fisico potrebbe non essere presente sul server.")
    }
  }

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleOutsideClick = (e) => {
    if (e.target.className === 'modal-overlay') onClose()
  }

  // Suddivide il testo in paragrafi leggibili
  const renderParagrafi = (testo) => {
    if (!testo) return null
    // Separa su doppio newline oppure su newline singolo se la riga è corta (stile documento)
    const righe = testo.split('\n')
    const blocchi = []
    let corrente = []

    righe.forEach((riga) => {
      if (riga.trim() === '') {
        if (corrente.length > 0) {
          blocchi.push(corrente.join(' ').trim())
          corrente = []
        }
      } else {
        corrente.push(riga.trim())
      }
    })
    if (corrente.length > 0) blocchi.push(corrente.join(' ').trim())

    return blocchi.filter(b => b.length > 0).map((blocco, idx) => (
      <p key={idx} style={{
        margin: '0 0 1.2em 0',
        textAlign: 'justify',
        lineHeight: '1.85',
        fontWeight: '400',
        color: '#1a1a1a',
      }}>
        {parole.length > 0 ? (
          <Highlighter
            searchWords={parole}
            autoEscape={true}
            textToHighlight={blocco}
            highlightStyle={{
              background: '#ffe066',
              color: '#1a1a1a',
              borderRadius: '2px',
              padding: '0 2px',
              fontWeight: '700'
            }}
          />
        ) : blocco}
      </p>
    ))
  }

  return (
    <div className="modal-overlay" onClick={handleOutsideClick}>
      <div className="modal-content" style={{
        maxWidth: '820px',
        width: '90vw',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#fff'
      }}>

        {/* ── HEADER ── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '2px solid #e5e0d8',
          background: '#faf7f2',
          flexShrink: 0
        }}>
          <div style={{ flex: 1, overflow: 'hidden', marginRight: '16px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: '700',
              color: '#c9a84c',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              marginBottom: '5px'
            }}>
              Archivio Storico · Cammino Neocatecumenale
              {doc?.categoria ? ` · ${doc.categoria}` : ''}
            </div>
            {doc ? (
              <h3 style={{
                fontSize: '17px',
                margin: 0,
                color: '#1a1a1a',
                fontFamily: "'Georgia', serif",
                fontWeight: '700',
                lineHeight: '1.3'
              }}>
                {doc.nome_file.replace('.txt', '').replace(/_/g, ' ')}
              </h3>
            ) : (
              <h3 style={{ fontSize: '17px', margin: 0, color: '#666' }}>Caricamento...</h3>
            )}
            {doc?.creato_il && (
              <p style={{ fontSize: '11px', color: '#999', margin: '5px 0 0 0', fontStyle: 'italic' }}>
                Caricato il {new Date(doc.creato_il).toLocaleDateString('it-IT', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {doc?.file_originale && (
              <button
                onClick={scaricaOriginale}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: '#c9a84c', color: '#fff', border: 'none',
                  borderRadius: '6px', padding: '7px 13px',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}
                title="Scarica il file originale"
              >
                <Download size={13} /> Originale
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', color: '#666',
                border: '1px solid #ddd', borderRadius: '6px',
                padding: '7px 13px', fontSize: '12px', cursor: 'pointer'
              }}
            >
              <X size={13} /> Chiudi
            </button>
          </div>
        </div>

        {/* ── BANNER PAROLE CERCATE ── */}
        {parole.length > 0 && (
          <div style={{
            padding: '10px 24px',
            background: '#fffbea',
            borderBottom: '1px solid #ffe066',
            fontSize: '13px',
            color: '#7a5c00',
            flexShrink: 0
          }}>
            🔍 Ricerca: <strong>{query}</strong> — le parole chiave sono evidenziate nel testo
          </div>
        )}

        {/* ── CORPO DOCUMENTO ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: '#f5f2ec',
          padding: '32px 24px'
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px' }} />
            </div>
          ) : doc ? (
            <div style={{
              maxWidth: '660px',
              margin: '0 auto',
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden'
            }}>
              {/* Foglio documento */}
              <div style={{
                padding: '48px 56px',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontSize: '15.5px',
              }}>
                {/* Titolo nel corpo */}
                <div style={{
                  borderBottom: '2px solid #c9a84c',
                  marginBottom: '28px',
                  paddingBottom: '16px'
                }}>
                  <h2 style={{
                    fontFamily: "'Georgia', serif",
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#111',
                    margin: '0 0 6px 0',
                    lineHeight: '1.4'
                  }}>
                    {doc.nome_file.replace('.txt', '').replace(/_/g, ' ')}
                  </h2>
                  {doc.categoria && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#c9a84c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em'
                    }}>
                      {doc.categoria}
                    </span>
                  )}
                </div>

                {/* Testo a paragrafi */}
                <div>
                  {renderParagrafi(doc.testo)}
                </div>
              </div>

              {/* Footer foglio */}
              <div style={{
                background: '#faf7f2',
                borderTop: '1px solid #e5e0d8',
                padding: '14px 56px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '11px' }}>
                  <FileText size={12} />
                  {doc.file_originale
                    ? 'File originale disponibile'
                    : 'Solo testo estratto disponibile'
                  }
                </div>
                {doc.file_originale ? (
                  <button
                    onClick={scaricaOriginale}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: '#c9a84c', color: '#fff', border: 'none',
                      borderRadius: '5px', padding: '6px 12px',
                      fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    <Download size={11} /> Scarica originale
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#bbb', fontStyle: 'italic' }}>
                    Nessun file originale allegato
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#c44', textAlign: 'center', padding: '32px' }}>
              Nessun documento trovato o errore nel caricamento.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
