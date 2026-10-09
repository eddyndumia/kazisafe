import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
const { db, offerProofUsedElsewhere } = await import("../src/store.ts");

const add = (placement: string, stage: number, kind: string, hash: string) =>
  db.prepare("INSERT INTO proofs (placement, stage, kind, proof_hash, created_at) VALUES (?, ?, ?, ?, 0)").run(placement, stage, kind, hash);

test("an offer proof used for one placement is flagged for any other placement", () => {
  add("placementA", 0, "offer", "aa");
  assert.equal(offerProofUsedElsewhere("aa", "placementB"), true);
  assert.equal(offerProofUsedElsewhere("aa", "placementA"), false);
  assert.equal(offerProofUsedElsewhere("bb", "placementB"), false);
});

test("the database refuses the same offer proof on two placements", () => {
  add("placementC", 0, "offer", "cc");
  assert.throws(() => add("placementD", 0, "offer", "cc"));
});

test("demo proofs are not affected by the offer rule", () => {
  add("placementE", 1, "visa", "dd");
  add("placementF", 1, "visa", "dd");
});
