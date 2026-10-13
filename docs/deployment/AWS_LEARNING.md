# Samyoj cloud move — seekhne wala note

> Date: 13 Oct 2026. Language: Hinglish. Sirf woh words jo is move mein use hue.  
> Live host abhi bhi GCP hai, jab tak DNS na badle. AWS box ready hai.

---

## 1. Ek line mein kya hua

Purana server Google Cloud par tha. Naya server AWS Mumbai par ban gaya. Database, uploads, aur chal raha app copy ho chuka hai. Domain abhi purane IP par hai. Tumhe sirf do A records badalne hain. Certificate uske baad lagta hai. Tab login aur WhatsApp AWS par aate hain.

---

## 2. Words (chhota matlab)

| Word | Matlab |
|------|--------|
| **VM / instance** | Ek virtual computer. Naam: GCP `samyoj-server`, AWS `samyoj-poc`. |
| **Region** | Shehar. Dono Mumbai: GCP `asia-south1`, AWS `ap-south-1`. |
| **Elastic IP** | AWS ka fixed public address. Hamara: `3.108.25.94`. Machine badlo, IP wahi reh sakta hai. |
| **DNS / A record** | Naam se IP. `app.samyoj.com` abhi `34.47.220.76` (GCP) hai. Badal kar `3.108.25.94`. |
| **Security group** | AWS firewall. Internet se sirf 80 aur 443. Database bahar nahi. |
| **nginx** | Darwaza. Browser yahan aata hai, woh Node ko andar bhejta hai. |
| **PM2** | Node ko zinda rakhta hai. Sirf `whatsapp-api`. Doosra worker mat chalao. |
| **Postgres** | Asli data: users, chats, WhatsApp number. |
| **Redis** | Temporary lines (jobs, cache). Copy nahi ki. |
| **`.env`** | Passwords aur API keys. Git mein nahi. Server par mode `600`. |
| **Cookie `Secure`** | Production login cookie sirf HTTPS par save hoti hai. |
| **Certbot** | Free HTTPS certificate. Domain AWS par point kare tabhi banega. |
| **MCP** | Cursor ka AWS connection. Machine banane ke liye. Extra bill nahi. |

---

## 3. Do machines

| | Google Cloud (abhi live naam) | AWS (naya box) |
|--|-------------------------------|----------------|
| Name | `samyoj-server` | `samyoj-poc` |
| ID | — | `i-085ca1949bb94e621` |
| Size | e2-medium, 2 CPU, ~4 GB | t3.medium, 2 CPU, 4 GB |
| Disk | 10 GB, tight | 30 GB encrypted |
| OS | Debian 13 | Debian 12 |
| IP | `34.47.220.76` | `3.108.25.94` |
| App | `https://app.samyoj.com` | `http://3.108.25.94` (certificate baad mein) |

Dono ek saath on hain to dono ka bill aata hai. AWS roughly **₹3,000 / month**.

---

## 4. Kya copy hua, kya nahi

| Copy | Nahi |
|------|------|
| Database `whatsapp_platform` (11 orgs, 17 messages, 1 WhatsApp number) | Redis |
| `server/.env` | `.git` aur TypeScript `src` |
| `uploads` (~3.6 MB) | Extra database `samyojdatabase` |
| Jo build GCP par chal raha tha (`dist`) | Meta / Razorpay accounts (woh bahar hain, URL same hai) |

Poora database ek file mein isliye, kyunki ek message apni chat se juda hai. Alag tables kaatne se link toot jata hai. Data chhota tha, isliye yeh hi minimal hai.

---

## 5. Do bugs jo humne dekhe

**Blank white page.** App ne browser se kaha: files HTTPS se lao. Is IP par HTTPS tha hi nahi, isliye JavaScript nahi aaya. POC par woh header hata diya. Domain + certificate ke baad header wapas aayega.

**Login ke baad wahi page.** Password galat nahi tha. Cookie `Secure` hai, HTTP par browser use phenk deta hai. Isliye session nahi banta. `https://app.samyoj.com` par yeh loop khatam hota hai.

Facebook / Google bhi IP par nahi chalenge. Unke registered URLs `https://app.samyoj.com` hain.

---

## 6. Tumhara kaam vs agent ka kaam

| Tum | Agent |
|-----|--------|
| AWS login, IAM permission | Instance, disk, firewall, IP |
| DNS ke do A records | Database copy, app start, health check |
| `DNS go` bolna | Certificate |
| Phone se ek naya WhatsApp reply | Confirm `totalReceived` badha |
| GCP band karne ka order, test ke baad | Machine stop / delete |

Meta, Razorpay, `.env` URLs mat badalna. Woh pehle se `app.samyoj.com` par hain.

---

## 7. DNS ke baad order

1. A records `3.108.25.94` par.
2. Agent certificate lagata hai.
3. Tum `https://app.samyoj.com` par login.
4. Ek naya WhatsApp reply.
5. GCP VM **stop**. Saat din baad delete. Turant delete mat karna.

---

## 8. Yaad rakhne wali teen baatein

1. **Naam badalta hai, IP nahi.** Customers domain kholte hain. IP sirf DNS ke peeche hai.
2. **Code GitHub par.** Server par sirf chalta hua build. VM haath lage to poori history nahi milni chahiye.
3. **Proof pehle, switch baad mein.** Health aur counts AWS par pass ho chuke. Switch sirf DNS + certificate hai.
