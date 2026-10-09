# KaziSafe

**Recruitment fees for jobs abroad, held in escrow until the job is real.**

Kenyans pay recruitment agencies KES 50,000 to 300,000 upfront for jobs in the Gulf and elsewhere. Too often the job doesn't exist, and the money is gone. KaziSafe holds the fee in a Solana escrow and releases it to the agency step by step, only as each stage of the job is proven. If the deadline passes first, the job seeker gets back everything not yet released, on M-Pesa.

Built for the Colosseum Crypto World's Fair (Solana track). Running on **Solana devnet**; no real money yet.

## How it works

1. **Agency registers** with its wallet. KaziSafe checks it against the National Employment Authority (NEA) licensed list and marks it verified onchain. Unverified agencies cannot create placements.
2. **Agency creates a placement**: job title, employer, employer email domain, country, salary, fee, deadline, and how the fee is split across stages (default: offer 20%, visa 40%, first salary 40%). The job terms are hashed and the hash goes onchain.
3. **Job seeker pays by M-Pesa.** No wallet, no crypto. Once the payment is confirmed, the USDC equivalent is locked in a vault owned by the placement's program account. Nobody, including KaziSafe, can move it except by the program's rules.
4. **Each stage releases its share** when proven:
   - **Offer:** the employer's offer email (`.eml`). Its DKIM signature must pass for the employer's domain, which proves the email really came from that domain and was not edited. Each offer email can prove only one placement.
   - **Visa** and **first salary:** proofs from the official portals (zkTLS, next milestone; demo proofs in this build, clearly labelled).
5. **Deadline passes before the last stage?** Anyone can trigger the refund. The unreleased money goes back to whoever paid, and on to the seeker's M-Pesa.
6. **Every outcome updates the agency's onchain record** (placements, completions, refunds, money released). That's the public scoreboard, and no agency can edit it.

KaziSafe earns 1% of each amount released to an agency. Refunds are free, and job seekers never pay a fee.

## Onchain (devnet)

| | Address |
|---|---|
| Program | [`G48xcsU1JTUtWhsg23Z3E94v3cUZDjg7S7wxH4NpYg4M`](https://explorer.solana.com/address/G48xcsU1JTUtWhsg23Z3E94v3cUZDjg7S7wxH4NpYg4M?cluster=devnet) |
| Test USDC mint | [`2kncvEP9JTMcMcQE9qEApQ9h9ZNRS6mzdqgXxtM4RuP7`](https://explorer.solana.com/address/2kncvEP9JTMcMcQE9qEApQ9h9ZNRS6mzdqgXxtM4RuP7?cluster=devnet) |

## Repo

| Path | What |
|---|---|
| `programs/kazisafe` | Anchor program: config, agencies, placements, escrow vault, staged release, refund |
| `server` | Proof service (DKIM offer check, attestor signing), M-Pesa (Daraja STK push + callback), NEA check, API |
| `web` | Landing page, job seeker page (English / Kiswahili), agency dashboard, public scoreboard, admin |
| `docs` | Product, plan, visual design, demo script |

### Program instructions

| Instruction | Who | What |
|---|---|---|
| `initialize_config` / `update_config` | admin | Attestor key, USDC mint, treasury, fee (max 5%) |
| `register_agency` | agency wallet | Creates the agency record, unverified |
| `set_agency_verified` | admin | After the NEA check |
| `create_placement` | verified agency | Terms hash, amount, stage split (must total 100%), deadline |
| `fund_placement` | payer (seeker or M-Pesa ramp) | Locks the full fee; the payer becomes the refund address |
| `confirm_stage` | attestor | Releases the next stage's share (stages in order, before the deadline), stores the proof hash |
| `refund` | anyone, after the deadline | Returns the unreleased amount to the payer |
| `cancel_unfunded` | agency | Cancels a placement nobody has paid into |

## Trust model and honest limits

- **Proofs are checked by the KaziSafe attestor**, which then signs the stage confirmation onchain. The proof hash is stored onchain so anyone holding the evidence can audit it. Next step: verify proofs onchain (zk-email, Reclaim zkTLS) and remove the attestor.
- **The offer proof is real** (DKIM). **Visa and salary proofs are demo proofs** in this build, and only the KaziSafe admin can issue them.
- **M-Pesa:** payments use the Daraja STK push; every callback is double-checked with Daraja before escrow is funded. Refunds to M-Pesa (B2C) are mocked until Safaricom approves B2C.
- **Privacy:** no personal data onchain. The seeker's phone number is stored only as a keyed hash; job terms are stored as a hash, with the text held by the server.
- **The admin key can verify or unverify agencies** and change the attestor and fee (capped at 5%). Escrowed money can only ever go to the placement's agency (stage by stage) or back to the payer (refund); no key, including KaziSafe's, can send it anywhere else. Today, a dishonest attestor could release a stage to the agency without real proof; that is what onchain proof verification removes.

## Run it locally

Needs Node 22.5+ and, to build the program, Docker.

```bash
# 1. Server
cd server
npm install
cp .env.example .env        # fill in ADMIN_TOKEN and SEEKER_REF_SECRET; leave Daraja empty for mock M-Pesa
# signing keys: put admin.json, attestor.json, ramp.json in ../keys/ (or set ADMIN_KEY etc. in .env)
npm run dev                 # http://localhost:8787

# 2. Web (another terminal)
cd web
npm install
npm run dev                 # http://localhost:5173, proxies /api to the server
```

Open `/agency` with Phantom or Solflare set to devnet. Agencies need a little devnet SOL for transaction fees.

### Tests

```bash
cd server
npm test                    # DKIM offer proof, single-use offers, M-Pesa callbacks
npm run test:program        # program tests on LiteSVM, in Docker (needs target/deploy/kazisafe.so from a build)
npx tsx scripts/smoke.ts    # end to end on devnet against a running server: one completed and one refunded placement
```

### Build and deploy the program

```bash
docker run --rm -v "$(pwd):/work" -v kazisafe-cargo:/root/.cargo/registry -w /work \
  solanafoundation/anchor:v1.0.2 bash -lc "anchor build"
./scripts/deploy-devnet.sh  # deploys, then creates the test mint, treasury and config (needs SOL on keys/admin.json)
```

After a rebuild, copy `target/idl/kazisafe.json` to `web/src/idl.json`.

### Hosting

- **Server:** `render.yaml` is a Render blueprint. It needs a persistent disk for the SQLite database (`DB_PATH`); secrets are entered in the Render dashboard.
- **Web:** any static host. On Cloudflare Pages: root `web`, build `npm run build`, output `dist`, and set `VITE_API_URL` to the server's URL.

## After the hackathon

1. A real zkTLS visa proof for one route (Saudi Musaned or Qatar visa check), via Reclaim.
2. Onchain proof verification, removing the attestor.
3. The first two or three licensed agencies live, with real placements.
4. The 1% agency fee live.
