using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Calendar;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public sealed class CalendarController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly ITaskGeneratorService _taskGenerator;

    public CalendarController(ResumeDbContext db, ICurrentUser current, ITaskGeneratorService taskGenerator)
    {
        _db = db;
        _current = current;
        _taskGenerator = taskGenerator;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var userId = _current.RequireUserId();

        var goals = await _db.CalendarGoals
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new CalendarGoalDto(x.Id, x.Title, x.Description, x.Timeline, x.Status, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        var goalIds = goals.Select(g => g.Id).ToList();

        var milestones = await _db.CalendarMilestones
            .Where(x => goalIds.Contains(x.GoalId))
            .OrderBy(x => x.CreatedAt)
            .Select(x => new CalendarMilestoneDto(x.Id, x.GoalId, x.Title, x.DueDate, x.Completed, x.CreatedAt))
            .ToListAsync(ct);

        var milestoneIds = milestones.Select(m => m.Id).ToList();

        var tasks = await _db.CalendarTasks
            .Where(x => milestoneIds.Contains(x.MilestoneId))
            .OrderBy(x => x.CreatedAt)
            .Select(x => new CalendarTaskDto(x.Id, x.MilestoneId, x.Title, x.Date, x.Completed, x.CreatedAt))
            .ToListAsync(ct);

        return Ok(ApiResult.Ok(new CalendarDataResponse(goals, milestones, tasks)));
    }

    [HttpPut("bulk")]
    public async Task<IActionResult> BulkSave([FromBody] BulkSaveCalendarRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();

        var existingGoals = await _db.CalendarGoals
            .Where(x => x.UserId == userId)
            .Include(x => x.Milestones)
                .ThenInclude(m => m.Tasks)
            .ToListAsync(ct);

        var existingGoalIds = existingGoals.ToDictionary(g => g.Id);
        var existingMsIds = existingGoals.SelectMany(g => g.Milestones).ToDictionary(m => m.Id);
        var existingTaskIds = existingGoals.SelectMany(g => g.Milestones).SelectMany(m => m.Tasks).ToDictionary(t => t.Id);

        _db.CalendarTasks.RemoveRange(existingTaskIds.Values);
        _db.CalendarMilestones.RemoveRange(existingMsIds.Values);
        _db.CalendarGoals.RemoveRange(existingGoalIds.Values);

        var goalIdMap = new Dictionary<string, Guid>();
        var milestoneIdMap = new Dictionary<string, Guid>();
        var now = DateTime.UtcNow;

        foreach (var g in req.Goals)
        {
            var goalId = Guid.TryParse(g.Id, out var parsed) && existingGoalIds.ContainsKey(parsed) ? parsed : Guid.NewGuid();
            goalIdMap[g.Id] = goalId;
            _db.CalendarGoals.Add(new CalendarGoal
            {
                Id = goalId,
                UserId = userId,
                Title = g.Title,
                Description = g.Description,
                Timeline = g.Timeline,
                Status = g.Status,
                CreatedAt = existingGoalIds.TryGetValue(goalId, out var eg) ? eg.CreatedAt : now,
                UpdatedAt = now,
            });
        }

        foreach (var m in req.Milestones)
        {
            if (!goalIdMap.TryGetValue(m.GoalId, out var goalId)) continue;
            var msId = Guid.TryParse(m.Id, out var parsed) && existingMsIds.ContainsKey(parsed) ? parsed : Guid.NewGuid();
            milestoneIdMap[m.Id] = msId;
            _db.CalendarMilestones.Add(new CalendarMilestone
            {
                Id = msId,
                GoalId = goalId,
                Title = m.Title,
                DueDate = m.DueDate,
                Completed = m.Completed,
                CreatedAt = existingMsIds.TryGetValue(msId, out var em) ? em.CreatedAt : now,
                UpdatedAt = now,
            });
        }

        foreach (var t in req.Tasks)
        {
            if (!milestoneIdMap.TryGetValue(t.MilestoneId, out var msId)) continue;
            var taskId = Guid.TryParse(t.Id, out var parsed) && existingTaskIds.ContainsKey(parsed) ? parsed : Guid.NewGuid();
            _db.CalendarTasks.Add(new CalendarTask
            {
                Id = taskId,
                MilestoneId = msId,
                Title = t.Title,
                Date = t.Date,
                Completed = t.Completed,
                CreatedAt = existingTaskIds.TryGetValue(taskId, out var et) ? et.CreatedAt : now,
                UpdatedAt = now,
            });
        }

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new { saved = true }));
    }

    // --- AI Generate Tasks ---

    [HttpPost("generate-tasks")]
    [RequiresPlan(PlanCode.Pro)]
    public async Task<IActionResult> GenerateTasks([FromBody] GenerateTasksRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();

        var ms = await _db.CalendarMilestones
            .Include(x => x.Goal)
            .FirstOrDefaultAsync(x => x.Id == req.MilestoneId && x.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Milestone not found.");

        var generated = await _taskGenerator.GenerateAsync(
            req.GoalTitle, req.MilestoneTitle, req.StartDate, req.EndDate, req.Context, ct);

        var entities = generated.Select(t => new CalendarTask
        {
            MilestoneId = ms.Id,
            Title = t.Title,
            Date = t.Date,
        }).ToList();

        _db.CalendarTasks.AddRange(entities);
        await _db.SaveChangesAsync(ct);

        var dtos = entities.Select(e => new CalendarTaskDto(e.Id, e.MilestoneId, e.Title, e.Date, e.Completed, e.CreatedAt)).ToList();
        return Ok(ApiResult.Ok(dtos));
    }

    // --- Individual CRUD for Goals ---

    [HttpPost("goals")]
    public async Task<IActionResult> CreateGoal([FromBody] CreateGoalRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        if (string.IsNullOrWhiteSpace(req.Title)) throw new ArgumentException("Title is required.");

        var goal = new CalendarGoal
        {
            UserId = userId,
            Title = req.Title,
            Description = req.Description,
            Timeline = req.Timeline,
        };
        _db.CalendarGoals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarGoalDto(goal.Id, goal.Title, goal.Description, goal.Timeline, goal.Status, goal.CreatedAt, goal.UpdatedAt)));
    }

    [HttpPut("goals/{id:guid}")]
    public async Task<IActionResult> UpdateGoal(Guid id, [FromBody] UpdateGoalRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var goal = await _db.CalendarGoals.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Goal not found.");

        if (req.Title is not null) goal.Title = req.Title;
        if (req.Description is not null) goal.Description = req.Description;
        if (req.Timeline is not null) goal.Timeline = req.Timeline;
        if (req.Status is not null) goal.Status = req.Status;
        goal.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarGoalDto(goal.Id, goal.Title, goal.Description, goal.Timeline, goal.Status, goal.CreatedAt, goal.UpdatedAt)));
    }

    [HttpDelete("goals/{id:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var goal = await _db.CalendarGoals.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Goal not found.");

        var milestoneIds = await _db.CalendarMilestones.Where(x => x.GoalId == id).Select(x => x.Id).ToListAsync(ct);
        _db.CalendarTasks.RemoveRange(_db.CalendarTasks.Where(x => milestoneIds.Contains(x.MilestoneId)));
        _db.CalendarMilestones.RemoveRange(_db.CalendarMilestones.Where(x => x.GoalId == id));
        _db.CalendarGoals.Remove(goal);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }

    // --- Individual CRUD for Milestones ---

    [HttpPost("milestones")]
    public async Task<IActionResult> CreateMilestone([FromBody] CreateMilestoneRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        if (string.IsNullOrWhiteSpace(req.Title)) throw new ArgumentException("Title is required.");

        var goal = await _db.CalendarGoals.FirstOrDefaultAsync(x => x.Id == req.GoalId && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Goal not found.");

        var ms = new CalendarMilestone
        {
            GoalId = goal.Id,
            Title = req.Title,
            DueDate = req.DueDate,
        };
        _db.CalendarMilestones.Add(ms);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarMilestoneDto(ms.Id, ms.GoalId, ms.Title, ms.DueDate, ms.Completed, ms.CreatedAt)));
    }

    [HttpPut("milestones/{id:guid}")]
    public async Task<IActionResult> UpdateMilestone(Guid id, [FromBody] UpdateMilestoneRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var ms = await _db.CalendarMilestones
            .Include(x => x.Goal)
            .FirstOrDefaultAsync(x => x.Id == id && x.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Milestone not found.");

        if (req.Title is not null) ms.Title = req.Title;
        if (req.DueDate is not null) ms.DueDate = req.DueDate;
        if (req.Completed.HasValue) ms.Completed = req.Completed.Value;
        ms.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarMilestoneDto(ms.Id, ms.GoalId, ms.Title, ms.DueDate, ms.Completed, ms.CreatedAt)));
    }

    [HttpDelete("milestones/{id:guid}")]
    public async Task<IActionResult> DeleteMilestone(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var ms = await _db.CalendarMilestones
            .Include(x => x.Goal)
            .FirstOrDefaultAsync(x => x.Id == id && x.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Milestone not found.");

        _db.CalendarTasks.RemoveRange(_db.CalendarTasks.Where(x => x.MilestoneId == id));
        _db.CalendarMilestones.Remove(ms);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }

    // --- Individual CRUD for Tasks ---

    [HttpPost("tasks")]
    public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        if (string.IsNullOrWhiteSpace(req.Title)) throw new ArgumentException("Title is required.");

        var ms = await _db.CalendarMilestones
            .Include(x => x.Goal)
            .FirstOrDefaultAsync(x => x.Id == req.MilestoneId && x.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Milestone not found.");

        var task = new CalendarTask
        {
            MilestoneId = ms.Id,
            Title = req.Title,
            Date = req.Date,
        };
        _db.CalendarTasks.Add(task);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarTaskDto(task.Id, task.MilestoneId, task.Title, task.Date, task.Completed, task.CreatedAt)));
    }

    [HttpPut("tasks/{id:guid}")]
    public async Task<IActionResult> UpdateTask(Guid id, [FromBody] UpdateTaskRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var task = await _db.CalendarTasks
            .Include(x => x.Milestone).ThenInclude(m => m!.Goal)
            .FirstOrDefaultAsync(x => x.Id == id && x.Milestone!.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Task not found.");

        if (req.Title is not null) task.Title = req.Title;
        if (req.Date is not null) task.Date = req.Date;
        if (req.Completed.HasValue) task.Completed = req.Completed.Value;
        task.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CalendarTaskDto(task.Id, task.MilestoneId, task.Title, task.Date, task.Completed, task.CreatedAt)));
    }

    [HttpDelete("tasks/{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var task = await _db.CalendarTasks
            .Include(x => x.Milestone).ThenInclude(m => m!.Goal)
            .FirstOrDefaultAsync(x => x.Id == id && x.Milestone!.Goal!.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Task not found.");

        _db.CalendarTasks.Remove(task);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }
}
