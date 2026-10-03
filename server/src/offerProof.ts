import { createHash } from "node:crypto";
import { authenticate } from "mailauth";

export type OfferProofResult =
  | { ok: true; domain: string; subject: string; proofHash: Buffer }
  | { ok: false; reason: string };

type Resolver = (name: string, rr: string) => Promise<unknown>;

/**
 * Checks that a raw offer email (.eml) carries a valid DKIM signature from the employer's domain.
 * A valid signature means the email really was sent through that domain's mail servers and was not edited.
 * The proof hash commits to the signature and the signed body hash, so anyone holding the email can re-check it.
 */
export async function verifyOfferEmail(
  rawEmail: string | Buffer,
  expectedDomain: string,
  opts: { resolver?: Resolver } = {},
): Promise<OfferProofResult> {
  const raw = typeof rawEmail === "string" ? Buffer.from(rawEmail) : rawEmail;
  const res = await authenticate(raw, {
    trustReceived: false,
    disableArc: true,
    disableBimi: true,
    ...(opts.resolver ? { resolver: opts.resolver } : {}),
  } as Parameters<typeof authenticate>[1]);

  const want = expectedDomain.toLowerCase();
  const results = (res.dkim?.results ?? []) as Array<{
    signingDomain?: string;
    status?: { result?: string; aligned?: string };
    signature?: string;
    bodyHash?: string;
  }>;
  const pass = results.find(
    (r) =>
      r.status?.result === "pass" &&
      !!r.signingDomain &&
      (r.signingDomain.toLowerCase() === want || r.signingDomain.toLowerCase().endsWith("." + want)),
  );
  if (!pass) {
    const seen = results.map((r) => `${r.signingDomain ?? "?"}:${r.status?.result ?? "?"}`).join(", ") || "no DKIM signature";
    return { ok: false, reason: `No passing DKIM signature from ${want} (${seen})` };
  }

  const subject = /^subject:\s*(.*)$/im.exec(raw.toString("utf8"))?.[1]?.trim() ?? "";
  const proofHash = createHash("sha256")
    .update("kazisafe:offer:v1|")
    .update(pass.signingDomain!.toLowerCase() + "|")
    .update((pass.signature ?? "") + "|")
    .update(pass.bodyHash ?? "")
    .digest();
  return { ok: true, domain: pass.signingDomain!.toLowerCase(), subject, proofHash };
}
