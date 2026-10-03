import { Link } from 'react-router-dom'
import { useState } from 'react'
import GlassShield from '../components/GlassShield'

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const faqs = [
  ['Do I need crypto or a wallet?', 'No. You pay by M-Pesa and any refund comes back to M-Pesa. The blockchain is only there so the money is held by rules nobody can bend, not by a person.'],
  ['What happens if the job never comes?', 'Every placement has a deadline. If the job is not completed by then, the money that has not been released goes back to you automatically. Anyone can trigger the refund, you do not need permission from the agency or from us.'],
  ['How does the agency prove each stage?', 'The offer has to come from the employer\'s real email domain, and we check its digital signature so it cannot be faked or edited. The visa and first salary are proven from the systems that show them. Proofs are recorded onchain so anyone can audit them.'],
  ['Who pays KaziSafe?', 'The agency. We take 1% of each payment released to them. Refunds are free and job seekers never pay a fee.'],
  ['Which agencies can use it?', 'Only agencies on the National Employment Authority licensed list. We check every agency before it can take a single shilling.'],
  ['Is this live?', 'Not yet. This version runs on Solana devnet for the Colosseum Crypto World\'s Fair. We are talking to agencies and job seekers now. If you have paid an agency for a job abroad, we would love to hear how it went.'],
]

export default function Landing() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <>
      <header className="hero">
        <div className="hero-bg" />
        <i className="streak" style={{ top: '22%', right: '4%', width: 260, ['--r' as any]: '-28deg' }} />
        <i className="streak" style={{ top: '48%', right: '30%', width: 180, ['--r' as any]: '-35deg', animationDelay: '1.5s' }} />
        <i className="streak" style={{ top: '70%', right: '8%', width: 220, ['--r' as any]: '-20deg', animationDelay: '3s' }} />
        <div className="wrap hero-grid">
          <div>
            <span className="chip chip-brand">For jobs abroad</span>
            <h1 style={{ marginTop: 18 }}>Pay for the job only when the job is real</h1>
            <p className="lead">
              KaziSafe holds your recruitment fee in escrow. The agency gets paid step by step as your offer, visa and first salary are proven. If the job never comes, you get your money back on M-Pesa.
            </p>
            <div className="hero-ctas">
              <Link to="/agencies" className="btn btn-primary">Check an agency</Link>
              <Link to="/agency" className="btn btn-ghost">I'm an agency</Link>
            </div>
          </div>
          <div className="hero-art">
            <GlassShield />
          </div>
        </div>
        <div className="wrap stats">
          {[
            ['M-Pesa', 'in and out, no wallet needed', 'M3 7h18v10H3zM7 12h.01M17 12h.01'],
            ['3 stages', 'offer, visa, first salary', 'M4 12l5 5L20 6'],
            ['Auto refund', 'if the deadline passes', 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'],
            ['0 KES', 'fees for job seekers', 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
          ].map(([b, s, d]) => (
            <div className="stat glass" key={b}>
              <span className="stat-icon"><Icon d={d} /></span>
              <div><b>{b}</b><span>{s}</span></div>
            </div>
          ))}
        </div>
      </header>

      <section className="block" id="how">
        <div className="wrap">
          <div className="center">
            <h2>How it works</h2>
            <p className="section-sub">No fine print. The money moves only when there's proof.</p>
          </div>
          <div className="grid3">
            <div className="card">
              <h3>1. You pay into escrow</h3>
              <p className="muted">Pay the agency fee by M-Pesa. It's locked onchain where nobody can touch it, not the agency and not us.</p>
              <div className="money-card" style={{ marginTop: 26 }}>
                <div className="lbl">Held in escrow</div>
                <div className="big">KES 110,000</div>
                <div className="lbl" style={{ marginTop: 18 }}>Caregiver · Riyadh · deadline 90 days</div>
              </div>
            </div>
            <div className="card">
              <h3>2. Each stage is proven</h3>
              <p className="muted">The agency is paid a share each time a stage is proven from the source.</p>
              <div className="pills" style={{ marginTop: 22 }}>
                {[['Offer from the employer', 20], ['Visa issued', 40], ['First salary paid', 40]].map(([t, p]) => (
                  <div className="pill" key={t}>
                    <span>{t} <span className="muted">· {p}%</span></span>
                    <span className="check">✓</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>3. Or you get it back</h3>
              <p className="muted">If the deadline passes before the job is done, whatever wasn't released goes back to your M-Pesa automatically.</p>
              <div className="bars" style={{ marginTop: 40 }}>
                {[['20%', 30], ['', 45], ['60%', 62], ['', 80], ['100%', 100]].map(([l, h], i) => (
                  <div className="bar" key={i} style={{ height: `${h}%`, opacity: 0.45 + i * 0.13 }}>{l && <small>{l}</small>}</div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>Released only as each stage is proven</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="why" style={{ paddingTop: 0 }}>
        <div className="wrap grid2">
          <div className="card-glass glass">
            <span className="chip chip-brand">For job seekers</span>
            <h2 style={{ marginTop: 16, fontSize: 34 }}>Your money waits for the job</h2>
            <div className="pills" style={{ marginTop: 22 }}>
              {['Pay and get refunds by M-Pesa', 'See every stage and every payment', 'Check any agency\'s record before you pay', 'No fees for you, ever'].map((t) => (
                <div className="pill" key={t}><span>{t}</span><span className="check">✓</span></div>
              ))}
            </div>
          </div>
          <div className="card-glass glass">
            <span className="chip chip-brand">For agencies</span>
            <h2 style={{ marginTop: 16, fontSize: 34 }}>A record you can't fake wins clients</h2>
            <div className="pills" style={{ marginTop: 22 }}>
              {['Show job seekers the money is safe', 'Get paid the moment each stage is proven', 'Public record of every person you placed', '1% per release, nothing upfront'].map((t) => (
                <div className="pill" key={t}><span>{t}</span><span className="check">✓</span></div>
              ))}
            </div>
            <Link to="/agency" className="btn btn-primary" style={{ marginTop: 22 }}>Register your agency</Link>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="money-card" style={{ padding: '48px 40px', borderRadius: 28 }}>
            <div className="grid2" style={{ alignItems: 'center' }}>
              <div>
                <h2 style={{ color: '#fff4ec' }}>Why onchain</h2>
                <p style={{ marginTop: 14, opacity: 0.85 }}>
                  An escrow company holding millions of shillings for job seekers is one more place money can disappear. A Solana program can't run off with it. The rules are public, the refund is automatic, and every agency's record lives where nobody can edit it.
                </p>
              </div>
              <div className="pills">
                {['Money held by code, not a person', 'Refund anyone can trigger after the deadline', 'Proof of every stage stored onchain', 'Open source'].map((t) => (
                  <div className="pill" key={t} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff4ec', borderColor: 'rgba(255,255,255,0.15)' }}>
                    <span>{t}</span><span className="check">✓</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 className="center" style={{ marginBottom: 36 }}>FAQs</h2>
          <div className="pills">
            {faqs.map(([q, a], i) => (
              <div key={q} className="card-glass glass" style={{ padding: '18px 22px', borderRadius: 18, cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink)', fontWeight: 600 }}>
                  {q}<span>{open === i ? '−' : '+'}</span>
                </div>
                {open === i && <p style={{ marginTop: 10 }}>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
