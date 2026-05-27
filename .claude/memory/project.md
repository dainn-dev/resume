# Project Facts — DResume

_Stable facts. Chỉ update khi project thay đổi căn bản._

## Description

DResume là AI-powered resume platform giúp job seekers phân tích, cải thiện CV và chuẩn bị cho quá trình tìm việc. Hỗ trợ bilingual EN/VI cho thị trường Việt Nam. Pipeline tuyến tính: Upload → Score → Build → Job Match → Cover Letter → Salary → Interview → Career Coach.

## Tech Stack

### Frontend (`resume/`)
- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`), dark theme exclusively
- **Auth:** Custom cookie-based (`dresume_access`, `dresume_refresh`, `dresume_user`)
- **i18n:** Custom localStorage-based, EN/VI dictionaries (`src/i18n/`)
- **State:** sessionStorage (pipeline), localStorage (persistent cache), React Context (auth, i18n)
- **File handling:** react-dropzone (upload), mammoth (DOCX preview), pdf-parse, jspdf
- **Markdown:** react-markdown
- **Package manager:** pnpm

### Backend (`backend/`)
- **Framework:** .NET 8 Web API (ASP.NET Core)
- **ORM:** Entity Framework Core 8 + Npgsql (PostgreSQL)
- **Auth:** DainnUser NuGet (JWT Bearer, 60min access / 7day refresh)
- **Billing:** DainnStripe NuGet (Stripe integration)
- **AI:** Custom AnthropicClient → Claude Sonnet 4.6 via `open-claude.com` proxy
- **Doc parsing:** UglyToad.PdfPig (PDF), DocumentFormat.OpenXml (DOCX)
- **Resilience:** Microsoft.Extensions.Http.Polly

### Infrastructure
- **Database:** PostgreSQL 16 (docker-compose)
- **Email:** MailHog (dev)
- **Containerization:** Docker (frontend), docker-compose (backend services)

## Architecture

Monorepo với 2 apps tách biệt:

1. **Frontend (Next.js)** — SSR/CSR hybrid, nhưng tất cả pages đều `"use client"`. API routes là thin proxies đọc auth cookie và forward tới backend.

2. **Backend (.NET)** — Feature-slice architecture. Controllers thin → Services xử lý business logic + AI calls → EF Core persist. Middleware pipeline: ExceptionHandler → CORS → DainnUser (JWT + rate limit) → DainnStripe (webhook) → Controllers.

**Data flow:** User → Next.js page → fetch `/api/*` (Next.js route) → forward với Bearer token → .NET Controller → Service → AnthropicClient → Claude AI → JsonExtractor → persist jsonb → return ApiResult

## Database

PostgreSQL 16, 3 schemas:

### Schema `resume` (app-owned, ResumeDbContext)
- **resumes** — id, userId, title, sourceFileName, rawText, parsedDataJson (jsonb), lastAnalysisId
- **resume_analyses** — id, userId, resumeId (FK→resumes), score, resultJson (jsonb)
- **job_matches** — id, userId, resumeId?, jobDescription, linkedInUrl, matchScore, resultJson (jsonb)
- **cover_letters** — id, userId, resumeId?, jobTitle, company, inputJson (jsonb), bodyText
- **career_coach_sessions** — id, userId, inputJson (jsonb), resultJson (jsonb), analysis (text)
- **interview_coach_sessions** — id, userId, inputJson (jsonb), resultJson (jsonb), analysis (text)
- **salary_estimates** — id, userId, inputJson (jsonb), estimateJson (jsonb), analysis (text)
- **user_subscriptions** — userId (PK, 1:1), planCode, stripeCustomerId, stripeSubscriptionId, status

### Schema `default` (DainnUserDbContext) — Users, Roles, Sessions, ActivityLogs
### Schema `stripe` (DainnStripeDbContext) — Products, Prices, Customers, Subscriptions, WebhookEvents

## API Overview

### Public
- `POST /api/auth/*` — register, login, refresh, verify-email, forgot/reset-password
- `GET /api/billing/plans` — list plans
- `POST /api/translate` — translate content

### Free tier (auth required)
- `GET/POST/DELETE /api/resumes` — CRUD resumes (max 2)
- `POST /api/resumes/{id}/analyze` — AI resume analysis
- `POST /api/resumes/parse` — parse resume to structured data
- `POST /api/build` — generate polished resume markdown

### Pro tier ($9.99/mo, auth + plan check)
- `POST /api/job-match` — resume vs job description matching
- `POST /api/cover-letters` — generate cover letter
- `POST /api/career-coach` — career roadmap (2 AI calls)
- `POST /api/interview-coach` — interview prep (2 AI calls)
- `POST /api/salary-estimator` — salary estimation (2 AI calls)

### Billing (auth required)
- `GET /api/billing/me` — current subscription
- `POST /api/billing/checkout` — create Stripe checkout
- `POST /api/billing/cancel` — cancel subscription

## Key Components

- `backend/DResume.Api/Ai/AnthropicClient.cs` — HTTP client cho Claude API, supports cả Anthropic và OpenAI-compatible response format
- `backend/DResume.Api/Ai/PromptLibrary.cs` — Tất cả system prompts cho 8+ AI features
- `backend/DResume.Api/Ai/LanguageDetector.cs` — Auto-detect Vietnamese via diacritical marks regex
- `backend/DResume.Api/Ai/JsonExtractor.cs` — Brace-depth JSON parser từ AI responses
- `backend/DResume.Api/Common/ApiResult.cs` — `ApiResult<T>(Success, Data, Error)` envelope
- `backend/DResume.Api/Billing/PlanService.cs` — Plan lookup, limit enforcement
- `resume/src/lib/backend.ts` — `callBackend()` proxy utility, `getServerAuthToken()`
- `resume/src/lib/pipeline.ts` — sessionStorage state manager cho step flow
- `resume/src/components/AuthProvider.tsx` — Auth context, cookie-based user state

## Conventions

- Backend: Feature-slice (`Features/<Name>/<Service>.cs`), interface + implementation, Scoped DI
- Backend: AI 2-pass cho complex features (JSON structured → narrative analysis)
- Backend: All AI responses qua `JsonExtractor.Extract()`
- Frontend: All pages `"use client"`, path alias `@/*`
- Frontend: Dark theme, score color system (green ≥75, amber 50-74, red <50)
- Frontend: API routes = thin proxies, no direct AI calls from client
- Response: `ApiResult<T>` envelope everywhere
- Plan gating: `[RequiresPlan(PlanCode.Pro)]` → HTTP 402
