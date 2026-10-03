# KaziSafe plan

Goal: ship a working KaziSafe demo and submit it to Colosseum's Crypto World's Fair (Solana track) by **2026-10-12**. Then use it to win grants and sign the first agencies.

Repo: `Documents/Projects/kazisafe`. Product: `docs/PRODUCT.md`. Theme: `docs/DESIGN.md`.

## Status (2026-10-03)
- [x] Escrow program written and compiling (Anchor 1.0.2, Docker build). Program id `G48xcsU1JTUtWhsg23Z3E94v3cUZDjg7S7wxH4NpYg4M`.
- [x] Offer-email proof (DKIM) with 4 passing tests.
- [x] Server routes: terms, agencies, scoreboard, pay by M-Pesa (mock or Daraja sandbox), proofs, refund.
- [x] Web app scaffold (Vite + React + Solana wallet adapter).
- [ ] Everything below.

## Build: how to build and test the program
Windows has no Solana toolchain, so everything runs in Docker:
```
docker run --rm -v "C:/Users/user/Documents/Projects/kazisafe:/work" -v kazisafe-cargo:/root/.cargo/registry -w /work solanafoundation/anchor:v1.0.2 bash -lc "anchor build"
```

## Day by day

### Day 1 to 2 (Oct 3 to 4): program done and tested
- Program tests on a local validator: happy path (fund, 3 stages, completed), refund after deadline, wrong-order stage rejected, unverified agency blocked, non-attestor blocked, agency can't redirect a refund.
- Deploy to devnet. Create a devnet test USDC mint, treasury, admin/attestor/ramp keys (in `keys/`, git-ignored).
- Server talks to devnet end to end with a script: register agency, verify, create placement, pay (mock M-Pesa), offer proof, demo visa + salary, completed. Second run: refund.

### Day 3 to 5 (Oct 5 to 7): web app
- Launch site (landing) in the FundingPips glass theme, orange (see DESIGN.md).
- Job seeker page `/p/:placement`: job terms, stage tracker, "Pay with M-Pesa", refund status. English + Swahili. Mobile first.
- Agency dashboard `/agency`: connect Phantom, register, create placement (terms form → hash → onchain), upload offer .eml, see payouts.
- Public scoreboard `/agencies`: verified badge, placements, completed, refunded, success rate. Each agency page lists its placements with Solana Explorer links.
- Admin page (token-protected): verify agency against NEA list.

### Day 6 (Oct 8): real-world bits
- Daraja sandbox keys (Eddy: create app at developer.safaricom.co.ke, put keys in `.env`).
- Load the real NEA agency list (Eddy: download from neaims.go.ke, we convert it to `server/data/nea-agencies.json`).
- Host: server on Render (or Cloudflare), web on Cloudflare Pages from the `web/dist` folder only (dry run first).

### Day 7 (Oct 9): demand validation (Eddy, can start today)
- 10 people who paid an agency (scammed and successful), 2 to 3 licensed agencies.
- Ask: how much, what happened, would you use this, would the agency accept it.
- Record short clips or quotes with permission. These go in the pitch.

### Day 8 (Oct 10): videos
- Pitch video (2 to 3 min): the problem with real cases, how KaziSafe works, why onchain, the business model, the team.
- Demo video (3 min max): agency creates placement, seeker pays by M-Pesa, offer proof releases 20%, visa + salary release the rest, a second placement times out and refunds, scoreboard updates.

### Day 9 (Oct 11): submit
- Public GitHub repo, README, demo + pitch videos, go-to-market plan, validation evidence.
- Submit a day early. Deadline is Oct 12.

## Honest limits for the pitch
- Visa and salary proofs are demo proofs in the hackathon build. The offer proof is real (DKIM).
- Proofs are checked by the KaziSafe attestor, not onchain yet. The proof hash is stored onchain so anyone can audit it.
- M-Pesa refunds (B2C) are mocked until Safaricom approves B2C.

## After the hackathon
1. Real zkTLS visa proof for one route (Saudi Musaned or Qatar visa check), via Reclaim.
2. Onchain proof verification, remove the attestor.
3. First 2 to 3 honest agencies live, real placements.
4. Grants: Solana Foundation, Reclaim, Superteam; development money (ILO/IOM fair recruitment, Swiss development agency, GIZ).
5. Agency fee (1% of each release) live.

## Who does what
- Claude: program, server, web app, deploy, README, demo script.
- Eddy: demand validation interviews, Daraja account, NEA list download, recording the videos, submission form.
