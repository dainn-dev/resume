using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminGrantedToUserSubscription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GrantNote",
                schema: "resume",
                table: "user_subscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GrantedAt",
                schema: "resume",
                table: "user_subscriptions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GrantedByEmail",
                schema: "resume",
                table: "user_subscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAdminGranted",
                schema: "resume",
                table: "user_subscriptions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GrantNote",
                schema: "resume",
                table: "user_subscriptions");

            migrationBuilder.DropColumn(
                name: "GrantedAt",
                schema: "resume",
                table: "user_subscriptions");

            migrationBuilder.DropColumn(
                name: "GrantedByEmail",
                schema: "resume",
                table: "user_subscriptions");

            migrationBuilder.DropColumn(
                name: "IsAdminGranted",
                schema: "resume",
                table: "user_subscriptions");
        }
    }
}
