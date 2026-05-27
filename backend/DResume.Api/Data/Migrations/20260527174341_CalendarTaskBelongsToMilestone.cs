using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DResume.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CalendarTaskBelongsToMilestone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_calendar_tasks_calendar_goals_GoalId",
                schema: "resume",
                table: "calendar_tasks");

            migrationBuilder.RenameColumn(
                name: "GoalId",
                schema: "resume",
                table: "calendar_tasks",
                newName: "MilestoneId");

            migrationBuilder.RenameIndex(
                name: "IX_calendar_tasks_GoalId",
                schema: "resume",
                table: "calendar_tasks",
                newName: "IX_calendar_tasks_MilestoneId");

            migrationBuilder.AddForeignKey(
                name: "FK_calendar_tasks_calendar_milestones_MilestoneId",
                schema: "resume",
                table: "calendar_tasks",
                column: "MilestoneId",
                principalSchema: "resume",
                principalTable: "calendar_milestones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_calendar_tasks_calendar_milestones_MilestoneId",
                schema: "resume",
                table: "calendar_tasks");

            migrationBuilder.RenameColumn(
                name: "MilestoneId",
                schema: "resume",
                table: "calendar_tasks",
                newName: "GoalId");

            migrationBuilder.RenameIndex(
                name: "IX_calendar_tasks_MilestoneId",
                schema: "resume",
                table: "calendar_tasks",
                newName: "IX_calendar_tasks_GoalId");

            migrationBuilder.AddForeignKey(
                name: "FK_calendar_tasks_calendar_goals_GoalId",
                schema: "resume",
                table: "calendar_tasks",
                column: "GoalId",
                principalSchema: "resume",
                principalTable: "calendar_goals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
