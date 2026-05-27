# DResume — Memory

**Stack:** Next.js 14 + .NET 8 API | **DB:** PostgreSQL 16 + EF Core | **Users:** Job seekers (EN/VI)

**Luôn nhớ:** ApiResult envelope `{ success, data, error }` | Frontend proxy → backend | AI 2-pass pattern | Vietnamese auto-detect

**Mode:** DEV AGENT

---

## Current State

- Status: freshly initialized by Blueberry Sensei
- Active branch: master
- Last task: initial setup

## Key Components

- `backend/DResume.Api/Program.cs` — .NET entry point, DI, middleware pipeline
- `backend/DResume.Api/Ai/AnthropicClient.cs` — Custom Claude API client
- `backend/DResume.Api/Features/` — 7 AI-powered services
- `resume/src/app/api/` — Next.js proxy routes → backend
- `resume/src/lib/pipeline.ts` — sessionStorage state management cho pipeline flow

## In Progress

(none)

## Recent Decisions

Xem `.claude/memory/decisions.md`

---

_Keep this file under 200 lines. Archive old context with compress-context skill._
