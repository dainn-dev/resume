using DResume.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Common.Encryption;

/// <summary>
/// One-time, idempotent backfill that encrypts pre-existing plaintext PII rows.
/// For each table it counts rows whose target column is still plaintext (no "enc:v1:" prefix);
/// if any remain it loads the rows (the converter decrypts on read), marks the encrypted
/// properties modified, and re-saves (the converter encrypts on write). Once every row is
/// encrypted the count is 0 and the backfill skips on subsequent startups.
/// </summary>
public static class PiiEncryptionBackfill
{
    public static async Task RunAsync(ResumeDbContext db, IFieldEncryptor enc, ILogger logger, CancellationToken ct = default)
    {
        if (!enc.Enabled)
        {
            logger.LogInformation("PII encryption disabled — skipping backfill.");
            return;
        }

        await BackfillAsync(db, logger, "resumes", "RawText", () => db.Resumes, r =>
        {
            db.Entry(r).Property(x => x.RawText).IsModified = true;
            db.Entry(r).Property(x => x.ParsedDataJson).IsModified = true;
        }, ct);

        await BackfillAsync(db, logger, "bank_accounts", "AccountNumber", () => db.BankAccounts, a =>
        {
            db.Entry(a).Property(x => x.AccountNumber).IsModified = true;
            db.Entry(a).Property(x => x.AccountHolder).IsModified = true;
        }, ct);

        await BackfillAsync(db, logger, "ai_providers", "ApiKey", () => db.AiProviders, p =>
        {
            db.Entry(p).Property(x => x.ApiKey).IsModified = true;
        }, ct);
    }

    private static async Task BackfillAsync<T>(
        ResumeDbContext db, ILogger logger, string table, string column,
        Func<DbSet<T>> set, Action<T> markModified, CancellationToken ct) where T : class
    {
        // Table/column names are compile-time constants here (not user input) — safe to interpolate.
        var sql = $"SELECT COUNT(*)::int AS \"Value\" FROM resume.{table} " +
                  $"WHERE \"{column}\" IS NOT NULL AND \"{column}\" <> '' AND \"{column}\" NOT LIKE '{AesFieldEncryptor.Prefix}%'";
        var pending = await db.Database.SqlQueryRaw<int>(sql).SingleAsync(ct);
        if (pending == 0) return;

        logger.LogInformation("Encrypting {Count} plaintext row(s) in {Table}...", pending, table);
        var rows = await set().ToListAsync(ct);
        foreach (var row in rows) markModified(row);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Encrypted {Table} (re-saved {Total} row(s)).", table, rows.Count);
    }
}
