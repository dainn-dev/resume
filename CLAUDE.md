# DResume

AI-powered resume scoring, building, và career coaching platform. Frontend Next.js 14 proxy mọi request tới backend .NET 8 API, nơi xử lý toàn bộ AI calls qua Claude Sonnet.

---

## Project Context

| | |
|---|---|
| **Stack** | Next.js 14 (App Router) + React 18 + Tailwind CSS v4 / .NET 8 Web API + EF Core |
| **Database** | PostgreSQL 16 (Npgsql), 3 DbContexts: DainnUser, DainnStripe, Resume |
| **AI** | Claude Sonnet 4.6 via custom AnthropicClient (proxy qua open-claude.com) |
| **Billing** | Stripe (DainnStripe NuGet) — Free / Pro $9.99 / Enterprise $29.99 |
| **Auth** | JWT Bearer (DainnUser NuGet) + cookie-based trên frontend |
| **Kiến trúc** | Monorepo: `resume/` (Next.js frontend) → proxy → `backend/` (.NET API) |
| **Deployment** | Docker (frontend port 3005→3000, backend + PostgreSQL + MailHog via docker-compose) |
| **Users** | Job seekers — phổ thông, hỗ trợ thị trường Việt Nam (EN/VI bilingual) |

**Luôn nhớ:**
- Response format luôn dùng `ApiResult<T>` envelope: `{ success, data, error }`
- Plan gating qua `[RequiresPlan]` attribute → HTTP 402
- AI features phức tạp dùng 2-pass: structured JSON → narrative analysis
- Frontend proxy mọi call tới backend — KHÔNG gọi Claude trực tiếp từ client
- `next-auth` và `next-intl` installed nhưng KHÔNG được dùng — auth và i18n đều custom
- Vietnamese detection tự động trong mọi AI prompt

---

## Làm việc với Claude (DEV AGENT mode)

### Bước 1 — Hiểu Task
- Đọc CLAUDE.md + `.claude/memory/MEMORY.md` + docs liên quan
- Nếu chưa rõ: hỏi từng câu một, chờ trả lời (max 3 câu)
- Dùng quick options khi có thể: "Option 1: ... Option 2: ... Option 3: Khác"

### Bước 2 — Branch
- Kiểm tra branch hiện tại: `git branch --show-current`
- **Cảnh báo** nếu user đang ở feat/fix branch khác (có thể quên chưa checkout về main/master)
- Hỏi:
  - Option 1: Tạo branch mới `feat/<slug>` hoặc `fix/<slug>`
  - Option 2: Tiếp tục trên branch hiện tại
  - Option 3: Khác

### Bước 3 — Plan & Confirm

**Task nhỏ** (1-3 file, ít impact):
> "Tôi sẽ [mô tả ngắn]. Được chưa?"
Chờ confirm mới làm.

**Task lớn** (nhiều file, nhiều component):
Build plan đầy đủ:
- File nào tạo/sửa
- Test nào viết
- Dependency nào cần
- Plan đủ context để chia cho sub-agent nếu cần
> "Đây là plan: [plan]. Confirm để bắt đầu?"
Chờ confirm mới làm.

### Bước 4 — Implement

Khi code, luôn kiểm tra:
- **Security:** Input đã validate chưa? Có lỗ hổng injection, auth bypass không?
- **Cluster-safe:** Có dùng in-memory state không? Nếu có → chuyển qua Redis
- **Performance:** Có N+1 query không? Cần cache không? Batch được không?
- **Pattern nhất quán:** Có theo đúng module pattern của codebase không?
- **Side effects:** Thay đổi này có break feature/logic khác không?
- **Deploy safety:** Code mới có ảnh hưởng đến container rebuild không?

### Bước 5 — Test & Verify
- Chạy test suite (nếu có)
- Build cả frontend và backend: `cd resume && pnpm build` / `cd backend && dotnet build`
- Kiểm tra không có lỗi compile/runtime
- Nếu có UI thay đổi → dùng `.claude/skills/ui-review.md`

---

## Project Structure

```
resume/                          # Monorepo root
├── resume/                      # Next.js 14 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (landing)/       # Public pages: login, register
│   │   │   ├── (app)/           # Auth-gated pages: dashboard, build, job-match, etc.
│   │   │   ├── api/             # Proxy route handlers → backend .NET API
│   │   │   ├── layout.tsx       # Root layout (server component)
│   │   │   └── page.tsx         # Landing / redirect to dashboard
│   │   ├── components/          # 16 components (AuthProvider, NavBar, FileUpload, etc.)
│   │   ├── hooks/               # useI18n, useTranslateContent
│   │   ├── i18n/                # en.json, vi.json translation dictionaries
│   │   ├── lib/                 # Backend proxy, pipeline state, auth utils, legacy AI calls
│   │   └── types/               # resume.ts, builder.ts, jobMatch.ts
│   ├── package.json             # pnpm, Next.js 14, Tailwind v4
│   └── Dockerfile
│
├── backend/                     # .NET 8 Web API
│   ├── DResume.Api/
│   │   ├── Ai/                  # AnthropicClient, PromptLibrary, LanguageDetector, JsonExtractor
│   │   ├── Billing/             # PlanService, StripeCatalogSeeder, PlanWebhookHandler
│   │   ├── Common/              # ApiResult, CurrentUser, ExceptionHandlingMiddleware
│   │   ├── Contracts/           # Request/response DTOs
│   │   ├── Controllers/         # 11 controllers (Auth, Billing, Resumes, Build, JobMatch, etc.)
│   │   ├── Data/                # EF Core: ResumeDbContext, Entities, Migrations
│   │   ├── DocumentParsing/     # PDF/DOCX/TXT parser
│   │   ├── Features/            # 7 AI service implementations
│   │   └── Program.cs           # Entry point, DI, middleware pipeline
│   └── docker-compose.yml       # PostgreSQL 16 + MailHog
│
├── .claude/                     # Claude Code config
│   ├── memory/                  # Project memory system
│   └── skills/                  # Task-specific skills
└── docs/                        # Architecture & API docs
```

---

## Key Commands

| Command | Mô tả |
|---|---|
| `cd resume && pnpm dev` | Start Next.js dev server (port 3000) |
| `cd backend && dotnet run --project DResume.Api` | Start .NET API (port 5000) |
| `cd backend && docker compose up -d` | Start PostgreSQL + MailHog |
| `cd resume && pnpm build` | Build frontend production |
| `cd backend && dotnet build` | Build backend |
| `cd resume && pnpm lint` | Lint frontend |
| `cd backend && dotnet ef migrations add <Name> --project DResume.Api` | New EF migration |
| `cd backend && dotnet ef database update --project DResume.Api` | Apply migrations |

---

## Skills

| Skill | Khi nào dùng |
|---|---|
| `.claude/skills/testing.md` | Chạy tests, viết tests |
| `.claude/skills/ui-review.md` | Sau khi thay đổi UI |
| `.claude/skills/parallel-agents.md` | Task lớn có nhiều phần độc lập |
| `.claude/skills/compress-context.md` | Context quá dài |
| `.claude/skills/dotnet-backend.md` | Thêm feature/endpoint mới vào backend .NET |
| `.claude/skills/nextjs-frontend.md` | Thêm page/component mới vào frontend |

---

## Memory System

Đọc trước khi bắt đầu task:
- `.claude/memory/MEMORY.md` — project state hiện tại (< 200 lines)
- `.claude/memory/project.md` — stable facts về project
- `.claude/memory/decisions.md` — architectural decisions đã được đưa ra

Cập nhật sau khi hoàn thành task:
- Update `MEMORY.md` nếu project state thay đổi
- Thêm vào `decisions.md` nếu có architectural decision mới

---

## Testing

- Framework: Chưa có test framework setup (không có vitest/jest/xunit trong project)
- Frontend build check: `cd resume && pnpm build`
- Backend build check: `cd backend && dotnet build`
- Manual testing: Swagger UI tại `http://localhost:5000/swagger`

---

## Git & GitHub

- Branches: `feat/<task>`, `fix/<task>`, `chore/<task>` (kebab-case, max 4 từ)
- Commits: nhỏ, thường xuyên, descriptive
- PR: tạo khi task xong, bao gồm change summary + test results

---

## Code Conventions

### Backend (.NET)
- Feature-slice architecture: `Features/<FeatureName>/<Service>.cs`
- Controllers thin — gọi service, persist entity, return `ApiResult`
- Tất cả services registered Scoped
- AI responses qua `JsonExtractor.Extract()` — custom brace-depth parser
- Language auto-detect trong mọi AI prompt (Vietnamese diacritical marks check)
- JSON columns dùng PostgreSQL `jsonb`
- Exception → HTTP status mapping trong `ExceptionHandlingMiddleware`

### Frontend (Next.js)
- Tất cả pages đều `"use client"` — không dùng server components cho pages
- Path alias: `@/*` → `./src/*`
- State qua `sessionStorage` (pipeline flow) và `localStorage` (persistent cache)
- API routes là thin proxies: request → đọc auth cookie → forward tới .NET backend
- Dark theme exclusively: `bg-gray-950`, gray-900/800 cards
- Score colors: green (≥75), amber (50-74), red (<50)
- Naming: kebab-case routes, PascalCase components, camelCase lib functions
- Auth: custom cookie-based (`dresume_access`, `dresume_refresh`, `dresume_user`)
- i18n: custom localStorage-based, EN/VI dictionaries

---

## Context Management

Khi context quá dài (nhiều messages, conversation cũ):
Run compress-context skill → summarize → archive → rewrite MEMORY.md
