import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { dkimSign } from "mailauth/lib/dkim/sign.js";
import { verifyOfferEmail } from "../src/offerProof.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const resolver = async (name: string, rr: string) => {
  if (rr === "TXT" && name === "kz._domainkey.employer.example") return [[`v=DKIM1; k=rsa; p=${pubB64}`]];
  const err: NodeJS.ErrnoException = new Error("not found");
  err.code = "ENOTFOUND";
  throw err;
};

const email = [
  "From: HR <hr@employer.example>",
  "To: jane@gmail.com",
  "Subject: Offer of employment - Caregiver, Riyadh",
  "Date: Fri, 03 Oct 2026 09:00:00 +0300",
  "Message-ID: <offer-1@employer.example>",
  "",
  "Dear Jane, we are pleased to offer you the role of Caregiver at SAR 2,500 per month.",
  "",
].join("\r\n");

async function sign(domain: string) {
  const out = await dkimSign(email, {
    signatureData: [{ signingDomain: domain, selector: "kz", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) }],
  });
  return out.signatures + email;
}

test("accepts a valid DKIM-signed offer from the employer domain", async () => {
  const r = await verifyOfferEmail(await sign("employer.example"), "employer.example", { resolver });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.domain, "employer.example");
    assert.equal(r.proofHash.length, 32);
    assert.match(r.subject, /Offer of employment/);
  }
});

test("rejects an email whose body was edited after signing", async () => {
  const signed = (await sign("employer.example")).replace("SAR 2,500", "SAR 9,500");
  const r = await verifyOfferEmail(signed, "employer.example", { resolver });
  assert.equal(r.ok, false);
});

test("rejects a signature from a different domain", async () => {
  const r = await verifyOfferEmail(await sign("employer.example"), "other-employer.example", { resolver });
  assert.equal(r.ok, false);
});

test("rejects an unsigned email", async () => {
  const r = await verifyOfferEmail(email, "employer.example", { resolver });
  assert.equal(r.ok, false);
});
