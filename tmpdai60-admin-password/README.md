# DResume

AI-powered resume platform: build, score, match, translate, and coach — all
backed by Anthropic Claude, JWT auth, and Stripe-driven plan gating.

The repo is a monorepo with two deployable units:

| Folder | What it is |
| --- | --- |
| [`backend/`](backend/) | ASP.NET Core 8 Web API — auth, Stripe billing, AI features, Postgres persistence |
| [`resume/`](resume/) | Next.js 14 (App Router) frontend — bilingual UI (EN / VI) over the backend |

For deep backend docs (endpoints, plan gating, Stripe local dev), see
[backend/README.md](backend/README.md).

## Features

- **Score Resume** — upload PDF / DOCX / TXT, get section-by-section scoring and recommendations
- **Build Resume** — guided form + AI rewriting, export to PDF
- **Job Match** — paste a JD, get fit score and gap analysis
- **Cover Letter** — generate tailored letters from a resume + JD
- **Career Coach** — open-ended career advice grounded in the user's resume
- **Interview Coach** — role-specific question packs with model answers
- **Salary Estimator** — market band estimate based on role / location / experience
- **Translation** — full UI + AI output localized to English and Vietnamese
- **Accounts & billing** — email/password auth with verification, sessions, 2FA, Stripe Checkout for plan upgrades

## Stack

**Backend** — .NET 8 Web API · PostgreSQL 16 (three EF Core contexts on one DB)
· JWT bearer auth · Stripe Checkout + webhooks · Anthropic Claude
(`claude-sonnet-4-6`)

**Frontend** — Next.js 14 (App Router) · React 18 · Tailwind v4 ·
`next-intl` (EN / VI) · `next-auth` · `react-dropzone` · `jspdf` · `mammoth`
· `pdf-parse` · `react-markdown`

## Plans

| Plan | Price | Resumes | AI/month | Gated features |
| --- | --- | --- | --- | --- |
| **Free** | $0 | 2 | 5 | Resume CRUD, parse, analyze, build, translate |
| **Pro** | $9.99/mo | 50 | 200 | Adds Job Match, Cover Letter, Career Coach, Interview Coach, Salary Estimator |
| **Enterprise** | $29.99/mo | unlimited | unlimited | Pro features + priority queue flag |

The three plans are upserted into Stripe on backend startup using lookup keys
`dresume_free`, `dresume_pro`, `dresume_enterprise`. Gated endpoints return
HTTP 402 with an upgrade hint when a Free user hits a Pro feature.

## Quick start

Prerequisites: Docker Desktop, .NET 8 SDK, Node 22 + pnpm 9, an Anthropic API
key, and Stripe test keys.

### 1. Backend (API + Postgres + MailHog)

```powershell
# Start Postgres + MailHog
docker compose -f backend\docker-compose.yml up -d

# Required env (Anthropic + Stripe test keys + webhook secret from `stripe listen`)
$env:Anthropic__ApiKey               = "sk-ant-..."
$env:DainnStripe__SecretKey          = "sk_test_..."
$env:DainnStripe__PublishableKey     = "pk_test_..."
$env:DainnStripe__WebhookSigningSecret = "whsec_..."

# Forward Stripe webhooks (separate terminal)
stripe listen --forward-to https://localhost:5001/api/billing/webhook

# Run the API — migrations + Stripe catalog seed run on startup
dotnet run --project backend\DResume.Api
# → https://localhost:5001/swagger
```

- MailHog UI: <http://localhost:8025> (verification + password-reset emails land here in dev)
- Default Postgres: `Host=localhost;Database=dresume;Username=dresume;Password=dresume`

### 2. Frontend (Next.js)

```powershell
cd resume
pnpm install

# Point the frontend at the API and configure NextAuth
"NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`nNEXTAUTH_SECRET=dev-secret`nNEXTAUTH_URL=http://localhost:3000" `
  | Out-File -Encoding utf8 .env.local

pnpm dev
# → http://localhost:3000
```

## Configuration cheat sheet

### Backend (`backend/DResume.Api/appsettings.json`, override via `__` env vars)

| Key | Notes |
| --- | --- |
| `DainnUser:Database:ConnectionString` | Postgres connection for user/auth tables |
| `Resume:ConnectionString` | Postgres connection for the resume domain (same DB, `resume` schema) |
| `DainnUser:Jwt:Secret` | **Must** be ≥ 32 chars in production |
| `Anthropic:ApiKey` | Required for every AI endpoint |
| `Cors:AllowedOrigins:0` | Frontend origin, e.g. `https://app.example.com` |
| `DainnStripe:SecretKey` / `:PublishableKey` / `:WebhookSigningSecret` | Stripe test or live keys |
| `ConnectionStrings:DainnStripe` | Postgres connection for the `stripe` schema |
| `Billing:SuccessUrl` / `Billing:CancelUrl` | Stripe Checkout redirect URLs |

### Frontend (`resume/.env.local`)

| Key | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | e.g. `http://localhost:5000` — backend origin used by `fetch()` |
| `NEXTAUTH_SECRET` | Required by `next-auth` |
| `NEXTAUTH_URL` | e.g. `http://localhost:3000` |

## Layout

```
DResume/
├── backend/
│   ├── DResume.Api/             ASP.NET Core 8 Web API
│   │   ├── Controllers/         Auth, Users, Resumes, Build, JobMatch, CoverLetters,
│   │   │                        CareerCoach, InterviewCoach, SalaryEstimator, Translation, Billing
│   │   ├── Features/            Service layer per feature (Anthropic + persistence)
│   │   ├── Ai/                  AnthropicClient, PromptLibrary, JsonExtractor, LanguageDetector
│   │   ├── Billing/             Plan catalog, Stripe seeder, webhook handler, `[RequiresPlan]`
│   │   ├── DocumentParsing/     PDF (UglyToad.PdfPig), DOCX (OpenXml), TXT
│   │   ├── Data/                ResumeDbContext, Entities, Migrations
│   │   ├── Contracts/           Request/response DTOs
│   │   └── Common/              ApiResult envelope, ExceptionHandlingMiddleware, CurrentUser
│   ├── docker-compose.yml       Postgres 16 + MailHog
│   └── README.md                Full backend reference
│
└── resume/
    ├── src/
    │   ├── app/
    │   │   ├── (landing)/       Marketing, login, register
    │   │   ├── (app)/           dashboard, build, results, job-match, cover-letter,
    │   │   │                    career-coach, interview-coach, salary-estimator, account
    │   │   └── api/             Next.js route handlers (proxy to backend)
    │   ├── components/          AuthGate, NavBar, BillingPanel, FileUpload, ScoreDashboard, …
    │   ├── i18n/                en.json, vi.json
    │   └── lib/                 Client helpers
    ├── Dockerfile               Multi-stage Node 22 / pnpm 9 / standalone Next build
    └── docker-compose.yml       Runs the frontend on port 3005
```

## API envelope

All backend responses use:

```json
{ "success": true, "data": { /* … */ }, "error": null }
```

Auth endpoints (`/api/auth/register`, `/login`, `/refresh`, `/verify-email`,
`/resend-verification`, `/forgot-password`, `/reset-password`,
`/2fa/complete`) and `/api/translate` are anonymous. Everything else requires
`Authorization: Bearer <accessToken>`. Pro-gated features return HTTP 402
when a Free user hits them.

## Production deployment

Both units have Dockerfiles / compose files:

```powershell
# Backend (Postgres + MailHog only; API runs alongside or in its own container)
docker compose -f backend\docker-compose.yml up -d

# Frontend (standalone Next build on port 3005)
docker compose -f resume\docker-compose.yml up -d --build
```

For production, terminate TLS in front of both services, set
`Cors:AllowedOrigins:0` to the public frontend origin, and rotate
`DainnUser:Jwt:Secret`, Stripe keys, and `NEXTAUTH_SECRET` away from
dev values.

## License

Proprietary — internal project. Not licensed for redistribution.
