using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlansTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "plans",
                schema: "resume",
                columns: table => new
                {
                    Code = table.Column<int>(type: "integer", nullable: false),
                    LookupKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    MonthlyPriceCents = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    MaxResumes = table.Column<int>(type: "integer", nullable: false),
                    MonthlyAiCalls = table.Column<int>(type: "integer", nullable: false),
                    JobMatchEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CoverLetterEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CareerCoachEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    InterviewCoachEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SalaryEstimatorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PriorityQueue = table.Column<bool>(type: "boolean", nullable: false),
                    ActiveStripePriceId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plans", x => x.Code);
                });

            migrationBuilder.CreateIndex(
                name: "IX_plans_LookupKey",
                schema: "resume",
                table: "plans",
                column: "LookupKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "plans",
                schema: "resume");
        }
    }
}
