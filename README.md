# Personal Finance App

A private personal finance dashboard you host yourself, for one owner. It pulls live bank data through Plaid and gives you budgets, recurring bills, goals, net worth tracking, investments, a "best card to use" rewards guide and an AI "Ask" assistant. The UI follows Apple's design language: automatic light and dark mode, an iOS tab bar on iPhone and a sidebar on iPad and Mac.

Everything runs in your own accounts: your Vercel project, your Postgres database, your Plaid keys. Nothing is shared with anyone else.

## Features

- **Live bank sync (Plaid):** balances and transactions for checking, savings, credit, investment and loan accounts.
  - Plaid webhooks deliver updates in real time, and a daily scheduled sync catches anything missed.
  - The toolbar has a manual **Sync** button.
  - **Reconnect** repairs an expired bank login in place (Plaid update mode) without creating a duplicate bank.
- **Overview:** net worth with its trend from daily snapshots, a budget ring, income/spending/cash/investment/credit tiles, recent activity and the rewards guide.
- **Transactions:** search, filters, a review queue, splits, tags, rules and CSV export.
- **Budgets:** per-category limits with spending pace and expandable transaction drawers.
- **Recurring, Goals, Trends, Investments, Assets** (manual holdings such as property, a car or crypto) and **Rules** (automatic categorization).
- **Ask:** questions about your own money in plain English, answered by Claude from your real data.
- **Notifications:** Web Push for new transactions and for banks that need attention.
- **Sign-in:** a password, or Face ID / Touch ID passkeys. A guest **demo mode** shows sample data only.

---

## Setup guide

Plan on 30–45 minutes. You need:

- [Node.js](https://nodejs.org) 20 or newer
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (the free Hobby plan works)
- A Postgres database. The free tier of [Supabase](https://supabase.com) or [Neon](https://neon.tech) works.
- A [Plaid](https://dashboard.plaid.com/signup) account for bank sync
- Optional: an [Anthropic API key](https://console.anthropic.com) for **Ask**, and a [Finnhub](https://finnhub.io) key for live stock quotes

### 1. Get the code

Click **Use this template** (or fork) on GitHub to make your own copy, then:

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
npm install
cp .env.example .env.local
```

### 2. Generate your secrets

Run each command and paste the output into `.env.local`:

```bash
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 32   # → ENCRYPTION_KEY  (must be a different value)
openssl rand -hex 32   # → CRON_SECRET
```

Then choose an `AUTH_USERNAME` and a long `AUTH_PASSWORD`. These are your login.

> Keep `ENCRYPTION_KEY` safe. It encrypts your stored bank tokens, and if you lose it you'll have to reconnect every bank.

### 3. Create the database

**Supabase:** create a project, open **Connect → ORMs → Prisma**, and copy the two URLs:
- the pooled connection (port 6543, ends in `?pgbouncer=true`) → `POSTGRES_PRISMA_URL`
- the direct connection (port 5432) → `POSTGRES_URL_NON_POOLING`

**Neon:** create a project and copy the **pooled** connection string into `POSTGRES_PRISMA_URL` and the **direct** (unpooled) one into `POSTGRES_URL_NON_POOLING`.

Create the tables:

```bash
set -a; source .env.local; set +a   # load your variables into this shell
npx prisma db push
```

**Supabase only:** the app connects only through Prisma on the server, so lock down Supabase's public REST API. In the SQL editor, run:

```sql
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
```

Run it again any time you add tables.

### 4. Set up Plaid

1. In the [Plaid dashboard](https://dashboard.plaid.com), go to **Developers → Keys** and copy your `client_id` and the **Sandbox** secret.
2. Set `PLAID_CLIENT_ID`, `PLAID_SECRET` and `PLAID_ENV=sandbox`.
3. Sandbox uses fake banks. In Plaid Link, log in with `user_good` / `pass_good`.
4. When everything works, request **Production** access in the Plaid dashboard (it's free for a small number of personal connections), then switch to the production secret and `PLAID_ENV=production`.

For investment accounts, enable the **Investments** product in Plaid.

### 5. Run it locally

```bash
npm run dev
```

Open http://localhost:3000, sign in with your username and password, and connect a bank.

### 6. Deploy to Vercel

1. Push your repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repo. The defaults are correct.
3. Under **Settings → Environment Variables**, add every value from your `.env.local`. Mark the secrets as **Sensitive**.
4. Deploy. Note your URL, e.g. `https://your-app.vercel.app`, then add these variables and redeploy:
   - `PLAID_WEBHOOK_URL=https://your-app.vercel.app/api/plaid/webhook`
   - `WEBAUTHN_RP_ID=your-app.vercel.app`
   - `WEBAUTHN_ORIGIN=https://your-app.vercel.app`
5. If you use production Plaid, add your Vercel domain under **Allowed redirect URIs / domains** in the Plaid dashboard.

`vercel.json` already schedules the daily sync. Vercel sends your `CRON_SECRET` to it automatically.

### 7. Optional extras

- **Push notifications:** run `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=mailto:you@example.com`. On iPhone, add the app to your Home Screen first (Share → Add to Home Screen).
- **Ask (AI assistant):** set `ANTHROPIC_API_KEY`.
- **Live stock quotes:** set `FINNHUB_API_KEY`.
- **Your time zone:** set `APP_TIMEZONE`, e.g. `America/New_York`. It defaults to UTC, which makes "today" and month boundaries wrong in the evening.
- **Passkeys:** after signing in, use **Set Up Face ID** in the sidebar (More on iPhone) to skip the password next time.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | 16+ random characters; signs session cookies |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | yes | Owner login. Changing the password signs everyone out. |
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | yes | Postgres connection (pooled + direct) |
| `ENCRYPTION_KEY` | yes | 64 hex chars (`openssl rand -hex 32`); encrypts stored Plaid tokens. Must differ from `SESSION_SECRET`. |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | for bank sync | `sandbox` or `production` |
| `PLAID_WEBHOOK_URL` | recommended | `https://<your-domain>/api/plaid/webhook`, for real-time updates |
| `CRON_SECRET` | recommended | Authorizes the daily sync at `/api/cron/sync` |
| `APP_TIMEZONE` | recommended | IANA time zone for day and month bucketing (default `UTC`) |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | recommended | Pins the passkey domain (otherwise taken from the request host) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for notifications | `npx web-push generate-vapid-keys` |
| `ANTHROPIC_API_KEY` | for Ask | Claude API key |
| `ASK_MODEL` | optional | Claude model for Ask (default `claude-sonnet-5-5`) |
| `ASK_DAILY_LIMIT`, `ASK_DEMO_DAILY_LIMIT`, `ASK_DEMO_IP_DAILY_LIMIT` | optional | Daily Ask caps: owner (100), all demo visitors (30), each demo IP (5) |
| `FINNHUB_API_KEY` | optional | Live stock quotes for investments |
| `FORECAST_LOW_BALANCE` | optional | Cash-flow forecast warning threshold (default 500) |
| `TRANSFER_NAME_PATTERNS` | optional | Comma-separated transaction-name fragments to treat as transfers, e.g. your own fund tickers |

## Security

- Owner credentials live only in environment variables, never in the repo or the database.
- Sessions use HMAC-signed, httpOnly cookies that expire after 30 days. Signing out revokes the session on the server, so a copied cookie stops working. **Sign Out All Devices** ends every session.
- Logins are rate-limited per IP (5 per 15 minutes). Passkeys use WebAuthn and require user verification.
- Plaid access tokens are encrypted at rest with AES-256-GCM.
- Plaid webhooks are verified against Plaid's signed JWT. The cron endpoint requires `CRON_SECRET`.
- Every response sets a per-request nonce Content-Security-Policy, HSTS and the standard hardening headers.
- Demo sessions can't read or change real data.

## Development

```bash
npm run typecheck   # TypeScript
npm test            # unit tests (vitest)
npm run build       # production build
```

CI runs all three on every push and pull request (`.github/workflows/ci.yml`).

### Making it yours

- **Categories:** `lib/categoryMapper.ts` maps merchant names to categories. Add your local stores there, or use **Rules** in the app.
- **Recurring bills:** `lib/subscriptionDetector.ts` lists the keywords that mark a charge as a subscription. Add your utility and insurance companies there.
- **Card rewards:** `lib/rewards.ts` holds the card-to-category multipliers.
- **Name and branding:** search for "Personal Finance" in `app/layout.tsx`, `components/Logo.tsx` and `public/manifest.json`.

## Data model (Prisma + Postgres)

`BankItem` · `Account` · `Transaction` · `TransactionSplit` · `Budget` · `CategoryRule` · `Subscription` · `Goal` · `ManualAccount` · `NetWorthSnapshot` · `PushSubscription` · `Passkey` · `LoginAttempt`
