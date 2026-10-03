// End-to-end smoke test against a running server on devnet, using a throwaway "DEMO" agency wallet.
// Usage: npx tsx scripts/smoke.ts   (server must be running; reads ADMIN_TOKEN from .env)
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import anchor, { type Idl } from "@anchor-lang/core";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const { AnchorProvider, BN, Program, Wallet } = anchor;
const API = process.env.API ?? "http://127.0.0.1:8787";
const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(root("keys/admin.json"), "utf8"))));
const connection = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const idl = JSON.parse(readFileSync(root("target/idl/kazisafe.json"), "utf8")) as Idl;

const call = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(API + path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j)}`);
  return j as any;
};

const health = await call("/api/health");
const mint = new PublicKey(health.mint);
const agencyKey = Keypair.generate();
await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: agencyKey.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL })), [admin]);
const program = new Program(idl, new AnchorProvider(connection, new Wallet(agencyKey), { commitment: "confirmed" }));
const m = program.methods as any;
const pid = program.programId;
const config = PublicKey.findProgramAddressSync([Buffer.from("config")], pid)[0];
const agency = PublicKey.findProgramAddressSync([Buffer.from("agency"), agencyKey.publicKey.toBuffer()], pid)[0];

await m.registerAgency("DEMO Safari Manpower Services", "DEMO-NEA-0002").accountsStrict({ authority: agencyKey.publicKey, agency, systemProgram: SystemProgram.programId }).rpc();
console.log("registered", agency.toBase58());
console.log("verify", (await call(`/api/agencies/${agency.toBase58()}/verify`, {}, { "x-admin-token": process.env.ADMIN_TOKEN! })).tx);

async function place(id: number, days: number, seconds = 0) {
  const t = await call("/api/terms", {
    jobTitle: "Caregiver", employerName: "DEMO Al Noor Home Care", employerDomain: "example.com", country: "Saudi Arabia",
    monthlySalary: "SAR 2,500", feeKes: 100000,
    stages: [{ kind: "visa", label: "Visa issued", bps: 5000 }, { kind: "salary", label: "First salary paid", bps: 5000 }],
  });
  const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(id));
  const placement = PublicKey.findProgramAddressSync([Buffer.from("placement"), agency.toBuffer(), b], pid)[0];
  const deadline = Math.floor(Date.now() / 1000) + days * 86400 + seconds;
  await m.createPlacement({ amount: new BN(t.amountUsdc), stageBps: t.stageBps, deadline: new BN(deadline), termsHash: [...Buffer.from(t.termsHash, "hex")] })
    .accountsStrict({ authority: agencyKey.publicKey, config, agency, placement, mint, vault: getAssociatedTokenAddressSync(mint, placement, true), tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  return placement.toBase58();
}

// 1) happy path
const p1 = await place(0, 90);
console.log("placement 1", p1);
console.log("pay", await call(`/api/placements/${p1}/pay`, { phone: "0712345678" }));
console.log("visa", (await call(`/api/placements/${p1}/proofs/demo`, {})).tx);
console.log("salary", (await call(`/api/placements/${p1}/proofs/demo`, {})).tx);
console.log("status", (await call(`/api/placements/${p1}`)).status);

// 2) refund path: deadline 25 seconds out
const p2 = await place(1, 0, 25);
console.log("placement 2", p2);
await call(`/api/placements/${p2}/pay`, { phone: "0798765432" });
console.log("visa", (await call(`/api/placements/${p2}/proofs/demo`, {})).tx);
await new Promise((r) => setTimeout(r, 35_000));
console.log("refund", await call(`/api/placements/${p2}/refund`, {}));
console.log("status", (await call(`/api/placements/${p2}`)).status);
console.log("agency", await call(`/api/agencies/${agency.toBase58()}`).then((a) => ({ completed: a.placementsCompleted, refunded: a.placementsRefunded })));
