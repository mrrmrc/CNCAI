import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search, BookOpen, LogOut, Users, Upload, Settings, Activity, Database, FileText, Home } from 'lucide-react'

const navStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '10px 16px', borderRadius: '8px', color: 'var(--text2)',
  fontSize: '14px', transition: 'all 0.15s', textDecoration: 'none',
}
const activeStyle = { background: 'rgba(201,168,76,0.12)', color: 'var(--gold)' }

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
        {/* Logo */}
        <div style={{ padding: '0 8px 24px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', lineHeight: 1.2, color: 'var(--gold)' }}>
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
              <div style={{ margin: '16px 8px 8px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>
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
