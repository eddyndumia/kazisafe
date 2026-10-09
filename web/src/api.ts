import { API } from './config'

export type Stage = { kind: 'offer' | 'visa' | 'salary'; label: string; bps: number }
export type Terms = {
  jobTitle: string
  employerName: string
  employerDomain: string
  country: string
  monthlySalary: string
  feeKes: number
  stages: Stage[]
}
export type Placement = {
  pubkey: string
  agency: string
  id: string
  amount: string
  released: string
  deadline: string
  createdAt: string
  stageCount: number
  stageBps: number[]
  stagesDone: number
  status: 'created' | 'funded' | 'completed' | 'refunded' | 'cancelled'
  termsHash: string
  terms: Terms | null
  proofs?: Array<{ stage: number; kind: string; proof_hash: string; detail: string; demo: number; tx: string; created_at: number }>
  payment?: { phone: string; amount_kes: number; status: string; receipt: string; fund_tx: string } | null
  refund?: { amount_kes: number; tx: string; mpesa_ref: string } | null
}
export type AgencyRow = {
  pubkey: string
  authority: string
  name: string
  licenseNo: string
  verified: boolean
  placementsCreated: string
  placementsCompleted: string
  placementsRefunded: string
  totalReleased: string
  totalRefunded: string
  successRate: number | null
}
export type Health = { programId: string; mint: string | null; feeBps: number | null; kesPerUsd: number; mpesa: string; demoMode: boolean }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? (body.errors ? body.errors.join('. ') : `Request failed (${r.status})`))
  return body as T
}
const json = (method: string, data: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(data),
})

export const api = {
  health: () => req<Health>('/api/health'),
  agencies: () => req<AgencyRow[]>('/api/agencies'),
  agency: (pk: string) => req<AgencyRow & { placements: Placement[] }>(`/api/agencies/${pk}`),
  placement: (pk: string) => req<Placement>(`/api/placements/${pk}`),
  saveTerms: (t: Terms) => req<{ termsHash: string; amountUsdc: number; stageBps: number[] }>('/api/terms', json('POST', t)),
  pay: (pk: string, phone: string) => req<{ mode: string }>(`/api/placements/${pk}/pay`, json('POST', { phone })),
  offerProof: (pk: string, file: File) => {
    const fd = new FormData()
    fd.append('eml', file)
    return req<{ domain: string; subject: string; tx: string }>(`/api/placements/${pk}/proofs/offer`, { method: 'POST', body: fd })
  },
  demoProof: (pk: string, token: string) => req<{ kind: string; tx: string }>(`/api/placements/${pk}/proofs/demo`, json('POST', {}, { 'x-admin-token': token })),
  refund: (pk: string) => req<{ tx: string; amountKes: number }>(`/api/placements/${pk}/refund`, json('POST', {})),
  verify: (pk: string, token: string, force = false) =>
    req<{ tx: string; manualOverride: boolean }>(`/api/agencies/${pk}/verify${force ? '?force=1' : ''}`, json('POST', {}, { 'x-admin-token': token })),
}

export const kes = (n: number) => 'KES ' + Math.round(n).toLocaleString('en-KE')
export const usdc = (base: string | number) => (Number(base) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' USDC'
export const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`
