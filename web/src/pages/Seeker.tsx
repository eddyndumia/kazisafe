import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, kes, type AgencyRow, type Placement } from '../api'
import { explorer } from '../config'

const T = {
  en: {
    job: 'Job', employer: 'Employer', country: 'Country', salary: 'Monthly salary', fee: 'Agency fee',
    held: 'Held safely in escrow', notPaid: 'Not paid yet', deadline: 'Deadline',
    payTitle: 'Pay the agency fee into KaziSafe', payNote: 'The money is locked until each stage is proven. The agency cannot touch it before that.',
    phone: 'Your M-Pesa number', pay: 'Pay with M-Pesa', paying: 'Check your phone for the M-Pesa prompt…',
    stages: 'Stages', done: 'Proven', next: 'Waiting for proof', later: 'Later',
    released: 'Released to agency', refundTitle: 'The deadline has passed', refundNote: 'The job was not completed in time. Get back everything that was not released.',
    refund: 'Refund me', refunded: 'Refunded to your M-Pesa', completed: 'Job confirmed. All stages proven.',
    agency: 'Agency', verified: 'NEA licensed', record: 'See their record', proof: 'proof', demo: 'demo proof',
  },
  sw: {
    job: 'Kazi', employer: 'Mwajiri', country: 'Nchi', salary: 'Mshahara kwa mwezi', fee: 'Ada ya wakala',
    held: 'Imehifadhiwa salama', notPaid: 'Bado haijalipwa', deadline: 'Tarehe ya mwisho',
    payTitle: 'Lipa ada ya wakala kupitia KaziSafe', payNote: 'Pesa inafungwa hadi kila hatua ithibitishwe. Wakala hawezi kuigusa kabla ya hapo.',
    phone: 'Nambari yako ya M-Pesa', pay: 'Lipa kwa M-Pesa', paying: 'Angalia simu yako kwa ombi la M-Pesa…',
    stages: 'Hatua', done: 'Imethibitishwa', next: 'Inasubiri uthibitisho', later: 'Baadaye',
    released: 'Imelipwa kwa wakala', refundTitle: 'Tarehe ya mwisho imepita', refundNote: 'Kazi haikukamilika kwa wakati. Rudishiwa pesa ambayo haijalipwa.',
    refund: 'Nirudishie pesa', refunded: 'Imerudishwa kwa M-Pesa yako', completed: 'Kazi imethibitishwa. Hatua zote zimekamilika.',
    agency: 'Wakala', verified: 'Ameidhinishwa na NEA', record: 'Ona rekodi yao', proof: 'uthibitisho', demo: 'uthibitisho wa majaribio',
  },
}

export default function Seeker() {
  const { pubkey = '' } = useParams()
  const [lang, setLang] = useState<'en' | 'sw'>(() => {
    try { return (localStorage.getItem('lang') as 'en' | 'sw') || 'en' } catch { return 'en' }
  })
  const t = T[lang]
  const [p, setP] = useState<Placement | null>(null)
  const [agency, setAgency] = useState<AgencyRow | null>(null)
  const [err, setErr] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const pl = await api.placement(pubkey)
      setP(pl)
      setAgency(await api.agency(pl.agency))
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [pubkey])
  useEffect(() => { load() }, [load])
  useEffect(() => { try { localStorage.setItem('lang', lang) } catch { /* ignore */ } }, [lang])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn(); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (err && !p) return <div className="wrap page"><p className="error">{err}</p></div>
  if (!p || !p.terms) return <div className="wrap page"><p className="muted">Loading…</p></div>

  const terms = p.terms
  const deadline = new Date(Number(p.deadline) * 1000)
  const pastDeadline = Date.now() > deadline.getTime()
  const releasedPct = Number(p.released) / Number(p.amount)
  const releasedKes = terms.feeKes * releasedPct

  return (
    <main className="wrap page" style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <span className="chip">{t.job}: {terms.jobTitle}</span>
        <div className="tabs" style={{ flex: 'none' }}>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'sw' ? 'on' : ''} onClick={() => setLang('sw')}>Kiswahili</button>
        </div>
      </div>

      <div className="money-card">
        <div className="lbl">{p.status === 'created' ? t.notPaid : p.status === 'refunded' ? t.refunded : t.held}</div>
        <div className="big">{kes(terms.feeKes - (p.status === 'refunded' ? 0 : releasedKes))}</div>
        <div className="lbl" style={{ marginTop: 14 }}>
          {t.released}: {kes(releasedKes)} · {t.deadline}: {deadline.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="grid2" style={{ gap: 12 }}>
          <div><small className="muted">{t.employer}</small><div style={{ color: 'var(--ink)', fontWeight: 600 }}>{terms.employerName}</div></div>
          <div><small className="muted">{t.country}</small><div style={{ color: 'var(--ink)', fontWeight: 600 }}>{terms.country}</div></div>
          <div><small className="muted">{t.salary}</small><div style={{ color: 'var(--ink)', fontWeight: 600 }}>{terms.monthlySalary}</div></div>
          <div><small className="muted">{t.fee}</small><div style={{ color: 'var(--ink)', fontWeight: 600 }}>{kes(terms.feeKes)}</div></div>
        </div>
        {agency && (
          <div className="row" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div>
              <small className="muted">{t.agency}</small>
              <div style={{ color: 'var(--ink)', fontWeight: 600 }}>{agency.name}</div>
            </div>
            <div style={{ flex: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
              {agency.verified && <span className="chip chip-ok">✓ {t.verified}</span>}
              <Link to={`/agencies/${agency.pubkey}`} className="btn btn-ghost btn-sm">{t.record}</Link>
            </div>
          </div>
        )}
      </div>

      {p.status === 'created' && (
        <div className="card-glass glass" style={{ marginTop: 18 }}>
          <h3>{t.payTitle}</h3>
          <p className="muted" style={{ margin: '6px 0 16px' }}>{t.payNote}</p>
          <form className="form" onSubmit={(e) => { e.preventDefault(); act(() => api.pay(pubkey, phone)) }}>
            <label>{t.phone}<input inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? t.paying : `${t.pay} · ${kes(terms.feeKes)}`}</button>
          </form>
        </div>
      )}

      <h3 style={{ margin: '28px 0 12px' }}>{t.stages}</h3>
      <div className="tracker">
        {terms.stages.map((s, i) => {
          const proof = p.proofs?.find((x) => x.stage === i)
          const done = i < p.stagesDone
          const isNext = i === p.stagesDone && p.status === 'funded'
          return (
            <div className="stage" key={i}>
              <span className={`check ${done ? '' : isNext ? 'active' : 'wait'}`}>{done ? '✓' : i + 1}</span>
              <div className="meta">
                <b>{s.label} <span className="muted" style={{ fontWeight: 400 }}>· {s.bps / 100}%</span></b>
                <small>
                  {done ? t.done : isNext ? t.next : t.later}
                  {proof && (
                    <> · <a href={explorer('tx', proof.tx)} target="_blank" rel="noreferrer">{proof.demo ? t.demo : t.proof}</a></>
                  )}
                </small>
              </div>
            </div>
          )
        })}
      </div>

      {p.status === 'completed' && <p className="notice" style={{ marginTop: 18 }}>{t.completed}</p>}
      {p.status === 'funded' && pastDeadline && (
        <div className="card-glass glass" style={{ marginTop: 18 }}>
          <h3>{t.refundTitle}</h3>
          <p className="muted" style={{ margin: '6px 0 14px' }}>{t.refundNote}</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.refund(pubkey))}>{t.refund}</button>
        </div>
      )}
      {p.status === 'refunded' && p.refund && (
        <p className="notice" style={{ marginTop: 18 }}>
          {t.refunded}: {kes(p.refund.amount_kes)} · <a href={explorer('tx', p.refund.tx)} target="_blank" rel="noreferrer">tx</a>
        </p>
      )}
      {err && <p className="error" style={{ marginTop: 14 }}>{err}</p>}
      <p className="muted mono" style={{ marginTop: 26 }}>
        Escrow account: <a href={explorer('address', p.pubkey)} target="_blank" rel="noreferrer">{p.pubkey}</a>
      </p>
    </main>
  )
}
