# Inbox Header + Customer Details — Information Architecture

Companion to the Header Details Redesign. Source of truth for ownership of every action.

## Now (post-redesign)

- Header = conversation ops: identity, service window, Search / Snooze / Star / Bot / More (Assign, Ticket, Export, Campaign, Status) + details toggle.
- Sidebar = customer context: compact profile (status, opt-in, SLA, last active, assignee), Labels, Notes, Stats, Tags, Automations (read-only + handoff).
- Quick Actions removed; Campaign lives in header More.
- Tablet expand uses `md:flex`; `D` / header toggle use docked panel on md+ and mobile sheet below md (overlay cleared on resize).

## Ask

- Cleaner header + details; less duplication; honest naming; real APIs only.

## Suggest (shipped + polish)

- Ownership matrix below.
- Profile shows opted-in, SLA, status, handoff in Automations, View full contact to Contacts.

## Ownership matrix

| Capability | Header | Sidebar |
|------------|--------|---------|
| Search / Snooze / Star / Bot toggle | Keep | Bot status read-only |
| Assign | More | Assignee row |
| Ticket / Export / Campaign / Status | More | Status badge on profile |
| Labels / Notes / Stats / Tags | — | Keep |
| Opt-in / SLA / Last active / Handoff | — | Profile / Automations |
| Open details | PanelRight toggle | Close X + rail |

## Do not invent

- No fake customer online / typing.
- No HubSpot / key-value customFields until schema exists.
- Tags are not custom attributes.
- Call stays disabled until a real path ships.
