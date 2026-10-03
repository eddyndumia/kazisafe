// Program tests on LiteSVM (in-process Solana runtime). Runs on Linux (see `npm run test:program`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LiteSVM, FailedTransactionMetadata, Clock } from "litesvm";
import anchor, { type Idl } from "@anchor-lang/core";
const { AnchorProvider, BN, Program, Wallet } = anchor;
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const idl = JSON.parse(readFileSync(root("target/idl/kazisafe.json"), "utf8")) as Idl;
const PROGRAM_ID = new PublicKey((idl as any).address);
const DAY = 86_400n;

function setup() {
  const svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ID, root("target/deploy/kazisafe.so"));
  const kp = () => {
    const k = Keypair.generate();
    svm.airdrop(k.publicKey, 10_000_000_000n);
    return k;
  };
  const admin = kp(), attestor = kp(), agencyAuth = kp(), seeker = kp(), stranger = kp();
  const program = new Program(idl, new AnchorProvider(new Connection("http://localhost:1"), new Wallet(admin), {}));

  const send = (ixs: TransactionInstruction[], signers: Keypair[]) => {
    const tx = new Transaction().add(...ixs);
    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = signers[0].publicKey;
    tx.sign(...signers);
    const r = svm.sendTransaction(tx);
    svm.expireBlockhash();
    if (r instanceof FailedTransactionMetadata) throw new Error(r.meta().logs().join("\n"));
    return r;
  };
  const balance = (ata: PublicKey) => {
    const a = svm.getAccount(ata);
    return a ? AccountLayout.decode(Buffer.from(a.data)).amount : 0n;
  };
  const decode = (name: string, pk: PublicKey) => program.coder.accounts.decode(name, Buffer.from(svm.getAccount(pk)!.data));
  const now = () => svm.getClock().unixTimestamp;
  const warp = (secs: bigint) => {
    const c = svm.getClock();
    svm.setClock(new Clock(c.slot + 1000n, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, c.unixTimestamp + secs));
  };

  // test USDC
  const mint = Keypair.generate();
  send(
    [
      SystemProgram.createAccount({ fromPubkey: admin.publicKey, newAccountPubkey: mint.publicKey, lamports: Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))), space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(mint.publicKey, 6, admin.publicKey, null),
    ],
    [admin, mint],
  );
  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mint.publicKey, owner, true);
  const makeAta = (owner: PublicKey) => send([createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata(owner), owner, mint.publicKey)], [admin]);
  for (const o of [admin.publicKey, agencyAuth.publicKey, seeker.publicKey, stranger.publicKey]) makeAta(o);
  send([createMintToInstruction(mint.publicKey, ata(seeker.publicKey), admin.publicKey, 10_000_000_000n)], [admin]);
  send([createMintToInstruction(mint.publicKey, ata(stranger.publicKey), admin.publicKey, 10_000_000_000n)], [admin]);

  const config = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
  const agency = PublicKey.findProgramAddressSync([Buffer.from("agency"), agencyAuth.publicKey.toBuffer()], PROGRAM_ID)[0];
  const placementAt = (id: number) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(id));
    return PublicKey.findProgramAddressSync([Buffer.from("placement"), agency.toBuffer(), b], PROGRAM_ID)[0];
  };
  const treasury = ata(admin.publicKey);
  const m = program.methods as any;

  const ix = {
    init: (fee = 100) => m.initializeConfig(attestor.publicKey, fee).accountsStrict({ admin: admin.publicKey, config, mint: mint.publicKey, treasury, systemProgram: SystemProgram.programId }).instruction(),
    register: () => m.registerAgency("DEMO Bright Horizons Recruitment Ltd", "DEMO-NEA-0001").accountsStrict({ authority: agencyAuth.publicKey, agency, systemProgram: SystemProgram.programId }).instruction(),
    verify: (signer = admin) => m.setAgencyVerified(true).accountsStrict({ admin: signer.publicKey, config, agency }).instruction(),
    create: (id: number, amount: bigint, stageBps: number[], deadline: bigint) =>
      m
        .createPlacement({ amount: new BN(amount.toString()), stageBps, deadline: new BN(deadline.toString()), termsHash: Array(32).fill(7) })
        .accountsStrict({
          authority: agencyAuth.publicKey,
          config,
          agency,
          placement: placementAt(id),
          mint: mint.publicKey,
          vault: ata(placementAt(id)),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    fund: (id: number, payer: Keypair) =>
      m.fundPlacement(Array(32).fill(1)).accountsStrict({ payer: payer.publicKey, config, placement: placementAt(id), mint: mint.publicKey, payerToken: ata(payer.publicKey), vault: ata(placementAt(id)), tokenProgram: TOKEN_PROGRAM_ID }).instruction(),
    confirm: (id: number, stage: number, signer = attestor) =>
      m
        .confirmStage(stage, Array(32).fill(9))
        .accountsStrict({ attestor: signer.publicKey, config, agency, placement: placementAt(id), mint: mint.publicKey, vault: ata(placementAt(id)), agencyToken: ata(agencyAuth.publicKey), treasury, tokenProgram: TOKEN_PROGRAM_ID })
        .instruction(),
    refund: (id: number, to: PublicKey) =>
      m.refund().accountsStrict({ caller: stranger.publicKey, config, agency, placement: placementAt(id), mint: mint.publicKey, vault: ata(placementAt(id)), refundToken: ata(to), tokenProgram: TOKEN_PROGRAM_ID }).instruction(),
  };

  return { svm, send, balance, decode, now, warp, ix, ata, admin, attestor, agencyAuth, seeker, stranger, agency, placementAt, treasury };
}

async function ready() {
  const t = setup();
  t.send([await t.ix.init()], [t.admin]);
  t.send([await t.ix.register()], [t.agencyAuth]);
  return t;
}

const AMOUNT = 775_000_000n; // ~KES 100,000 at 129 KES/USD
const STAGES = [2000, 4000, 4000];

test("happy path: fund, three proven stages, agency paid minus 1% fee, scoreboard updated", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + 90n * DAY)], [t.agencyAuth]);
  const seekerBefore = t.balance(t.ata(t.seeker.publicKey));
  t.send([await t.ix.fund(0, t.seeker)], [t.seeker]);
  assert.equal(t.balance(t.ata(t.placementAt(0))), AMOUNT);
  assert.equal(seekerBefore - t.balance(t.ata(t.seeker.publicKey)), AMOUNT);

  t.send([await t.ix.confirm(0, 0)], [t.attestor]);
  assert.equal(t.balance(t.ata(t.agencyAuth.publicKey)), (AMOUNT * 2000n) / 10000n - (AMOUNT * 2000n) / 10000n / 100n);
  t.send([await t.ix.confirm(0, 1)], [t.attestor]);
  t.send([await t.ix.confirm(0, 2)], [t.attestor]);

  assert.equal(t.balance(t.ata(t.placementAt(0))), 0n);
  const toAgency = t.balance(t.ata(t.agencyAuth.publicKey));
  const fee = t.balance(t.treasury);
  assert.equal(toAgency + fee, AMOUNT);
  assert.ok(fee > 0n && fee <= AMOUNT / 100n);

  const p = t.decode("placement", t.placementAt(0));
  assert.deepEqual(Object.keys(p.status), ["completed"]);
  const a = t.decode("agency", t.agency);
  assert.equal(a.placementsCompleted.toString(), "1");
  assert.equal(a.totalReleased.toString(), AMOUNT.toString());
});

test("refund after deadline returns only the unreleased money to whoever paid", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + 30n * DAY)], [t.agencyAuth]);
  t.send([await t.ix.fund(0, t.seeker)], [t.seeker]);
  t.send([await t.ix.confirm(0, 0)], [t.attestor]); // offer proven, 20% released
  const afterOffer = t.balance(t.ata(t.seeker.publicKey));

  await assert.rejects(async () => t.send([await t.ix.refund(0, t.seeker.publicKey)], [t.stranger]), /DeadlineNotReached/);
  t.warp(31n * DAY);
  await assert.rejects(async () => t.send([await t.ix.confirm(0, 1)], [t.attestor]), /DeadlinePassed/);

  t.send([await t.ix.refund(0, t.seeker.publicKey)], [t.stranger]); // anyone can trigger it
  assert.equal(t.balance(t.ata(t.seeker.publicKey)) - afterOffer, AMOUNT - (AMOUNT * 2000n) / 10000n);
  assert.equal(t.balance(t.ata(t.placementAt(0))), 0n);
  const a = t.decode("agency", t.agency);
  assert.equal(a.placementsRefunded.toString(), "1");
  await assert.rejects(async () => t.send([await t.ix.refund(0, t.seeker.publicKey)], [t.stranger]), /InvalidStatus/);
});

test("refund cannot be pointed at anyone except the payer", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + DAY)], [t.agencyAuth]);
  t.send([await t.ix.fund(0, t.seeker)], [t.seeker]);
  t.warp(2n * DAY);
  await assert.rejects(async () => t.send([await t.ix.refund(0, t.agencyAuth.publicKey)], [t.stranger]));
});

test("unverified agency cannot create placements", async () => {
  const t = await ready();
  await assert.rejects(async () => t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + DAY)], [t.agencyAuth]), /AgencyNotVerified/);
});

test("only the admin can verify agencies", async () => {
  const t = await ready();
  await assert.rejects(async () => t.send([await t.ix.verify(t.stranger)], [t.stranger]));
});

test("only the attestor can confirm stages, and only in order", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + DAY)], [t.agencyAuth]);
  t.send([await t.ix.fund(0, t.seeker)], [t.seeker]);
  await assert.rejects(async () => t.send([await t.ix.confirm(0, 0, t.agencyAuth)], [t.agencyAuth]));
  await assert.rejects(async () => t.send([await t.ix.confirm(0, 1)], [t.attestor]), /WrongStage/);
});

test("stages must add up to 100% and the deadline must be in the future", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  await assert.rejects(async () => t.send([await t.ix.create(0, AMOUNT, [5000, 4000], t.now() + DAY)], [t.agencyAuth]), /InvalidStages/);
  await assert.rejects(async () => t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() - 1n)], [t.agencyAuth]), /DeadlineInPast/);
});

test("a placement can only be funded once", async () => {
  const t = await ready();
  t.send([await t.ix.verify()], [t.admin]);
  t.send([await t.ix.create(0, AMOUNT, STAGES, t.now() + DAY)], [t.agencyAuth]);
  t.send([await t.ix.fund(0, t.seeker)], [t.seeker]);
  await assert.rejects(async () => t.send([await t.ix.fund(0, t.stranger)], [t.stranger]), /InvalidStatus/);
});
