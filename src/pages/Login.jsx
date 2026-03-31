import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login }  = useAuth()
  const navigate   = useNavigate()

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
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg)',
    }}>
      {/* Pannello immagine — sinistra */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        minWidth: 0,
      }}>
        <img
          src="/origene.jpg"
          alt="Cammino Neocatecumenale"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            filter: 'brightness(0.55)',
          }}
        />
        {/* Overlay gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, transparent 60%, var(--bg) 100%)',
        }} />
        {/* Testo sovrapposto nell'immagine */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '48px',
          maxWidth: '520px',
        }}>
          <h1 style={{
            fontSize: '38px',
            fontWeight: '800',
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: '16px',
            textShadow: '0 2px 16px rgba(0,0,0,0.6)',
          }}>
            Cammino<br />Neocatecumenale
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.8)',
            lineHeight: 1.6,
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
          }}>
            Archivio Storico — Accesso riservato
          </p>
          <div style={{
            marginTop: '24px',
            width: '60px',
            height: '3px',
            background: 'var(--gold)',
            borderRadius: '2px',
          }} />
        </div>
      </div>

      {/* Pannello form — destra */}
      <div style={{
        width: '440px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: 'var(--bg2)',
        boxShadow: '-8px 0 48px rgba(0,0,0,0.4)',
      }}>
        <div style={{ width: '100%', maxWidth: '340px' }}>
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              width: '48px', height: '48px',
              borderRadius: '12px',
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '24px',
              fontSize: '22px',
            }}>✝</div>
            <h2 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Accedi</h2>
            <p style={{ color: 'var(--text3)', fontSize: '14px' }}>Inserisci le tue credenziali per accedere all'archivio</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Username
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required autoFocus
                placeholder="Il tuo username"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.12)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: '8px', padding: '14px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading
                ? <><span className="spinner" style={{ width: '16px', height: '16px' }} /> Accesso...</>
                : 'Accedi all\'archivio'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
