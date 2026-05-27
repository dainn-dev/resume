# Next.js Frontend Workflow

Skill cho việc thêm page/component mới vào frontend Next.js.

## Thêm Page Mới

### 1. Tạo Page

Tạo: `resume/src/app/(app)/<route-name>/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function PageName() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // ... implementation
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t("page.title")}</h1>
      {/* content */}
    </div>
  );
}
```

Conventions:
- Luôn `"use client"` ở đầu file
- Dùng `useAuth()` cho user state
- Dùng `useTranslation()` cho i18n
- Dark theme: `text-white`, `bg-gray-900`, `border-gray-700`

### 2. Thêm API Route (proxy)

Tạo: `resume/src/app/api/<endpoint>/route.ts`

```tsx
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await callBackend<ResponseType>("/api/<backend-endpoint>", {
    method: "POST",
    body,
    cookies: req.cookies,
  });
  return NextResponse.json(res.data, { status: res.status });
}
```

Pattern: luôn dùng `callBackend()` từ `@/lib/backend` — KHÔNG gọi backend trực tiếp.

### 3. Thêm vào Pipeline (nếu cần)

Update `resume/src/lib/pipeline.ts`:
- Thêm key cho sessionStorage
- Thêm getter/setter functions

Update `resume/src/components/WorkflowProgress.tsx`:
- Thêm step mới vào progress bar

### 4. Thêm Navigation

Update `resume/src/components/NavBar.tsx`:
- Thêm tab mới vào navigation array

### 5. i18n

Thêm translations vào:
- `resume/src/i18n/en.json`
- `resume/src/i18n/vi.json`

Dùng dot notation: `t("featureName.title")`, `t("featureName.description")`

### 6. Billing Gate (nếu Pro feature)

Backend trả 402 nếu user không có Pro plan. Frontend nên handle:

```tsx
if (res.status === 402) {
  // Show upgrade prompt hoặc redirect đến /account
}
```

### 7. Verify

```bash
cd resume && pnpm build
cd resume && pnpm lint
```

## Component Conventions

- File: PascalCase (`MyComponent.tsx`)
- Export: default export cho pages, named export cho components
- Props: TypeScript interface, defined inline hoặc trong `src/types/`
- Styling: Tailwind utility classes, no CSS modules
- Loading: `<LoadingSpinner message="..." />`
- Scores: dùng `scoreColor(score)` → green/amber/red
- Forms: `useState` + controlled inputs, utility functions `inputClass()`, `labelClass()`
