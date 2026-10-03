import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Snapshot of the National Employment Authority approved private employment agencies list.
// Refresh from https://www.nea.go.ke before production use.
type NeaAgency = { name: string; licenseNo: string };

const listPath = fileURLToPath(new URL("../data/nea-agencies.json", import.meta.url));
let cache: NeaAgency[] | null = null;

function list(): NeaAgency[] {
  if (!cache) cache = JSON.parse(readFileSync(listPath, "utf8")) as NeaAgency[];
  return cache;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True if the license number is on the NEA list and the name matches. */
export function checkNea(name: string, licenseNo: string): { ok: boolean; match?: NeaAgency } {
  const match = list().find((a) => norm(a.licenseNo) === norm(licenseNo));
  if (!match) return { ok: false };
  const a = norm(match.name);
  const b = norm(name);
  return { ok: a.includes(b) || b.includes(a), match };
}
