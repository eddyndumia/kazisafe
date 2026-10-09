import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import anchor, { type Idl } from "@anchor-lang/core";
const { AnchorProvider, BN, Program, Wallet } = anchor;
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

// target/ is git-ignored, so hosted builds fall back to the copy the web app ships with.
const idlPath = [process.env.IDL_PATH, "../../target/idl/kazisafe.json", "../../web/src/idl.json"]
  .filter((p): p is string => !!p)
  .map((p) => (p.startsWith("/") ? p : fileURLToPath(new URL(p, import.meta.url))))
  .find((p) => existsSync(p))!;

function loadKey(envName: string, file: string): Keypair {
  const v = process.env[envName];
  if (v) return Keypair.fromSecretKey(v.trim().startsWith("[") ? Uint8Array.from(JSON.parse(v)) : bs58.decode(v.trim()));
  const p = fileURLToPath(new URL(`../../keys/${file}`, import.meta.url));
  if (!existsSync(p)) throw new Error(`Missing key: set ${envName} or create keys/${file}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
}

export const connection = new Connection(process.env.RPC_URL ?? "http://127.0.0.1:8899", "confirmed");
export const admin = loadKey("ADMIN_KEY", "admin.json");
export const attestor = loadKey("ATTESTOR_KEY", "attestor.json");
export const ramp = loadKey("RAMP_KEY", "ramp.json");

const idl = JSON.parse(readFileSync(idlPath, "utf8")) as Idl;
const provider = (signer: Keypair) => new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
export const program = new Program(idl, provider(admin));
const programAs = (signer: Keypair) => new Program(idl, provider(signer));

export const programId = program.programId;
export const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
export const agencyPda = (authority: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("agency"), authority.toBuffer()], programId)[0];
export const placementPda = (agency: PublicKey, id: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddressSync([Buffer.from("placement"), agency.toBuffer(), b], programId)[0];
};

const acc = program.account as any;

export async function getConfig() {
  return acc.config.fetch(configPda) as Promise<{ admin: PublicKey; attestor: PublicKey; mint: PublicKey; treasury: PublicKey; feeBps: number }>;
}

export async function listAgencies() {
  const all = await acc.agency.all();
  return all.map((a: any) => ({ pubkey: a.publicKey.toBase58(), ...serialise(a.account) }));
}

export async function listPlacements(agency?: string) {
  const filters = agency ? [{ memcmp: { offset: 8, bytes: agency } }] : [];
  const all = await acc.placement.all(filters);
  return all.map((p: any) => ({ pubkey: p.publicKey.toBase58(), ...serialise(p.account) }));
}

export async function getPlacement(pubkey: string) {
  const p = await acc.placement.fetch(new PublicKey(pubkey));
  return { pubkey, ...serialise(p) };
}

export async function getAgency(pubkey: string) {
  return { pubkey, ...serialise(await acc.agency.fetch(new PublicKey(pubkey))) };
}

export async function setAgencyVerified(agency: string, verified: boolean) {
  return program.methods
    .setAgencyVerified(verified)
    .accounts({ admin: admin.publicKey, config: configPda, agency: new PublicKey(agency) } as any)
    .rpc();
}

/** Ramp wallet pays the placement on the job seeker's behalf after their M-Pesa payment lands. */
export async function fundPlacement(placement: string, seekerRef: Buffer) {
  const cfg = await getConfig();
  const placementPk = new PublicKey(placement);
  const rampToken = await getOrCreateAssociatedTokenAccount(connection, ramp, cfg.mint, ramp.publicKey);
  return programAs(ramp)
    .methods.fundPlacement([...seekerRef])
    .accounts({
      payer: ramp.publicKey,
      config: configPda,
      placement: placementPk,
      mint: cfg.mint,
      payerToken: rampToken.address,
      vault: getAssociatedTokenAddressSync(cfg.mint, placementPk, true),
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
}

export async function confirmStage(placement: string, stage: number, proofHash: Buffer) {
  const cfg = await getConfig();
  const placementPk = new PublicKey(placement);
  const p = await acc.placement.fetch(placementPk);
  const agency = await acc.agency.fetch(p.agency);
  const agencyToken = await getOrCreateAssociatedTokenAccount(connection, attestor, cfg.mint, agency.authority);
  return programAs(attestor)
    .methods.confirmStage(stage, [...proofHash])
    .accounts({
      attestor: attestor.publicKey,
      config: configPda,
      agency: p.agency,
      placement: placementPk,
      mint: cfg.mint,
      vault: getAssociatedTokenAddressSync(cfg.mint, placementPk, true),
      agencyToken: agencyToken.address,
      treasury: cfg.treasury,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
}

export async function refund(placement: string) {
  const cfg = await getConfig();
  const placementPk = new PublicKey(placement);
  const p = await acc.placement.fetch(placementPk);
  const refundToken = await getOrCreateAssociatedTokenAccount(connection, ramp, cfg.mint, p.refundTo);
  return programAs(ramp)
    .methods.refund()
    .accounts({
      caller: ramp.publicKey,
      config: configPda,
      agency: p.agency,
      placement: placementPk,
      mint: cfg.mint,
      vault: getAssociatedTokenAddressSync(cfg.mint, placementPk, true),
      refundToken: refundToken.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
}

/** Turns Anchor account data (PublicKey, BN, byte arrays, enums) into plain JSON. */
export function serialise(v: any): any {
  if (v instanceof PublicKey) return v.toBase58();
  if (BN.isBN(v)) return v.toString();
  if (Array.isArray(v)) {
    if (v.length && v.every((x) => typeof x === "number") && v.length === 32) return Buffer.from(v).toString("hex");
    return v.map(serialise);
  }
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 1 && v[keys[0]] && typeof v[keys[0]] === "object" && !Object.keys(v[keys[0]]).length) return keys[0];
    return Object.fromEntries(keys.map((k) => [k, serialise(v[k])]));
  }
  return v;
}
