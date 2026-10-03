# KaziSafe

Recruitment fees for jobs abroad, held in escrow until the job is real.

## Problem
Kenyans pay agencies KES 50k to 300k upfront for overseas jobs. Many jobs don't exist. Refunds after the fact rarely happen.

## How it works
1. Agency registers. KaziSafe checks it against the NEA licensed list and marks it verified onchain.
2. Agency creates a placement: job, employer, fee, stages, deadline.
3. Job seeker pays by M-Pesa. The fee is converted to USDC and locked in a vault owned by the placement (a program PDA). Nobody, including KaziSafe, can move it except by the program's rules.
4. Each stage releases its share to the agency when proven:
   - Offer: employer's offer email, DKIM-verified (proves it came from the employer's domain)
   - Visa: proof from the destination visa portal (zkTLS, next milestone; mocked in the hackathon demo)
   - First salary: proof of salary received (zkTLS, next milestone; mocked in the hackathon demo)
5. If the deadline passes before all stages complete, anyone can trigger the refund. Unreleased money goes back to the job seeker.
6. Every outcome updates the agency's onchain stats: placements, completions, refunds. That's the public scoreboard.

## Parts
- `programs/kazisafe`: Solana program (Anchor)
- `server`: proof service (DKIM verification, attestor signing), M-Pesa (Daraja) in/out
- `web`: job seeker page, agency dashboard, public scoreboard

## Trust model (hackathon version)
Proofs are checked by the KaziSafe proof service, which then signs the stage confirmation onchain with an attestor key. The proof hash is stored onchain so anyone can audit it. Next step: verify proofs directly onchain (Reclaim zkTLS verifier, zk-email) and remove the attestor.

## Fee
1% of each released amount, paid by the agency. Refunds are free.
