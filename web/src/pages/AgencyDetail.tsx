import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, kes, usdc, type AgencyRow, type Placement } from '../api'
import { explorer } from '../config'

const statusChip = (s: Placement['status']) =>
  s === 'completed' ? 'chip chip-ok' : s === 'refunded' ? 'chip chip-bad' : s === 'funded' ? 'chip chip-brand' : 'chip'

export default function AgencyDetail() {
  const { pubkey = '' } = useParams()
  const [a, setA] = useState<(AgencyRow & { placements: Placement[] }) | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.agency(pubkey).then(setA).catch((e) => setErr(e.message)) }, [pubkey])
  if (err) return <div className="wrap page"><p className="error">{err}</p></div>
  if (!a) return <div className="wrap page"><p className="muted">Loading…</p></div>

  return (
    <main className="wrap page">
      <Link to="/agencies" className="muted">← Scoreboard</Link>
      <div className="row" style={{ margin: '14px 0 24px', justifyContent: 'space-between' }}>
        <div>
          <h2>{a.name}</h2>
          <p className="muted mono">NEA licence {a.licenseNo} · <a href={explorer('address', a.pubkey)} target="_blank" rel="noreferrer">onchain record</a></p>
        </div>
        <div style={{ flex: 'none' }}>{a.verified ? <span className="chip chip-ok">✓ NEA verified</span> : <span className="chip">Not verified</span>}</div>
      </div>
      <div className="grid3" style={{ marginBottom: 28 }}>
        <div className="card"><small className="muted">Placed abroad</small><h2>{a.placementsCompleted}</h2></div>
        <div className="card"><small className="muted">Refunded</small><h2>{a.placementsRefunded}</h2></div>
        <div className="card"><small className="muted">Released to agency</small><h2 style={{ fontSize: 30 }}>{usdc(a.totalReleased)}</h2></div>
      </div>
      <h3 style={{ marginBottom: 12 }}>Placements</h3>
      <div className="tracker">
        {a.placements.map((p) => (
          <div className="stage" key={p.pubkey}>
            <div className="meta">
              <b>{p.terms?.jobTitle} · {p.terms?.country}</b>
              <small>{p.terms ? kes(p.terms.feeKes) : ''} · stage {p.stagesDone}/{p.stageCount} · <Link to={`/p/${p.pubkey}`}>details</Link></small>
            </div>
            <span className={statusChip(p.status)}>{p.status}</span>
          </div>
        ))}
        {!a.placements.length && <p className="muted">No placements yet.</p>}
      </div>
    </main>
  )
}
