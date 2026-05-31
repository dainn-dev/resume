using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class EncryptPiiColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // jsonb -> text needs an explicit USING cast (the values become opaque ciphertext).
            migrationBuilder.Sql("ALTER TABLE resume.resumes ALTER COLUMN \"ParsedDataJson\" TYPE text USING \"ParsedDataJson\"::text;");

            migrationBuilder.AlterColumn<string>(
                name: "AccountNumber",
                schema: "resume",
                table: "bank_accounts",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            migrationBuilder.AlterColumn<string>(
                name: "AccountHolder",
                schema: "resume",
                table: "bank_accounts",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);

            migrationBuilder.AlterColumn<string>(
                name: "ApiKey",
                schema: "resume",
                table: "ai_providers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // NOTE: fails if rows are encrypted (ciphertext is not valid JSON) — rollback before encrypting.
            migrationBuilder.Sql("ALTER TABLE resume.resumes ALTER COLUMN \"ParsedDataJson\" TYPE jsonb USING \"ParsedDataJson\"::jsonb;");

            migrationBuilder.AlterColumn<string>(
                name: "AccountNumber",
                schema: "resume",
                table: "bank_accounts",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "AccountHolder",
                schema: "resume",
                table: "bank_accounts",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "ApiKey",
                schema: "resume",
                table: "ai_providers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
