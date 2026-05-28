"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CalendarGoal, CalendarMilestone, CalendarTask, CalendarData } from "@/types/builder";
import { useTranslation } from "@/components/TranslationProvider";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  getCalendarData,
  setCalendarData,
  getCareerCoachResult,
} from "@/lib/pipeline";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

async function loadFromApi(): Promise<CalendarData | null> {
  try {
    const res = await fetch("/api/calendar");
    const json = await res.json();
    if (!json.success || !json.data) return null;
    const d = json.data;
    if (!d.goals?.length && !d.milestones?.length && !d.tasks?.length) return null;
    return {
      goals: d.goals.map((g: any) => ({ id: g.id, title: g.title, description: g.description, timeline: g.timeline, status: g.status })),
      milestones: d.milestones.map((m: any) => ({ id: m.id, goalId: m.goalId, title: m.title, dueDate: m.dueDate ?? "", completed: m.completed })),
      tasks: d.tasks.map((t: any) => ({ id: t.id, milestoneId: t.milestoneId, title: t.title, date: t.date ?? "", completed: t.completed })),
    };
  } catch {
    return null;
  }
}

async function saveToApi(data: CalendarData) {
  try {
    await fetch("/api/calendar?path=/api/calendar/bulk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goals: data.goals.map((g) => ({ id: g.id, title: g.title, description: g.description, timeline: g.timeline, status: g.status })),
        milestones: data.milestones.map((m) => ({ id: m.id, goalId: m.goalId, title: m.title, dueDate: m.dueDate || null, completed: m.completed })),
        tasks: data.tasks.map((t) => ({ id: t.id, milestoneId: t.milestoneId, title: t.title, date: t.date || null, completed: t.completed })),
      }),
    });
  } catch { /* pipeline still has local copy */ }
}

function milestoneProgress(msId: string, tasks: CalendarTask[]) {
  const msTasks = tasks.filter((t) => t.milestoneId === msId);
  if (msTasks.length === 0) return 0;
  return msTasks.filter((t) => t.completed).length / msTasks.length;
}

function goalProgress(goalId: string, milestones: CalendarMilestone[], tasks: CalendarTask[]) {
  const goalMs = milestones.filter((m) => m.goalId === goalId);
  if (goalMs.length === 0) return 0;
  const sum = goalMs.reduce((acc, ms) => acc + milestoneProgress(ms.id, tasks), 0);
  return sum / goalMs.length;
}

function overallProgress(goals: CalendarGoal[], milestones: CalendarMilestone[], tasks: CalendarTask[]) {
  if (goals.length === 0) return 0;
  const sum = goals.reduce((acc, g) => acc + goalProgress(g.id, milestones, tasks), 0);
  return Math.round((sum / goals.length) * 100);
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const { t, mounted } = useTranslation();
  const [goals, setGoals] = useState<CalendarGoal[]>([]);
  const [milestones, setMilestones] = useState<CalendarMilestone[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"tree" | "calendar">("tree");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [addMilestoneGoalId, setAddMilestoneGoalId] = useState<string | null>(null);
  const [addTaskMilestoneId, setAddTaskMilestoneId] = useState<string | null>(null);
  const [generatingMs, setGeneratingMs] = useState<string | null>(null);
  const [dueDatePromptMs, setDueDatePromptMs] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback((data: CalendarData) => {
    setCalendarData(data);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveToApi(data), 1500);
  }, []);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      const apiData = await loadFromApi();
      if (apiData) {
        setGoals(apiData.goals);
        setMilestones(apiData.milestones);
        setTasks(apiData.tasks);
        setCalendarData(apiData);
        hydratedRef.current = true;
        setLoading(false);
        return;
      }
      const cached = getCalendarData();
      if (cached) {
        setGoals(cached.goals);
        setMilestones(cached.milestones);
        setTasks(cached.tasks);
        hydratedRef.current = true;
        setLoading(false);
        return;
      }
      const careerResult = getCareerCoachResult();
      if (careerResult?.careerRoadmap?.length) {
        const ig: CalendarGoal[] = [];
        const im: CalendarMilestone[] = [];
        careerResult.careerRoadmap.forEach((m) => {
          const goalId = genId();
          ig.push({ id: goalId, title: m.goal, description: "", timeline: m.timeframe, status: "not-started" });
          m.actions.forEach((action) => {
            im.push({ id: genId(), goalId, title: action, dueDate: "", completed: false });
          });
        });
        if (careerResult.skillDevelopment?.length && ig[0]) {
          careerResult.skillDevelopment.forEach((skill) => {
            im.push({ id: genId(), goalId: ig[0].id, title: `Learn ${skill.skill}`, dueDate: "", completed: false });
          });
        }
        setGoals(ig);
        setMilestones(im);
        setSynced(true);
      }
      hydratedRef.current = true;
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    debouncedSave({ goals, milestones, tasks });
  }, [goals, milestones, tasks, debouncedSave]);

  function addGoal(title: string) {
    const id = genId();
    setGoals((prev) => [...prev, { id, title, description: "", timeline: "", status: "not-started" }]);
    setShowGoalForm(false);
    setExpandedGoal(id);
  }

  function deleteGoal(id: string) {
    const msIds = milestones.filter((m) => m.goalId === id).map((m) => m.id);
    setTasks((prev) => prev.filter((t) => !msIds.includes(t.milestoneId)));
    setMilestones((prev) => prev.filter((m) => m.goalId !== id));
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  function addMilestone(goalId: string, title: string, dueDate: string) {
    const id = genId();
    setMilestones((prev) => [...prev, { id, goalId, title, dueDate, completed: false }]);
    setAddMilestoneGoalId(null);
    setExpandedMilestone(id);
  }

  function deleteMilestone(id: string) {
    setTasks((prev) => prev.filter((t) => t.milestoneId !== id));
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function addTask(milestoneId: string, title: string, date: string) {
    setTasks((prev) => [...prev, { id: genId(), milestoneId, title, date, completed: false }]);
    setAddTaskMilestoneId(null);
  }

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function generateTasks(msId: string, startDate: string, endDate: string) {
    const ms = milestones.find((m) => m.id === msId);
    if (!ms) return;
    const goal = goals.find((g) => g.id === ms.goalId);
    if (!goal) return;

    if (!startDate || !endDate) {
      setDueDatePromptMs(msId);
      return;
    }

    if (ms.dueDate !== endDate) {
      setMilestones((prev) => prev.map((m) => (m.id === msId ? { ...m, dueDate: endDate } : m)));
    }

    setGeneratingMs(msId);
    try {
      // Ensure data is saved first so milestone exists in DB
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await saveToApi({
        goals,
        milestones: milestones.map((m) => (m.id === msId ? { ...m, dueDate: endDate } : m)),
        tasks,
      });

      // Reload to get stable GUIDs
      const fresh = await loadFromApi();
      if (!fresh) { setGeneratingMs(null); return; }

      const freshMs = fresh.milestones.find((m) => m.title === ms.title);
      const freshGoal = freshMs ? fresh.goals.find((g) => g.id === freshMs.goalId) : null;
      if (!freshMs || !freshGoal) { setGeneratingMs(null); return; }

      const res = await fetch("/api/calendar?path=/api/calendar/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneId: freshMs.id,
          goalTitle: freshGoal.title,
          milestoneTitle: freshMs.title,
          startDate,
          endDate,
          context: freshGoal.description || null,
        }),
      });
      const json = await res.json();

      // Reload — tasks persisted server-side by generate endpoint
      const updated = await loadFromApi();
      if (updated) {
        hydratedRef.current = false;
        setGoals(updated.goals);
        setMilestones(updated.milestones);
        setTasks(updated.tasks);
        setCalendarData(updated);
        setTimeout(() => { hydratedRef.current = true; }, 100);
      }
    } catch { /* silently fail */ }
    setGeneratingMs(null);
    setDueDatePromptMs(null);
  }

  const progressValue = overallProgress(goals, milestones, tasks);
  const today = todayStr();
  const locale = typeof localStorage !== "undefined" ? localStorage.getItem("locale") || "en" : "en";
  const dayNames = locale === "vi" ? DAY_NAMES_VI : DAY_NAMES;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("calendar.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("calendar.subtitle")}</p>
      </div>

      {synced && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("calendar.syncedBanner")}</span>
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      ) : (
        <>
          {/* Overall progress */}
          {goals.length > 0 && (
            <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{t("calendar.totalProgress")}</span>
                <span className="text-sm text-gray-400">{progressValue}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressValue}%` }} />
              </div>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "tree" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {t("calendar.treeView")}
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {t("calendar.calendarView")}
              </button>
            </div>
            {viewMode === "tree" && (
              <button
                onClick={() => setShowGoalForm(!showGoalForm)}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                + {t("calendar.addGoal")}
              </button>
            )}
          </div>

          {/* ===== TREE VIEW ===== */}
          {viewMode === "tree" && (
            <>
              {showGoalForm && (
                <div className="mb-4">
                  <InlineForm
                    label={t("calendar.goalTitle")}
                    placeholder={t("calendar.goalTitlePlaceholder")}
                    onSubmit={(title) => addGoal(title)}
                    onCancel={() => setShowGoalForm(false)}
                    submitText={t("calendar.addGoal")}
                  />
                </div>
              )}

              {goals.length === 0 && !showGoalForm && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <p className="text-gray-500 text-sm text-center py-8">{t("calendar.noGoals")}</p>
                </div>
              )}

              <div className="space-y-3">
                {goals.map((goal) => {
                  const gProg = Math.round(goalProgress(goal.id, milestones, tasks) * 100);
                  const goalMilestones = milestones.filter((m) => m.goalId === goal.id);
                  const isExpanded = expandedGoal === goal.id;

                  return (
                    <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-800/50 transition-colors"
                      >
                        <span className="text-gray-500 text-lg shrink-0">{isExpanded ? "▾" : "▸"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-white truncate">{goal.title}</h3>
                            {goal.timeline && <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">{goal.timeline}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 max-w-48">
                              <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${gProg}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{gProg}%</span>
                            <span className="text-xs text-gray-600">{goalMilestones.length} {t("calendar.milestonesSection").toLowerCase()}</span>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0 px-1">×</button>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-800 px-4 pb-4 pt-2 space-y-2">
                          {goalMilestones.length === 0 && <p className="text-gray-600 text-xs py-2">{t("calendar.noMilestones")}</p>}

                          {goalMilestones.map((ms) => {
                            const msTasks = tasks.filter((t) => t.milestoneId === ms.id);
                            const msProg = pct(msTasks.filter((t) => t.completed).length, msTasks.length);
                            const msExpanded = expandedMilestone === ms.id;
                            const isGenerating = generatingMs === ms.id;

                            return (
                              <div key={ms.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setExpandedMilestone(msExpanded ? null : ms.id)}
                                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-750 transition-colors"
                                >
                                  <span className="text-gray-500 text-sm shrink-0">{msExpanded ? "▾" : "▸"}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm text-white truncate">{ms.title}</p>
                                      {ms.dueDate && <span className="text-xs text-gray-500 shrink-0">{ms.dueDate}</span>}
                                    </div>
                                    {msTasks.length > 0 && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 bg-gray-700 rounded-full h-1 max-w-32">
                                          <div className="bg-blue-500 h-1 rounded-full transition-all duration-500" style={{ width: `${msProg}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-500">{msTasks.filter((t) => t.completed).length}/{msTasks.length}</span>
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); deleteMilestone(ms.id); }} className="text-gray-600 hover:text-red-400 text-xs transition-colors shrink-0 px-1">×</button>
                                </button>

                                {msExpanded && (
                                  <div className="border-t border-gray-700 bg-gray-900 px-3 pb-3 pt-2 space-y-1.5">
                                    {isGenerating && <LoadingSpinner message={t("calendar.generating")} />}

                                    {/* Date range prompt for AI generate */}
                                    {dueDatePromptMs === ms.id && (
                                      <DateRangePrompt
                                        defaultStart={todayStr()}
                                        defaultEnd={ms.dueDate || defaultDueDate()}
                                        onConfirm={(start, end) => generateTasks(ms.id, start, end)}
                                        onCancel={() => setDueDatePromptMs(null)}
                                        t={t}
                                      />
                                    )}

                                    {msTasks.length === 0 && !isGenerating && !dueDatePromptMs && (
                                      <p className="text-gray-600 text-xs py-1">{t("calendar.noTasks")}</p>
                                    )}

                                    {msTasks.map((task) => (
                                      <div key={task.id} className={`flex items-center gap-2 py-1 ${task.date && task.date < today && !task.completed ? "bg-red-500/5 -mx-1 px-1 rounded" : ""}`}>
                                        <button
                                          onClick={() => toggleTask(task.id)}
                                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? "bg-green-500 border-green-500" : "border-gray-600 hover:border-blue-500"}`}
                                        >
                                          {task.completed && (
                                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5" /></svg>
                                          )}
                                        </button>
                                        <span className={`flex-1 text-xs ${task.completed ? "line-through text-gray-500" : task.date && task.date < today ? "text-red-400" : "text-gray-300"}`}>
                                          {task.title}
                                        </span>
                                        {task.date && <span className={`text-xs ${task.date < today && !task.completed ? "text-red-400" : "text-gray-600"}`}>{task.date}</span>}
                                        <button onClick={() => deleteTask(task.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">×</button>
                                      </div>
                                    ))}

                                    {/* Actions row */}
                                    {!isGenerating && !dueDatePromptMs && (
                                      <div className="flex items-center gap-3 mt-2 pt-1 border-t border-gray-800">
                                        {addTaskMilestoneId === ms.id ? (
                                          <InlineForm
                                            label=""
                                            placeholder={t("calendar.taskTitlePlaceholder")}
                                            onSubmit={(title) => addTask(ms.id, title, todayStr())}
                                            onCancel={() => setAddTaskMilestoneId(null)}
                                            submitText={t("calendar.addTask")}
                                            compact
                                          />
                                        ) : (
                                          <>
                                            <button onClick={() => setAddTaskMilestoneId(ms.id)} className="text-xs text-blue-400 hover:text-blue-300">
                                              + {t("calendar.addTask")}
                                            </button>
                                            <button
                                              onClick={() => setDueDatePromptMs(ms.id)}
                                              className="text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-2 py-1 rounded-md transition-colors"
                                            >
                                              {t("calendar.generateTasks")}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {addMilestoneGoalId === goal.id ? (
                            <InlineForm label="" placeholder={t("calendar.milestoneTitlePlaceholder")} onSubmit={(title) => addMilestone(goal.id, title, "")} onCancel={() => setAddMilestoneGoalId(null)} submitText={t("calendar.addMilestone")} />
                          ) : (
                            <button onClick={() => setAddMilestoneGoalId(goal.id)} className="text-xs text-blue-400 hover:text-blue-300 mt-1">+ {t("calendar.addMilestone")}</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ===== CALENDAR VIEW ===== */}
          {viewMode === "calendar" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); setSelectedDate(null); }}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1 transition-colors"
                >
                  {t("calendar.prevMonth")}
                </button>
                <h3 className="text-sm font-semibold text-white">
                  {new Date(calYear, calMonth).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" })}
                </h3>
                <button
                  onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); setSelectedDate(null); }}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1 transition-colors"
                >
                  {t("calendar.nextMonth")}
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayNames.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {getMonthDays(calYear, calMonth).map((day, idx) => {
                  if (day === null) return <div key={`e${idx}`} className="h-12" />;

                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayTasks = tasks.filter((t) => t.date === dateStr);
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.completed);
                  const hasOverdue = dayTasks.some((t) => !t.completed && dateStr < today);
                  const hasPending = dayTasks.some((t) => !t.completed) && !hasOverdue;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`h-12 rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                        isSelected
                          ? "bg-blue-600/20 border border-blue-500/50"
                          : isToday
                          ? "bg-blue-500/10 border border-blue-500/30"
                          : "hover:bg-gray-800 border border-transparent"
                      }`}
                    >
                      <span className={`font-medium ${isToday ? "text-blue-400" : "text-gray-300"}`}>{day}</span>
                      {dayTasks.length > 0 && (
                        <div className="flex gap-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${allDone ? "bg-green-500" : hasOverdue ? "bg-red-500" : hasPending ? "bg-amber-500" : "bg-gray-600"}`} />
                          <span className="text-[9px] text-gray-500">{dayTasks.length}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected date detail */}
              {selectedDate && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <h4 className="text-xs font-semibold text-white mb-3">
                    {t("calendar.tasksForDate")} — {selectedDate}
                    {selectedDate === today && <span className="ml-2 text-blue-400">({t("calendar.today")})</span>}
                  </h4>
                  {(() => {
                    const dayTasks = tasks.filter((t) => t.date === selectedDate);
                    if (dayTasks.length === 0) return <p className="text-gray-600 text-xs">{t("calendar.noTasksToday")}</p>;
                    return (
                      <div className="space-y-1.5">
                        {dayTasks.map((task) => {
                          const ms = milestones.find((m) => m.id === task.milestoneId);
                          const goal = ms ? goals.find((g) => g.id === ms.goalId) : null;
                          return (
                            <div key={task.id} className="flex items-center gap-2 py-1">
                              <button
                                onClick={() => toggleTask(task.id)}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? "bg-green-500 border-green-500" : "border-gray-600 hover:border-blue-500"}`}
                              >
                                {task.completed && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5" /></svg>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs ${task.completed ? "line-through text-gray-500" : "text-gray-300"}`}>{task.title}</span>
                                {goal && <span className="text-[10px] text-gray-600 block truncate">{goal.title} → {ms?.title}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function DateRangePrompt({ defaultStart, defaultEnd, onConfirm, onCancel, t }: { defaultStart: string; defaultEnd: string; onConfirm: (start: string, end: string) => void; onCancel: () => void; t: (k: string) => string }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const invalid = !start || !end || start > end;
  return (
    <div className="bg-gray-800 border border-purple-500/30 rounded-lg p-3 space-y-2">
      <p className="text-xs text-purple-300">{t("calendar.setDateRangeFirst")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass()}>{t("calendar.startDate")}</label>
          <input type="date" max={end || undefined} className={inputClass("text-sm")} value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className={labelClass()}>{t("calendar.endDate")}</label>
          <input type="date" min={start || undefined} className={inputClass("text-sm")} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => !invalid && onConfirm(start, end)} disabled={invalid} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          {t("calendar.generateTasks")}
        </button>
        <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function InlineForm({ label, placeholder, onSubmit, onCancel, submitText, compact }: { label: string; placeholder: string; onSubmit: (v: string) => void; onCancel: () => void; submitText: string; compact?: boolean }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
    if (e.key === "Escape") onCancel();
  }
  return (
    <div className={compact ? "flex items-center gap-2" : "bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2"}>
      {label && <label className={labelClass()}>{label}</label>}
      <input ref={inputRef} className={compact ? inputClass("text-xs py-1") : inputClass()} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} />
      {!compact && (
        <div className="flex gap-2">
          <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">{submitText}</button>
          <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
        </div>
      )}
    </div>
  );
}
