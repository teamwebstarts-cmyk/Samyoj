# Live test — is session ke baad (A–F)

Tick tab jab **tum** screen/phone pe dekho. Unit green ≠ customer access.

Customer access **tabhi** jab G2–G6 evidence ho. Aaj stack band tha — pehle G2.

## 0) Code (unit) — agent chalayega

Packets A–F oracles. File: `.unlazy/existing-harden-manual/GATES.md` G1.

## 1) Stack (G2) — tum + agent

```text
bash start.sh
```

Dekho:

- UI `http://localhost:3000`
- Admin `http://localhost:3001`
- `curl http://localhost:8000/health` → api/database/redis ok
- `curl http://localhost:8000/api/whatsapp/webhook/health` → `webhookConfigured: true`, **no** webhookUrl
- Tunnel: challenge `ping` (Codespace mein Node fetch)

Fail: `NGROK_AUTHTOKEN` missing, `totalReceived` ignore karo jab tak naya reply na ho.

## 2) Naya phone reply (G3) — tum

1. WhatsApp **connected** number pe, apne personal phone se **naya** message (purana thread ka old msg nahi).
2. Inbox mein bubble aaye.
3. Health `totalReceived` **pehle se zyada**.

Fail = inbound lost. Customer **mat** do. Infra (tunnel / META_WEBHOOK_URL), Inbox UI mat rewrite.

## 3) Send path (G4) — tum

1. Connect (OAuth, App ID/Secret UI nahi).
2. Inbox se 1 message.
3. Approved template send.
4. Chhota campaign, consented contacts. Double-click = 2 WhatsApp **nahi**.

## 4) Mix nahi (G5) — tum, agar 2 org ya 2 numbers hon

Doosre org / doosre number ka Inbox/contact mix = **stop**.

## 5) Restore other host (optional aaj)

Is machine pe isolated restore **ho chuka** (Packet F). Doosri machine abhi optional. Customer host ke bina GO weak.

## 6) GO / NO-GO (G6)

| Must-tick | Abhi |
|---|---|
| Jhoot nahi | unit done |
| Duplicate send nahi | unit done |
| 1000 numbers | harness done |
| Restore this host | done |
| Inbound lost nahi | **G3** |
| Naya phone reply | **G3** |
| Org/number mix | **G5** |
| Other-host restore | optional / weak GO |

**NO-GO** if G3 fail, mix, ya duplicate live.

---

## Is session mein code leftover (live ke baad, alag)

- Login `organizations[0]` — 2 membership silent pehli org
- `dailySendLimit` naam vs Meta cap
- Live transfer stub, TARGET billing, Phase C, ES v4 — **is track mein nahi**
