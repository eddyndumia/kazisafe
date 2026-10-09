import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePhone, parseStkCallback } from "../src/mpesa.ts";

const callback = (ResultCode: number, extra: object = {}) => ({
  Body: { stkCallback: { MerchantRequestID: "m1", CheckoutRequestID: "ws_CO_1", ResultCode, ResultDesc: "desc", ...extra } },
});

test("a paid STK callback carries the receipt and amount", () => {
  const r = parseStkCallback(callback(0, {
    CallbackMetadata: { Item: [{ Name: "Amount", Value: 100000 }, { Name: "MpesaReceiptNumber", Value: "QJK1234" }] },
  }));
  assert.deepEqual(r, { checkoutRequestId: "ws_CO_1", ok: true, receipt: "QJK1234", amount: 100000, reason: "desc" });
});

test("a cancelled STK callback is reported as not ok, so the payment can be marked failed", () => {
  const r = parseStkCallback(callback(1032));
  assert.equal(r?.ok, false);
  assert.equal(r?.checkoutRequestId, "ws_CO_1");
});

test("anything that isn't an STK callback is ignored", () => {
  assert.equal(parseStkCallback(null), null);
  assert.equal(parseStkCallback({ hello: "world" }), null);
});

test("Kenyan phone numbers are normalised to 254 format", () => {
  assert.equal(normalisePhone("0712 345 678"), "254712345678");
  assert.equal(normalisePhone("+254712345678"), "254712345678");
  assert.equal(normalisePhone("712345678"), "254712345678");
  assert.throws(() => normalisePhone("12345"));
});
