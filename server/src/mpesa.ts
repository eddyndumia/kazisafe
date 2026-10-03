// M-Pesa (Safaricom Daraja). Uses the sandbox when keys are set, otherwise runs in mock mode
// so the demo works end to end without credentials.

const BASE = process.env.DARAJA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export const mpesaMode = () => (process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET ? "daraja" : "mock");

async function token(): Promise<string> {
  const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString("base64");
  const r = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error(`Daraja auth failed: ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

function timestamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Normalises 07xx / +2547xx / 2547xx to 2547xxxxxxxx. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return "254" + digits;
  throw new Error("Enter a valid Kenyan phone number");
}

export type StkResult = { checkoutRequestId: string; mode: "daraja" | "mock" };

/** Sends the "enter your M-Pesa PIN" prompt to the job seeker's phone. */
export async function stkPush(phone: string, amountKes: number, reference: string): Promise<StkResult> {
  const msisdn = normalisePhone(phone);
  if (mpesaMode() === "mock") {
    return { checkoutRequestId: `mock_${Date.now()}_${reference}`, mode: "mock" };
  }
  const shortcode = process.env.DARAJA_SHORTCODE!;
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${process.env.DARAJA_PASSKEY}${ts}`).toString("base64");
  const r = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amountKes),
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: process.env.DARAJA_CALLBACK_URL,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: "KaziSafe escrow",
    }),
  });
  const body = (await r.json()) as { CheckoutRequestID?: string; errorMessage?: string };
  if (!r.ok || !body.CheckoutRequestID) throw new Error(body.errorMessage ?? `STK push failed: ${r.status}`);
  return { checkoutRequestId: body.CheckoutRequestID, mode: "daraja" };
}

/** Parses Daraja's STK callback. Returns null if the payment failed or was cancelled. */
export function parseStkCallback(body: any): { checkoutRequestId: string; receipt: string; amount: number } | null {
  const cb = body?.Body?.stkCallback;
  if (!cb || cb.ResultCode !== 0) return null;
  const items: Array<{ Name: string; Value: unknown }> = cb.CallbackMetadata?.Item ?? [];
  const get = (n: string) => items.find((i) => i.Name === n)?.Value;
  return { checkoutRequestId: cb.CheckoutRequestID, receipt: String(get("MpesaReceiptNumber") ?? ""), amount: Number(get("Amount") ?? 0) };
}

/** Refund to the job seeker's M-Pesa. Mocked until B2C credentials are approved by Safaricom. */
export async function refundToPhone(phone: string, amountKes: number, reference: string) {
  normalisePhone(phone);
  return { mode: "mock" as const, reference: `refund_${Date.now()}_${reference}`, amountKes };
}
