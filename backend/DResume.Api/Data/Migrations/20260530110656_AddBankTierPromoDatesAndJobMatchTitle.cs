using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBankTierPromoDatesAndJobMatchTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Title",
                schema: "resume",
                table: "job_matches",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Title",
                schema: "resume",
                table: "job_matches");
        }
    }
}
