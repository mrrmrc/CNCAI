import { useState, useEffect, useRef } from 'react'
import { Upload, File, CheckCircle, XCircle } from 'lucide-react'
import api from '../../api'

export default function AdminUpload() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [risultati, setRisultati] = useState([])
  const [categoria, setCategoria] = useState('')
  const [categorieEsistenti, setCategorieEsistenti] = useState([])
  const inputRef = useRef()

  useEffect(() => {
    api.get('/categorie').then(r => setCategorieEsistenti(r.data)).catch(console.error)
  }, [])

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
      fd.append('categoria', categoria)
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

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text2)' }}>
          📁 Categoria / Archivio di appartenenza *
        </label>
        <input 
          type="text" 
          value={categoria} 
          onChange={e => setCategoria(e.target.value)} 
          list="categorie-list"
          placeholder="es: Documenti Padre Mario, Lettere, Catechismo..."
          style={{ width: '100%', maxWidth: '480px' }}
          required
        />
        <datalist id="categorie-list">
          {categorieEsistenti.map(c => (
            <option key={c.nome} value={c.nome}>{c.nome} ({c.totale} documenti)</option>
          ))}
        </datalist>
        <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>
          ↳ Scrivi il nome di una categoria esistente (l'autocompletamento ti suggerisce) oppure digita una nuova per crearla.
        </p>
        {categorieEsistenti.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {categorieEsistenti.map(c => (
              <button key={c.nome} type="button" onClick={() => setCategoria(c.nome)}
                style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', border: '1px solid var(--border)', background: categoria === c.nome ? 'var(--gold)' : 'var(--bg3)', color: categoria === c.nome ? '#000' : 'var(--text)', cursor: 'pointer', transition: '0.2s' }}>
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>

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
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>File selezionati ({files.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'var(--bg3)', borderRadius: '6px' }}>
                <File size={16} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '14px', flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={carica} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {uploading ? <><span className="spinner" style={{ width: '16px', height: '16px' }} /> Caricamento...</> : <><Upload size={16} /> Carica tutti</>}
          </button>
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
