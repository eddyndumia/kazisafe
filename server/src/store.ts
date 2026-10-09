import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Off-chain details that should not live onchain (job terms text, phone numbers, payment receipts).
// Onchain we keep only hashes of these.
const dir = fileURLToPath(new URL("../data/", import.meta.url));
mkdirSync(dir, { recursive: true });
export const db = new DatabaseSync(process.env.DB_PATH ?? dir + "kazisafe.db");

db.exec(`
CREATE TABLE IF NOT EXISTS terms (
  hash TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  checkout_id TEXT PRIMARY KEY,
  placement TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount_kes INTEGER NOT NULL,
  status TEXT NOT NULL,
  receipt TEXT,
  fund_tx TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS proofs (
  placement TEXT NOT NULL,
  stage INTEGER NOT NULL,
  kind TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  detail TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  tx TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (placement, stage)
);
-- One offer email proves one placement. Stops an agency reusing the same offer for many seekers.
CREATE UNIQUE INDEX IF NOT EXISTS proofs_offer_once ON proofs (proof_hash) WHERE kind = 'offer';
CREATE TABLE IF NOT EXISTS refunds (
  placement TEXT PRIMARY KEY,
  phone TEXT,
  amount_kes INTEGER,
  tx TEXT,
  mpesa_ref TEXT,
  created_at INTEGER NOT NULL
);
`);

export type Terms = {
  jobTitle: string;
  employerName: string;
  employerDomain: string;
  country: string;
  monthlySalary: string;
  feeKes: number;
  stages: Array<{ kind: "offer" | "visa" | "salary"; label: string; bps: number }>;
};

export function offerProofUsedElsewhere(proofHash: string, placement: string): boolean {
  return !!db.prepare("SELECT 1 FROM proofs WHERE kind = 'offer' AND proof_hash = ? AND placement != ?").get(proofHash, placement);
}

export const stageKinds = (t: Terms) => t.stages.map((s) => s.kind);
