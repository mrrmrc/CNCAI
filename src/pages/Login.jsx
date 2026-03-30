import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(username, password)
      navigate('/ricerca')
    } catch {
      setError('Credenziali non valide')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 60%), var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', color: 'var(--gold)', marginBottom: '8px' }}>
            Cammino Neocatecumenale
          </h1>
          <p style={{ color: 'var(--text2)' }}>Archivio Storico — Accesso riservato</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
