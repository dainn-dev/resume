namespace DResume.Api.Billing;

/// <summary>
/// Plan-gated features. Each maps to a boolean flag on <see cref="PlanLimits"/> so gating
/// follows the editable per-plan flags in the DB catalog rather than a hard-coded plan tier.
/// </summary>
public enum Feature
{
    JobMatch,
    CoverLetter,
    CareerCoach,
    InterviewCoach,
    SalaryEstimator,
    Calendar,
    CompanyReview,
}

public static class FeatureExtensions
{
    /// <summary>Whether the given plan has this feature enabled.</summary>
    public static bool IsEnabledFor(this Feature feature, PlanLimits limits) => feature switch
    {
        Feature.JobMatch => limits.JobMatchEnabled,
        Feature.CoverLetter => limits.CoverLetterEnabled,
        Feature.CareerCoach => limits.CareerCoachEnabled,
        Feature.InterviewCoach => limits.InterviewCoachEnabled,
        Feature.SalaryEstimator => limits.SalaryEstimatorEnabled,
        Feature.Calendar => limits.CalendarEnabled,
        Feature.CompanyReview => limits.CompanyReviewEnabled,
        _ => false,
    };

    /// <summary>Human-friendly name used in error messages.</summary>
    public static string DisplayName(this Feature feature) => feature switch
    {
        Feature.JobMatch => "Job Match",
        Feature.CoverLetter => "Cover Letter",
        Feature.CareerCoach => "Career Coach",
        Feature.InterviewCoach => "Interview Coach",
        Feature.SalaryEstimator => "Salary Estimator",
        Feature.Calendar => "Goals & Tasks",
        Feature.CompanyReview => "Company Reviews",
        _ => feature.ToString(),
    };
}
