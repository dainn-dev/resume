# DResume Backend API

ASP.NET Core 8 Web API providing authentication (via **DainnUser**), Stripe
billing with three tiers (via **DainnStripe**), and AI-powered resume features
for the Next.js frontend in `../resume`.

## Stack

- .NET 8 Web API
- PostgreSQL 16 (three EF Core DbContexts on the same database)
  - `DainnUserDbContext` — owned by `DainnUser.Infrastructure` (Users, Roles, Sessions)
  - `DainnStripeDbContext` — owned by `DainnStripe` (Customers, Products, Prices, Subscriptions, Webhooks) in the `stripe` schema
  - `ResumeDbContext` — resume domain + per-user plan state in the `resume` schema
- JWT bearer auth (configured by DainnUser)
- Stripe Checkout + webhook-driven plan management (Free / Pro / Enterprise)
- Anthropic Claude (`claude-sonnet-4-6`) for all AI features

## Layout

```
DResume.Api/
  Controllers/      AuthController, UsersController, ResumesController, JobMatchController,
                    BuildController, CoverLettersController, CareerCoachController,
                    InterviewCoachController, SalaryEstimatorController, TranslationController
  Features/         service layer per feature (calls Anthropic + persists results)
  Ai/               AnthropicClient, PromptLibrary, JsonExtractor, LanguageDetector
  DocumentParsing/  PDF (UglyToad.PdfPig), DOCX (DocumentFormat.OpenXml), TXT
  Data/             ResumeDbContext, Entities/, Migrations/
  Contracts/        request/response DTOs mirroring the frontend TS types
  Common/           ApiResult envelope, ExceptionHandlingMiddleware, CurrentUser
  Program.cs        wires DainnUser + Resume DbContext + Anthropic client + CORS + Swagger
```

## Configuration

All settings live in `appsettings.json` (overridable via env vars using the
standard ASP.NET Core `__` separator, e.g. `Anthropic__ApiKey`).

Required overrides for any non-dev environment:

| Key | Notes |
| --- | --- |
| `DainnUser:Database:ConnectionString` | Postgres connection for the user/auth tables |
| `Resume:ConnectionString` | Postgres connection for the resume domain (same DB, separate `resume` schema) |
| `DainnUser:Jwt:Secret` | **Must** be ≥ 32 chars in production |
| `Anthropic:ApiKey` | Required to run any AI endpoint |
| `Cors:AllowedOrigins:0` | Frontend origin, e.g. `https://app.example.com` |
| `DainnStripe:SecretKey` | Stripe secret key (`sk_test_…` / `sk_live_…`) |
| `DainnStripe:PublishableKey` | Stripe publishable key (`pk_test_…`) |
| `DainnStripe:WebhookSigningSecret` | Endpoint signing secret (`whsec_…`) — use Stripe CLI output for local dev |
| `ConnectionStrings:DainnStripe` | Postgres connection for the `stripe` schema |
| `Billing:SuccessUrl` / `CancelUrl` | Where Stripe Checkout redirects after payment |

## Local development

```powershell
# 1. Start Postgres + MailHog
docker compose -f backend\docker-compose.yml up -d

# 2. Export your Anthropic key for this shell
$env:Anthropic__ApiKey = "sk-ant-..."

# 3. Migrations run automatically on app start, but you can apply manually:
dotnet ef database update --project backend\DResume.Api --context ResumeDbContext

# 4. Run the API
dotnet run --project backend\DResume.Api
# → https://localhost:5001/swagger
```

MailHog web UI: `http://localhost:8025` — verification + password reset emails land here in dev.

## Endpoint summary

All resume/AI endpoints require `Authorization: Bearer <accessToken>` except
`/api/translate` (used by the frontend i18n machinery) and the `/api/auth/*`
flows.

**Auth (`AllowAnonymous`)** — `POST /api/auth/register`, `/login`, `/refresh`,
`/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`,
`/2fa/complete`. `POST /api/auth/logout` is `[Authorize]`.

**User profile** — `GET/PUT /api/users/me`, `GET /api/users/me/sessions`,
`DELETE /api/users/me/sessions/{id}`, `POST /api/users/me/sessions/revoke-all`.

**Resume domain** — `GET/POST /api/resumes`, `GET/DELETE /api/resumes/{id}`,
`POST /api/resumes/parse`, `POST /api/resumes/{id}/analyze`. Legacy aliases
`POST /api/analyze` (multipart upload) and `POST /api/parse-resume` are kept
for frontend back-compat.

**AI features** — `POST /api/build`, `POST /api/job-match`, `POST /api/cover-letters`
(legacy alias `POST /api/cover-letter`), `POST /api/career-coach`, `POST /api/interview-coach`,
`POST /api/salary-estimator`, `POST /api/translate`. Each `POST` persists the
result; the matching `GET` / `GET {id}` returns history per user. Resume CRUD
+ `/api/build` are available on **Free**; Job Match, Cover Letter, Career
Coach, Interview Coach, and Salary Estimator require **Pro** or **Enterprise**
(enforced by `[RequiresPlan(PlanCode.Pro)]`, returns HTTP 402 with an
upgrade hint).

**Billing** — `GET /api/billing/plans` (anonymous: shows Free/Pro/Enterprise
pricing and feature matrix), `GET /api/billing/me`, `POST /api/billing/checkout`
(body: `{ "planCode": "Pro" }` — returns a Stripe Checkout `url` to redirect
the user to), `POST /api/billing/cancel`, `POST /api/billing/seed` (re-runs
the Stripe catalog seeder). The Stripe webhook is mounted at
`/api/billing/webhook` and updates `user_subscriptions` on
`checkout.session.completed` and `customer.subscription.{created,updated,deleted}`.

All responses use the envelope `{ success: bool, data?: T, error?: string }`.

## Plans

| Plan | Price | Resumes | AI/month | Gated features |
| --- | --- | --- | --- | --- |
| **Free** | $0 | 2 | 5 | Resume CRUD, parse, analyze, build, translate |
| **Pro** | $9.99/mo | 50 | 200 | Adds Job Match, Cover Letter, Career Coach, Interview Coach, Salary Estimator |
| **Enterprise** | $29.99/mo | unlimited | unlimited | Pro features + priority queue flag |

On startup the API upserts these three products + monthly prices in Stripe
using lookup keys `dresume_free`, `dresume_pro`, `dresume_enterprise` (and
`<key>_monthly` for prices). The seeder is idempotent — safe to run repeatedly.

## Stripe local dev

```powershell
# 1. Set your Stripe test keys (user-secrets or env vars)
$env:DainnStripe__SecretKey = "sk_test_..."
$env:DainnStripe__PublishableKey = "pk_test_..."

# 2. Forward webhooks to the local API — copy the printed whsec_… into config
stripe listen --forward-to https://localhost:5001/api/billing/webhook

# 3. Run the API; on first boot it auto-seeds the three plans into Stripe
dotnet run --project backend\DResume.Api

# 4. Trigger a test event (after a checkout flow has produced a subscription)
stripe trigger checkout.session.completed
```

## Wiring the frontend

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000` in
`resume/.env.local` and switch the frontend's `fetch("/api/...")` calls to
`fetch(\`${NEXT_PUBLIC_API_BASE_URL}/api/...\`, { credentials: "include" })`
so cookies/bearer tokens flow correctly through CORS.
