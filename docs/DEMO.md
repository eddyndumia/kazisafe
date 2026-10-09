# Demo video script

Target: 3 minutes. Story: an agency creates a job, a seeker pays by M-Pesa, the offer email releases 20%, visa and salary release the rest, a second job times out and refunds, and the scoreboard shows both.

## Prep (before recording)

1. **App running** with `DEMO_MODE=true` (hosted, or locally: `server` on :8787 and `web` on :5173). M-Pesa in mock mode is fine; use the Daraja sandbox if the keys are in.
2. **Agency wallet:** Phantom set to devnet, with about 0.1 SOL from https://faucet.solana.com.
3. **Offer email.** The offer stage needs a real DKIM-signed email whose domain matches the "employer email domain" you'll type in the form.
   - Best: someone with a company email (Google Workspace, Zoho, Outlook on a custom domain) sends it. Use that domain in the form.
   - Fallback: send it from a Gmail account and use `gmail.com` as the domain. Say on screen that a real employer would use their own domain.
   - Subject like "Offer of employment: Caregiver, Riyadh". Send it to any inbox, open it in Gmail, then ⋮ → **Download message**. That saves the `.eml`.
   - Each email can prove only one placement. Make a fresh one for every run-through.
4. **Admin token:** open `/admin` in the same browser tab you'll record in and enter the token. The agency dashboard reuses it for demo proofs.
5. **Register and verify the agency once** (not worth showing in 3 minutes): `/agency` → connect → register as `DEMO Safari Manpower Services` / `DEMO-NEA-0002` (on the demo NEA list) → `/admin` → "Check NEA list + verify".
6. **Refund placement, prepared about 10 minutes before recording:** create a placement with deadline **5 minutes (demo)**, open its seeker link and pay. Do the visa step only if you want to show a partial release. By the time you reach the refund scene, its deadline has passed.
7. Close other tabs, zoom the browser to 110 to 125%, and turn on dark or light mode as you like (the site follows the system setting).

## Recording

| Time | Screen | Say |
|---|---|---|
| 0:00 | Landing page | "Kenyans pay agencies up to 300,000 shillings for jobs abroad. Too often the job never existed. KaziSafe holds that fee in escrow until the job is proven real." |
| 0:15 | `/agencies` scoreboard | "Every licensed agency has a public record onchain: jobs completed, jobs refunded. Nobody can edit it, including us." |
| 0:25 | `/agency`, New placement form | Fill in: Caregiver, employer, employer email domain, Saudi Arabia, SAR 2,500, KES 100,000, 90 days. Point at the stage split: "The agency gets 20% when the offer is proven, 40% at visa, 40% at first salary." Click **Create placement**, approve in Phantom. |
| 0:50 | Copy the job seeker link, open it | "The agency sends this link to the job seeker." Switch to **Kiswahili** and back. |
| 1:00 | Seeker page, Pay with M-Pesa | Enter a phone number, pay. "No wallet, no crypto. Just M-Pesa. The money is now locked in a Solana escrow that neither the agency nor KaziSafe can touch." Point at the money card. |
| 1:20 | Agency dashboard, Upload offer email | Upload the `.eml`. "The offer has to come from the employer's own email domain. We check its DKIM signature, so it can't be faked or edited." Reload the seeker page: stage 1 proven, 20% released. Click the proof link to show the transaction on Solana Explorer. |
| 1:50 | Agency dashboard, Demo proof: Visa, then Demo proof: Salary | "Visa and first-salary proofs will come straight from the official portals using zkTLS. That's our next milestone, so here they're demo proofs." Reload the seeker page: "Job confirmed. All stages proven." |
| 2:15 | The prepared refund placement's seeker page | "This job didn't happen in time. The deadline passed, so anyone can trigger the refund. No permission needed from the agency or from us." Click **Refund me**. "The money goes back to the seeker's M-Pesa." (The M-Pesa payout itself is mocked until Safaricom approves B2C; the onchain refund is real.) |
| 2:35 | `/agencies/<agency>` | "And it's on the agency's permanent record: one completed, one refunded." |
| 2:45 | Landing page | "KaziSafe. Pay for the job only when the job is real." |

## If something goes wrong

- **"Agency is not verified":** do prep step 5.
- **"Demo proofs need the admin token":** do prep step 4 in the same tab. A new tab doesn't carry the token.
- **"No passing DKIM signature from …":** the form's domain doesn't match the email's sender domain, or the email was forwarded or edited. Download it again from the original inbox.
- **"This offer email has already been used":** make a fresh email.
- **The Refund button doesn't show:** the deadline hasn't passed yet. Wait and reload.
- **Phantom shows mainnet:** Settings → Developer settings → Testnet mode → Solana devnet.
