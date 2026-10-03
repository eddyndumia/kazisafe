import "dotenv/config";
import { createHash } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as chain from "./chain.ts";
import { db, type Terms } from "./store.ts";
import { verifyOfferEmail } from "./offerProof.ts";
import { mpesaMode, normalisePhone, parseStkCallback, refundToPhone, stkPush } from "./mpesa.ts";
import { checkNea } from "./nea.ts";

const KES_PER_USD = Number(process.env.KES_PER_USD ?? 129);
const DEMO_MODE = process.env.DEMO_MODE !== "false";
const app = new Hono();
app.use("/api/*", cors());

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest();
const now = () => Math.floor(Date.now() / 1000);
const fail = (c: any, status: number, error: string) => c.json({ error }, status);

function termsFor(hash: string): Terms | null {
  const row = db.prepare("SELECT json FROM terms WHERE hash = ?").get(hash) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Terms) : null;
}

async function placementView(pubkey: string) {
  const p = await chain.getPlacement(pubkey);
  const proofs = db.prepare("SELECT stage, kind, proof_hash, detail, demo, tx, created_at FROM proofs WHERE placement = ? ORDER BY stage").all(pubkey);
  const payment = db.prepare("SELECT phone, amount_kes, status, receipt, fund_tx, created_at FROM payments WHERE placement = ? ORDER BY created_at DESC LIMIT 1").get(pubkey) as any;
  const refund = db.prepare("SELECT amount_kes, tx, mpesa_ref, created_at FROM refunds WHERE placement = ?").get(pubkey);
  if (payment) payment.phone = payment.phone.replace(/^(\d{6})\d{3}/, "$1***");
  return { ...p, terms: termsFor(p.termsHash), proofs, payment: payment ?? null, refund: refund ?? null };
}

// ---------- meta ----------

app.get("/api/health", async (c) => {
  const cfg = await chain.getConfig().catch(() => null);
  return c.json({
    ok: true,
    programId: chain.programId.toBase58(),
    mint: cfg?.mint.toBase58() ?? null,
    feeBps: cfg?.feeBps ?? null,
    kesPerUsd: KES_PER_USD,
    mpesa: mpesaMode(),
    demoMode: DEMO_MODE,
  });
});

// ---------- terms ----------

app.post("/api/terms", async (c) => {
  const t = (await c.req.json()) as Terms;
  const errors: string[] = [];
  if (!t.jobTitle?.trim()) errors.push("Job title is required");
  if (!t.employerName?.trim()) errors.push("Employer name is required");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t.employerDomain ?? "")) errors.push("Employer email domain looks wrong (e.g. company.com)");
  if (!t.country?.trim()) errors.push("Country is required");
  if (!(t.feeKes > 0)) errors.push("Fee must be above zero");
  if (!Array.isArray(t.stages) || !t.stages.length || t.stages.length > 4) errors.push("Add 1 to 4 stages");
  else if (t.stages.reduce((a, s) => a + s.bps, 0) !== 10_000) errors.push("Stage shares must add up to 100%");
  if (errors.length) return c.json({ errors }, 400);

  const clean: Terms = { ...t, employerDomain: t.employerDomain.toLowerCase().trim() };
  const json = JSON.stringify(clean);
  const hash = sha256(json).toString("hex");
  db.prepare("INSERT OR IGNORE INTO terms (hash, json, created_at) VALUES (?, ?, ?)").run(hash, json, now());
  const amountUsdc = Math.round((clean.feeKes / KES_PER_USD) * 1e6);
  return c.json({ termsHash: hash, amountUsdc, stageBps: clean.stages.map((s) => s.bps) });
});

app.get("/api/terms/:hash", (c) => {
  const t = termsFor(c.req.param("hash"));
  return t ? c.json(t) : fail(c, 404, "Not found");
});

// ---------- agencies / scoreboard ----------

app.get("/api/agencies", async (c) => {
  const agencies = await chain.listAgencies();
  const rows = agencies.map((a: any) => {
    const created = Number(a.placementsCreated);
    const completed = Number(a.placementsCompleted);
    const refunded = Number(a.placementsRefunded);
    const settled = completed + refunded;
    return { ...a, successRate: settled ? completed / settled : null };
  });
  rows.sort((x: any, y: any) => Number(y.verified) - Number(x.verified) || Number(y.placementsCompleted) - Number(x.placementsCompleted));
  return c.json(rows);
});

app.get("/api/agencies/:pubkey", async (c) => {
  const agency = await chain.getAgency(c.req.param("pubkey")).catch(() => null);
  if (!agency) return fail(c, 404, "Agency not found");
  const placements = await chain.listPlacements(c.req.param("pubkey"));
  return c.json({ ...agency, placements: placements.map((p: any) => ({ ...p, terms: termsFor(p.termsHash) })) });
});

/** Admin: check the agency against the NEA list and mark it verified onchain. */
app.post("/api/agencies/:pubkey/verify", async (c) => {
  if (c.req.header("x-admin-token") !== process.env.ADMIN_TOKEN) return fail(c, 401, "Not allowed");
  const agency = await chain.getAgency(c.req.param("pubkey")).catch(() => null);
  if (!agency) return fail(c, 404, "Agency not found");
  const nea = checkNea(agency.name, agency.licenseNo);
  const force = c.req.query("force") === "1";
  if (!nea.ok && !force) return fail(c, 400, `Not on the NEA list: ${agency.name} / ${agency.licenseNo}`);
  const tx = await chain.setAgencyVerified(agency.pubkey, true);
  return c.json({ verified: true, nea: nea.match ?? null, manualOverride: !nea.ok, tx });
});

// ---------- placements ----------

app.get("/api/placements", async (c) => {
  const list = await chain.listPlacements(c.req.query("agency") ?? undefined);
  return c.json(list.map((p: any) => ({ ...p, terms: termsFor(p.termsHash) })));
});

app.get("/api/placements/:pubkey", async (c) => {
  const v = await placementView(c.req.param("pubkey")).catch(() => null);
  return v ? c.json(v) : fail(c, 404, "Placement not found");
});

async function fundAfterPayment(checkoutId: string, receipt: string) {
  const pay = db.prepare("SELECT placement, phone, status FROM payments WHERE checkout_id = ?").get(checkoutId) as any;
  if (!pay || pay.status === "funded") return;
  const seekerRef = sha256(`kazisafe:seeker:${pay.phone}`);
  const tx = await chain.fundPlacement(pay.placement, seekerRef);
  db.prepare("UPDATE payments SET status = 'funded', receipt = ?, fund_tx = ? WHERE checkout_id = ?").run(receipt, tx, checkoutId);
}

/** Job seeker pays the fee by M-Pesa. Once the payment lands, the ramp locks the USDC equivalent in escrow. */
app.post("/api/placements/:pubkey/pay", async (c) => {
  const pubkey = c.req.param("pubkey");
  const { phone } = (await c.req.json()) as { phone: string };
  let msisdn: string;
  try {
    msisdn = normalisePhone(phone);
  } catch (e) {
    return fail(c, 400, (e as Error).message);
  }
  const p = await chain.getPlacement(pubkey).catch(() => null);
  if (!p) return fail(c, 404, "Placement not found");
  if (p.status !== "created") return fail(c, 400, "This placement is already paid or closed");
  const terms = termsFor(p.termsHash);
  if (!terms) return fail(c, 400, "Job terms missing");

  const stk = await stkPush(msisdn, terms.feeKes, pubkey.slice(0, 12));
  db.prepare("INSERT INTO payments (checkout_id, placement, phone, amount_kes, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").run(
    stk.checkoutRequestId,
    pubkey,
    msisdn,
    terms.feeKes,
    now(),
  );
  if (stk.mode === "mock") {
    await fundAfterPayment(stk.checkoutRequestId, `MOCK${Date.now().toString().slice(-8)}`);
  }
  return c.json({ checkoutRequestId: stk.checkoutRequestId, mode: stk.mode });
});

app.post("/api/mpesa/callback", async (c) => {
  const parsed = parseStkCallback(await c.req.json());
  if (parsed) await fundAfterPayment(parsed.checkoutRequestId, parsed.receipt).catch((e) => console.error("fund failed", e));
  return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

async function recordAndConfirm(pubkey: string, stage: number, kind: string, proofHash: Buffer, detail: string, demo: boolean) {
  const tx = await chain.confirmStage(pubkey, stage, proofHash);
  db.prepare("INSERT OR REPLACE INTO proofs (placement, stage, kind, proof_hash, detail, demo, tx, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    pubkey,
    stage,
    kind,
    proofHash.toString("hex"),
    detail,
    demo ? 1 : 0,
    tx,
    now(),
  );
  return tx;
}

async function nextStage(pubkey: string) {
  const p = await chain.getPlacement(pubkey);
  if (p.status !== "funded") throw new Error("Placement is not funded and active");
  const terms = termsFor(p.termsHash);
  if (!terms) throw new Error("Job terms missing");
  const stage = Number(p.stagesDone);
  return { p, terms, stage, kind: terms.stages[stage]?.kind };
}

/** Offer stage: the agency uploads the employer's offer email (.eml). Checked by DKIM against the employer domain. */
app.post("/api/placements/:pubkey/proofs/offer", async (c) => {
  const pubkey = c.req.param("pubkey");
  let ctx;
  try {
    ctx = await nextStage(pubkey);
  } catch (e) {
    return fail(c, 400, (e as Error).message);
  }
  if (ctx.kind !== "offer") return fail(c, 400, `The next stage is "${ctx.kind}", not the offer`);
  const body = await c.req.parseBody();
  const file = body.eml;
  const raw = file instanceof File ? Buffer.from(await file.arrayBuffer()) : typeof file === "string" ? Buffer.from(file) : null;
  if (!raw) return fail(c, 400, "Attach the offer email as a .eml file");

  const r = await verifyOfferEmail(raw, ctx.terms.employerDomain);
  if (!r.ok) return fail(c, 400, r.reason);
  const tx = await recordAndConfirm(pubkey, ctx.stage, "offer", r.proofHash, `DKIM pass: ${r.domain} — "${r.subject}"`, false);
  return c.json({ ok: true, stage: ctx.stage, domain: r.domain, subject: r.subject, proofHash: r.proofHash.toString("hex"), tx });
});

/** Demo only: confirm visa / salary stages until the zkTLS proofs for those portals are built. Clearly flagged as demo. */
app.post("/api/placements/:pubkey/proofs/demo", async (c) => {
  if (!DEMO_MODE) return fail(c, 403, "Demo proofs are disabled");
  const pubkey = c.req.param("pubkey");
  let ctx;
  try {
    ctx = await nextStage(pubkey);
  } catch (e) {
    return fail(c, 400, (e as Error).message);
  }
  if (ctx.kind === "offer") return fail(c, 400, "The offer stage needs a real email proof");
  const proofHash = sha256(`kazisafe:demo:${ctx.kind}:${pubkey}:${ctx.stage}`);
  const tx = await recordAndConfirm(pubkey, ctx.stage, ctx.kind, proofHash, `DEMO proof for ${ctx.kind} (zkTLS portal proof is the next milestone)`, true);
  return c.json({ ok: true, stage: ctx.stage, kind: ctx.kind, demo: true, tx });
});

/** After the deadline, anyone can trigger the refund. Unreleased money goes back to the payer, then to the seeker's M-Pesa. */
app.post("/api/placements/:pubkey/refund", async (c) => {
  const pubkey = c.req.param("pubkey");
  const p = await chain.getPlacement(pubkey).catch(() => null);
  if (!p) return fail(c, 404, "Placement not found");
  if (p.status !== "funded") return fail(c, 400, "Only an active, paid placement can be refunded");
  if (now() < Number(p.deadline)) return fail(c, 400, "The deadline has not passed yet");
  const remaining = Number(p.amount) - Number(p.released);
  const tx = await chain.refund(pubkey);
  const pay = db.prepare("SELECT phone FROM payments WHERE placement = ? AND status = 'funded'").get(pubkey) as any;
  const amountKes = Math.round((remaining / 1e6) * KES_PER_USD);
  const m = pay ? await refundToPhone(pay.phone, amountKes, pubkey.slice(0, 12)) : null;
  db.prepare("INSERT OR REPLACE INTO refunds (placement, phone, amount_kes, tx, mpesa_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    pubkey,
    pay?.phone ?? null,
    amountKes,
    tx,
    m?.reference ?? null,
    now(),
  );
  return c.json({ ok: true, tx, amountKes, mpesa: m });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`KaziSafe server on :${port} (mpesa: ${mpesaMode()}, demo: ${DEMO_MODE})`));
