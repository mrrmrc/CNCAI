import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search, BookOpen, LogOut, Users, Upload, Settings, Activity, Database, FileText, Home } from 'lucide-react'

const navStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '10px 16px', borderRadius: '8px', color: '#ffffff',
  fontSize: '14px', transition: 'all 0.15s', textDecoration: 'none',
  fontWeight: '500',
}
const activeStyle = { background: 'rgba(201,168,76,0.18)', color: 'var(--gold)', fontWeight: '700' }

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
      <Icon size={16} /> {label}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { utente, logout } = useAuth()
  const navigate = useNavigate()
  
  const [zoomLevel, setZoomLevel] = useState(3)   // 1-5, default 3
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    // Rimuovi tutte le classi zoom
    for (let i = 1; i <= 5; i++) document.body.classList.remove(`zoom-${i}`)
    document.body.classList.remove('high-contrast')
    if (zoomLevel !== 3) document.body.classList.add(`zoom-${zoomLevel}`)
    if (highContrast) document.body.classList.add('high-contrast')
  }, [zoomLevel, highContrast])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '24px 12px',
        position: 'fixed', top: 0, left: 0, bottom: 0, overflowY: 'auto'
      }}>
        {/* Accessibilità - Zoom 5 step */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 8px 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dimensione Testo</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => setZoomLevel(l => Math.max(1, l - 1))}
              disabled={zoomLevel === 1}
              style={{ width: '32px', height: '32px', padding: 0, fontSize: '16px', fontWeight: 'bold', background: 'var(--bg3)', color: '#ffffff', border: '1px solid var(--border)', borderRadius: '6px', cursor: zoomLevel === 1 ? 'not-allowed' : 'pointer', opacity: zoomLevel === 1 ? 0.4 : 1 }}
            >A-</button>
            <div style={{ flex: 1, display: 'flex', gap: '3px', justifyContent: 'center' }}>
              {[1,2,3,4,5].map(l => (
                <div key={l} onClick={() => setZoomLevel(l)} style={{ width: '10px', height: '10px', borderRadius: '50%', background: l <= zoomLevel ? 'var(--gold)' : 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer', transition: '0.2s' }} title={`Livello ${l}`} />
              ))}
            </div>
            <button
              onClick={() => setZoomLevel(l => Math.min(5, l + 1))}
              disabled={zoomLevel === 5}
              style={{ width: '32px', height: '32px', padding: 0, fontSize: '14px', fontWeight: 'bold', background: 'var(--bg3)', color: '#ffffff', border: '1px solid var(--border)', borderRadius: '6px', cursor: zoomLevel === 5 ? 'not-allowed' : 'pointer', opacity: zoomLevel === 5 ? 0.4 : 1 }}
            >A+</button>
            <button title="Alto Contrasto" onClick={() => setHighContrast(!highContrast)}
              style={{ width: '32px', height: '32px', padding: 0, fontSize: '14px', background: highContrast ? 'var(--gold)' : 'var(--bg3)', color: highContrast ? '#000' : 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}>◑</button>
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text3)' }}>Livello {zoomLevel} / 5</div>
        </div>

        {/* Logo + Immagine */}
        <div style={{ padding: '0 8px 24px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', maxHeight: '120px' }}>
            <img 
              src="/origene.jpg" 
              alt="Archivio Storico" 
              style={{ width: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', opacity: 0.9 }}
            />
          </div>
          <h1 style={{ fontSize: '18px', lineHeight: 1.2, color: '#ffffff', fontWeight: '700' }}>
            Cammino<br/>Neocatecumenale
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Archivio Storico</p>
        </div>

        {/* Nav principale */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <NavItem to="/ricerca" icon={Search} label="Ricerca AI" />
          <NavItem to="/libreria" icon={BookOpen} label="Libreria" />

          {utente?.ruolo === 'admin' && (
            <>
              <div style={{ margin: '16px 8px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)' }}>
                Amministrazione
              </div>
              <NavItem to="/admin/upload" icon={Upload} label="Carica Documenti" />
              <NavItem to="/admin/utenti" icon={Users} label="Utenti" />
              <NavItem to="/admin/ai" icon={Settings} label="Configurazione AI" />
              <NavItem to="/admin/stato" icon={Activity} label="Stato Server" />
              <NavItem to="/admin/log" icon={FileText} label="Log Accessi" />
              <NavItem to="/admin/backup" icon={Database} label="Backup" />
            </>
          )}
        </nav>

        {/* Footer utente */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ padding: '0 8px 12px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>{utente?.username}</div>
            <span className={`badge badge-${utente?.ruolo}`}>{utente?.ruolo}</span>
          </div>
          <button onClick={handleLogout} style={{ ...navStyle, width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
            <LogOut size={16} /> Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: '1200px' }}>
        {children}
      </main>
    </div>
  )
}
