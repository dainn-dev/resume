# Architectural Decisions

_Thêm decisions vào đây khi chúng được đưa ra._

---

## Decision: Enforce plan perks bằng feature-flag + usage metering (không chỉ tier)

**Date:** 2026-05-29
**Decision:**
- Gating theo **feature flag thực tế** của plan qua `[RequiresFeature(Feature.X)]` (đọc `PlanLimits.*Enabled` từ DB catalog), thay cho `[RequiresPlan(PlanCode.Pro)]` vốn chỉ so thứ hạng tier. Nay admin sửa flag trong DB là có hiệu lực ngay.
- `CompanyReviewController` được gate bằng `[RequiresFeature(Feature.CompanyReview)]` (trước đó không có check nào).
- `MaxResumes` enforce trong `ResumesController`/`LegacyAnalyzeController.Upload` (đếm resume trước khi tạo mới).
- `MonthlyAiCalls` enforce qua bảng `ai_usage` (entity `AiUsageRecord`, unique `(UserId, Period yyyyMM)`) + `IUsageService` (atomic upsert `ON CONFLICT`). Attribute `[ConsumesAiCall]`: check quota trước, đếm sau khi action thành công; cache-hit gọi `ConsumesAiCallAttribute.SkipConsumption` để không tính.
- Vượt quota → `PlanLimitExceededException` → HTTP 402 (map trong `ExceptionHandlingMiddleware`).
- Admin = unlimited (do `GetCurrentPlanAsync` trả Premium cho admin). Translation endpoint (`/api/translate`, AllowAnonymous) KHÔNG tính quota. CompanyReview KHÔNG tính vào AI quota (cache nặng, là perk riêng).
**Reason:** Trước đây UI/DB hiển thị ưu đãi nhưng backend không enforce: MaxResumes & MonthlyAiCalls hoàn toàn không kiểm tra, CompanyReview ai cũng gọi được, và flag editable trong DB bị `RequiresPlan` (so tier) phớt lờ.
**Alternatives considered:** Giữ `RequiresPlan` so tier (đơn giản nhưng bỏ qua flag DB); đếm AI call trong `AnthropicClient` (không có user context).

---

## Decision: Proxy architecture — Frontend không gọi AI trực tiếp

**Date:** 2026-05-27
**Decision:** Next.js API routes chỉ là thin proxies forward tới .NET backend. Mọi AI calls đều xử lý ở backend.
**Reason:** Bảo vệ API key, centralize AI logic, dễ billing/rate-limit. Frontend có legacy direct AI calls trong `src/lib/` nhưng không được dùng.
**Alternatives considered:** Direct Anthropic SDK calls từ Next.js API routes (đã implement nhưng deprecated)

---

## Decision: Custom auth thay vì NextAuth

**Date:** 2026-05-27
**Decision:** Dùng DainnUser NuGet package (JWT Bearer) + custom cookie management thay vì NextAuth.
**Reason:** DainnUser cung cấp full auth infrastructure (email verification, account lockout, session management, 2FA ready) tích hợp sẵn với .NET backend. NextAuth vẫn trong package.json nhưng không được import/dùng.
**Alternatives considered:** NextAuth (installed nhưng không dùng)

---

## Decision: Custom i18n thay vì next-intl

**Date:** 2026-05-27
**Decision:** Dùng custom TranslationProvider + localStorage thay vì next-intl.
**Reason:** Đơn giản hơn cho use case 2 ngôn ngữ (EN/VI). Không cần middleware-based locale routing. Dynamic AI translation qua `/api/translate` endpoint.
**Alternatives considered:** next-intl (installed nhưng không dùng)

---

## Decision: Feature-slice architecture cho backend

**Date:** 2026-05-27
**Decision:** Mỗi AI feature có folder riêng trong `Features/` với interface + implementation. Controllers thin.
**Reason:** Dễ maintain, mỗi feature độc lập, DI registration rõ ràng.
**Alternatives considered:** N/A — inferred từ existing code

---

## Decision: AI response lưu dạng jsonb

**Date:** 2026-05-27
**Decision:** Tất cả AI outputs lưu dưới dạng PostgreSQL `jsonb` columns (ResultJson, EstimateJson, InputJson).
**Reason:** Schema flexible — AI response shape có thể thay đổi mà không cần migration. Dễ query với PostgreSQL JSON operators.
**Alternatives considered:** Strongly-typed columns cho mỗi field

---

## Decision: Stripe billing với 3-tier plan

**Date:** 2026-05-27 (updated 2026-05-29: renamed Enterprise → Premium, repriced)
**Decision:** Free (2 resumes, 5 AI calls/mo) / Pro $4.99 (50 resumes, 200 AI calls) / Premium $9.99 (unlimited resumes + AI calls). Mỗi paid plan thanh toán qua Stripe (card) hoặc bank QR (SePay) với chọn 1/3/6/12 tháng.
**Reason:** Freemium model — free tier cho basic resume analysis, Pro unlock advanced features (job match, cover letter, coaching), Premium bỏ mọi giới hạn + priority queue.
**Alternatives considered:** N/A — inferred từ PlanCatalog.cs

---

## Decision: 2-pass AI pattern cho complex features

**Date:** 2026-05-27
**Decision:** Career Coach, Interview Coach, Salary Estimator mỗi feature gọi Claude 2 lần: (1) structured JSON, (2) narrative analysis dùng JSON result làm context.
**Reason:** Tách structured data (dễ parse, hiển thị UI) khỏi human-readable narrative (giá trị cho user). Mỗi call có system prompt tối ưu riêng.
**Alternatives considered:** Single call trả cả JSON + narrative (khó parse reliably)

---
