using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBugReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "MonthlyPriceVnd",
                schema: "resume",
                table: "plans",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "bank_accounts",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BankBin = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    BankCode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    BankName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AccountNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AccountHolder = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bug_reports",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReporterEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    Category = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PageUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AdminNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bug_reports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_payments",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanCode = table.Column<int>(type: "integer", nullable: false),
                    DurationMonths = table.Column<int>(type: "integer", nullable: false),
                    AmountVnd = table.Column<long>(type: "bigint", nullable: false),
                    TransactionCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConfirmedByEmail = table.Column<string>(type: "text", nullable: true),
                    WebhookRaw = table.Column<string>(type: "jsonb", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_payments_bank_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "resume",
                        principalTable: "bank_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_IsActive",
                schema: "resume",
                table: "bank_accounts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_IsDefault",
                schema: "resume",
                table: "bank_accounts",
                column: "IsDefault");

            migrationBuilder.CreateIndex(
                name: "IX_bank_payments_BankAccountId",
                schema: "resume",
                table: "bank_payments",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_payments_Status",
                schema: "resume",
                table: "bank_payments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_bank_payments_TransactionCode",
                schema: "resume",
                table: "bank_payments",
                column: "TransactionCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bank_payments_UserId",
                schema: "resume",
                table: "bank_payments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_bug_reports_CreatedAt",
                schema: "resume",
                table: "bug_reports",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_bug_reports_Status",
                schema: "resume",
                table: "bug_reports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_bug_reports_UserId",
                schema: "resume",
                table: "bug_reports",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bank_payments",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "bug_reports",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "bank_accounts",
                schema: "resume");

            migrationBuilder.DropColumn(
                name: "MonthlyPriceVnd",
                schema: "resume",
                table: "plans");
        }
    }
}
