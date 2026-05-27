# Parallel Agents Skill

Dùng khi task có nhiều phần lớn, độc lập với nhau.

## Luôn Hỏi Trước

KHÔNG dispatch agents mà không có confirmation. Present:
- Agent nào làm gì
- File nào mỗi agent owns
- Tradeoffs của parallel vs sequential

Chờ explicit approval.

## Ví dụ phân chia cho DResume

**Frontend + Backend song song:**
- Agent 1: Backend — tạo Entity, Service, Controller trong `backend/DResume.Api/`
- Agent 2: Frontend — tạo page, components, API route trong `resume/src/`

**Nhiều features cùng lúc:**
- Agent per feature, mỗi agent owns toàn bộ vertical slice

## Dispatching

Mỗi agent prompt phải include:
1. Mô tả task chính xác
2. File paths agent owns
3. File paths agent KHÔNG được touch
4. Backend: `cd backend && dotnet build` để verify
5. Frontend: `cd resume && pnpm build` để verify
6. Definition of done

## Sau khi Hoàn Thành

1. Review tất cả changes cùng nhau
2. Run full build cho cả frontend và backend
3. Resolve conflicts
4. Commit cùng nhau
