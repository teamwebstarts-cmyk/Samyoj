# Deferred & Rejected Features Registry

This document records architectural, product, and feature decisions where specific capabilities have been evaluated and explicitly marked as **REJECTED** or **DEFERRED** by the product owner.

**Rule for Future AI / Agents:** Do NOT re-propose or re-recommend these features in future discovery reports or roadmap sessions unless explicitly requested by the user.

---

## 1. Conversation Snooze & Follow-Up Reminders
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** The database schema has fields for `snoozedUntil` and status `SNOOZED`, but the product owner determined that conversation snoozing adds unnecessary queue complexity and is not desired in the current or near-term product workflow.
- **Instruction:** Keep conversation status workflows simple (`OPEN`, `CLOSED`). Do not add snooze dropdowns or snooze filter queues.

---

## 2. Visual Kanban Sales Pipeline for Deals
- **Status:** ⏸️ **DEFERRED FOR FUTURE VERSION**
- **Date Decided:** September 2026
- **Context:** A drag-and-drop Kanban board for deals/leads is a valuable CRM concept, but for the current product milestone, the existing Leads table view and Contacts management are sufficient.
- **Instruction:** Do not replace or refactor the current Leads/Contacts view into a Kanban board now. Retain this item in the long-term backlog for later review.

---

## 3. Click-to-WhatsApp (CTWA) Ad Lead Badge & Attribution
- **Status:** ⏸️ **DEFERRED FOR DEDICATED CAMPAIGN PHASE**
- **Date Decided:** September 2026
- **Context:** While capturing Meta Ad referral data (`ctwa_clid`, ad creative ID) and syncing conversions to Meta CAPI is high value, it requires a dedicated marketing integration and testing phase with active Meta Ad accounts.
- **Instruction:** Do not implement ad badge heuristics or partial CAPI dispatchers now. Save for a focused ad-attribution epic when live ad accounts are connected.

---

## 4. Whisper Voice Note Speech-to-Text Transcription
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** Unnecessary and creates confusion for regular users. The newly implemented 1x/1.5x/2x audio playback speed toggle already provides sufficient utility without extra AI cognitive load.
- **Instruction:** Do not implement audio transcription or speech-to-text models.

---

## 5. AI Thread Summarizer
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** While an interesting concept, it is confusing for non-technical users and adds UI clutter to the inbox.
- **Instruction:** Do not add AI thread summarization buttons or widgets.

---

## 6. AI Smart Reply Suggestions
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** Generates excessive API token/credit consumption without guaranteed accuracy for business replies.
- **Instruction:** Do not implement auto-suggested AI response pills in the composer. The slash command (`/`) quick replies feature already solves fast response drafting cleanly.

---

## 7. In-Chat Payment Links Generator
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** Evaluated and rejected by the product owner as unnecessary complexity for the chat composer workflow.
- **Instruction:** Do not add in-chat payment link generation dialogs.

---

## 8. Dynamic Smart Lists for Contacts
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** Dynamic automated list rules add confusing segmentation logic. Existing manual tags and filtered views are preferred.
- **Instruction:** Do not build dynamic smart list builders for contacts.

---

## 9. Global Command Palette (Cmd + K / Ctrl + K)
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** Too technical for everyday business users. Users prefer direct sidebar navigation and standard UI search.
- **Instruction:** Do not build a global keyboard command palette.

---

## 10. Shopify & E-Commerce Live Order Widget
- **Status:** ⏸️ **DEFERRED FOR FUTURE SCOPE**
- **Date Decided:** September 2026
- **Context:** Useful when scaling to a high volume of Shopify/WooCommerce merchants, but deferred for the future when customer demand materializes.
- **Instruction:** Keep in long-term future roadmap. Do not implement now.

---

## 11. Inbound Welcome Auto-Responder (First Message Greeting)
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT — NOW OR FUTURE)**
- **Date Decided:** September 2026
- **Context:** Product owner explicitly rejected this. The existing automation flows engine already handles first-message routing and greeting. A separate welcome auto-responder creates duplicate logic and user confusion.
- **Instruction:** Do not build a standalone "welcome message" feature. Flows handle this entirely.

---

## 12. Delivery / Read Receipt Informational UI
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT)**
- **Date Decided:** September 2026
- **Context:** WhatsApp blue double-tick (read receipt) is already rendered natively in the inbox message thread. Adding a dedicated "delivered to device / read by" info panel duplicates what WhatsApp already surfaces and adds visual clutter.
- **Instruction:** Do not build a separate delivery/read-receipt status overlay or info panel. The blue tick in the chat thread is sufficient.

---

## 13. Team Round-Robin Assignment
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT — NOW OR FUTURE)**
- **Date Decided:** September 2026
- **Context:** Automatic round-robin distribution of conversations to team members is not a required workflow for the current customer base.
- **Instruction:** Do not implement round-robin auto-assignment. Manual agent assignment and existing automation rules cover the use case.

---

## 14. Campaign Delivery Analytics / Export Dashboard
- **Status:** ❌ **REJECTED (DO NOT IMPLEMENT — NOW OR FUTURE)**
- **Date Decided:** September 2026
- **Context:** Explicit per-campaign delivery analytics export (beyond the existing campaign recipient list and status view) was evaluated and rejected for now and the future.
- **Instruction:** Do not build a dedicated campaign analytics export dashboard or per-campaign delivery funnel report.

---

## 15. One-Click SVG Flowchart Export
- **Status:** ⏸️ **DEFERRED — RE-IMPLEMENT WHEN READY**
- **Date Decided:** September 2026
- **Context:** A one-click SVG/PNG export of the automation flow canvas was previously removed or broken. Product owner flagged it should be re-implemented properly in a dedicated pass.
- **Instruction:** Do not partially implement. When scheduling, do this as a focused task with proper canvas-to-SVG serialization.

