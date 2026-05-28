namespace DResume.Api.Data.Entities;

public class CompanyReviewCacheRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CompanyKey { get; set; } = string.Empty;
    public string DataJson { get; set; } = "{}";
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}
