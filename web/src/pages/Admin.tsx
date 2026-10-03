import { useEffect, useState } from 'react'
import { api, type AgencyRow } from '../api'
import { explorer } from '../config'

export default function Admin() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem('adminToken') ?? '' } catch { return '' } })
  const [rows, setRows] = useState<AgencyRow[]>([])
  const [msg, setMsg] = useState('')
  const load = () => api.agencies().then(setRows).catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])
  useEffect(() => { try { sessionStorage.setItem('adminToken', token) } catch { /* ignore */ } }, [token])

  const verify = async (pk: string, force: boolean) => {
    setMsg('')
    try {
      const r = await api.verify(pk, token, force)
      setMsg(`Verified${r.manualOverride ? ' (manual override)' : ''}. Tx ${r.tx}`)
      load()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <main className="wrap page" style={{ maxWidth: 900 }}>
      <h2>Admin</h2>
      <p className="muted" style={{ margin: '6px 0 20px' }}>Verify agencies against the NEA licensed list.</p>
      <input type="password" placeholder="Admin token" value={token} onChange={(e) => setToken(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
      {msg && <p className="notice" style={{ marginBottom: 16 }}>{msg}</p>}
      <div className="tracker">
        {rows.filter((r) => !r.verified).map((r) => (
          <div className="stage" key={r.pubkey} style={{ flexWrap: 'wrap' }}>
            <div className="meta"><b>{r.name}</b><small className="mono">{r.licenseNo} · <a href={explorer('address', r.pubkey)} target="_blank" rel="noreferrer">{r.pubkey}</a></small></div>
            <button className="btn btn-primary btn-sm" style={{ flex: 'none' }} onClick={() => verify(r.pubkey, false)}>Check NEA list + verify</button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={() => verify(r.pubkey, true)}>Verify manually</button>
          </div>
        ))}
        {!rows.filter((r) => !r.verified).length && <p className="muted">No agencies waiting.</p>}
      </div>
    </main>
  )
}
