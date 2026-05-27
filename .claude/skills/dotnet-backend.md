# .NET Backend Workflow

Skill cho việc thêm feature/endpoint mới vào backend .NET API.

## Thêm Feature Mới (full vertical slice)

### 1. Entity (nếu cần table mới)

Tạo file: `backend/DResume.Api/Data/Entities/<EntityName>.cs`

```csharp
public class EntityName
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    // ... fields
    public string ResultJson { get; set; } = "{}";  // jsonb cho AI output
    public DateTime CreatedAt { get; set; }
}
```

Thêm DbSet vào `ResumeDbContext.cs`:
```csharp
public DbSet<EntityName> EntityNames => Set<EntityName>();
```

Configure trong `OnModelCreating`:
```csharp
modelBuilder.Entity<EntityName>(e =>
{
    e.ToTable("entity_names", "resume");
    e.HasIndex(x => x.UserId);
    e.Property(x => x.ResultJson).HasColumnType("jsonb");
    e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
});
```

### 2. Migration

```bash
cd backend
dotnet ef migrations add Add<EntityName> --project DResume.Api
```

### 3. Contracts (DTOs)

Tạo/update: `backend/DResume.Api/Contracts/<Feature>Contracts.cs`

Pattern: dùng C# records cho request/response DTOs.

### 4. Service

Tạo: `backend/DResume.Api/Features/<Feature>/<FeatureName>Service.cs`

Pattern:
```csharp
public interface I<Feature>Service
{
    Task<ResultType> ProcessAsync(InputType input, CancellationToken ct = default);
}

public class <Feature>Service : I<Feature>Service
{
    private readonly AnthropicClient _ai;
    // constructor injection
    
    public async Task<ResultType> ProcessAsync(...)
    {
        // 1. Build prompt (dùng PromptLibrary pattern)
        // 2. Detect language (LanguageDetector)
        // 3. Call AI (AnthropicClient.SendMessageAsync)
        // 4. Extract JSON (JsonExtractor.Extract)
        // 5. Return result
    }
}
```

Register trong `Program.cs`:
```csharp
builder.Services.AddScoped<I<Feature>Service, <Feature>Service>();
```

### 5. Controller

Tạo: `backend/DResume.Api/Controllers/<Feature>Controller.cs`

Pattern:
```csharp
[ApiController]
[Route("api/[controller-kebab-case]")]
[Authorize]
[RequiresPlan(PlanCode.Pro)]  // nếu Pro feature
public class <Feature>Controller : ControllerBase
{
    // POST — create/process
    // GET — list (filter by userId)
    // GET /{id} — get detail (verify userId ownership)
}
```

Response luôn dùng `ApiResult.Ok(data)` hoặc `ApiResult.Fail(error)`.

### 6. AI Prompts

Thêm system prompt vào `backend/DResume.Api/Ai/PromptLibrary.cs`.

Nếu complex feature → dùng 2-pass pattern:
- Call 1: structured JSON (higher maxTokens)
- Call 2: narrative analysis (dùng JSON result làm context)

### 7. Verify

```bash
cd backend && dotnet build
```

## CORS

Nếu thêm endpoint mới, CORS đã configured globally trong `Program.cs` — không cần thêm gì.

## Auth

- `[Authorize]` → require JWT
- `[AllowAnonymous]` → public
- `[RequiresPlan(PlanCode.Pro)]` → require Pro plan (HTTP 402 nếu không đủ)
- Lấy userId: `var user = new CurrentUser(HttpContext); user.Id`
