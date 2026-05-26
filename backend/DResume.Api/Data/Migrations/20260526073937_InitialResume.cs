using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialResume : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "resume");

            migrationBuilder.CreateTable(
                name: "career_coach_sessions",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InputJson = table.Column<string>(type: "jsonb", nullable: false),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: false),
                    Analysis = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_career_coach_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cover_letters",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: true),
                    JobTitle = table.Column<string>(type: "text", nullable: false),
                    Company = table.Column<string>(type: "text", nullable: true),
                    InputJson = table.Column<string>(type: "jsonb", nullable: false),
                    BodyText = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cover_letters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "interview_coach_sessions",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InputJson = table.Column<string>(type: "jsonb", nullable: false),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: false),
                    Analysis = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_interview_coach_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "job_matches",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: true),
                    JobDescription = table.Column<string>(type: "text", nullable: true),
                    LinkedInUrl = table.Column<string>(type: "text", nullable: true),
                    MatchScore = table.Column<int>(type: "integer", nullable: false),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_job_matches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "resumes",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: true),
                    SourceFileName = table.Column<string>(type: "text", nullable: true),
                    RawText = table.Column<string>(type: "text", nullable: false),
                    ParsedDataJson = table.Column<string>(type: "jsonb", nullable: true),
                    LastAnalysisId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_resumes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "salary_estimates",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InputJson = table.Column<string>(type: "jsonb", nullable: false),
                    EstimateJson = table.Column<string>(type: "jsonb", nullable: false),
                    Analysis = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salary_estimates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "resume_analyses",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResumeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_resume_analyses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_resume_analyses_resumes_ResumeId",
                        column: x => x.ResumeId,
                        principalSchema: "resume",
                        principalTable: "resumes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_career_coach_sessions_UserId",
                schema: "resume",
                table: "career_coach_sessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_cover_letters_UserId",
                schema: "resume",
                table: "cover_letters",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_interview_coach_sessions_UserId",
                schema: "resume",
                table: "interview_coach_sessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_job_matches_UserId",
                schema: "resume",
                table: "job_matches",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_resume_analyses_ResumeId",
                schema: "resume",
                table: "resume_analyses",
                column: "ResumeId");

            migrationBuilder.CreateIndex(
                name: "IX_resume_analyses_UserId",
                schema: "resume",
                table: "resume_analyses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_resumes_UserId",
                schema: "resume",
                table: "resumes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_salary_estimates_UserId",
                schema: "resume",
                table: "salary_estimates",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "career_coach_sessions",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "cover_letters",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "interview_coach_sessions",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "job_matches",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "resume_analyses",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "salary_estimates",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "resumes",
                schema: "resume");
        }
    }
}
