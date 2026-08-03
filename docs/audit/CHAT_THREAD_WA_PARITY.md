# Chat thread — WhatsApp parity checklist

## Bubble rules
- Inbound: white + light ring; outbound `#D9FDD3` / dark `#005c4b` (tail matches dark)
- Tail only on last bubble in a same-direction group
- Tighter gap within a group (`mt-0.5`); larger when sender changes (`mt-2`)
- Date divider: centered soft pill (“Today”)
- Outbound first-in-group: `You · time` or `AI Bot · time` when automation/flow
- Ticks: PENDING clock → SENT ✓ → DELIVERED ✓✓ grey → READ ✓✓ `#53bdeb` → FAILED + Retry
- Quote strip + action menu on text, media, interactive, contact, location

## Load algorithm
1. Open conversation → `ThreadSkeleton` until first page
2. `GET /messages?limit=50` returns `{ messages, hasMore, serviceWindow }`
3. Near top (`scrollTop < 72`) → fetch `before=oldest.createdAt` with scroll-height anchor restore
4. Soft “Load earlier” fallback remains
5. Server clamps `limit` 1–100; `hasMore` via take+1
6. Optimistic outbound rows are replaced/deduped when HTTP or `message:new` arrives

## Composer
- Tabs: Reply | Template | Interactive (window closed → Template forced, Reply/Interactive locked)
- Multiline textarea; Enter send / Shift+Enter newline
- Emoji grid; attach Photo/Video/PDF; lightning + `/` canned; Mic voice notes (`voice: true`)
- Media limits: image 5MB, video/audio 16MB, PDF 100MB

## Honesty
- No customer typing / online
- Viewing strip only from real agent presence (`conversation:presence`)
- Reactions sync via `message:reaction` (`reactions` top-level)
