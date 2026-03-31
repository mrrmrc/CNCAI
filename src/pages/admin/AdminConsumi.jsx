import { useState, useEffect } from 'react'
import { RefreshCw, ExternalLink, Zap, Database, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import api from '../../api'

const MODELLO_INFO = {
  'gte-Qwen2':                { tipo: 'Embedding', colore: '#f59e0b', nota: 'Vettorizza ogni documento e ogni ricerca' },
  'Llama-3.3-70B-Instruct':   { tipo: 'LLM Chat',  colore: '#8b5cf6', nota: 'Risponde alle domande basandosi sui documenti' },
  'apertus-70b':              { tipo: 'LLM Chat',  colore: '#6366f1', nota: 'LLM di riserva (fallback)' },
  'mistral-small-4-119b':     { tipo: 'LLM Chat',  colore: '#3b82f6', nota: 'LLM di riserva (fallback)' },
  'gpt-oss-20b':              { tipo: 'LLM Chat',  colore: '#06b6d4', nota: 'LLM di riserva (fallback)' },
}

function fmt(n)   { return Number(n || 0).toLocaleString('it') }
function fmtE(n)  { return `€ ${Number(n || 0).toFixed(4)}` }
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminConsumi() {
  const [dati, setDati]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('modelli') // 'modelli' | 'recenti'

  const carica = () => {
    setLoading(true)
    api.get('/admin/consumi')
      .then(r => setDati(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(() => { carica() }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} style={{ color: 'var(--gold)' }} />
            </div>
            <h2 style={{ fontSize: '28px', margin: 0 }}>Consumi AI</h2>
          </div>
          <p style={{ color: 'var(--text2)', margin: 0, fontSize: '14px' }}>
            Dettaglio token e costi per ogni modello — dati tracciati localmente dal sistema
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="https://dashboard.regolo.ai/usage" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
            <ExternalLink size={13} /> Dashboard Regolo
          </a>
          <button className="btn-secondary" onClick={carica} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}>
            <RefreshCw size={13} /> Aggiorna
          </button>
        </div>
      </div>

      {/* Avviso storico */}
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: '1.6' }}>
          <strong style={{ color: '#f59e0b' }}>Nota storica:</strong> il tracking locale è attivo da quando il sistema è stato ripristinato.
          I consumi precedenti (es. il mese di marzo: ~36,97€) sono visibili solo su{' '}
          <a href="https://dashboard.regolo.ai/usage" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>dashboard.regolo.ai</a>.
          {' '}<strong>Il modello più costoso è sempre <code>gte-Qwen2</code></strong> perché è il motore di embedding
          — viene chiamato ogni volta che si carica un documento e ad ogni ricerca per convertire il testo in vettore.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px' }}><span className="spinner" style={{ width: '28px', height: '28px' }} /></div>
      ) : !dati ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>Errore nel caricamento dei dati</div>
      ) : (
        <>
          {/* Totale cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <div className="card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={20} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'Cormorant Garamond, serif', fontWeight: '600' }}>{fmt(dati.totale.chiamate)}</div>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Chiamate totali API</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Database size={20} style={{ color: '#8b5cf6' }} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'Cormorant Garamond, serif', fontWeight: '600' }}>{fmt(dati.totale.token)}</div>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Token totali (tracciati)</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={20} style={{ color: '#4ade80' }} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'Cormorant Garamond, serif', fontWeight: '600', color: '#4ade80' }}>{fmtE(dati.totale.costo)}</div>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Costo stimato (tracciato)</div>
              </div>
            </div>
          </div>

          {/* Tab */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg3)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
            {[['modelli', 'Per modello'], ['recenti', 'Ultime 50 operazioni']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: tab === id ? 'var(--gold)' : 'transparent', color: tab === id ? '#000' : 'var(--text2)', transition: '0.2s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab contenuti */}
          {tab === 'modelli' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {dati.per_modello.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
                  <Zap size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ margin: 0 }}>Nessun dato ancora — il tracking è partito adesso.<br />Esegui una ricerca per vedere i primi consumi.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                      {['Modello', 'Tipo', 'Chiamate', 'Prompt Tk', 'Completion Tk', 'Totale Tk', 'Costo €', 'Ultima chiamata'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dati.per_modello.map((m, i) => {
                      const info = MODELLO_INFO[m.modello] || { tipo: 'AI', colore: '#6b7280', nota: '' }
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: info.colore }}>{m.modello}</div>
                            {info.nota && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{info.nota}</div>}
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ background: `${info.colore}22`, color: info.colore, borderRadius: '10px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>{info.tipo}</span>
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: '14px', fontWeight: '600' }}>{fmt(m.chiamate)}</td>
                          <td style={{ padding: '13px 14px', fontSize: '13px', color: 'var(--text2)' }}>{fmt(m.prompt_tokens)}</td>
                          <td style={{ padding: '13px 14px', fontSize: '13px', color: 'var(--text2)' }}>{fmt(m.completion_tokens)}</td>
                          <td style={{ padding: '13px 14px', fontSize: '14px', fontWeight: '600' }}>{fmt(m.totale_tokens)}</td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ color: '#4ade80', fontWeight: '700', fontSize: '14px' }}>{fmtE(m.costo_stimato)}</span>
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: '12px', color: 'var(--text3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={11} />{fmtDate(m.ultima_chiamata)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={5} style={{ padding: '12px 14px', fontWeight: '700', fontSize: '13px', color: 'var(--text2)' }}>Totale (tracciato)</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14px' }}>{fmt(dati.totale.token)}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14px', color: '#4ade80' }}>{fmtE(dati.totale.costo)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {tab === 'recenti' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {dati.recenti.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ margin: 0 }}>Nessuna operazione ancora registrata.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                      {['Data/Ora', 'Utente', 'Modello', 'Prompt Tk', 'Completion Tk', 'Totale Tk', 'Costo'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dati.recenti.map((r, i) => {
                      const info = MODELLO_INFO[r.modello] || { tipo: 'AI', colore: '#6b7280' }
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={11} />{fmtDate(r.creato_il)}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '13px' }}>{r.username || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: info.colore, fontSize: '12px', fontWeight: '600' }}>{r.modello}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text2)' }}>{fmt(r.prompt_tokens)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text2)' }}>{fmt(r.completion_tokens)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>{fmt(r.totale_tokens)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: '#4ade80', fontWeight: '700', fontSize: '13px' }}>{fmtE(r.costo_stimato)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
