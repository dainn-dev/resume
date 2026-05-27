# Testing Skill

## Hiện trạng

Project chưa có test framework setup. Khi cần viết tests:

### Frontend (resume/)
```bash
# Install vitest
cd resume && pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Run
npx vitest run
```

Config file cần tạo: `resume/vitest.config.ts`

### Backend (backend/)
```bash
# Tạo test project
cd backend && dotnet new xunit -n DResume.Api.Tests
dotnet sln DResume.slnx add DResume.Api.Tests
dotnet add DResume.Api.Tests reference DResume.Api

# Run
dotnet test
```

## Build Verification (thay thế khi chưa có tests)

```bash
# Frontend
cd resume && pnpm build

# Backend
cd backend && dotnet build
```

## Test Requirements

**New feature:** Viết tests TRƯỚC implementation (TDD).
**Bug fix:** Viết regression test trước.
**Backend API:** Test happy path + error path + auth.
**Frontend:** Test behavior, không test implementation.

## Sau khi test

Report: "Build: OK/FAIL. Tests: X/X passing (nếu có)."
Nếu có failure: fix trước khi tiếp tục.
