# Frontend — Complete Inventory

> Framework: React 18.3 + TypeScript  
> Build: Vite 6  
> Routing: react-router-dom v7  
> Styling: Tailwind CSS 3.4 (light/dark)  
> State: React Context (3 contexts)  
> Real-time: socket.io-client  
> Flow builder: @xyflow/react v12  

---

## Pages (20+)

### Public Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | `LoginPage` | Email/password + 2FA + Google OAuth |
| `/register` | `RegisterPage` | New account creation |
| `/forgot-password` | `ForgotPasswordPage` | Request reset email |
| `/reset-password` | `ResetPasswordPage` | Set new password |
| `/invite/:token` | `AcceptInvitePage` | Accept team invite |
| `/settings/whatsapp/callback` | `WhatsappCallbackPage` | Meta OAuth callback |

### Protected Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `DashboardPage` | Analytics overview, quick actions |
| `/inbox` | `InboxPage` | WhatsApp inbox (3-panel) |
| `/calls` | `CallsPage` | Voice call list + detail |
| `/automations` | `AutomationsPage` | Automations + flows list |
| `/automations/flows/:id` | `FlowBuilderPage` | Visual flow editor |
| `/automations/meta-flows/:id` | `MetaFlowBuilder` | WA-native flow builder |
| `/ai-bot` | `AiBotPage` | AI bot management |
| `/campaigns` | `CampaignsPage` | Broadcast campaigns |
| `/templates` | `TemplatesPage` | Template management |
| `/content-studio` | `ContentStudioPage` | AI content creation |
| `/commerce` | `CommercePage` | Order management |
| `/contacts` | `ContactsPage` | Contact management + pipeline |
| `/tickets` | `TicketsPage` | Support tickets |
| `/team` | `TeamPage` | Team management |
| `/reports` | `ReportsPage` | Analytics dashboard |
| `/billing` | `BillingPage` | Billing & plans |
| `/settings` | `SettingsPage` | Settings hub (9 tabs) |

---

## Components (150+)

### UI Primitives (30+)
`AppButton`, `AppInput`, `AppTextarea`, `AppSelect`, `AppAlert`, `PageShell`, `PageHeader`, `PageHero`, `DataTable`, `ListCard`, `ListToolbar`, `FilterBar`, `Pagination`, `ResponsiveDataView`, `SlideOver`, `ConfirmDialog`, `ContextMenu`, `EmptyState`, `LoadingState`, `StatusBadge`, `ProgressBar`, `SegmentedControl`, `SearchInput`, `RowActions`, `TableActions`, `SectionCard`, `FirstVisitHint`, `ThemeToggle`, `ConnectionStatusIndicator`, `modalUi.tsx` (ModalPanel, ModalSection, etc.)

### Layout (8)
`Sidebar`, `AppTopbar`, `MobileBottomNav`, `MobileMoreSheet`, `PlatformBrand`, `NumberSwitcher`, `NotificationCenter`, `GlobalSearch`

### Auth (8)
`AuthLayout`, `AuthInput`, `AuthButton`, `AuthDivider`, `GoogleAuthButton`, `AuthTabs`, `AuthError`, `AuthShowcase`

### Inbox (18)
`ConversationItem`, `MessageBubble`, `DateDivider`, `ChatComposer`, `TemplateComposer`, `InteractiveComposer`, `InboxDetailsPanel`, `InboxChatHeaderActions`, `MediaViewer`, `NewChatSlideOver`, `ChatContextMenu`, `ContactAvatar`, `ServiceWindowBanner`, `ServiceWindowBadge`, `InboxSelect`, `InboxListEmpty`, `ChatPlaceholder`, `AuthenticatedMedia`

### Flows (22)
`FlowCanvas`, `FlowStepNode`, `FlowStepPalette`, `FlowHandle`, `FlowNodePanel`, `FlowSettingsPanel`, `FlowPreviewPanel`, `FlowTestPanel`, `FlowAnalyticsPanel`, `FlowVersionsPanel`, `FlowValidationWarnings`, `FlowBuilderSidePanel`, `FlowMobileNav`, `FlowTemplatesSlideOver`, `FlowTemplateCard`, `FlowCard`, `FlowPhoneMockup`, `FlowEmptyState`, `FlowsTab`, `TriggerNode`, `WaFormPicker`, `WhatsAppFormsPromo`

### Campaigns (8)
`CampaignCard`, `CampaignTable`, `CampaignAudienceSection`, `CampaignAudiencePreview`, `CampaignAnalyticsPanel`, `CampaignRecipientTable`, `CampaignDetailHeader`, `CampaignQuotaBanner`

### Contacts (10)
`ContactTable`, `ContactCard`, `ContactDetailPanel`, `ContactFiltersBar`, `ContactTagManager`, `ContactBulkBar`, `ContactBulkTagModal`, `ContactPipelineTab`, `ContactInsightCards`

### Templates (7)
`TemplateCard`, `TemplateTable`, `TemplateCreateForm`, `TemplateDetailPanel`, `TemplateLibraryPanel`, `TemplateButtonEditor`

### AI Bot (6)
`AiBotCard`, `AiBotAnalyticsPanel`, `AiBotAuditPanel`, `AiBotHowItWorks`, `AiBotTemplatePicker`

### Calls (11)
`CallListItem`, `CallDetailView`, `CallFiltersBar`, `CallAnalyticsPanel`, `CallInfoPanel`, `CallRingModal`, `CallNotificationProvider`, `CallSetupProgress`, `CallSystemStatus`, `CallingSettingsPanel`, `CallsPageHeader`

### Billing (4)
`BillingCurrentPlanHero`, `BillingPlanCard`, `BillingUsageWidget`, `BillingSkeleton`

### Reports (6)
`ReportsAgentTable`, `ReportsLeaderboardTable`, `ReportsBreakdownCard`, `ReportsSlaPanel`, `ReportsTemplateTable`

### Team (11)
`TeamMembersTab`, `TeamMemberCard`, `TeamInvitesTab`, `TeamDepartmentsTab`, `TeamRolesTab`, `TeamAuditTab`, `TeamSecurityPanel`, `TeamSettingsTab`, `AvailabilityBadge`, `RoleBadge`

### Settings (9)
`SettingsPanel`, `SettingsSidebar`, `SettingsReadinessBanner`, `SettingsInsightCards`, `SettingsStatusPill`, `SettingsStat`, `MetaAppConfigModal`, `CannedRepliesPanel`, `IntegrationsPanel`

### Dashboard (5)
`StatCard`, `RingMetric`, `QuickActionTile`, `DashboardSkeleton`, `WhatsAppConnectGuide`

### Other
`Layout`, `ProtectedRoute`, `OnboardingGate`, `ErrorBoundary`, `LeadCard`, `LeadStageSelect`, `CommerceOrderCard`, `CommerceOrderDetailPanel`, `TicketCard`, `TicketDetailPanel`

---

## State Management

### Contexts (3)

| Context | Purpose | Key State |
|---------|---------|-----------|
| `AuthContext` | User session | user, organization, orgRole, availability |
| `WhatsAppNumberContext` | Active WA number | numbers, activeNumber, hasConnectedNumber |
| `ThemeContext` | Light/dark theme | mode, resolved |

### Hooks (8)

| Hook | Purpose |
|------|---------|
| `useSocket` | Socket.IO connection |
| `useGoogleAuth` | Google OAuth flow |
| `useOnActiveNumberChange` | WA number switch callback |
| `useDebouncedValue` | Search debounce |
| `useBreakpoint` | Responsive detection |
| `useSidebarCollapsed` | Sidebar state |
| `useInboxKeyboardShortcuts` | R/Esc/D shortcuts |
| `useFirstVisit` | First-visit hints |

---

## API Layer (27 API objects)

All in `src/services/api.ts` — Axios with auto token refresh.

`authApi`, `inboxApi`, `labelsApi`, `cannedRepliesApi`, `whatsappApi`, `automationApi`, `flowApi`, `settingsApi`, `callingApi`, `aiBotApi`, `campaignApi`, `contactApi`, `templateApi`, `analyticsApi`, `billingApi`, `onboardingApi`, `complianceApi`, `integrationsApi`, `leadApi`, `ticketApi`, `commerceApi`, `contentStudioApi`, `waFormsApi`, `flowAssetsApi`, `teamApi`

---

## Real-time Events (Socket.IO)

| Event | Purpose |
|-------|---------|
| `message:new` | New message |
| `message:status` | Delivery status |
| `call:incoming` | Incoming call |
| `call:ring` | Call ringing |
| `call:ring_timeout` | Ring timeout |
| `call:declined` | Call declined |
| `call:updated` | Call status change |
| `call:transcript` | Live transcript |
| `conversation:handoff` | Bot → agent |
| `conversation:assigned` | Agent assigned |
| `conversation:bot` | Bot status change |
| `campaign:status` | Campaign status |
| `campaign:progress` | Campaign progress |
| `alert:new` | System alert |
| `template:status` | Template approval |
| `whatsapp:quality` | Quality rating |
| `whatsapp:account-alert` | Account alert |
