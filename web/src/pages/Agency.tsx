import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { api, kes, usdc, type Health, type Placement, type Stage } from '../api'
import { createPlacement, fetchAgency, registerAgency } from '../chain'
import { explorer } from '../config'

const defaultStages: Stage[] = [
  { kind: 'offer', label: 'Offer from the employer', bps: 2000 },
  { kind: 'visa', label: 'Visa issued', bps: 4000 },
  { kind: 'salary', label: 'First salary paid', bps: 4000 },
]

export default function Agency() {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  const [health, setHealth] = useState<Health | null>(null)
  const [agency, setAgency] = useState<any>(undefined)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [reg, setReg] = useState({ name: '', licenseNo: '' })
  const [form, setForm] = useState({ jobTitle: '', employerName: '', employerDomain: '', country: 'Saudi Arabia', monthlySalary: '', feeKes: 100000, days: 90 })
  const [stages, setStages] = useState(defaultStages)
  // Demo mode can set the deadline in minutes, so a refund can be shown live.
  const [deadlineUnit, setDeadlineUnit] = useState<'days' | 'minutes'>('days')
  const [created, setCreated] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try {
      setHealth(await api.health())
      if (!wallet) return setAgency(undefined)
      const a = await fetchAgency(connection, wallet)
      setAgency(a)
      if (a) setPlacements((await api.agency(a.pda.toBase58())).placements)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [wallet, connection])
  useEffect(() => { load() }, [load])

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setErr('')
    try { await fn(); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy('') }
  }

  // Demo proofs stand in for the attestor, so they need the admin token (shared with the /admin page).
  const demoProof = async (pk: string) => {
    let token = ''
    try { token = sessionStorage.getItem('adminToken') ?? '' } catch { /* ignore */ }
    if (!token) token = window.prompt('Admin token (demo proofs are KaziSafe-only)') ?? ''
    if (!token) throw new Error('Demo proofs need the admin token')
    const r = await api.demoProof(pk, token)
    try { sessionStorage.setItem('adminToken', token) } catch { /* ignore */ }
    return r
  }

  const totalBps = stages.reduce((a, s) => a + s.bps, 0)

  const submitPlacement = () =>
    run('create', async () => {
      if (!wallet || !health?.mint) throw new Error('Not connected')
      const saved = await api.saveTerms({ ...form, feeKes: Number(form.feeKes), stages })
      const deadline = Math.floor(Date.now() / 1000) + Number(form.days) * (deadlineUnit === 'minutes' && health?.demoMode ? 60 : 86400)
      const r = await createPlacement(connection, wallet, new PublicKey(health.mint), { amountUsdc: saved.amountUsdc, stageBps: saved.stageBps, deadline, termsHash: saved.termsHash })
      setCreated(r.placement)
    })

  return (
    <main className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <h2>Agency dashboard</h2>
          <p className="muted">Create placements, prove each stage, get paid.</p>
        </div>
        <div style={{ flex: 'none' }}><WalletMultiButton /></div>
      </div>

      {!wallet && (
        <div className="card-glass glass">
          <h3>Connect your agency wallet</h3>
          <p className="muted" style={{ marginTop: 6 }}>Use Phantom or Solflare set to devnet. Your wallet is your agency's login and where your payouts land.</p>
        </div>
      )}

      {wallet && agency === null && (
        <div className="card-glass glass" style={{ maxWidth: 560 }}>
          <h3>Register your agency</h3>
          <p className="muted" style={{ margin: '6px 0 16px' }}>We check you against the NEA licensed list before you can take payments.</p>
          <form className="form" onSubmit={(e) => { e.preventDefault(); run('register', () => registerAgency(connection, wallet, reg.name, reg.licenseNo)) }}>
            <label>Registered name<input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} maxLength={64} required /></label>
            <label>NEA licence number<input value={reg.licenseNo} onChange={(e) => setReg({ ...reg, licenseNo: e.target.value })} maxLength={32} required /></label>
            <button className="btn btn-primary" disabled={!!busy}>{busy ? 'Confirm in your wallet…' : 'Register'}</button>
          </form>
        </div>
      )}

      {wallet && agency && (
        <>
          <div className="grid3" style={{ marginBottom: 24 }}>
            <div className="card"><small className="muted">Agency</small><h3>{agency.name}</h3>
              {agency.verified ? <span className="chip chip-ok">✓ Verified</span> : <span className="chip chip-brand">Waiting for NEA check</span>}
            </div>
            <div className="card"><small className="muted">Placements</small><h3>{agency.placementsCreated.toString()} created · {agency.placementsCompleted.toString()} completed</h3>
              <span className="muted">{agency.placementsRefunded.toString()} refunded</span></div>
            <div className="card"><small className="muted">Released to you</small><h3>{usdc(agency.totalReleased.toString())}</h3>
              <Link to={`/agencies/${agency.pda.toBase58()}`} className="muted">Public record →</Link></div>
          </div>

          {agency.verified && (
            <div className="card-glass glass" style={{ marginBottom: 24 }}>
              <h3>New placement</h3>
              <form className="form" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); submitPlacement() }}>
                <div className="row">
                  <label>Job title<input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} required /></label>
                  <label>Employer<input value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} required /></label>
                </div>
                <div className="row">
                  <label>Employer email domain<input placeholder="company.com" value={form.employerDomain} onChange={(e) => setForm({ ...form, employerDomain: e.target.value })} required /></label>
                  <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></label>
                </div>
                <div className="row">
                  <label>Monthly salary<input placeholder="SAR 2,500" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} required /></label>
                  <label>Fee (KES)<input type="number" min={1} value={form.feeKes} onChange={(e) => setForm({ ...form, feeKes: Number(e.target.value) })} required /></label>
                  <label>Deadline ({health?.demoMode ? deadlineUnit : 'days'})
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min={1} max={365} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} required style={{ flex: 1, minWidth: 0 }} />
                      {health?.demoMode && (
                        <select value={deadlineUnit} onChange={(e) => setDeadlineUnit(e.target.value as 'days' | 'minutes')} style={{ flex: 'none' }}>
                          <option value="days">days</option>
                          <option value="minutes">minutes (demo)</option>
                        </select>
                      )}
                    </div>
                  </label>
                </div>
                <div className="tracker">
                  {stages.map((s, i) => (
                    <div className="stage" key={s.kind}>
                      <span className="check active">{i + 1}</span>
                      <div className="meta"><b>{s.label}</b><small>{s.kind === 'offer' ? 'Proven by the employer\'s signed offer email' : 'Proven from the official system (demo proof in this build)'}</small></div>
                      <input type="number" min={0} max={100} style={{ width: 80, flex: 'none' }} value={s.bps / 100}
                        onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, bps: Math.round(Number(e.target.value) * 100) } : x)))} />
                      <span>%</span>
                    </div>
                  ))}
                </div>
                {totalBps !== 10000 && <p className="error">Stage shares add up to {totalBps / 100}%. They need to add up to 100%.</p>}
                <p className="muted" style={{ fontSize: 14 }}>Held as {usdc(Math.round((form.feeKes / (health?.kesPerUsd ?? 129)) * 1e6))} at KES {health?.kesPerUsd} per USD.</p>
                <button className="btn btn-primary" disabled={!!busy || totalBps !== 10000}>{busy === 'create' ? 'Confirm in your wallet…' : 'Create placement'}</button>
              </form>
              {created && (
                <p className="notice" style={{ marginTop: 16 }}>
                  Created. Send this link to the job seeker so they can pay: <Link to={`/p/${created}`}>{location.origin}/p/{created}</Link>
                </p>
              )}
            </div>
          )}

          <h3 style={{ marginBottom: 12 }}>Your placements</h3>
          {!placements.length && <p className="muted">None yet.</p>}
          <div className="tracker">
            {placements.map((p) => {
              const next = p.terms?.stages[p.stagesDone]
              return (
                <div className="stage" key={p.pubkey} style={{ flexWrap: 'wrap' }}>
                  <div className="meta">
                    <b>{p.terms?.jobTitle ?? 'Placement'} · {p.terms?.employerName}</b>
                    <small>{p.terms ? kes(p.terms.feeKes) : ''} · {p.status} · stage {p.stagesDone}/{p.stageCount} · <Link to={`/p/${p.pubkey}`}>job seeker link</Link> · <a href={explorer('address', p.pubkey)} target="_blank" rel="noreferrer">explorer</a></small>
                  </div>
                  {p.status === 'funded' && next?.kind === 'offer' && (
                    <label className="btn btn-primary btn-sm" style={{ flex: 'none' }}>
                      {busy === p.pubkey ? 'Checking…' : 'Upload offer email (.eml)'}
                      <input type="file" accept=".eml,message/rfc822" hidden onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) run(p.pubkey, () => api.offerProof(p.pubkey, f))
                      }} />
                    </label>
                  )}
                  {p.status === 'funded' && next && next.kind !== 'offer' && health?.demoMode && (
                    <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} disabled={!!busy} onClick={() => run(p.pubkey, () => demoProof(p.pubkey))}>
                      {busy === p.pubkey ? 'Confirming…' : `Demo proof: ${next.label}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {err && <p className="error" style={{ marginTop: 16 }}>{err}</p>}
    </main>
  )
}
