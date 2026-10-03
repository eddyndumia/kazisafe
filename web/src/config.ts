export const API = import.meta.env.VITE_API_URL ?? ''
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? 'https://api.devnet.solana.com'
export const CLUSTER = import.meta.env.VITE_CLUSTER ?? 'devnet'
export const explorer = (kind: 'tx' | 'address', id: string) =>
  `https://explorer.solana.com/${kind}/${id}?cluster=${CLUSTER}`
