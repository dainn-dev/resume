using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddResumeFileStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileContentType",
                schema: "resume",
                table: "resumes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FileSizeBytes",
                schema: "resume",
                table: "resumes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StoredFilePath",
                schema: "resume",
                table: "resumes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileContentType",
                schema: "resume",
                table: "resumes");

            migrationBuilder.DropColumn(
                name: "FileSizeBytes",
                schema: "resume",
                table: "resumes");

            migrationBuilder.DropColumn(
                name: "StoredFilePath",
                schema: "resume",
                table: "resumes");
        }
    }
}
