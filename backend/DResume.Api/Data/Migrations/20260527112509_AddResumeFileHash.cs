using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddResumeFileHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileHash",
                schema: "resume",
                table: "resumes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_resumes_UserId_FileHash",
                schema: "resume",
                table: "resumes",
                columns: new[] { "UserId", "FileHash" },
                filter: "\"FileHash\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_resumes_UserId_FileHash",
                schema: "resume",
                table: "resumes");

            migrationBuilder.DropColumn(
                name: "FileHash",
                schema: "resume",
                table: "resumes");
        }
    }
}
