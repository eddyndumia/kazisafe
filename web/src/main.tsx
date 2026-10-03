import './polyfill'
import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import { RPC_URL } from './config'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Seeker from './pages/Seeker'
import Agency from './pages/Agency'
import Scoreboard from './pages/Scoreboard'
import AgencyDetail from './pages/AgencyDetail'
import Admin from './pages/Admin'

function App() {
  const wallets = useMemo(() => [], [])
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/p/:pubkey" element={<Seeker />} />
                <Route path="/agency" element={<Agency />} />
                <Route path="/agencies" element={<Scoreboard />} />
                <Route path="/agencies/:pubkey" element={<AgencyDetail />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
