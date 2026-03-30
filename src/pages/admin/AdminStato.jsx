import { useState, useEffect } from 'react'
import { RefreshCw, Server, Database, HardDrive, Search } from 'lucide-react'
import api from '../../api'

function StatCard({ label, value, sub, icon: Icon, color = 'var(--gold)' }) {
  return (
    <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `rgba(201,168,76,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: '24px', fontFamily: 'Cormorant Garamond, serif', fontWeight: '600' }}>{value}</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{label}</div>
        {sub && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function AdminStato() {
  const [stato, setStato] = useState(null)
  const [loading, setLoading] = useState(true)

  const carica = () => {
    setLoading(true)
    api.get('/admin/stato').then(r => setStato(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { carica() }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '32px' }}>Stato Server</h2>
        <button className="btn-secondary" onClick={carica}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={14} /> Aggiorna
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '64px' }}><span className="spinner" style={{ width: '28px', height: '28px' }} /></div> : stato && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Servizi */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Servizi
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {Object.entries(stato.servizi).map(([nome, attivo]) => (
                <div key={nome} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: attivo ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{nome}</div>
                    <div style={{ fontSize: '12px', color: attivo ? 'var(--green)' : 'var(--red)' }}>
                      {attivo ? 'Operativo' : 'Non attivo'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Database */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Database
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <StatCard label="Documenti" value={stato.database.documenti.toLocaleString('it')} icon={Database} />
              <StatCard label="Utenti attivi" value={stato.database.utenti_attivi} icon={Server} />
              <StatCard label="Ricerche oggi" value={stato.database.ricerche_oggi} icon={Search} />
            </div>
          </div>

          {/* Disco */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Spazio Disco
            </h3>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text2)' }}>Usato: <strong style={{ color: 'var(--text)' }}>{stato.disco.usato_gb} GB</strong></span>
                <span style={{ color: 'var(--text2)' }}>Libero: <strong style={{ color: 'var(--green)' }}>{stato.disco.libero_gb} GB</strong></span>
                <span style={{ color: 'var(--text2)' }}>Totale: <strong style={{ color: 'var(--text)' }}>{stato.disco.totale_gb} GB</strong></span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stato.disco.percentuale}%`, background: stato.disco.percentuale > 80 ? 'var(--red)' : 'var(--gold)', borderRadius: '4px', transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px', textAlign: 'right' }}>{stato.disco.percentuale}% utilizzato</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
