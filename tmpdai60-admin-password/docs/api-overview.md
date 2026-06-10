# API Overview — DResume

## Base URL

- Development: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/swagger`

## Authentication

JWT Bearer tokens via DainnUser library.
- Access token: 60 phút, gửi trong header `Authorization: Bearer <token>`
- Refresh token: 7 ngày
- Frontend lưu tokens trong httpOnly cookies (`dresume_access`, `dresume_refresh`)

## Response Format

Tất cả endpoints trả về `ApiResult<T>`:

```json
// Success
{ "success": true, "data": { ... }, "error": null }

// Failure
{ "success": false, "data": null, "error": "Error message" }
```

## Error Status Codes

| Status | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Unauthorized / invalid credentials |
| 402 | Plan upgrade required (Pro feature) |
| 403 | Email not verified / account inactive |
| 404 | Resource not found |
| 423 | Account locked (too many failed attempts) |
| 429 | Rate limit exceeded |
| 502 | AI response parse error |
| 504 | AI request timeout |
| 500 | Internal server error |

## Endpoints

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/login` | No | Login → access + refresh tokens |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/logout` | Yes | Revoke session |
| POST | `/api/auth/verify-email` | No | Verify email |
| POST | `/api/auth/resend-verification` | No | Resend verification email |
| POST | `/api/auth/forgot-password` | No | Request password reset |
| POST | `/api/auth/reset-password` | No | Execute password reset |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users/me` | Yes | Get profile |
| PUT | `/api/users/me` | Yes | Update profile |
| GET | `/api/users/me/sessions` | Yes | List active sessions |
| DELETE | `/api/users/me/sessions/{id}` | Yes | Revoke session |
| POST | `/api/users/me/sessions/revoke-all` | Yes | Revoke all sessions |
| GET | `/api/users/me/summary` | Yes | Full dashboard summary |

### Resumes — `/api/resumes` (Free tier)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/resumes` | Yes | List resumes with last score |
| GET | `/api/resumes/{id}` | Yes | Get resume + parsed data + latest analysis |
| POST | `/api/resumes` | Yes | Upload file (PDF/DOCX/TXT, max 15MB) → auto-parse + auto-analyze |
| POST | `/api/resumes/{id}/analyze` | Yes | Re-analyze existing resume |
| POST | `/api/resumes/parse` | Yes | Parse resume text to structured data |
| DELETE | `/api/resumes/{id}` | Yes | Delete resume |

### Build — `/api/build` (Free tier)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/build` | Yes | Generate polished Markdown resume |

### Translation — `/api/translate`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/translate` | No | Translate JSON or text to target locale |

### Job Match — `/api/job-match` (Pro)

| Method | Path | Auth | Plan | Description |
|---|---|---|---|---|
| POST | `/api/job-match` | Yes | Pro | Analyze resume vs job description |
| GET | `/api/job-match` | Yes | Pro | List match history |
| GET | `/api/job-match/{id}` | Yes | Pro | Get match result |

### Cover Letters — `/api/cover-letters` (Pro)

| Method | Path | Auth | Plan | Description |
|---|---|---|---|---|
| POST | `/api/cover-letters` | Yes | Pro | Generate cover letter |
| GET | `/api/cover-letters` | Yes | Pro | List cover letters |
| GET | `/api/cover-letters/{id}` | Yes | Pro | Get cover letter |

### Career Coach — `/api/career-coach` (Pro, 2 AI calls)

| Method | Path | Auth | Plan | Description |
|---|---|---|---|---|
| POST | `/api/career-coach` | Yes | Pro | Generate career roadmap + analysis |
| GET | `/api/career-coach` | Yes | Pro | List sessions |
| GET | `/api/career-coach/{id}` | Yes | Pro | Get session |

### Interview Coach — `/api/interview-coach` (Pro, 2 AI calls)

| Method | Path | Auth | Plan | Description |
|---|---|---|---|---|
| POST | `/api/interview-coach` | Yes | Pro | Generate interview prep + analysis |
| GET | `/api/interview-coach` | Yes | Pro | List sessions |
| GET | `/api/interview-coach/{id}` | Yes | Pro | Get session |

### Salary Estimator — `/api/salary-estimator` (Pro, 2 AI calls)

| Method | Path | Auth | Plan | Description |
|---|---|---|---|---|
| POST | `/api/salary-estimator` | Yes | Pro | Estimate salary + analysis |
| GET | `/api/salary-estimator` | Yes | Pro | List estimates |
| GET | `/api/salary-estimator/{id}` | Yes | Pro | Get estimate |

### Billing — `/api/billing`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/billing/plans` | No | List plans with pricing + limits |
| GET | `/api/billing/me` | Yes | Current subscription status |
| POST | `/api/billing/checkout` | Yes | Create Stripe Checkout session |
| POST | `/api/billing/cancel` | Yes | Cancel subscription |
| POST | `/api/billing/webhook` | Stripe signature | Stripe webhook handler |
