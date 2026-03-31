import { useState, useRef } from 'react'
import { Upload, File, CheckCircle, XCircle } from 'lucide-react'
import api from '../../api'

export default function AdminUpload() {
  const [files, setFiles]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [risultati, setRisultati] = useState([])
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setFiles(Array.from(e.dataTransfer.files))
  }

  const handleSelect = (e) => {
    setFiles(Array.from(e.target.files))
  }

  const carica = async () => {
    if (!files.length) return
    setUploading(true); setRisultati([])
    const res = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const r = await api.post('/admin/upload', fd)
        res.push({ nome: file.name, ok: true, msg: r.data.messaggio })
      } catch (e) {
        res.push({ nome: file.name, ok: false, msg: e.response?.data?.detail || 'Errore' })
      }
    }
    setRisultati(res)
    setFiles([])
    setUploading(false)
  }

  const FORMATI = 'PDF, DOCX, DOC, TXT, JPG, PNG, TIF, TIFF'

  return (
    <div>
      <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>Carica Documenti</h2>
      <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>Formati supportati: {FORMATI}</p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current.click()}
        style={{
          border: '2px dashed var(--border)', borderRadius: '12px',
          padding: '64px', textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 0.2s',
          marginBottom: '24px',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <Upload size={40} style={{ color: 'var(--text3)', marginBottom: '16px' }} />
        <p style={{ fontWeight: '500', marginBottom: '4px' }}>Trascina i file qui o clicca per selezionare</p>
        <p style={{ color: 'var(--text3)', fontSize: '13px' }}>{FORMATI}</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.tif,.tiff"
          onChange={handleSelect} style={{ display: 'none' }} />
      </div>

      {/* File selezionati */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', marginBottom: '24px', alignItems: 'start' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <File size={18} style={{ color: 'var(--gold)' }} />
              File selezionati ({files.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'var(--bg3)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '13px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={carica} disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'center', padding: '12px' }}>
              {uploading ? <><span className="spinner" style={{ width: '18px', height: '18px' }} /> Caricamento in corso...</> : <><Upload size={18} /> Avvia Caricamento ed Indicizzazione</>}
            </button>
          </div>

          <div className="card" style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.05)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)', marginBottom: '16px' }}>
              Stima Costi AI (Preventivo)
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>Token stimati (totali)</div>
              <div style={{ fontSize: '24px', fontWeight: '600', fontFamily: 'Cormorant Garamond, serif' }}>
                {Math.round(files.reduce((acc, f) => acc + (f.size / 4), 0)).toLocaleString('it')}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>Costo stimato indicizzazione</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ade80' }}>
                € {(files.reduce((acc, f) => acc + (f.size / 4), 0) / 1000000 * 0.10).toFixed(4)}
              </div>
            </div>

            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: 'var(--text3)', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 6px 0' }}><strong>Come viene calcolato:</strong></p>
              • Basato sul modello <code>gte-Qwen2</code> (€0.10/M token).<br />
              • Stima conservativa: 1 token ogni 4 byte di file.<br />
              • Il costo reale può variare in base alla densità del testo nel PDF.
            </div>
          </div>
        </div>
      )}

      {/* Risultati */}
      {risultati.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Risultati</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {risultati.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--bg3)', borderRadius: '6px' }}>
                {r.ok ? <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} /> : <XCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                <span style={{ fontSize: '13px', flex: 1, fontWeight: '500' }}>{r.nome}</span>
                <span style={{ fontSize: '12px', color: r.ok ? 'var(--green)' : 'var(--red)' }}>{r.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
