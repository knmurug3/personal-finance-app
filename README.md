<div align="center">

<img src="public/icon.svg" width="96" height="96" alt="Personal Finance App logo" />

# Personal Finance App

**Your own private money dashboard: live bank sync, budgets, net worth and an AI that answers questions about your spending.**
<br/>
Self-hosted. One owner. Your data stays in your accounts.

<br/>

[![CI](https://github.com/knmurug3/personal-finance-app/actions/workflows/ci.yml/badge.svg)](https://github.com/knmurug3/personal-finance-app/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-Postgres-2D3748?logo=prisma&logoColor=white)
![Plaid](https://img.shields.io/badge/Plaid-bank%20sync-111111)
![Claude](https://img.shields.io/badge/Ask-Claude-D97757?logo=anthropic&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-iPhone%20%7C%20iPad%20%7C%20Mac-5A0FC8?logo=pwa&logoColor=white)

<br/>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fknmurug3%2Fpersonal-finance-app&env=SESSION_SECRET,AUTH_USERNAME,AUTH_PASSWORD,ENCRYPTION_KEY,POSTGRES_PRISMA_URL,POSTGRES_URL_NON_POOLING&envDescription=Required%20settings%20%E2%80%94%20see%20the%20README%20setup%20guide&envLink=https%3A%2F%2Fgithub.com%2Fknmurug3%2Fpersonal-finance-app%23-setup-guide)
&nbsp;
[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge&logo=github)](https://github.com/knmurug3/personal-finance-app/generate)

<br/>

[Features](#-features) · [How it works](#-how-it-works) · [Setup](#-setup-guide) · [Configuration](#%EF%B8%8F-environment-variables) · [Security](#-security) · [Customize](#-make-it-yours)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🏦 Live bank sync
Plaid connects checking, savings, credit, investment and loan accounts. Webhooks deliver updates in real time, and a daily sync catches anything missed. **Reconnect** repairs an expired bank login in place, with no duplicates.

</td>
<td width="50%" valign="top">

### 📈 Net worth & overview
Net worth with a trend line built from daily snapshots, a budget ring, and tiles for income, spending, cash, investments and credit, all on one screen.

</td>
</tr>
<tr>
<td valign="top">

### 💳 Transactions
Search, filters, a review queue, splits, tags, auto-categorization rules and CSV export.

</td>
<td valign="top">

### 🎯 Budgets & goals
Per-category limits that show your spending pace, plus savings goals with target dates.

</td>
</tr>
<tr>
<td valign="top">

### 🔁 Recurring bills
Subscriptions and bills are detected from your history automatically, then shown on an upcoming-bills timeline and a cash-flow forecast.

</td>
<td valign="top">

### 📊 Investments
Holdings from every connected brokerage, combined by ticker, with optional live quotes. You can add manual assets such as a home, a car or crypto.

</td>
</tr>
<tr>
<td valign="top">

### 💬 Ask (AI assistant)
Ask "How much did I spend on dining last month?" and Claude answers from your real data. It never guesses numbers.

</td>
<td valign="top">

### 🏆 Card rewards guide
Shows which of your cards earns the most for dining, groceries, gas, streaming and shopping.

</td>
</tr>
<tr>
<td valign="top">

### 🔔 Notifications
Web Push alerts for new transactions and for banks that need attention, on iPhone too.

</td>
<td valign="top">

### 🔐 Face ID sign-in
Sign in with a password or a passkey (Face ID / Touch ID). A guest **demo mode** shows sample data only.

</td>
</tr>
</table>

> [!TIP]
> The app follows Apple's design language: automatic light and dark mode, an iOS tab bar on iPhone and a sidebar on iPad and Mac. Add it to your Home Screen and it behaves like a native app.

---

## 🧭 How it works

```mermaid
flowchart LR
    U["📱 You<br/>(browser / Home Screen app)"] -->|HTTPS · session cookie| V["▲ Vercel<br/>Next.js app + API"]
    V -->|Prisma| DB[("🐘 Postgres<br/>Supabase / Neon")]
    V <-->|Link · sync| P["🏦 Plaid"]
    P -.->|signed webhooks| V
    C["⏰ Vercel Cron<br/>daily"] -->|CRON_SECRET| V
    V -->|questions + tool calls| A["🤖 Claude API<br/>(optional)"]
    V -->|Web Push| U
```

Everything runs in **your** accounts: your Vercel project, your database, your Plaid keys. No third party ever sees your data.

---

## 🚀 Setup guide

> [!NOTE]
> Plan on **30–45 minutes**. Everything below works on free tiers.

**You'll need:**

| | Service | Used for | Cost |
|---|---|---|---|
| 🟩 | [Node.js](https://nodejs.org) 20+ | Running locally | Free |
| 🐙 | [GitHub](https://github.com) | Your copy of the code | Free |
| ▲ | [Vercel](https://vercel.com) | Hosting and the daily sync | Free (Hobby) |
| 🐘 | [Supabase](https://supabase.com) or [Neon](https://neon.tech) | Postgres database | Free tier |
| 🏦 | [Plaid](https://dashboard.plaid.com/signup) | Bank connections | Free sandbox; low-cost production |
| 🤖 | [Anthropic](https://console.anthropic.com) *(optional)* | The **Ask** assistant | Pay as you go |
| 📉 | [Finnhub](https://finnhub.io) *(optional)* | Live stock quotes | Free tier |

<details open>
<summary><h3>1️⃣ Get the code</h3></summary>

Click **[Use this template](https://github.com/knmurug3/personal-finance-app/generate)** to create your own copy, then:

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
npm install
cp .env.example .env.local
```

</details>

<details open>
<summary><h3>2️⃣ Generate your secrets</h3></summary>

Run this three times and paste each result into `.env.local`:

```bash
openssl rand -hex 32
```

| Paste into | Notes |
|---|---|
| `SESSION_SECRET` | Signs your login cookie |
| `ENCRYPTION_KEY` | Encrypts stored bank tokens. **Must differ** from `SESSION_SECRET`. |
| `CRON_SECRET` | Protects the daily sync endpoint |

Then choose an `AUTH_USERNAME` and a long `AUTH_PASSWORD`. These are your login.

> [!WARNING]
> Back up `ENCRYPTION_KEY` in a password manager. If you lose it, you'll have to reconnect every bank.

</details>

<details>
<summary><h3>3️⃣ Create the database</h3></summary>

**Supabase:** create a project, open **Connect → ORMs → Prisma**, and copy:
- the pooled URL (port `6543`, ends with `?pgbouncer=true`) → `POSTGRES_PRISMA_URL`
- the direct URL (port `5432`) → `POSTGRES_URL_NON_POOLING`

**Neon:** copy the **pooled** connection string into `POSTGRES_PRISMA_URL` and the **direct** one into `POSTGRES_URL_NON_POOLING`.

Then create the tables:

```bash
set -a; source .env.local; set +a   # load your variables into this shell
npx prisma db push
```

> [!IMPORTANT]
> **Supabase only:** lock down Supabase's public REST API. The app talks to the database only through Prisma on the server, so nothing breaks. In the SQL editor, run:
>
> ```sql
> do $$ declare t record; begin
>   for t in select tablename from pg_tables where schemaname = 'public' loop
>     execute format('alter table public.%I enable row level security', t.tablename);
>     execute format('revoke all on public.%I from anon, authenticated', t.tablename);
>   end loop;
> end $$;
> ```
>
> Run it again any time you add tables.

</details>

<details>
<summary><h3>4️⃣ Set up Plaid</h3></summary>

1. In the [Plaid dashboard](https://dashboard.plaid.com), go to **Developers → Keys** and copy your `client_id` and the **Sandbox** secret.
2. Set `PLAID_CLIENT_ID`, `PLAID_SECRET` and `PLAID_ENV=sandbox`.
3. Sandbox uses fake banks. In Plaid Link, sign in with **`user_good` / `pass_good`**.
4. Enable the **Investments** product if you want brokerage holdings.
5. When everything works, apply for **Production** access, then switch to the production secret and `PLAID_ENV=production`.

</details>

<details>
<summary><h3>5️⃣ Run it locally</h3></summary>

```bash
npm run dev
```

Open **http://localhost:3000**, sign in, and click **Add Account** to connect a bank. 🎉

</details>

<details>
<summary><h3>6️⃣ Deploy to Vercel</h3></summary>

1. Push your repo to GitHub, or use the **Deploy with Vercel** button at the top.
2. In Vercel, **Add New → Project** and import the repo. The defaults are correct.
3. Under **Settings → Environment Variables**, add everything from `.env.local`. Mark the secrets as **Sensitive**.
4. Deploy, note your URL (e.g. `https://your-app.vercel.app`), then add these variables and **redeploy**:

   ```env
   PLAID_WEBHOOK_URL=https://your-app.vercel.app/api/plaid/webhook
   WEBAUTHN_RP_ID=your-app.vercel.app
   WEBAUTHN_ORIGIN=https://your-app.vercel.app
   ```

5. For production Plaid, add your domain to the allowed domains in the Plaid dashboard.

`vercel.json` already schedules the daily sync at 11:00 UTC, and Vercel sends your `CRON_SECRET` automatically.

</details>

<details>
<summary><h3>7️⃣ Optional extras</h3></summary>

| Extra | How |
|---|---|
| 🔔 Push notifications | `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=mailto:you@example.com`. On iPhone, add the app to your Home Screen first. |
| 💬 Ask assistant | Set `ANTHROPIC_API_KEY` |
| 📉 Live quotes | Set `FINNHUB_API_KEY` |
| 🕒 Your time zone | Set `APP_TIMEZONE` (e.g. `America/New_York`). The default is UTC, which puts "today" on the wrong day in the evening. |
| 🔐 Face ID | After signing in, tap **Set Up Face ID** in the sidebar (or **More** on iPhone) |

</details>

---

## ⚙️ Environment variables

<details>
<summary><b>Show all variables</b></summary>

<br/>

| Variable | Required | Purpose |
|---|:---:|---|
| `SESSION_SECRET` | ✅ | 16+ random characters; signs session cookies |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | ✅ | Owner login. Changing the password signs everyone out. |
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | ✅ | Postgres connection (pooled + direct) |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars; encrypts stored Plaid tokens. Must differ from `SESSION_SECRET`. |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | 🏦 | Bank sync. `sandbox` or `production`. |
| `PLAID_WEBHOOK_URL` | ⭐ | `https://<your-domain>/api/plaid/webhook`, for real-time updates |
| `CRON_SECRET` | ⭐ | Authorizes the daily sync at `/api/cron/sync` |
| `APP_TIMEZONE` | ⭐ | IANA time zone for day and month bucketing (default `UTC`) |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | ⭐ | Pins the passkey domain |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 🔔 | Push notifications |
| `ANTHROPIC_API_KEY` | 💬 | Enables Ask |
| `ASK_MODEL` | — | Claude model for Ask (default `claude-sonnet-5-5`) |
| `ASK_DAILY_LIMIT`, `ASK_DEMO_DAILY_LIMIT`, `ASK_DEMO_IP_DAILY_LIMIT` | — | Daily Ask caps: owner (100), all demo visitors (30), each demo IP (5) |
| `FINNHUB_API_KEY` | — | Live stock quotes |
| `FORECAST_LOW_BALANCE` | — | Cash-flow forecast warning threshold (default 500) |
| `TRANSFER_NAME_PATTERNS` | — | Comma-separated name fragments to treat as transfers (e.g. your own fund tickers) |

✅ required · 🏦 for bank sync · ⭐ recommended · 🔔 / 💬 for that feature · — optional

</details>

---

## 🔒 Security

| | |
|---|---|
| 🔑 **Credentials** | Owner login lives only in environment variables, never in the repo or the database |
| 🍪 **Sessions** | HMAC-signed, httpOnly cookies that expire after 30 days and are revoked on the server at sign-out. **Sign Out All Devices** ends every session. |
| 🧱 **Brute force** | Logins are rate-limited per IP (5 per 15 minutes, counted atomically) |
| 👆 **Passkeys** | WebAuthn with user verification required |
| 🔐 **Bank tokens** | Plaid access tokens are encrypted at rest with AES-256-GCM |
| ✍️ **Webhooks** | Verified against Plaid's signed JWT; the cron endpoint requires `CRON_SECRET` |
| 🛡️ **Headers** | Per-request nonce CSP, HSTS and the standard hardening headers |
| 👀 **Demo mode** | Demo sessions can't read or change real data |

---

## 🎨 Make it yours

| Want to… | Edit |
|---|---|
| Teach it your local stores | `lib/categoryMapper.ts`, or add **Rules** in the app |
| Detect your utility and insurance bills | `lib/subscriptionDetector.ts` |
| Change card reward multipliers | `lib/rewards.ts` |
| Rename or rebrand the app | `app/layout.tsx`, `components/Logo.tsx`, `public/manifest.json` |

---

## 🛠️ Development

```bash
npm run typecheck   # TypeScript
npm test            # unit tests (vitest)
npm run build       # production build
```

CI runs all three on every push and pull request.

<details>
<summary><b>Tech stack & data model</b></summary>

<br/>

**Stack:** Next.js 16 (App Router) · React 18 · TypeScript · Tailwind CSS · Prisma · Postgres · Plaid · Recharts · SimpleWebAuthn · Web Push · Anthropic SDK · Vitest

**Tables:** `BankItem` · `Account` · `Transaction` · `TransactionSplit` · `Budget` · `CategoryRule` · `Subscription` · `Goal` · `ManualAccount` · `NetWorthSnapshot` · `PushSubscription` · `Passkey` · `LoginAttempt`

</details>

---

<div align="center">
<sub>Built for people who want their finances in one place without handing their data to someone else. ⭐ Star the repo if it helps you.</sub>
</div>
