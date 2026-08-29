# Agent skills (Samyoj project)

Project-scoped skills for Cursor and other agents. Installed via [skills.sh](https://skills.sh/) CLI; versions tracked in `skills-lock.json` at repo root.

## Installed skills

| Skill | Source | Use for |
|-------|--------|---------|
| `whatsapp-cloud-api` | [bellopushon/whatsapp-cloud-api](https://github.com/bellopushon/whatsapp-cloud-api) | Official Meta WhatsApp Cloud API reference (messages, webhooks, templates, CSW, errors) |
| `samyoj-whatsapp-dev` | `.cursor/skills/samyoj-whatsapp-dev/` | Samyoj local dev: `start.sh`, ngrok, Connect OAuth, Inbox inbound |
| `frontend-design` | anthropics/skills | Distinctive UI design guidance |
| `unlazy` | Leonxlnx/unlazy | Completion discipline for long agent tasks |

**Samyoj rule:** Use `samyoj-whatsapp-dev` for *this repo’s* runbooks and product rules. Use `whatsapp-cloud-api` for *Meta API* payloads, endpoints, and error codes.

## Update all project skills

From repo root:

```bash
npx skills update -p -y
```

Or update only WhatsApp API reference:

```bash
npx skills update whatsapp-cloud-api -p -y
```

## Add a new skill

```bash
npx skills add <owner/repo> --skill <skill-name> -y
```

Example (already installed):

```bash
npx skills add https://github.com/bellopushon/whatsapp-cloud-api --skill whatsapp-cloud-api -y
```

Commit `skills-lock.json` and `.agents/skills/<name>/` after adding or updating.
