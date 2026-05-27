# UI Review Skill

Chạy sau khi implement bất kỳ UI changes nào.

## Step 1: Start Dev Servers

```bash
# Terminal 1: Backend services
cd backend && docker compose up -d
cd backend && dotnet run --project DResume.Api

# Terminal 2: Frontend
cd resume && pnpm dev
```

Chờ "ready" / "listening on" trong output.

## Step 2: Open Browser với Playwright

Dùng Playwright MCP tool để:
1. Navigate đến `http://localhost:3000`
2. Login nếu cần (register test account hoặc check .env cho test credentials)
3. Navigate đến page/feature đã thay đổi

## Step 3: Dừng lại và Chờ

Báo user:
- "Tôi đã mở [URL] trong browser"
- "Đang ở trang [page name / route]"
- "Bạn review UI và cho tôi biết cần điều chỉnh gì"

**DỪNG TẠI ĐÂY. Chờ user response.**

## Step 4: Iterate

Nếu user yêu cầu thay đổi: apply → reload → hỏi review lại.
Nếu user approve: tiếp tục tạo PR.

## UI Conventions cần tuân thủ

- Dark theme exclusively: `bg-gray-950` body, `bg-gray-900/800` cards
- Score colors: green (`text-green-400`) ≥75, amber (`text-amber-400`) 50-74, red (`text-red-400`) <50
- Font: Inter (Google Fonts)
- Mobile responsive: hamburger menu, `sm:` / `lg:` breakpoints
- Consistent input styling: dùng `inputClass()` và `labelClass()` utility functions
- Loading states: `animate-pulse` skeleton hoặc `LoadingSpinner` component
