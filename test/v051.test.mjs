import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveActivity,
  checkinFromInput,
  todoFromInput,
  toggleCheckin,
} from "../activities.js";
import {
  NATIVE_STORAGE_KEY,
  PREVIOUS_NATIVE_STORAGE_KEY,
  migrateNativeState,
} from "../app-state.js";
import { createLocalAccount } from "../account.js";
import { createBackup, parseBackup } from "../backup.js";
import {
  buildReminderPlan,
  syncScheduledNotifications,
} from "../notifications.js";
import {
  addRecoveryPoint,
  readRecoveryPoints,
  removeReviewsBeforeYearFromRecovery,
} from "../recovery.js";
import {
  buildReviewActivitySnapshot,
  buildReviewMarkdown,
  createReviewEntry,
  normalizeReviewEntries,
  normalizeReviewReminder,
  removeReviewsBeforeYear,
} from "../review.js";
import { seriesFromInput } from "../schedule.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function review(date, text = "总结", overrides = {}) {
  return {
    date,
    summary: text,
    reflection: "",
    inspiration: "",
    activitySnapshot: {
      schedules: [],
      todos: [],
      checkins: [],
    },
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    ...overrides,
  };
}

test("review entries keep one latest entry per current-year date", () => {
  const entries = normalizeReviewEntries([
    review("2026-11-21", "较早", {
      updatedAt: "2026-11-21T10:00:00.000Z",
    }),
    review("2026-11-21", "较新", {
      updatedAt: "2026-11-21T12:00:00.000Z",
    }),
    review("2026-11-22", "第二天"),
    { ...review("2026-11-23"), summary: "" },
  ]);
  assert.deepEqual(
    entries.map((entry) => [entry.date, entry.summary]),
    [
      ["2026-11-21", "较新"],
      ["2026-11-22", "第二天"],
    ],
  );
});

test("first review save freezes activity snapshot and blank text deletes entry", () => {
  const schedule = seriesFromInput({
    title: "课程",
    date: "2026-11-22",
    startTime: "09:00",
    endTime: "10:00",
    repeatEvery: 1,
    repeatCount: 1,
    notes: "",
    reminderMode: "none",
    reminderMinutesBefore: 5,
  });
  const todo = todoFromInput({
    title: "报告",
    deadlineDate: "2026-11-22",
    deadlineTime: "18:00",
    reminderMode: "none",
    reminderDaysBefore: 0,
    notes: "",
  });
  const completedTodo = archiveActivity(
    [todo],
    todo.id,
    "已完成",
    new Date("2026-11-22T10:00:00.000Z"),
  )[0];
  const checkin = toggleCheckin(
    checkinFromInput(
      { title: "阅读", notes: "", checkInDates: [] },
      { year: 2026 },
    ),
    "2026-11-22",
    new Date(2026, 10, 22, 12),
  );
  const snapshot = buildReviewActivitySnapshot(
    [schedule, completedTodo, checkin],
    "2026-11-22",
  );
  assert.equal(snapshot.schedules[0].title, "课程");
  assert.equal(snapshot.todos[0].status, "completed");
  assert.equal(snapshot.checkins[0].checked, true);

  const saved = createReviewEntry(
    {
      date: "2026-11-22",
      summary: "完成复习",
      reflection: "",
      inspiration: "",
    },
    {
      activitySnapshot: snapshot,
      now: new Date("2026-11-22T20:00:00.000Z"),
    },
  );
  const edited = createReviewEntry(
    {
      date: "2026-11-22",
      summary: "完成复习并整理笔记",
      reflection: "",
      inspiration: "",
    },
    {
      existing: saved,
      activitySnapshot: { schedules: [], todos: [], checkins: [] },
      now: new Date("2026-11-22T21:00:00.000Z"),
    },
  );
  assert.deepEqual(edited.activitySnapshot, saved.activitySnapshot);
  assert.equal(
    createReviewEntry({
      date: "2026-11-22",
      summary: " ",
      reflection: "",
      inspiration: "",
    }),
    null,
  );
});

test("markdown review book includes only written days and frozen facts", () => {
  const entries = [
    review("2026-11-20", "有内容", {
      activitySnapshot: {
        schedules: [
          { title: "课程", startTime: "09:00", endTime: "10:00" },
        ],
        todos: [
          {
            title: "报告",
            deadlineTime: "18:00",
            status: "completed",
          },
        ],
        checkins: [{ title: "阅读", checked: false }],
      },
    }),
    review("2026-11-21", " "),
  ];
  const markdown = buildReviewMarkdown(entries, { year: 2026 });
  assert.match(markdown, /2026 年 Daily Route 回顾/);
  assert.match(markdown, /09:00–10:00 课程/);
  assert.match(markdown, /\[x\] 18:00 报告/);
  assert.match(markdown, /\[ \] 阅读/);
  assert.match(markdown, /### 今日总结/);
  assert.doesNotMatch(markdown, /2026年11月21日/);
});

test("v4 storage migrates to v5 with default review settings", async () => {
  const storage = memoryStorage();
  const account = await createLocalAccount(
    { username: "小风", password: "secret123" },
    { iterations: 1000 },
  );
  storage.setItem(
    PREVIOUS_NATIVE_STORAGE_KEY,
    JSON.stringify({
      version: 4,
      account,
      sessionActive: true,
      events: [],
      categories: { schedule: [], todo: [], checkin: [] },
      yearMigrationCompletedFor: 2026,
    }),
  );
  const migrated = migrateNativeState(storage);
  assert.equal(migrated.status, "ok");
  assert.deepEqual(migrated.state.reviewEntries, []);
  assert.deepEqual(migrated.state.reviewReminder, {
    enabled: false,
    time: "21:30",
  });
  assert.ok(storage.getItem(NATIVE_STORAGE_KEY));
  assert.equal(JSON.parse(storage.getItem(NATIVE_STORAGE_KEY)).version, 5);
});

test("backup v5 round-trips review text and reminder without credentials", () => {
  const reviewEntries = [review("2026-11-22", "今天完成了复习")];
  const backup = createBackup([], {
    reviewEntries,
    reviewReminder: { enabled: true, time: "22:00" },
    now: new Date("2026-11-22T12:00:00.000Z"),
  });
  const text = JSON.stringify(backup);
  const parsed = parseBackup(text);
  assert.equal(parsed.version, 5);
  assert.equal(parsed.reviewCount, 1);
  assert.equal(parsed.reviewEntries[0].summary, "今天完成了复习");
  assert.equal(parsed.reviewReminder.time, "22:00");
  assert.equal(text.includes("passwordHash"), false);
  assert.throws(
    () => parseBackup(JSON.stringify({ ...backup, reviewCount: 2 })),
    /回顾数量校验失败/,
  );
});

test("daily review reminder uses one repeating normal notification", async () => {
  const reviewReminder = { enabled: true, time: "21:30" };
  const plan = buildReminderPlan([], {
    startDate: "2026-11-22",
    endDate: "2026-11-22",
    now: new Date(2026, 10, 22, 20, 0),
    reviewReminder,
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, "dailyReview");
  assert.equal(plan[0].repeatDaily, true);
  const scheduled = [];
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "denied" }),
      getPending: async () => ({ notifications: [] }),
      createChannel: async () => {},
      schedule: async ({ notifications }) => scheduled.push(...notifications),
    },
  };
  const status = await syncScheduledNotifications([], { reviewReminder });
  assert.equal(status.scheduled, 1);
  assert.deepEqual(scheduled[0].schedule.on, {
    hour: 21,
    minute: 30,
    second: 0,
  });
  assert.equal(scheduled[0].extra.activityKind, "dailyReview");
  delete globalThis.DailyRouteNative;
});

test("review cleanup removes old entries from state and recovery points", () => {
  const old = review("2026-12-31", "去年");
  const current = review("2027-01-01", "今年");
  assert.deepEqual(
    removeReviewsBeforeYear([old, current], 2027).map((item) => item.date),
    ["2027-01-01"],
  );
  const storage = memoryStorage();
  addRecoveryPoint(
    {
      events: [],
      categories: {},
      yearMigrationCompletedFor: 2027,
      reviewEntries: [old, current],
      reviewReminder: normalizeReviewReminder(),
    },
    "清理前",
    { storage, now: new Date("2027-01-02T00:00:00.000Z") },
  );
  removeReviewsBeforeYearFromRecovery(2027, { storage });
  assert.deepEqual(
    readRecoveryPoints(storage)[0].reviewEntries.map((item) => item.date),
    ["2027-01-01"],
  );
});
