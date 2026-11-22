import test from "node:test";
import assert from "node:assert/strict";
import {
  addCategory,
  archiveActivity,
  categoryName,
  checkinFromInput,
  cloneActivityForYear,
  deleteCategory,
  isCheckedIn,
  normalizeCategories,
  pauseCheckin,
  todoFromInput,
  todoReminderDate,
  toggleCheckin,
  validateTodoInput,
} from "../activities.js";
import {
  PREVIOUS_NATIVE_STORAGE_KEY,
  NATIVE_STORAGE_KEY,
  migrateNativeState,
} from "../app-state.js";
import { createLocalAccount } from "../account.js";
import { createBackup, parseBackup } from "../backup.js";
import { buildWidgetSnapshot } from "../native-widget.js";
import {
  buildReminderPlan,
  syncScheduledNotifications,
} from "../notifications.js";
import { occurrencesBetween, seriesFromInput } from "../schedule.js";

function schedule(overrides = {}) {
  return seriesFromInput({
    title: "课程",
    date: "2026-12-28",
    startTime: "09:00",
    endTime: "10:00",
    repeatEvery: 1,
    repeatCount: null,
    notes: "",
    reminderMode: "none",
    reminderMinutesBefore: 5,
    ...overrides,
  });
}

function todo(overrides = {}) {
  return todoFromInput({
    title: "提交报告",
    deadlineDate: "2026-12-30",
    deadlineTime: "18:00",
    reminderMode: "alarm",
    reminderDaysBefore: 2,
    notes: "最终版",
    ...overrides,
  });
}

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

test("repeat-to-year-end never generates next-year occurrences", () => {
  const activity = schedule();
  assert.deepEqual(
    occurrencesBetween([activity], "2026-12-28", "2027-01-05").map(
      (item) => item.date,
    ),
    ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"],
  );
});

test("todo reminder uses whole-day offset from the deadline time", () => {
  const activity = todo();
  assert.equal(
    todoReminderDate(activity).getTime(),
    new Date(2026, 11, 28, 18, 0).getTime(),
  );
  assert.equal(
    validateTodoInput(
      {
        title: "提交报告",
        deadlineDate: "2026-12-30",
        deadlineTime: "18:00",
        reminderMode: "alarm",
        reminderDaysBefore: 2,
      },
      {
        year: 2026,
        now: new Date(2026, 11, 1, 0, 0),
      },
    ),
    null,
  );
});

test("check-in allows one toggle per date and prevents future or paused dates", () => {
  const activity = checkinFromInput(
    { title: "阅读", notes: "", checkInDates: [] },
    { year: 2026 },
  );
  const checked = toggleCheckin(
    activity,
    "2026-12-20",
    new Date(2026, 11, 22, 12, 0),
  );
  assert.equal(isCheckedIn(checked, "2026-12-20"), true);
  assert.equal(
    isCheckedIn(
      toggleCheckin(
        checked,
        "2026-12-20",
        new Date(2026, 11, 22, 12, 0),
      ),
      "2026-12-20",
    ),
    false,
  );
  assert.throws(
    () =>
      toggleCheckin(
        activity,
        "2026-12-23",
        new Date(2026, 11, 22, 12, 0),
      ),
    /不能打卡/,
  );
  const paused = pauseCheckin(activity, "2026-12-20");
  assert.throws(
    () =>
      toggleCheckin(
        paused,
        "2026-12-20",
        new Date(2026, 11, 22, 12, 0),
      ),
    /不能打卡/,
  );
});

test("legacy and new check-ins default to no reminder at 21:00", () => {
  const activity = checkinFromInput(
    { title: "阅读", notes: "", checkInDates: [] },
    { year: 2026 },
  );
  assert.equal(activity.reminderMode, "none");
  assert.equal(activity.reminderTime, "21:00");
});

test("categories are isolated by kind and deleting one leaves activities intact", () => {
  let categories = normalizeCategories(null);
  categories = addCategory(categories, "schedule", "课程");
  categories = addCategory(categories, "todo", "课程");
  assert.equal(categories.schedule.length, 1);
  assert.equal(categories.todo.length, 1);
  const category = categories.schedule[0];
  assert.equal(
    categoryName(categories, "schedule", category.id),
    "课程",
  );
  categories = deleteCategory(categories, "schedule", category.id);
  assert.equal(categories.schedule.length, 0);
  assert.equal(categories.todo.length, 1);
});

test("completed todo archives and retains its backup metadata", () => {
  const activity = todo();
  const archived = archiveActivity(
    [activity],
    activity.id,
    "已完成",
    new Date("2026-12-01T00:00:00.000Z"),
  )[0];
  assert.ok(archived.archivedAt);
  assert.ok(archived.completedAt);
  assert.equal(archived.archiveReason, "已完成");
});

test("archiving a regular series removes all future occurrences", () => {
  const activity = schedule({ repeatCount: null });
  const archived = archiveActivity(
    [activity],
    activity.id,
    "已归档",
  )[0];
  assert.deepEqual(
    occurrencesBetween([archived], "2026-12-28", "2026-12-31"),
    [],
  );
});

test("native v3 storage upgrades to v4 with categories and activity kinds", async () => {
  const storage = memoryStorage();
  const account = await createLocalAccount(
    { username: "小风", password: "secret123" },
    { iterations: 1000 },
  );
  storage.setItem(
    PREVIOUS_NATIVE_STORAGE_KEY,
    JSON.stringify({
      version: 3,
      account,
      sessionActive: true,
      events: [schedule()],
      categories: {
        schedule: [{ id: "cat", name: "课程" }],
        todo: [],
        checkin: [],
      },
      yearMigrationCompletedFor: 2026,
    }),
  );
  const migrated = migrateNativeState(storage);
  assert.equal(migrated.status, "ok");
  assert.equal(migrated.state.events[0].kind, "schedule");
  assert.equal(migrated.state.categories.schedule[0].name, "课程");
  assert.ok(storage.getItem(NATIVE_STORAGE_KEY));
});

test("backup v4 includes categories and mixed kinds without account secrets", () => {
  const categories = normalizeCategories({
    schedule: [{ id: "cat", name: "课程" }],
  });
  const backup = createBackup([schedule(), todo()], {
    categories,
    yearMigrationCompletedFor: 2026,
    now: new Date("2026-12-01T00:00:00.000Z"),
  });
  const text = JSON.stringify(backup);
  const parsed = parseBackup(text);
  assert.equal(parsed.version, 4);
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.categories.schedule[0].name, "课程");
  assert.equal(text.includes("passwordHash"), false);
});

test("year migration clones regular and check-in projects but not todos", () => {
  const regular = schedule({ categoryId: "cat" });
  const reading = checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: ["2026-12-01"],
      reminderMode: "alarm",
      reminderTime: "20:30",
    },
    { year: 2026, categoryId: "cat" },
  );
  assert.equal(cloneActivityForYear(todo(), 2027), null);
  const nextRegular = cloneActivityForYear(regular, 2027);
  const nextReading = cloneActivityForYear(reading, 2027);
  assert.equal(nextRegular.year, 2027);
  assert.equal(nextRegular.date, "2027-12-28");
  assert.equal(nextRegular.categoryId, "cat");
  assert.equal(nextReading.year, 2027);
  assert.deepEqual(nextReading.checkInDates, []);
  assert.equal(nextReading.reminderMode, "alarm");
  assert.equal(nextReading.reminderTime, "20:30");
});

test("check-in reminders group by identical time and mode", () => {
  const reading = checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: [],
      reminderMode: "notification",
      reminderTime: "21:00",
    },
    { year: 2026 },
  );
  const exercise = checkinFromInput(
    {
      title: "运动",
      notes: "",
      checkInDates: [],
      reminderMode: "notification",
      reminderTime: "21:00",
    },
    { year: 2026 },
  );
  const plan = buildReminderPlan([todo(), reading, exercise], {
    startDate: "2026-12-01",
    endDate: "2026-12-01",
    now: new Date(2026, 11, 1, 0, 0),
  });
  const group = plan.find((item) => item.kind === "checkinGroup");
  assert.equal(group.titles.length, 2);
  assert.deepEqual(group.titles, ["阅读", "运动"]);
});

test("check-in reminders skip checked, paused, archived and different modes", () => {
  const base = checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: ["2026-12-01"],
      reminderMode: "notification",
      reminderTime: "21:00",
    },
    { year: 2026 },
  );
  const paused = pauseCheckin(
    checkinFromInput(
      {
        title: "运动",
        notes: "",
        checkInDates: [],
        reminderMode: "notification",
        reminderTime: "21:00",
      },
      { year: 2026 },
    ),
    "2026-12-01",
  );
  const archivedSource = checkinFromInput(
      {
        title: "写作",
        notes: "",
        checkInDates: [],
        reminderMode: "notification",
        reminderTime: "21:00",
      },
      { year: 2026 },
    );
  const archived = archiveActivity(
    [archivedSource],
    archivedSource.id,
    "已完成",
  )[0];
  const alarm = checkinFromInput(
    {
      title: "复习",
      notes: "",
      checkInDates: [],
      reminderMode: "alarm",
      reminderTime: "21:00",
    },
    { year: 2026 },
  );
  const plan = buildReminderPlan([base, paused, archived, alarm], {
    startDate: "2026-12-01",
    endDate: "2026-12-01",
    now: new Date(2026, 11, 1, 0, 0),
  });
  const checkinPlans = plan.filter(
    (item) => item.kind === "checkinGroup",
  );
  assert.equal(checkinPlans.length, 1);
  assert.equal(checkinPlans[0].mode, "alarm");
  assert.deepEqual(checkinPlans[0].titles, ["复习"]);
});

test("widget snapshot separates today's schedules, todos and check-in summary", () => {
  const regular = schedule({
    date: "2026-12-01",
    repeatCount: 1,
  });
  const report = todo({ deadlineDate: "2026-12-01" });
  const reading = checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: ["2026-12-01"],
      reminderMode: "notification",
      reminderTime: "21:00",
    },
    { year: 2026 },
  );
  const snapshot = buildWidgetSnapshot([regular, report, reading], {
    startDate: "2026-12-01",
    endDate: "2026-12-01",
  });
  const day = snapshot.days["2026-12-01"];
  assert.equal(snapshot.version, 2);
  assert.equal(day.schedules[0].title, "课程");
  assert.equal(day.todos[0].title, "提交报告");
  assert.deepEqual(day.checkins, { total: 1, checked: 1 });
});

test("notification synchronization is serialized across concurrent refreshes", async () => {
  let active = 0;
  let maximumActive = 0;
  const enter = async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
  };
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
      getPending: async () => {
        await enter();
        return { notifications: [] };
      },
      createChannel: async () => {},
      schedule: async () => enter(),
    },
  };
  const notice = schedule({
    date: "2026-12-20",
    reminderMode: "notification",
    repeatCount: 1,
  });
  await Promise.all([
    syncScheduledNotifications([notice]),
    syncScheduledNotifications([notice]),
  ]);
  assert.equal(maximumActive, 1);
  delete globalThis.DailyRouteNative;
});
