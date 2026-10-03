import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, usdc, type AgencyRow } from '../api'

export default function Scoreboard() {
  const [rows, setRows] = useState<AgencyRow[] | null>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { api.agencies().then(setRows).catch((e) => setErr(e.message)) }, [])
  const list = (rows ?? []).filter((r) => (r.name + r.licenseNo).toLowerCase().includes(q.toLowerCase()))

  return (
    <main className="wrap page">
      <div className="center">
        <h2>Agency scoreboard</h2>
        <p className="section-sub">Every number here comes straight from the blockchain. No agency can edit or delete its record, and neither can we.</p>
      </div>
      <div className="card-glass glass">
        <input placeholder="Search by agency name or NEA licence" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        {err && <p className="error">{err}</p>}
        {!rows && !err && <p className="muted">Loading…</p>}
        {rows && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Agency</th><th>Status</th><th>Placed abroad</th><th>Refunded</th><th>Success rate</th><th>Released</th></tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.pubkey}>
                    <td><Link to={`/agencies/${r.pubkey}`} style={{ fontWeight: 600 }}>{r.name}</Link><div className="muted mono">{r.licenseNo}</div></td>
                    <td>{r.verified ? <span className="chip chip-ok">✓ NEA verified</span> : <span className="chip">Not verified</span>}</td>
                    <td>{r.placementsCompleted}</td>
                    <td>{r.placementsRefunded}</td>
                    <td>{r.successRate === null ? <span className="muted">No results yet</span> : `${Math.round(r.successRate * 100)}%`}</td>
                    <td>{usdc(r.totalReleased)}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={6} className="muted">No agencies found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
