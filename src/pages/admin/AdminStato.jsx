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
  const [loadingRepair, setLoadingRepair] = useState(false)
  const [repairResult, setRepairResult] = useState(null)

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

      {loading ? <div style={{ textAlign: 'center', padding: '64px' }}><span className="spinner" style={{ width: '28px', height: '28px' }} /></div> : (stato && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Servizi */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Servizi
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {Object.entries(stato?.servizi || {}).map(([nome, attivo]) => (
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
              <StatCard label="Documenti" value={(stato?.database?.documenti || 0).toLocaleString('it')} icon={Database} />
              <StatCard label="Utenti attivi" value={stato?.database?.utenti_attivi || 0} icon={Server} />
              <StatCard label="Ricerche oggi" value={stato?.database?.ricerche_oggi || 0} icon={Search} />
            </div>
          </div>


          {/* Consumi AI */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Consumi AI (Regolo.ai)
            </h3>
            {stato?.consolidato_ai ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <StatCard
                  label="Token Totali"
                  value={(stato.consolidato_ai.totale_tokens || 0).toLocaleString('it')}
                  icon={Database}
                  color="var(--gold)"
                />
                <StatCard
                  label="Costo Stimato"
                  value={`€ ${(stato.consolidato_ai.costo_stimato || 0).toFixed(4)}`}
                  icon={HardDrive}
                  color="var(--green)"
                />
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <HardDrive size={20} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>Verifica i consumi reali su Regolo.ai</div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                      Il tracking locale è disabilitato — clicca per vedere credito e utilizzo sulla dashboard ufficiale
                    </div>
                  </div>
                </div>
                <a
                  href="https://dashboard.regolo.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '8px',
                    background: 'var(--gold)', color: '#000',
                    fontWeight: '700', fontSize: '13px',
                    textDecoration: 'none', flexShrink: 0,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  🔗 Apri Dashboard Regolo
                </a>
              </div>
            )}
          </div>

          {/* Disco */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Spazio Disco
            </h3>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text2)' }}>Usato: <strong style={{ color: 'var(--text)' }}>{stato?.disco?.usato_gb || 0} GB</strong></span>
                <span style={{ color: 'var(--text2)' }}>Libero: <strong style={{ color: 'var(--green)' }}>{stato?.disco?.libero_gb || 0} GB</strong></span>
                <span style={{ color: 'var(--text2)' }}>Totale: <strong style={{ color: 'var(--text)' }}>{stato?.disco?.totale_gb || 0} GB</strong></span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stato?.disco?.percentuale || 0}%`, background: (stato?.disco?.percentuale || 0) > 80 ? 'var(--red)' : 'var(--gold)', borderRadius: '4px', transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px', textAlign: 'right' }}>{stato?.disco?.percentuale || 0}% utilizzato</div>
            </div>
          </div>

          {/* Manutenzione */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '12px' }}>
              Manutenzione Avanzata
            </h3>
            <div className="card" style={{ border: '1px solid rgba(220, 38, 38, 0.3)', background: 'rgba(220, 38, 38, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: '700', color: 'var(--red)', marginBottom: '4px' }}>Rigenera Indice Completo</div>
                  <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0, maxWidth: '500px' }}>
                    Questa funzione rilegge tutti i file originali (PDF/Word), estrae il testo completo e ricrea gli embeddings a blocchi. 
                    <strong> Consigliato per riparare documenti caricati parzialmente.</strong>
                  </p>
                </div>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    if (window.confirm("Sei sicuro? Questa operazione ricalcolerà tutti i documenti e consumerà token API.")) {
                      setLoadingRepair(true)
                      api.post('/admin/ripara-libreria')
                        .then(r => {
                          setRepairResult(r.data)
                          const msg = r.data.messaggio || `Riparazione avviata per ${r.data.totale || ''} documenti.`
                          alert(msg)
                          carica()
                        })
                        .catch(e => alert("Errore durante l'avvio della riparazione"))
                        .finally(() => {
                           // Non resettiamo subito loadingRepair se lo consideriamo un processo lungo? 
                           // In realtà qui ritorna subito perché è backgroundTask.
                           setLoadingRepair(false)
                        })
                    }
                  }}
                  disabled={loadingRepair}
                  style={{ background: 'var(--red)', color: '#fff', border: 'none', padding: '10px 24px' }}>
                  {loadingRepair ? 'In corso...' : 'Avvia Riparazione'}
                </button>
              </div>
              {repairResult && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
                  {repairResult?.log?.map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
