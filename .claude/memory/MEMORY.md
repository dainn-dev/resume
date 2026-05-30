# DResume — Memory

**Stack:** Next.js 14 + .NET 8 API | **DB:** PostgreSQL 16 + EF Core | **Users:** Job seekers (EN/VI)

**Luôn nhớ:** ApiResult envelope `{ success, data, error }` | Frontend proxy → backend | AI 2-pass pattern | Vietnamese auto-detect

**Mode:** DEV AGENT

---

## Current State

- Active branch: fix/stripe-disable-di
- Stripe gating fix (2026-05-30): `DainnStripe:Enabled` (env STRIPE_ENABLED) GIỜ là master switch thật — trước đây code chỉ check SecretKey present (cờ Enabled bị bỏ qua hoàn toàn). `stripeEnabled = GetValue("DainnStripe:Enabled", false) && SecretKey present` (Program.cs). BillingController + StripePriceManager bỏ hard-dep `DainnStripeDbContext`/`IDainnStripeSubscriptionService` (dead) → resolve lazy qua `_sp.GetService<DainnStripeDbContext>()` + guard "Card payments disabled". Cho phép deploy Bank-QR-only, KHÔNG cần DB `_stripe`, endpoint anonymous plans/config vẫn chạy. Để bật Stripe: cần CẢ Enabled=true + SecretKey + tạo DB `<db>_stripe`.
- Prev active branch: feat/plan-perks-enforcement
- Plans: Free / Pro $4.99 / Premium $9.99 (Enterprise đã đổi tên → Premium). Thanh toán: Stripe (card) + Bank QR/SePay (chọn 1/3/6/12 tháng).
- Enforcement: feature flags `[RequiresFeature]` + AI-call quota `[ConsumesAiCall]` + resume quota (`EnsureResumeQuotaAsync` trong ResumesController) — tất cả đã active.
- Last task (2026-05-30): (1) Maintenance takeover — `MaintenanceProvider` patch `window.fetch`, đếm 5xx liên tiếp trên call `/api/*` (network error cũng tính), đạt 5 lần → full-screen `MaintenancePage` (khung giờ cố định 1:00–7:00 SA GMT+7, nút Thử lại = reload). Wrap trong layout.tsx (TranslationProvider > MaintenanceProvider > AuthProvider). i18n keys: maintenance.pageTitle/pageBody/retry. (2) Global 404: `app/not-found.tsx` (dark theme, nút Về trang chủ); i18n keys notFound.title/body/home.
- Prev task (2026-05-29): i18n hóa BillingPanel + bank UI + 4 trang admin; thêm lịch sử bank payment vào trang Account; fix UX bug report. en.json/vi.json parity 893 keys.

## Feature completeness (audit 2026-05-29)

- Bug reports: hoàn thiện (modal + admin + email notify + reCAPTCHA).
- Bank payments: hoàn thiện (checkout, QR, SePay webhook, admin, polling, lịch sử trong Account).
- Billing: nhất quán Free/Pro/Premium.
- i18n: admin pages + bank UI đã refactor sang t() (namespaces: billing, bankPay, adminBank, adminBugReports, adminBankPayments, adminUsers).
- Lưu ý: `t()` KHÔNG hỗ trợ interpolation — dùng helper `interpolate()` cục bộ với placeholder `{x}`.

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
