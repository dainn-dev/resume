# Architecture — DResume

## Overview

DResume là AI-powered resume platform với kiến trúc monorepo gồm 2 apps tách biệt. Frontend Next.js 14 xử lý UI/UX và proxy mọi API request tới backend .NET 8 API, nơi tập trung toàn bộ business logic, AI processing, và data persistence.

Mọi AI features đều sử dụng Claude Sonnet thông qua custom HTTP client. Complex features (Career Coach, Interview Coach, Salary Estimator) dùng 2-pass pattern: call đầu trả structured JSON, call sau generate narrative analysis.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    User Browser                      │
│          (Dark theme, EN/VI bilingual)               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────┐
│              Next.js 14 (port 3000)                  │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Pages   │  │Components│  │ API Routes (proxy) │  │
│  │(app)    │  │AuthGate  │  │ /api/auth/*        │  │
│  │(landing)│  │NavBar    │  │ /api/resumes/*     │  │
│  │         │  │Pipeline  │  │ /api/build         │  │
│  └─────────┘  └──────────┘  │ /api/job-match     │  │
│                              │ /api/cover-letter  │  │
│  State: sessionStorage       │ /api/billing/*     │  │
│  Auth: httpOnly cookies      │ /api/translate     │  │
│  i18n: localStorage          │ /api/career-coach  │  │
│                              │ /api/interview-*   │  │
│                              │ /api/salary-*      │  │
│                              └────────┬───────────┘  │
└───────────────────────────────────────┼──────────────┘
                                        │ Bearer token
                                        ▼
┌─────────────────────────────────────────────────────┐
│              .NET 8 Web API (port 5000)              │
│                                                      │
│  Middleware Pipeline:                                │
│  ExceptionHandler → CORS → DainnUser → DainnStripe  │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │Controllers │  │ Features/  │  │     Ai/       │  │
│  │(thin)      │→ │ Services   │→ │AnthropicClient│  │
│  │11 total    │  │(business   │  │PromptLibrary  │  │
│  │            │  │ logic + AI)│  │LanguageDetect │  │
│  └────────────┘  └─────┬──────┘  │JsonExtractor  │  │
│                         │         └───────┬───────┘  │
│                         ▼                 │          │
│  ┌────────────────────────────┐           ▼          │
│  │   EF Core (3 DbContexts)  │  ┌───────────────┐   │
│  │   ResumeDbContext (resume) │  │ Claude Sonnet  │   │
│  │   DainnUserDbContext       │  │ (via proxy     │   │
│  │   DainnStripeDbContext     │  │  open-claude)  │   │
│  └────────────┬───────────────┘  └───────────────┘   │
└───────────────┼──────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────┐
│            PostgreSQL 16 (Docker)                     │
│                                                      │
│  Schema: resume    │ Schema: default │ Schema: stripe │
│  - resumes         │ - Users         │ - Products     │
│  - resume_analyses │ - Roles         │ - Prices       │
│  - job_matches     │ - Sessions      │ - Customers    │
│  - cover_letters   │ - ActivityLogs  │ - Subscriptions│
│  - career_coach_*  │                 │ - WebhookEvents│
│  - interview_*     │                 │                │
│  - salary_*        │                 │                │
│  - user_subs       │                 │                │
└─────────────────────────────────────────────────────┘
```

## Components

### Frontend — `resume/`
- **Location:** `resume/src/`
- **Role:** UI rendering, auth state, pipeline flow, API proxying
- **Key files:**
  - `src/app/(app)/` — 10 authenticated pages (dashboard, build, job-match, etc.)
  - `src/app/api/` — Proxy routes forwarding to .NET backend
  - `src/components/AuthProvider.tsx` — Cookie-based auth context
  - `src/lib/pipeline.ts` — sessionStorage state management
  - `src/lib/backend.ts` — `callBackend()` utility

### Backend — `backend/DResume.Api/`
- **Location:** `backend/DResume.Api/`
- **Role:** Business logic, AI processing, data persistence, auth, billing
- **Key files:**
  - `Program.cs` — Entry point, DI registration, middleware pipeline
  - `Ai/AnthropicClient.cs` — Custom Claude HTTP client
  - `Ai/PromptLibrary.cs` — All AI system prompts
  - `Features/` — 7 AI service implementations
  - `Controllers/` — 11 API controllers
  - `Data/ResumeDbContext.cs` — EF Core context with 8 entities
  - `Billing/PlanService.cs` — Plan enforcement

## Data Flow

### Resume Analysis (typical flow)
```
User uploads PDF
  → FileUpload component (react-dropzone)
  → POST /api/analyze (Next.js proxy)
  → POST /api/resumes (backend controller)
  → DocumentParser extracts text (PdfPig/OpenXml)
  → ResumeAnalysisService builds prompt
  → LanguageDetector appends language instruction
  → AnthropicClient → Claude Sonnet → JSON response
  → JsonExtractor parses response
  → EF Core saves Resume + ResumeAnalysisRecord (jsonb)
  → ApiResult.Ok(analysis) → frontend
  → sessionStorage saves result for pipeline
  → ScoreDashboard renders scores
```

### Pipeline Flow (user journey)
```
Upload/Score → Build Resume → Job Match → Cover Letter → Salary → Interview → Career Coach
     ↓              ↓             ↓            ↓           ↓          ↓           ↓
  dashboard      /build      /job-match  /cover-letter  /salary   /interview  /career-coach
     ↓              ↓             ↓            ↓           ↓          ↓           ↓
sessionStorage carries context forward between each step
```

## External Services

- **Claude AI** — via `open-claude.com/v1` proxy (configurable `Anthropic:BaseUrl`)
- **Stripe** — Billing, checkout, webhooks (via DainnStripe NuGet)
- **MailHog** — Dev email (SMTP localhost:1025, Web UI localhost:8025)

## Environment Variables

### Frontend (`resume/.env`)
```
ANTHROPIC_API_KEY=          # Legacy — not used in proxy mode
ANTHROPIC_URL=              # Legacy
GOOGLE_CLIENT_ID=           # OAuth (not yet active)
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=         # OAuth (not yet active)
LINKEDIN_CLIENT_SECRET=
NEXTAUTH_SECRET=            # Legacy — not used
NEXTAUTH_URL=               # Legacy
DRESUME_API_URL=            # Backend URL (default: http://localhost:5000)
```

### Backend (`backend/DResume.Api/appsettings.json`)
```
Anthropic:ApiKey            # Claude API key
Anthropic:BaseUrl           # API base URL
Anthropic:Model             # Model name (claude-sonnet-4-6)
DainnUser:Jwt:Secret        # JWT signing key (min 32 chars)
DainnUser:Jwt:Issuer        # DResume
DainnUser:Jwt:Audience      # DResumeApp
DainnStripe:SecretKey       # Stripe secret key
DainnStripe:WebhookSecret   # Stripe webhook signing secret
ConnectionStrings:Default   # PostgreSQL connection string
Frontend:AllowedOrigins     # CORS origins
```
