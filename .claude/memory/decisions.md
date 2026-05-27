# Architectural Decisions

_Thêm decisions vào đây khi chúng được đưa ra._

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

**Date:** 2026-05-27
**Decision:** Free (2 resumes, 5 AI calls/mo) / Pro $9.99 (50 resumes, 200 AI calls) / Enterprise $29.99 (unlimited).
**Reason:** Freemium model — free tier cho basic resume analysis, Pro unlock advanced features (job match, cover letter, coaching).
**Alternatives considered:** N/A — inferred từ PlanCatalog.cs

---

## Decision: 2-pass AI pattern cho complex features

**Date:** 2026-05-27
**Decision:** Career Coach, Interview Coach, Salary Estimator mỗi feature gọi Claude 2 lần: (1) structured JSON, (2) narrative analysis dùng JSON result làm context.
**Reason:** Tách structured data (dễ parse, hiển thị UI) khỏi human-readable narrative (giá trị cho user). Mỗi call có system prompt tối ưu riêng.
**Alternatives considered:** Single call trả cả JSON + narrative (khó parse reliably)

---
