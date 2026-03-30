import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import api from '../../api'

export default function AdminAI() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/admin/ai').then(r => setPrompt(r.data.system_prompt)).finally(() => setLoading(false))
  }, [])

  const salva = async () => {
    setSaving(true); setMsg('')
    try {
      await api.put('/admin/ai', { system_prompt: prompt })
      setMsg('System prompt aggiornato con successo')
    } catch { setMsg('Errore nel salvataggio') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>Configurazione AI</h2>
      <p style={{ color: 'var(--text2)', marginBottom: '32px' }}>
        Il system prompt definisce il comportamento dell'AI. Le modifiche sono immediate.
      </p>

      {loading ? <div style={{ textAlign: 'center', padding: '48px' }}><span className="spinner" /></div> : (
        <div className="card">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text2)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={16}
            style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <button className="btn-primary" onClick={salva} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {saving ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : <Save size={15} />}
              Salva
            </button>
            {msg && <span style={{ fontSize: '14px', color: msg.includes('successo') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
