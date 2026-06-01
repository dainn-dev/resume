using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPortfolioSites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "portfolio_sites",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Subdomain = table.Column<string>(type: "character varying(63)", maxLength: 63, nullable: false),
                    Theme = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    HideContact = table.Column<bool>(type: "boolean", nullable: false),
                    ReviewedByEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_portfolio_sites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_portfolio_sites_resumes_ResumeId",
                        column: x => x.ResumeId,
                        principalSchema: "resume",
                        principalTable: "resumes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_portfolio_sites_ResumeId",
                schema: "resume",
                table: "portfolio_sites",
                column: "ResumeId");

            migrationBuilder.CreateIndex(
                name: "IX_portfolio_sites_Status",
                schema: "resume",
                table: "portfolio_sites",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_portfolio_sites_Subdomain",
                schema: "resume",
                table: "portfolio_sites",
                column: "Subdomain",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_portfolio_sites_UserId",
                schema: "resume",
                table: "portfolio_sites",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "portfolio_sites",
                schema: "resume");
        }
    }
}
