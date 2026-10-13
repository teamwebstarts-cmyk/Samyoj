# AWS Official MCP Server — Cursor Setup (Samyoj)

> **Kya hai:** AWS ka **managed** MCP Server (Agent Toolkit for AWS). Cursor se tum AI ko bol sakte ho: “Mumbai mein t3.medium banao”, “security group check karo” — wo AWS APIs **tumhare IAM permissions** ke andar chalayega.  
> **Official docs:** [Setting up the AWS MCP Server](https://docs.aws.amazon.com/aws-mcp/latest/userguide/getting-started-aws-mcp-server.html) · [OAuth with AWS Sign-in](https://docs.aws.amazon.com/signin/latest/userguide/aws-mcp-server.html)  
> **Migration context:** [AWS_MIGRATION_GUIDE.md](./AWS_MIGRATION_GUIDE.md)

---

## 1. Pehle samjho — do alag cheezein (confusion mat karo)

| Name | Official? | Kya karta hai |
|------|-----------|----------------|
| **AWS MCP Server** (remote URL `aws-mcp.*.api.aws`) | ✅ **Haan — AWS managed** | Docs search, `call_aws`, skills, sandbox scripts. **Yahi tum chahiye.** |
| **awslabs.aws-api-mcp-server** (local `uvx`) | AWS Labs open-source | Sirf CLI wrapper; tumhare laptop par credentials. Backup option. |

Is repo mein humne **AWS MCP Server (OAuth)** Cursor config mein add kiya hai: `.cursor/mcp.json` → entry `aws-mcp`.

**Paisa:** MCP server ka **alag charge nahi**. Sirf jo EC2/S3 tum banaoge uska bill + CloudTrail normal.

---

## 2. Repo mein kya already setup hai

File: **`.cursor/mcp.json`**

```json
"aws-mcp": {
  "url": "https://aws-mcp.us-east-1.api.aws/mcp?oauth=initialize",
  "type": "http"
}
```

- **`?oauth=initialize`** — Cursor ke liye AWS recommend karta hai (OAuth flow start ho).
- **Endpoint region `us-east-1`** — MCP **control plane** yahan hosted hai; **tumhari EC2 `ap-south-1` (Mumbai)** par ban sakti hai. API calls target region mein jaati hain jab agent `--region ap-south-1` use kare.

**Tumhe ab kya karna hai (human steps):**

1. Cursor **reload** / project dubara kholo (MCP config pick ho).
2. Cursor → **Settings → MCP** → `aws-mcp` **Enabled** ho.
3. Chat mein koi AWS tool use karo → **browser khulega** → AWS Sign-in → **Allow** dabao.

---

## 3. Tumhe exactly kya chahiye (checklist — mujhe / AWS ko dena)

### Zaroori (OAuth path — recommended)

| # | Detail | Example / note |
|---|--------|----------------|
| 1 | **AWS account** | Naya ya existing; **root se daily kaam mat karo** |
| 2 | **AWS account ID** | 12 digit, e.g. `123456789012` (Console → top right) |
| 3 | **Sign-in identity** | IAM Identity Center **ya** IAM user **with MFA** |
| 4 | **IAM policy for OAuth** | Attach managed policy: **`AWSMCPSignInOAuthAccessPolicy`** (actions: `signin:AuthorizeOAuth2Access`, `signin:CreateOAuth2Token`) |
| 5 | **Kaam karne ke liye AWS permissions** | OAuth sirf **login** hai. EC2 banane ke liye alag policy chahiye — shuruat: **`ReadOnlyAccess`** (seekhne ke liye) **ya** migration ke liye scoped custom (§5) |
| 6 | **Default region (Samyoj)** | **`ap-south-1`** (Mumbai) — agent ko hamesha yahi bolna |
| 7 | **Cursor surface** | **Cursor Desktop** best (OAuth redirect `cursor://...`). Web/Codespace par browser OAuth kabhi awkward ho sakta hai → §4 Plan B |

### Chat / repo mein **mat bhejo**

- Root access keys  
- `AWS_SECRET_ACCESS_KEY`  
- Production `server/.env`  
- GitHub PAT  

OAuth ke baad token Cursor khud manage karta hai (~1 hr, refresh ~12 hr).

### Optional (baad mein, migration ke liye useful)

| Detail | Kyon |
|--------|------|
| **Route 53 hosted zone** `samyoj.com` | DNS cutover |
| **Elastic IP** (after create) | `app.samyoj.com` A record |
| **Separate “staging” AWS account** | Agent galti se prod na todo |
| **Billing alarm** e.g. ₹5000/month | Surprise bill se bachao |

---

## 4. Plan B — agar OAuth Cursor Web / Codespace par fail ho

AWS docs ka **MCP Proxy for AWS** (local):

**Requirements:** `uvx` installed, `aws configure` / `AWS_PROFILE` with credentials.

`.cursor/mcp.json` mein `aws-mcp` ko temporarily replace karo:

```json
"aws-mcp": {
  "command": "uvx",
  "args": [
    "mcp-proxy-for-aws==1.6.4",
    "https://aws-mcp.us-east-1.api.aws/mcp",
    "--metadata",
    "AWS_REGION=ap-south-1"
  ]
}
```

**Is path par tumhe chahiye:**

| Detail | Kahan se |
|--------|----------|
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` **ya** SSO | `aws configure` / `~/.aws/credentials` |
| **Profile name** | e.g. `samyoj-admin` → env `AWS_PROFILE=samyoj-admin` in mcp.json `env` block |
| **MFA** | SSO use karo ya short-lived session token |

---

## 5. Safe IAM — migration se pehle (recommended)

**Phase A — seekhna / read-only (1–2 din)**  
Attach: `ReadOnlyAccess` + `AWSMCPSignInOAuthAccessPolicy`  
Agent sirf describe/list karega.

**Phase B — infra banana (jab tum ready)**  
Custom policy example (idea — exact ARN tumhare account ke):

- `ec2:*` in `ap-south-1` only (ya `RunInstances`, `CreateSecurityGroup`, … scoped)
- `iam:PassRole` sirf ek EC2 instance role par
- `ssm:*` Session Manager ke liye
- `s3:PutObject` sirf backup bucket par

**Deny example (optional):** `aws:ViaAWSMCPService` condition se sirf MCP se aayi calls allow — advanced; baad mein.

CloudTrail **on** rakho (default in most accounts) — kaun si API call agent ne ki, audit.

---

## 6. Verify — setup sahi hai ya nahi

1. Cursor MCP panel: `aws-mcp` = connected (green).  
2. Mujhse bolo: *“List EC2 regions”* ya *“Describe my account aliases”* — pehli baar browser OAuth aayega.  
3. AWS Console → **CloudTrail** → last events mein MCP-related API calls dikhengi.

Agar error:

| Error | Fix |
|-------|-----|
| OAuth / consent failed | `AWSMCPSignInOAuthAccessPolicy` attach karo |
| Access denied on `call_aws` | IAM mein ReadOnly ya EC2 permissions add karo |
| Cursor browser nahi khulta | Desktop app use karo ya Plan B proxy |

---

## 7. Office documents — kaunsa doc kis kaam ke liye

| Document | Kab padho |
|----------|-----------|
| [AWS_MIGRATION_GUIDE.md](./AWS_MIGRATION_GUIDE.md) | GCP → AWS data, security, GitHub deploy, cost, cutover |
| [AWS_MCP_CURSOR_SETUP.md](./AWS_MCP_CURSOR_SETUP.md) | **Yahi file** — Cursor + AWS agent |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Abhi live GCP par redeploy |
| [SERVER_INVENTORY.md](./SERVER_INVENTORY.md) | GCP VM audit reference |
| [README.md](./README.md) | Deployment folder index |

---

## 8. Tum mujhe migration start karne ke liye kya bhejoge (ek message mein)

Copy-paste template:

```text
AWS account ID: __________
Main region: ap-south-1
Sign-in: IAM user / SSO (email): __________
MCP OAuth policy attached: yes/no
Agent IAM: ReadOnly / Custom (describe): __________
Cursor: Desktop / Web
DNS hostnames: app.samyoj.com, admin.samyoj.com — Route 53? yes/no
Cutover target window: __________
```

Secrets **kabhi** is template mein mat likho — sirf “`.env` Doppler se milega” likhna kaafi hai.

---

## 9. Maintenance

- AWS MCP endpoint / Cursor OAuth rules change ho sakte hain — pehle [AWS MCP release notes](https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is.html) check karo.
- `.cursor/mcp.json` mein **API keys commit mat karo** — env interpolation use karo (Cursor docs: MCP config interpolation).

**Last updated:** 2026-10-13
