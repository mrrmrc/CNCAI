import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import Highlighter from 'react-highlight-words'
import api from '../api'

export default function Documento() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const query = location.state?.query || ''
  const parole = query.split(/\s+/).filter(p => p.length > 2)

  useEffect(() => {
    api.get(`/documento/${id}`)
      .then(r => setDoc(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const scaricaOriginale = () => {
    window.open(`${api.defaults.baseURL}/originale/${id}`, '_blank')
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '64px' }}>
      <span className="spinner" style={{ width: '28px', height: '28px' }} />
    </div>
  )

  if (!doc) return <div className="error-msg">Documento non trovato</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn-secondary btn-sm" onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Indietro
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '22px', marginBottom: '2px' }}>
            {doc.nome_file.replace('.txt', '')}
          </h2>
          {doc.creato_il && (
            <p style={{ fontSize: '13px', color: 'var(--text3)' }}>
              Caricato il {new Date(doc.creato_il).toLocaleDateString('it')}
            </p>
          )}
        </div>
        {doc.file_originale && (
          <button className="btn-secondary" onClick={scaricaOriginale}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Download size={15} /> Scarica originale
          </button>
        )}
      </div>

      {/* Legenda highlight */}
      {parole.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(201,168,76,0.08)', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.2)', fontSize: '13px', color: 'var(--text2)' }}>
          Le parole evidenziate corrispondono alla tua ricerca: <strong style={{ color: 'var(--gold)' }}>{query}</strong>
        </div>
      )}

      {/* Testo documento */}
      <div className="card" style={{ padding: '40px', background: 'white', color: '#000000', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #ddd' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '19px', fontWeight: '500', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
          {parole.length > 0 ? (
            <Highlighter
              searchWords={parole}
              autoEscape={true}
              textToHighlight={doc.testo || ''}
              highlightStyle={{ background: '#fff3cd', color: '#000', borderRadius: '2px', padding: '0 2px', borderBottom: '1px solid #ffeeba', fontWeight: '700' }}
            />
          ) : (
            doc.testo
          )}
        </div>
      </div>
    </div>
  )
}
