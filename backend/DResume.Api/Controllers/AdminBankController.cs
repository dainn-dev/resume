using DainnUser.Infrastructure.Data;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
[RequiresAdmin]
public sealed class AdminBankController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly DainnUserDbContext _userDb;
    private readonly IBankPaymentService _bank;
    private readonly ICurrentUser _current;

    public AdminBankController(
        ResumeDbContext db,
        DainnUserDbContext userDb,
        IBankPaymentService bank,
        ICurrentUser current)
    {
        _db = db;
        _userDb = userDb;
        _bank = bank;
        _current = current;
    }

    // ---- Bank accounts CRUD ----

    [HttpGet("bank-accounts")]
    public async Task<IActionResult> ListAccounts(CancellationToken ct)
    {
        var rows = await _db.BankAccounts.AsNoTracking()
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        return Ok(ApiResult.Ok(rows.Select(ToDto)));
    }

    [HttpPost("bank-accounts")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateBankAccountRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.BankBin) || string.IsNullOrWhiteSpace(req.AccountNumber))
            return BadRequest(ApiResult.Fail("BankBin and AccountNumber are required."));

        if (req.IsDefault)
            await ClearDefaultsAsync(ct);

        var account = new BankAccount
        {
            BankBin = req.BankBin.Trim(),
            BankCode = req.BankCode.Trim(),
            BankName = req.BankName.Trim(),
            AccountNumber = req.AccountNumber.Trim(),
            AccountHolder = req.AccountHolder.Trim(),
            IsActive = req.IsActive,
            IsDefault = req.IsDefault,
        };
        _db.BankAccounts.Add(account);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(ToDto(account)));
    }

    [HttpPut("bank-accounts/{id:guid}")]
    public async Task<IActionResult> UpdateAccount(Guid id, [FromBody] UpdateBankAccountRequest req, CancellationToken ct)
    {
        var account = await _db.BankAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null) return NotFound(ApiResult.Fail("Bank account not found."));

        if (req.BankBin is not null) account.BankBin = req.BankBin.Trim();
        if (req.BankCode is not null) account.BankCode = req.BankCode.Trim();
        if (req.BankName is not null) account.BankName = req.BankName.Trim();
        if (req.AccountNumber is not null) account.AccountNumber = req.AccountNumber.Trim();
        if (req.AccountHolder is not null) account.AccountHolder = req.AccountHolder.Trim();
        if (req.IsActive.HasValue) account.IsActive = req.IsActive.Value;
        if (req.IsDefault == true)
        {
            await ClearDefaultsAsync(ct);
            account.IsDefault = true;
        }
        else if (req.IsDefault == false)
        {
            account.IsDefault = false;
        }
        account.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(ToDto(account)));
    }

    [HttpDelete("bank-accounts/{id:guid}")]
    public async Task<IActionResult> DeleteAccount(Guid id, CancellationToken ct)
    {
        var account = await _db.BankAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null) return NotFound(ApiResult.Fail("Bank account not found."));

        var hasPayments = await _db.BankPayments.AnyAsync(p => p.BankAccountId == id, ct);
        if (hasPayments)
        {
            // Soft-disable instead of hard delete to preserve payment history
            account.IsActive = false;
            account.IsDefault = false;
            account.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.BankAccounts.Remove(account);
        }
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = !hasPayments, disabled = hasPayments }));
    }

    private async Task ClearDefaultsAsync(CancellationToken ct)
    {
        var defaults = await _db.BankAccounts.Where(a => a.IsDefault).ToListAsync(ct);
        foreach (var a in defaults) { a.IsDefault = false; a.UpdatedAt = DateTime.UtcNow; }
    }

    // ---- Bank payments review ----

    [HttpGet("bank-payments")]
    public async Task<IActionResult> ListPayments(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int size = 30,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 100);

        var query = _db.BankPayments.AsNoTracking().Include(p => p.BankAccount).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<BankPaymentStatus>(status, ignoreCase: true, out var s))
        {
            query = query.Where(p => p.Status == s);
        }

        var total = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        var userIds = rows.Select(r => r.UserId).Distinct().ToList();
        var userMap = await _userDb.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var items = rows.Select(p =>
        {
            var a = p.BankAccount!;
            userMap.TryGetValue(p.UserId, out var email);
            return new BankPaymentAdminDto(
                p.Id, p.UserId, email, p.PlanCode.ToString(), p.DurationMonths, p.AmountVnd, p.TransactionCode,
                new BankAccountSummaryDto(a.BankCode, a.BankName, a.BankBin, a.AccountNumber, a.AccountHolder),
                p.Status.ToString(), p.PaidAt, p.ConfirmedByEmail, p.Notes, p.WebhookRaw,
                p.ExpiresAt, p.CreatedAt, p.UpdatedAt);
        });

        return Ok(ApiResult.Ok(new { total, page, size, items }));
    }

    [HttpPost("bank-payments/{id:guid}/confirm")]
    public async Task<IActionResult> ConfirmPayment(Guid id, [FromBody] AdminConfirmPaymentRequest req, CancellationToken ct)
    {
        var payment = await _db.BankPayments.Include(p => p.BankAccount).FirstOrDefaultAsync(p => p.Id == id, ct);
        if (payment is null) return NotFound(ApiResult.Fail("Payment not found."));
        if (payment.Status == BankPaymentStatus.Confirmed)
            return BadRequest(ApiResult.Fail("Payment is already confirmed."));

        if (!string.IsNullOrWhiteSpace(req.Notes))
            payment.Notes = req.Notes.Trim();

        await _bank.ConfirmPaymentAsync(payment, confirmedByEmail: _current.Email, webhookRaw: null, ct);
        return Ok(ApiResult.Ok(new { confirmed = true }));
    }

    [HttpPost("bank-payments/{id:guid}/cancel")]
    public async Task<IActionResult> CancelPayment(Guid id, [FromBody] AdminConfirmPaymentRequest req, CancellationToken ct)
    {
        var payment = await _db.BankPayments.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (payment is null) return NotFound(ApiResult.Fail("Payment not found."));
        if (payment.Status == BankPaymentStatus.Confirmed)
            return BadRequest(ApiResult.Fail("Cannot cancel a confirmed payment."));

        payment.Status = BankPaymentStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(req.Notes)) payment.Notes = req.Notes.Trim();
        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { cancelled = true }));
    }

    private static BankAccountDto ToDto(BankAccount a) => new(
        a.Id, a.BankBin, a.BankCode, a.BankName, a.AccountNumber, a.AccountHolder,
        a.IsActive, a.IsDefault, a.CreatedAt, a.UpdatedAt);
}
