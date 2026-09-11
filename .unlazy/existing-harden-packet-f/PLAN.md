# PLAN — Packet F 1000-send + restart harness

Owner: engineering
Mode: Solo
Scope: Test-deploy harness only. Meta simulator (200 / 429 / 5xx / timeout-after-accept). N eligible consented recipients → N unique Graph sends, 0 dups. Restart after `providerCallStartedAt` does not send twice. Redis down falls back to memory throttle; workers stay claim/lease safe. Isolated restore refuses the primary DB. No campaign-send rewrite.

## Out of this packet

- Live phone reply (Manual)
- Off-host encrypted backup
- Customer production / GO
- Rebuilding campaign worker send

## Evidence (measured, not guessed)

- Count: eligible=1000 graphCalls=1000 uniqueTos=1000 dups=0
- Restart: afterCrash=7 afterRestart=7 crashedPhoneCalls=0
- Meta: retry429=2 timeout=1 http5xx=1
- Restore: refusedPrimary=true rehearsal=ok (schema-only dump 202567 bytes into `samyoj_packet_f_restore`, then dropped)
- ES v4, Razorpay Subscriptions, Ads, real Studio, live transfer, Phase C automations
