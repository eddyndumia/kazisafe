import { AnchorProvider, BN, Program, type Idl } from '@anchor-lang/core'
import { PublicKey, SystemProgram, type Connection } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import idl from './idl.json'

export const PROGRAM_ID = new PublicKey((idl as any).address)
export const configPda = PublicKey.findProgramAddressSync([new TextEncoder().encode('config')], PROGRAM_ID)[0]
export const agencyPda = (authority: PublicKey) =>
  PublicKey.findProgramAddressSync([new TextEncoder().encode('agency'), authority.toBuffer()], PROGRAM_ID)[0]
export const placementPda = (agency: PublicKey, id: bigint) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, id, true)
  return PublicKey.findProgramAddressSync([new TextEncoder().encode('placement'), agency.toBuffer(), b], PROGRAM_ID)[0]
}

export function programFor(connection: Connection, wallet: AnchorWallet) {
  return new Program(idl as Idl, new AnchorProvider(connection, wallet, { commitment: 'confirmed' }))
}

export async function fetchAgency(connection: Connection, wallet: AnchorWallet) {
  const program = programFor(connection, wallet)
  const pda = agencyPda(wallet.publicKey)
  const acc = await (program.account as any).agency.fetchNullable(pda)
  return acc ? { pda, ...acc } : null
}

export async function registerAgency(connection: Connection, wallet: AnchorWallet, name: string, licenseNo: string) {
  const program = programFor(connection, wallet)
  return (program.methods as any)
    .registerAgency(name, licenseNo)
    .accountsStrict({ authority: wallet.publicKey, agency: agencyPda(wallet.publicKey), systemProgram: SystemProgram.programId })
    .rpc()
}

export async function createPlacement(
  connection: Connection,
  wallet: AnchorWallet,
  mint: PublicKey,
  args: { amountUsdc: number; stageBps: number[]; deadline: number; termsHash: string },
) {
  const program = programFor(connection, wallet)
  const agency = agencyPda(wallet.publicKey)
  const acc = await (program.account as any).agency.fetch(agency)
  const id = BigInt(acc.placementsCreated.toString())
  const placement = placementPda(agency, id)
  const hash = Array.from(args.termsHash.match(/../g)!.map((h) => parseInt(h, 16)))
  const sig = await (program.methods as any)
    .createPlacement({ amount: new BN(args.amountUsdc), stageBps: args.stageBps, deadline: new BN(args.deadline), termsHash: hash })
    .accountsStrict({
      authority: wallet.publicKey,
      config: configPda,
      agency,
      placement,
      mint,
      vault: getAssociatedTokenAddressSync(mint, placement, true),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  return { sig, placement: placement.toBase58() }
}
