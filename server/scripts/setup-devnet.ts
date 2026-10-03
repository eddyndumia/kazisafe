// One-time devnet setup after the program is deployed:
// creates the test USDC mint, treasury, config account, and funds the ramp wallet with test USDC + SOL.
// Usage: RPC_URL=https://api.devnet.solana.com npx tsx scripts/setup-devnet.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import anchor, { type Idl } from "@anchor-lang/core";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const { AnchorProvider, Program, Wallet } = anchor;
const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const key = (n: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(root(`keys/${n}.json`), "utf8"))));
const connection = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const admin = key("admin"), attestor = key("attestor"), ramp = key("ramp");
const idl = JSON.parse(readFileSync(root("target/idl/kazisafe.json"), "utf8")) as Idl;
const program = new Program(idl, new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" }));
const config = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];
const statePath = root("keys/devnet-state.json");

async function topUp(to: PublicKey, sol: number) {
  if ((await connection.getBalance(to)) >= sol * LAMPORTS_PER_SOL * 0.5) return;
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: to, lamports: sol * LAMPORTS_PER_SOL }));
  await sendAndConfirmTransaction(connection, tx, [admin]);
}

const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
console.log("admin balance", (await connection.getBalance(admin.publicKey)) / LAMPORTS_PER_SOL, "SOL");

if (!state.mint) {
  state.mint = (await createMint(connection, admin, admin.publicKey, null, 6)).toBase58();
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
const mint = new PublicKey(state.mint);
const treasury = await getOrCreateAssociatedTokenAccount(connection, admin, mint, admin.publicKey);
console.log("test USDC mint", mint.toBase58(), "treasury", treasury.address.toBase58());

if (!(await connection.getAccountInfo(config))) {
  const sig = await (program.methods as any)
    .initializeConfig(attestor.publicKey, 100)
    .accountsStrict({ admin: admin.publicKey, config, mint, treasury: treasury.address, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("config initialised", sig);
}

await topUp(attestor.publicKey, 0.5);
await topUp(ramp.publicKey, 0.5);
const rampToken = await getOrCreateAssociatedTokenAccount(connection, admin, mint, ramp.publicKey);
await mintTo(connection, admin, mint, rampToken.address, admin, 1_000_000n * 1_000_000n);
console.log("ramp funded with 1,000,000 test USDC");
console.log("Done. Program", program.programId.toBase58());
