import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveActivity,
  checkinFromInput,
  pauseCheckin,
  todoFromInput,
} from "../activities.js";
import { buildReminderPlan } from "../notifications.js";
import {
  buildReviewMarkdown,
  reviewEntriesInRange,
  reviewRangeFor,
} from "../review.js";
import { pauseSeries, seriesFromInput } from "../schedule.js";
import {
  buildMigrationCopies,
  migrationCandidates,
  migrationIsDue,
  migrationTargetYear,
} from "../year-migration.js";

function schedule(overrides = {}) {
  return seriesFromInput({
    title: "课程",
    date: "2026-11-16",
    startTime: "09:00",
    endTime: "10:00",
    repeatEvery: 1,
    repeatCount: 8,
    notes: "",
    reminderMode: "notification",
    reminderMinutesBefore: 5,
    ...overrides,
  });
}

function checkin(overrides = {}) {
  return checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: ["2026-11-16"],
      reminderMode: "notification",
      reminderTime: "21:00",
      ...overrides,
    },
    { year: 2026, categoryId: "study" },
  );
}

function review(date, summary) {
  return {
    date,
    summary,
    reflection: "",
    inspiration: "",
    activitySnapshot: {
      schedules: [],
      todos: [],
      checkins: [],
    },
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

test("review export ranges follow the selected date", () => {
  assert.deepEqual(reviewRangeFor("week", "2026-11-22"), {
    scope: "week",
    startDate: "2026-11-16",
    endDate: "2026-11-22",
  });
  assert.deepEqual(reviewRangeFor("month", "2026-11-22"), {
    scope: "month",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
  });
  assert.deepEqual(reviewRangeFor("year", "2026-11-22"), {
    scope: "year",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
});

test("range export includes only saved review days in range", () => {
  const entries = [
    review("2026-11-09", "上周"),
    review("2026-11-16", "周一"),
    review("2026-11-22", "周日"),
    review("2026-11-23", "下周"),
  ];
  assert.deepEqual(
    reviewEntriesInRange(
      entries,
      "2026-11-16",
      "2026-11-22",
    ).map((entry) => entry.date),
    ["2026-11-16", "2026-11-22"],
  );
  const markdown = buildReviewMarkdown(entries, {
    startDate: "2026-11-16",
    endDate: "2026-11-22",
    title: "Daily Route 回顾 · 本周",
  });
  assert.match(markdown, /^# Daily Route 回顾 · 本周/m);
  assert.match(markdown, /周一/);
  assert.doesNotMatch(markdown, /上周/);
  assert.doesNotMatch(markdown, /下周/);
});

test("migration candidates include paused projects but exclude todos and manual archives", () => {
  const regular = schedule();
  const pausedSource = schedule({ title: "暂停课程" });
  const pausedActivity = pauseSeries(
    [pausedSource],
    pausedSource.id,
    "2026-11-18",
  )[0];
  const reading = pauseCheckin(checkin(), "2026-11-18");
  const todo = todoFromInput({
    title: "报告",
    deadlineDate: "2026-11-30",
    deadlineTime: "18:00",
    reminderMode: "none",
    reminderDaysBefore: 0,
    notes: "",
  });
  const archivedSource = schedule({ title: "手动归档" });
  const archived = archiveActivity(
    [archivedSource],
    archivedSource.id,
    "已归档",
  )[0];
  const candidates = migrationCandidates(
    [regular, pausedActivity, reading, todo, archived],
    2027,
  );
  assert.deepEqual(
    candidates.map((item) => item.title),
    ["课程", "暂停课程", "阅读"],
  );
});

test("confirmed migration creates next-year copies and resumes paused projects", () => {
  const regular = schedule();
  const pausedSource = schedule({ title: "暂停课程" });
  const paused = pauseSeries(
    [pausedSource],
    pausedSource.id,
    "2026-11-18",
  )[0];
  const reading = checkin({
    title: "阅读",
    checkInDates: ["2026-11-16", "2026-11-17"],
  });
  const copies = buildMigrationCopies(
    [regular, paused, reading],
    [regular.id, paused.id, reading.id],
    2027,
  );
  assert.equal(copies.length, 3);
  const nextPaused = copies.find((item) => item.title === "暂停课程");
  assert.equal(nextPaused.year, 2027);
  assert.deepEqual(nextPaused.pauses, []);
  const nextReading = copies.find((item) => item.title === "阅读");
  assert.equal(nextReading.year, 2027);
  assert.deepEqual(nextReading.checkInDates, []);
  assert.equal(nextReading.categoryId, "study");
});

test("migration window lasts December through January", () => {
  assert.equal(
    migrationTargetYear(new Date(2026, 11, 1)),
    2027,
  );
  assert.equal(
    migrationIsDue(2026, new Date(2026, 11, 1)),
    true,
  );
  assert.equal(
    migrationIsDue(2026, new Date(2027, 0, 1)),
    true,
  );
  assert.equal(
    migrationIsDue(2027, new Date(2027, 0, 1)),
    false,
  );
  assert.equal(
    migrationIsDue(2026, new Date(2027, 1, 1)),
    false,
  );
});

test("December migration reminder is a one-off normal notification", () => {
  const plan = buildReminderPlan([], {
    startDate: "2026-11-01",
    endDate: "2026-12-31",
    now: new Date(2026, 10, 1, 10),
    migrationReminder: { enabled: true, targetYear: 2027 },
  });
  const reminder = plan.find((item) => item.kind === "yearMigration");
  assert.ok(reminder);
  assert.equal(reminder.mode, "notification");
  assert.equal(reminder.at.getTime(), new Date(2026, 11, 1, 9).getTime());

  const latePlan = buildReminderPlan([], {
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    now: new Date(2026, 11, 1, 10),
    migrationReminder: { enabled: true, targetYear: 2027 },
  });
  assert.equal(
    latePlan.some((item) => item.kind === "yearMigration"),
    false,
  );
});
