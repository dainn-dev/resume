using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCalendarEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "calendar_goals",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Timeline = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_goals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "calendar_milestones",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GoalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    DueDate = table.Column<string>(type: "text", nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_milestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_calendar_milestones_calendar_goals_GoalId",
                        column: x => x.GoalId,
                        principalSchema: "resume",
                        principalTable: "calendar_goals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "calendar_tasks",
                schema: "resume",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GoalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<string>(type: "text", nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_calendar_tasks_calendar_goals_GoalId",
                        column: x => x.GoalId,
                        principalSchema: "resume",
                        principalTable: "calendar_goals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_calendar_goals_UserId",
                schema: "resume",
                table: "calendar_goals",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_milestones_GoalId",
                schema: "resume",
                table: "calendar_milestones",
                column: "GoalId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_tasks_GoalId",
                schema: "resume",
                table: "calendar_tasks",
                column: "GoalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "calendar_milestones",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "calendar_tasks",
                schema: "resume");

            migrationBuilder.DropTable(
                name: "calendar_goals",
                schema: "resume");
        }
    }
}
