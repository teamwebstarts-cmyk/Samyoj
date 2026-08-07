# Taste — UI & Design

- Prefers pixel-perfect implementation of provided design mockups: read reference images pixel-by-pixel and match exact spacing, sizes, alignment, and content — not approximate. Confidence: 0.95
- Provides exact text-based UI specifications inline (card titles, descriptions, button labels, flow directions like "lands on Personality") and expects them to be implemented exactly as stated — textual specs carry the same weight as visual mockups. Confidence: 0.85
- Uses WhatsApp's chat UI as the canonical reference for inbox/chat design (bubble colors #D9FDD3 sent / #FFFFFF received, #EFEAE2 chat bg, Roboto/SF Pro fonts, ~8px bubble radius, read-receipt ticks, 24h reply-window badge). Confidence: 0.9
- Wants a glassmorphism aesthetic: translucent panels, backdrop-blur, frosted-glass cards with soft shadows and gradient tints. Confidence: 0.85
- Treats icons as high priority: wants custom SVG icons that match the design exactly (not library defaults), plus small hover tooltips on every icon explaining what it does. Confidence: 0.9
- Demands full responsiveness across mobile/tablet/desktop with no overlapping text, no blank gaps, and app screens that fit the viewport without page-level scroll. Confidence: 0.9
- Prefers square-cornered (rounded-rect) selection/status indicators over circular ones. Confidence: 0.75
- No mock data — analytics, graphs, and stats must be wired to real backend data with correct logic/mathematics. Confidence: 0.95
- Avoids multiple/vertical scrollbars in composer panels; prefers side-by-side layouts (form on left, live preview on right) that don't require scrolling. Confidence: 0.8
- Chat-scoped notifications only (inline notices like WhatsApp, e.g. "AI bot paused") — no global page-level toasts for success; success is shown by the message bubble itself. Confidence: 0.85
- Wants skeleton loaders for async-loaded content (conversation lists, chat threads) and smooth transitions when content appears. Confidence: 0.7
- When presenting many configurable options (especially sensory ones like TTS voices), requires inline preview/demo controls so users can audition each choice before selecting — listing names/labels alone is insufficient; the user must be able to experience the difference to make an informed decision. Confidence: 0.85
