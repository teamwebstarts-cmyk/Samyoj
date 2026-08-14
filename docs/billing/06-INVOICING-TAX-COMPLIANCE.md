# 06 — Invoicing, tax, GST (India)

**Not legal advice.** Confirm with CA. Accessed 2026-08-14.

## 1. What Samyoj invoices vs what Meta invoices

| | Samyoj GST tax invoice | Meta / WhatsApp Manager |
| --- | --- | --- |
| Tech Provider (TARGET) | SaaS subscription SKU only | Cloud API PMP + Calling |
| Solution Partner later | Software **plus** separately disclosed Meta pass-through | Meta bills **us**; we must show their charge vs ours ([17](17-META-WHATSAPP-BILLING-AND-POLICY.md) Price Transparency) |

Never one blended “WhatsApp ₹2,499.” Display “₹2,499/mo **+ GST**.” List prices in [01](01-PRICING-CATALOG.md) are **exclusive of 18% GST**.

## 2. Rate and SAC

- GST on SaaS/OIDAR-like software for Indian customers: **18%**.
- SAC (typical): **998314** (IT design/development) or **998315** (hosting/IT infrastructure). **Pick one with CA** and print on every invoice. Many Indian SaaS use 998314 or 998313/998314. Document the chosen code in finance config — do not invent per-invoice.
- Place of supply (B2B): **recipient location** (GSTIN state). Intra-state: CGST 9% + SGST 9%. Inter-state: IGST 18%.
- B2C: recipient address / IP+declared state. Collect **billing state** at checkout.
- Collect **GSTIN** (optional B2C, strongly prompted B2B). Validate checksum. Store on org.

## 3. Rule 46 invoice fields (must)

Invoice number (unique, sequential per FY), date, supplier GSTIN + name + address, recipient name + address + GSTIN if any, SAC, description (“Samyoj Growth — quarterly subscription”), taxable value, CGST/SGST or IGST rate and amount, total, place of supply, reverse-charge N, signature/QR as applicable.

**e-invoice (IRN/QR):** mandatory if aggregate turnover **> ₹5 crore** in any FY since 2017-18 (threshold as commonly applied to e-invoicing — confirm current CBIC). Until then: GST-compliant PDF is enough.

**Razorpay Invoices API:** cannot set SAC/HSN/tax break-up as a full GST invoice. Use Razorpay as **payment receipt**; Samyoj (or ClearTax/Zoho Books) as **tax invoice**.

## 4. Credits and refunds

- Upgrade: net invoice + tax on net (see [04](04-SUBSCRIPTION-LIFECYCLE.md)).
- Refund: **credit note** linked to original invoice (GST). Do not delete invoices.
- Failed payment: no invoice until captured (or invoice cancelled).
- Meta fees: **never** credit Samyoj GST because Meta overcharged — customer disputes Meta BM.

## 5. CURRENT CODE

No Invoice model. History tab = last 5 `PaymentOrder` amounts. No GSTIN. No SAC. Not compliant to charge Indian businesses at scale.

## 6. Foreign customers (v1 out of scope)

No USD SKUs. If an INR customer is overseas: OIDAR / export of services — CA. Do not enable until then.
