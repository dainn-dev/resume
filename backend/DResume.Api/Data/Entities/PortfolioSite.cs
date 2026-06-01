namespace DResume.Api.Data.Entities;

public enum PortfolioStatus { Pending = 0, Approved = 1, Rejected = 2 }

// A public portfolio website backed by one of the user's resumes, served at <Subdomain>.dainn.online.
// Premium-only. First publish requires admin approval; once Approved the user may freely change the
// resume/subdomain/theme without re-approval (uniqueness + reserved-word checks still apply).
public class PortfolioSite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }              // unique — 1 portfolio per user
    public Guid ResumeId { get; set; }            // FK resumes.Id — which resume to render
    public string Subdomain { get; set; } = "";   // normalized lowercase, globally unique
    public string Theme { get; set; } = "minimal";
    public PortfolioStatus Status { get; set; } = PortfolioStatus.Pending;
    public bool HideContact { get; set; }         // hide email/phone on the public page
    public string? ReviewedByEmail { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
