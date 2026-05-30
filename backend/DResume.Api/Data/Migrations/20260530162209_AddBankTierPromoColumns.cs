using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBankTierPromoColumns : Migration
    {
        // The earlier "AddBankTierPromoDatesAndJobMatchTitle" migration was scaffolded incomplete:
        // it only added job_matches.Title, but the model snapshot was advanced to also include the
        // bank-tier promo columns — so no migration ever created them in the DB, yet EF queries
        // select them (→ 42703 "column EndDate does not exist"). This migration adds them.
        // Uses IF NOT EXISTS so it is safe on partially-migrated environments.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE resume.bank_pricing_tiers ADD COLUMN IF NOT EXISTS ""StartDate"" timestamp with time zone NULL;
                ALTER TABLE resume.bank_pricing_tiers ADD COLUMN IF NOT EXISTS ""EndDate"" timestamp with time zone NULL;
                ALTER TABLE resume.bank_pricing_tiers ADD COLUMN IF NOT EXISTS ""MaxRedemptions"" integer NULL;
                ALTER TABLE resume.bank_pricing_tiers ADD COLUMN IF NOT EXISTS ""Redemptions"" integer NOT NULL DEFAULT 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE resume.bank_pricing_tiers DROP COLUMN IF EXISTS ""StartDate"";
                ALTER TABLE resume.bank_pricing_tiers DROP COLUMN IF EXISTS ""EndDate"";
                ALTER TABLE resume.bank_pricing_tiers DROP COLUMN IF EXISTS ""MaxRedemptions"";
                ALTER TABLE resume.bank_pricing_tiers DROP COLUMN IF EXISTS ""Redemptions"";
            ");
        }
    }
}
