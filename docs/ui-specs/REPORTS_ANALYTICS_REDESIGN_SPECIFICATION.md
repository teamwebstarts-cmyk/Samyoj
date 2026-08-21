# WhatsApp CRM Reports & Analytics Engine — Complete Specification & Redesign Blueprint

**Document Version:** 2.0  
**Status:** Architecture & Design Specification (Review Phase)  
**Target Systems:** `client/src/pages/ReportsPage.tsx`, `client/src/components/reports/*`, `server/src/modules/analytics/*`

---

## 1. Executive Overview & Problem Statement

The Reports and Analytics module in a production WhatsApp CRM serves three distinct stakeholder personas:
1. **Executive Leadership / Owners**: Require high-level ROI, customer volume growth, message delivery reliability, Meta conversation cost estimation, and overall phone number reputation.
2. **Support & Operations Managers**: Require real-time and historical SLA attainment, First Response Time (FRT), Mean Time to Resolution (MTTR), agent workload balance, 7×24 peak hour scheduling heatmaps, and First Contact Resolution (FCR) rates.
3. **Marketing & Growth Teams**: Require campaign conversion funnels (Sent → Delivered → Read → Clicked → Replied), template quality ratings, audience opt-out rates, and broadcast performance comparisons.

### 1.1 Summary of Existing Gaps in Samyoj Reports

A comprehensive code audit of `client/src/pages/ReportsPage.tsx` and `server/src/modules/analytics/routes.ts` revealed several critical architectural and functional limitations:

1. **Delivery Rate Calculation Bug**: `server/src/modules/analytics/routes.ts` queries messages with `status: 'DELIVERED'` directly. In Meta's webhook lifecycle, once a message is read, its state transitions to `READ`. Excluding `READ` messages causes calculated delivery rates to collapse as customer engagement increases.
2. **$N+1$ Database Query Inefficiencies**: The `/api/analytics/reports` endpoint executes 3 sequential database count queries per organization member in an unbatched loop, creating significant query latency and database connection pool pressure on medium/large teams.
3. **Broadcast-Only Template Tracking**: The `/api/analytics/templates` endpoint only aggregates data from the `Campaign` table, omitting all templates dispatched directly from the Shared Inbox or automated flows (`Message` records with `type: 'TEMPLATE'`).
4. **Absence of Time-Series Trends & Heatmaps**: The current UI displays static aggregate counters with no historical time-series curves, volume charts, or Day × Hour activity heatmaps.
5. **Redundant Duplicate Tables**: `ReportsAgentTable` and `ReportsLeaderboardTable` render separate lists with overlapping columns, causing UI clutter without offering unified sorting, search, or pagination.
6. **No Data Export Capability**: The interface lacks CSV/Excel export mechanisms for agent scorecards, template analytics, or delivery logs.
7. **Missing Meta Category & Phone Health Analytics**: No tracking of Meta conversation pricing categories (*Marketing, Utility, Authentication, Service*), daily tier limit utilization, or phone number quality rating tiers.

---

## 2. Competitive Intelligence & Benchmark Matrix (30+ Sources)

We benchmarked the analytics architectures of 30+ market leaders across WhatsApp Business Solution Providers (BSPs), omnichannel customer engagement platforms, and enterprise support suites:

| Category | Platforms Analyzed | Key Strengths & Patterns Identified |
|---|---|---|
| **WhatsApp-First CRMs & BSPs** | **WATI, Respond.io, AiSensy, Interakt, Gallabox, DoubleTick, SleekFlow, Kommo, Cooby** | Clear separation between marketing broadcasts and inbox support; First Response Time (FRT) & Resolution Time tracking; 24h Customer Service Window (CSW) utilization; Meta conversation category billing breakdown; Live phone number quality rating (Green/Yellow/Red). |
| **Enterprise Support & Omnichannel Suites** | **Zendesk Explore, Freshchat, Twilio Flex, DelightChat, Trengo, Kustomer, Sprinklr, Gorgias, Zoho Desk** | 7×24 Day-of-Week × Hour-of-Day Activity Heatmaps for shift staffing; SLA compliance rate (%) with breach tracking; First Contact Resolution (FCR); Agent concurrency & active workload distribution; Multi-attribute CSV exports. |
| **Conversational AI & Automation Platforms** | **Yellow.ai, Gupshup Conversation Cloud, Jio Haptik, Decagon, Alhena, Verloop.io, ChatBot** | Bot Containment Rate (`bot_resolved / total_sessions`); Bot-to-Human Escalation Rate; Unrecognized query / Fallback intent clustering (identifies missing FAQ articles); Token consumption and provider cost estimation. |
| **Telecom & Enterprise Cloud Infrastructure** | **Meta Cloud API Analytics, Infobip, Sinch, Bird (MessageBird), Brevo, Klaviyo** | Precise delivery funnel tracking (Sent → Delivered → Read → Clicked → Replied); Messaging Tier Limits (1K, 10K, 100K, Unlimited); Meta failure code categorization (Policy, Rate Limit, Service Window expired). |

---

## 3. High-Value Intelligence vs. Vanity Noise Framework

To keep the UI clean, purposeful, and uncluttered, we establish strict inclusion criteria:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                VALUE VS. NOISE MATRIX                                         │
├───────────────────────────────────────────────────────────────┬───────────────────────────────┤
│                     HIGH-VALUE METRICS                        │         VANITY NOISE          │
│                      (Always Surface)                         │       (Discard / Avoid)       │
├───────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ • Full Message Funnel: Sent → Delivered → Read → Click/Reply  │ • Arbitrary "Health Score %"  │
│ • 7×24 Hourly Activity Heatmap (Staffing & Surge Matrix)      │ • Disconnected static links   │
│ • True First Response Time (FRT) & Resolution Time (MTTR)     │ • Raw token counts without    │
│ • SLA Attainment % and Breach Counts                          │   feature or cost context     │
│ • Bot Containment Rate vs. Human Escalation Rate              │ • Overlapping dual tables     │
│ • Unrecognized AI Query Clustering (Knowledge Gap Insights)   │ • Static mock numbers         │
│ • Template CTR, Reply Rate, and Meta Quality Tier             │ • Unfiltered lifetime counts  │
│ • Meta Category Cost Estimation (Marketing/Utility/Service)   │   on date-filtered views      │
│ • CSV / Excel Export on all data tables                       │ • Pie charts with >6 slices   │
└───────────────────────────────────────────────────────────────┴───────────────────────────────┘
```

---

## 4. Proposed 5-Tab Architecture

The Reports screen is reorganized into 5 distinct, role-based tabs with a unified **Global Filter Bar**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  REPORTS & INTELLIGENCE                  [ 📱 All Numbers ▾ ]  [ 📅 Last 30 Days ▾ ]  [ 📊 vs Prev ▾ ]  [ 📥 Export ▾]│
├──────────────────┬──────────────────────┬──────────────────────┬────────────────────────┬───────────────────────┤
│ 1. Overview      │ 2. Team & Support    │ 3. Campaigns & CTR   │ 4. AI & Automation     │ 5. Meta Ops & Costs   │
└──────────────────┴──────────────────────┴──────────────────────┴────────────────────────┴───────────────────────┘
```

### 4.1 Global Filter Bar
* **WhatsApp Number Selector**: Switch between active phone numbers or aggregate across all connected numbers in the workspace.
* **Date Range Picker**:
  * **Presets**: *Today, Yesterday, Last 7 Days, Last 14 Days, Last 30 Days, This Month (MTD), Last Month, Last 90 Days*.
  * **Custom Date Range**: Dual calendar picker supporting arbitrary date windows up to 365 days.
* **Period-over-Period Comparison Toggle**: Compare selected range against previous period (e.g. *Last 30 Days vs Previous 30 Days*), rendering delta percentage pills (+12.4% ↑ / -3.2% ↓).
* **Universal Export Dropdown**: One-click export to CSV for:
  * Executive Overview Summary
  * Agent Performance Scorecard
  * Template Delivery & CTR Matrix
  * AI Deflection & Knowledge Gap Log
  * Message Delivery Log

---

### Tab 1: Overview & Conversational Volume (Executive Dashboard)

#### Purpose
Provides business owners and leadership with a 360-degree view of communication health, customer reach, and message engagement.

#### Key Metrics & Widgets
1. **Executive KPI Strip (6 Cards with PoP Delta)**:
   * **Total Messages Sent**: Total outbound dispatches (Broadcasts + Automations + Agent Replies).
   * **Delivery Rate %**: Formula: `((Delivered + Read) / Sent) * 100`.
   * **Read Rate %**: Formula: `(Read / Sent) * 100`.
   * **Inbound Inquiries**: Total incoming customer messages.
   * **Active Conversations**: Total open customer conversation threads.
   * **24h Window Utilization %**: Ratio of customer-initiated (free) sessions vs outbound templates.

2. **Volume Trend Chart (Interactive Time-Series)**:
   * Dual-line smooth area chart plotting **Outbound Messages** (Emerald) vs. **Inbound Messages** (Sky) over time.
   * Hover tooltip displaying exact date, sent count, delivered count, read count, and inbound inquiries.
   * Dashed reference line showing previous period comparison.

3. **Message Engagement Funnel**:
   * Visual conversion funnel showing attrition at each stage:
     $$\text{Sent (100\%)} \longrightarrow \text{Delivered (98.4\%)} \longrightarrow \text{Read (82.1\%)} \longrightarrow \text{Interacted / Replied (31.5\%)}$$

4. **Conversation Status Distribution**:
   * Segmented bar showing ratio of *Open*, *Pending*, *Closed*, and *Snoozed* conversations.

---

### Tab 2: Team & Support Operations (Manager Dashboard)

#### Purpose
Equips support supervisors to monitor SLA adherence, agent workload balance, response speed, and shift staffing requirements.

#### Key Metrics & Widgets
1. **SLA & Responsiveness Hero**:
   * **SLA Compliance Rate %**: Percentage of conversations responded to within the target SLA window (e.g. 94.2%).
   * **Average First Response Time (FRT)**: Time from customer inbound message to first human agent reply.
   * **Mean Time to Resolution (MTTR)**: Average duration from conversation creation to closed state.
   * **First Contact Resolution (FCR) Rate %**: Percentage of chats resolved in a single agent interaction.
   * **Active SLA Breaches**: Count of currently open conversations exceeding the SLA deadline.

2. **7×24 Peak Hours Activity Heatmap**:
   * A 7-day (Monday–Sunday) by 24-hour (00:00–23:00) intensity grid.
   * Color scale indicating inbound message density.
   * Hover tooltip reveals: *Hour, Day, Inbound Volume, Average First Response Time during that hour*.
   * Provides immediate visual clarity on when to schedule more support agents.

3. **Unified Agent Performance Scorecard (Interactive Table)**:
   * Search input for agent name/email.
   * Department filter (Support, Sales, Operations).
   * Columns:
     * **Agent**: Avatar, Name, Email, Role.
     * **Availability**: Live status pill (*Online, Away, Offline*).
     * **Assigned Active**: Currently open chats.
     * **Resolved Chats**: Total closed conversations in period.
     * **Messages Sent**: Agent reply count.
     * **Avg First Response Time (FRT)**: Color-coded (Green < 5m, Amber < 15m, Red > 15m).
     * **Avg Resolution Time**: Time to close.
     * **SLA Attainment %**: Individual agent SLA score.
   * Sortable by any column with CSV export.

---

### Tab 3: Broadcast Campaigns & Template ROI (Marketing Dashboard)

#### Purpose
Empowers marketing and growth teams to evaluate broadcast reach, click-through rates, audience engagement, and template quality.

#### Key Metrics & Widgets
1. **Broadcast Performance Summary**:
   * Total Campaigns Dispatched
   * Total Recipients Reached
   * Aggregate Delivery Rate %
   * Aggregate Read Rate %
   * Button Click-Through Rate (CTR) %
   * Inbound Reply Rate %

2. **Template Intelligence Matrix (All Dispatches — Campaigns + Shared Inbox + Flows)**:
   * Search and filter by Category (*Marketing, Utility, Authentication*).
   * Columns:
     * **Template Name & Language**: e.g., `festive_sale_2026 (en_IN)`.
     * **Category**: Color-coded pill (*Marketing, Utility, Authentication*).
     * **Dispatches**: Total times sent (Broadcast + 1-on-1 Inbox + Bot Flows).
     * **Delivery Rate %**: Percentage reached device.
     * **Read Rate %**: Percentage read by recipient.
     * **Click-Through Rate (CTR) %**: URL / CTA button clicks.
     * **Reply Rate %**: Inbound responses generated.
     * **Meta Quality Score**: Live Meta rating (*High [Green], Medium [Yellow], Low [Red]*).

3. **Campaign Conversion & ROI Breakdown**:
   * Table of individual campaigns with direct reply attribution and delivery funnel.

---

### Tab 4: AI Bots & Automation Deflection (Automation Dashboard)

#### Purpose
Provides transparent insights into automated self-service, deflection rates, escalation frequency, and AI token/cost expenditure.

#### Key Metrics & Widgets
1. **Deflection & Containment Overview**:
   * **Bot Containment Rate %**: Formula: `(Conversations fully resolved by Bot without human handoff / Total Bot-handled conversations) * 100`.
   * **Human Escalation Rate %**: Percentage of bot conversations transferred to human agents.
   * **Average Bot Handling Time**: Duration in seconds per automated interaction.
   * **Automations Triggered**: Total automated keyword, welcome, and flow executions.

2. **Top Unrecognized Queries & Knowledge Gaps (Actionable AI Learning)**:
   * Identifies top user questions that triggered fallback responses.
   * Table displaying:
     * *Customer Query / Intent*
     * *Frequency Count*
     * *Action*: Quick-action button to "+ Add to AI Knowledge Base" or "+ Create Keyword Automation".

3. **AI Feature Consumption & Cost Estimator**:
   * Usage breakdown by feature (*Chatbot Replies, Voice Calling Agent, Smart Suggestions, Audio STT, Translation*).
   * Columns: *Feature, Request Count, Input Tokens, Output Tokens, Total Units, Estimated Cost (USD / INR)*.
   * Quota progress bar with warning alerts at 80% and 95% of monthly allowance.

---

### Tab 5: WhatsApp Phone Health & Meta Operations (Telecom / Admin Dashboard)

#### Purpose
Monitors Meta Cloud API compliance, phone number reputation, messaging limits, and conversation category billing.

#### Key Metrics & Widgets
1. **Phone Number Reputation & Tier Guard**:
   * **Phone Quality Rating**: Live Meta status indicator (*GREEN - High, YELLOW - Medium, RED - Low*).
   * **Messaging Limit Tier**: Daily 24-hour unique recipient limit (*1,000 / 10,000 / 100,000 / Unlimited*).
   * **Daily Quota Progress Bar**: Today's consumption against the current tier limit.
   * **Opt-Out & Block Rate %**: Unsubscribe frequency to safeguard against Meta spam bans.

2. **Meta Conversation Category Breakdown (Billing Analytics)**:
   * Segmented distribution and counts for:
     * **Marketing Conversations** (Promotional broadcasts, offers)
     * **Utility Conversations** (Order updates, transactional alerts)
     * **Authentication Conversations** (OTP verification)
     * **Service Conversations** (Customer-initiated support within 24h window — includes Free Tier allowance tracking)
   * Estimated Meta charges based on regional conversation rate cards.

3. **Delivery Error Code Classification**:
   * Categorization of failed dispatches (*Policy Rejection, Rate Limit, Service Window Expired, Invalid Phone Number*).

---

## 5. Technical Implementation & Data Architecture

### 5.1 Corrected Calculation Formulas

$$\text{Delivery Rate} = \frac{\text{Count}(\text{status} \in [\text{'DELIVERED'}, \text{'READ'}])}{\text{Count}(\text{direction} = \text{'OUTBOUND'})} \times 100$$

$$\text{Read Rate} = \frac{\text{Count}(\text{status} = \text{'READ'})}{\text{Count}(\text{direction} = \text{'OUTBOUND'})} \times 100$$

$$\text{Bot Containment Rate} = \frac{\text{Count}(\text{botActive} = \text{true} \land \text{botHandoffAt} = \text{null} \land \text{status} = \text{'CLOSED'})}{\text{Count}(\text{activeBotId} \neq \text{null} \lor \text{botActive} = \text{true})} \times 100$$

$$\text{SLA Compliance Rate} = \frac{\text{Count}(\text{slaBreached} = \text{false} \land \text{firstResponseAt} \neq \text{null})}{\text{Count}(\text{firstResponseAt} \neq \text{null})} \times 100$$

### 5.2 Optimized SQL Aggregation Strategy (Eliminating $N+1$ Loops)

Instead of looping through team members in JavaScript, all agent performance metrics are aggregated in a single database roundtrip using grouped Prisma aggregations:

```typescript
// Single-pass agent performance aggregation
const [agentOutbound, agentClosed, agentAssigned] = await Promise.all([
  prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      direction: 'OUTBOUND',
      createdAt: { gte: since, lte: until },
      conversation: { organizationId, assignedAgentId: { not: null } },
    },
    _count: { id: true },
  }),
  prisma.conversation.groupBy({
    by: ['assignedAgentId'],
    where: {
      organizationId,
      status: 'CLOSED',
      updatedAt: { gte: since, lte: until },
      assignedAgentId: { not: null },
    },
    _count: { id: true },
  }),
  prisma.conversation.groupBy({
    by: ['assignedAgentId'],
    where: {
      organizationId,
      status: 'OPEN',
      assignedAgentId: { not: null },
    },
    _count: { id: true },
  }),
]);
```

### 5.3 Database Indexing Requirements

To ensure sub-100ms response times on workspaces with 100,000+ messages:

```prisma
// server/prisma/schema.prisma additions
model Message {
  // ... existing fields
  @@index([conversationId, direction, status, createdAt])
  @@index([createdAt, direction])
}

model Conversation {
  // ... existing fields
  @@index([organizationId, assignedAgentId, status, updatedAt])
  @@index([organizationId, firstResponseAt, createdAt])
  @@index([organizationId, slaBreached, status])
}
```

---

## 6. Frontend Component & File Structure

```
client/src/
├── pages/
│   └── ReportsPage.tsx                       # Main shell with tab switcher and global filter bar
├── components/reports/
│   ├── ReportsHeader.tsx                     # Title, WhatsApp number switcher, Date picker, Export CTA
│   ├── ReportsDateRangePicker.tsx            # Preset + Custom date range calendar popover
│   ├── ReportsOverviewTab.tsx                # Tab 1: Executive volume, trend chart, funnel
│   ├── ReportsTeamTab.tsx                    # Tab 2: SLA speed, 7x24 heatmap, agent scorecard
│   ├── ReportsCampaignsTab.tsx               # Tab 3: Broadcast metrics, template performance matrix
│   ├── ReportsAiTab.tsx                      # Tab 4: Deflection rate, fallback insights, cost estimator
│   ├── ReportsMetaHealthTab.tsx              # Tab 5: Number quality, tier limits, category billing
│   ├── charts/
│   │   ├── VolumeTimeSeriesChart.tsx         # Responsive dual-line SVG/Canvas time-series
│   │   ├── PeakHoursHeatmap.tsx              # 7x24 interactive hourly activity grid
│   │   ├── ConversionFunnelChart.tsx         # 4-stage horizontal visual conversion funnel
│   │   └── MetaCategoryDonut.tsx             # Category distribution ring chart
│   ├── tables/
│   │   ├── UnifiedAgentScorecardTable.tsx    # Sortable agent table with search & CSV export
│   │   ├── UniversalTemplateTable.tsx        # Combined template matrix (Campaign + Inbox + Bot)
│   │   └── AiKnowledgeGapTable.tsx           # Fallback query clustering table
│   └── ReportsSkeleton.tsx                   # Fluid loading state skeleton
```

---

## 7. Phased Execution Plan

1. **Review & Approval (Current)**: Validate architecture, tab boundaries, and metric definitions.
2. **Phase 1 — Backend Core**:
   * Implement corrected delivery rate, containment rate, and SLA formulas.
   * Add grouped database queries for time-series trends and the 7×24 hourly heatmap.
   * Create universal template aggregation endpoint (`Campaign` + `Message`).
   * Add CSV export streaming endpoint (`/api/analytics/export`).
3. **Phase 2 — UI Foundation & Filter System**:
   * Implement tabbed navigation in `ReportsPage.tsx`.
   * Build `ReportsDateRangePicker` with presets and comparison toggles.
   * Build universal export trigger.
4. **Phase 3 — Tab Implementations & Visualizations**:
   * Construct `VolumeTimeSeriesChart`, `PeakHoursHeatmap`, and `ConversionFunnelChart`.
   * Unify Agent Scorecard with search, sorting, and availability badges.
   * Implement Template Performance Matrix and AI Knowledge Gap panel.
5. **Phase 4 — Verification & QA**:
   * Unit tests for calculation accuracy and timezone offsets.
   * Dark mode, mobile responsiveness, and dynamic density compliance checks.
