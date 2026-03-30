import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
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
      const { data } = await api.get(`/originale/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc?.nome_file || `documento_${id}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error("Errore download originale", e)
      alert("Impossibile scaricare l'originale.")
    }
  }

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleOutsideClick = (e) => {
    if (e.target.className === 'modal-overlay') {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOutsideClick}>
      <div className="modal-content">
        
        {/* Header Modale */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', flexShrink: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', marginRight: '16px' }}>
            {doc ? (
              <h3 style={{ fontSize: '18px', margin: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', color: 'var(--gold)' }}>
                {doc.nome_file.replace('.txt', '')}
              </h3>
            ) : (
              <h3 style={{ fontSize: '18px', margin: 0 }}>Caricamento in corso...</h3>
            )}
            {doc?.creato_il && (
               <p style={{ fontSize: '13px', color: 'var(--text3)', margin: 0, marginTop: '4px' }}>
                 Caricato il {new Date(doc.creato_il).toLocaleDateString('it')}
               </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {doc?.file_originale && (
              <button className="btn-secondary btn-sm" onClick={scaricaOriginale} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> Scarica
              </button>
            )}
            <button className="btn-secondary btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--red)', color: '#ff6b6b' }}>
              <X size={14} /> Chiudi
            </button>
          </div>
        </div>

        {/* Corpo Documento */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg2)' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
              <span className="spinner" />
            </div>
          ) : doc ? (
            <>
              {parole.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(201,168,76,0.1)', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.3)', fontSize: '14px', color: 'var(--text2)' }}>
                  Parole evidenziate: <strong style={{ color: 'var(--gold)' }}>{query}</strong>
                </div>
              )}
              <div style={{ padding: '32px', background: '#ffffff', color: '#000000', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3em', fontWeight: '700', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                  {parole.length > 0 ? (
                    <Highlighter
                      searchWords={parole}
                      autoEscape={true}
                      textToHighlight={doc.testo || ''}
                      highlightStyle={{ background: 'yellow', color: '#000', borderRadius: '2px', padding: '0 2px', fontWeight: 'bold' }}
                    />
                  ) : (
                    doc.testo
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="error-msg">Nessun documento trovato.</div>
          )}
        </div>
      </div>
    </div>
  )
}
