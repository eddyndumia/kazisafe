import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB27A" />
          <stop offset="1" stopColor="#E2500A" />
        </linearGradient>
      </defs>
      <path d="M32 4 8 13v17c0 15 10 26 24 30 14-4 24-15 24-30V13L32 4z" fill="url(#lg)" />
      <path d="m21 32 8 8 15-16" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <>
      <div className="promo">
        Building for the Colosseum Crypto World's Fair. Running on Solana devnet, no real money yet.
      </div>
      <div className="nav-shell">
        <nav className="nav glass">
          <Link to="/" className="brand">
            <Logo /> KaziSafe
          </Link>
          <div className="nav-links">
            <a href="/#how">How it works</a>
            <NavLink to="/agencies">Agency scoreboard</NavLink>
            <a href="/#why">Why onchain</a>
            <a href="/#faq">FAQs</a>
          </div>
          <Link to="/agency" className="btn btn-dark btn-sm">For agencies</Link>
        </nav>
      </div>
      <Outlet />
      <footer>
        <div className="wrap">
          <span>KaziSafe. Recruitment fees held safe until the job is real.</span>
          <span>
            Built in Nairobi · <Link to="/agencies">Scoreboard</Link> · <Link to="/admin">Admin</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
