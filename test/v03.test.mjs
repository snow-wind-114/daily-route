import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_NATIVE_STORAGE_KEY,
  NATIVE_STORAGE_KEY,
  migrateNativeState,
  normalizeNativeState,
} from "../app-state.js";
import { createBackup, parseBackup, summarizeEvents } from "../backup.js";
import { buildWidgetSnapshot } from "../native-widget.js";
import {
  buildReminderPlan,
  getReminderChannelState,
  scheduleTestReminder,
  syncScheduledNotifications,
} from "../notifications.js";
import {
  addRecoveryPoint,
  clearRecoveryPoints,
  markManualExport,
  readLastManualExport,
  readRecoveryPoints,
  shouldRemindBackup,
} from "../recovery.js";
import {
  applyOccurrenceOverride,
  findScheduleConflict,
  getOccurrenceIndex,
  normalizeSeries,
  occurrencesBetween,
  occurrencesOnDate,
  pauseSeries,
  resumeSeries,
  seriesFromInput,
  splitSeriesForEdit,
  unmatchedOverridesForSeriesEdit,
} from "../schedule.js";
import { checkForUpdate, parseUpdateManifest } from "../update-check.js";

function makeSeries(overrides = {}) {
  return seriesFromInput({
    title: "项目会议",
    date: "2026-11-16",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 1,
    repeatCount: 5,
    notes: "",
    reminderMode: "notification",
    reminderMinutesBefore: 5,
    ...overrides,
  });
}

function makeStorage() {
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

test("legacy reminder booleans migrate to explicit reminder modes", () => {
  const base = {
    id: "legacy",
    title: "旧活动",
    date: "2026-11-16",
    startTime: "09:00",
    endTime: "10:00",
    repeatEvery: 1,
    repeatCount: 1,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  assert.equal(
    normalizeSeries({ ...base, reminderEnabled: true }).reminderMode,
    "notification",
  );
  assert.equal(
    normalizeSeries({ ...base, reminderEnabled: false }).reminderMode,
    "none",
  );
});

test("single occurrence override moves one event and stays in its series", () => {
  const event = makeSeries({ repeatCount: 3, repeatEvery: 2 });
  const moved = applyOccurrenceOverride(
    [event],
    event.id,
    "2026-11-18",
    {
      title: "调整后的会议",
      date: "2026-11-19",
      startTime: "16:00",
      endTime: "17:00",
      notes: "换到会议室",
      reminderMode: "alarm",
      reminderMinutesBefore: 10,
    },
  )[0];

  assert.equal(occurrencesOnDate([moved], "2026-11-18").length, 0);
  const adjusted = occurrencesOnDate([moved], "2026-11-19")[0];
  assert.equal(adjusted.series.title, "调整后的会议");
  assert.equal(adjusted.originalDate, "2026-11-18");
  assert.equal(adjusted.series.reminderMode, "alarm");
  assert.equal(moved.occurrenceOverrides.length, 1);
  assert.equal(getOccurrenceIndex(moved, "2026-11-18"), 1);
});

test("single occurrence conflict ignores only the replaced occurrence", () => {
  const first = makeSeries({ repeatCount: 3, repeatEvery: 2 });
  const second = makeSeries({
    title: "固定课程",
    date: "2026-11-18",
    startTime: "15:00",
    endTime: "16:00",
    repeatCount: 1,
  });
  const candidate = makeSeries({
    title: "调整后的会议",
    date: "2026-11-18",
    startTime: "16:00",
    endTime: "17:00",
    repeatCount: 1,
  });

  assert.equal(
    findScheduleConflict(
      [first, second],
      candidate,
      "2026-11-16",
      "2026-11-20",
      { seriesId: first.id, originalDate: "2026-11-16" },
    ),
    null,
  );
});

test("paused dates do not consume finite repeat count", () => {
  const event = makeSeries({ repeatCount: 5 });
  const paused = pauseSeries([event], event.id, "2026-11-17")[0];
  assert.deepEqual(
    occurrencesBetween([paused], "2026-11-16", "2026-11-25").map(
      (item) => item.date,
    ),
    ["2026-11-16"],
  );

  const resumed = resumeSeries([paused], event.id, "2026-11-20")[0];
  assert.deepEqual(
    occurrencesBetween([resumed], "2026-11-16", "2026-11-30").map(
      (item) => item.date,
    ),
    [
      "2026-11-16",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
    ],
  );
});

test("series edit preserves only overrides matching the new schedule", () => {
  let event = makeSeries({
    repeatEvery: 2,
    repeatCount: 6,
  });
  event = applyOccurrenceOverride(
    [event],
    event.id,
    "2026-11-20",
    {
      title: "仍有效",
      date: "2026-11-20",
      startTime: "14:30",
      endTime: "15:50",
      notes: "",
      reminderMode: "none",
      reminderMinutesBefore: 5,
    },
  )[0];
  event = applyOccurrenceOverride(
    [event],
    event.id,
    "2026-11-22",
    {
      title: "将失效",
      date: "2026-11-22",
      startTime: "14:30",
      endTime: "15:50",
      notes: "",
      reminderMode: "none",
      reminderMinutesBefore: 5,
    },
  )[0];

  const nextInput = {
    title: "系列改名",
    date: "2026-11-18",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 4,
    repeatCount: 4,
    notes: "",
    reminderMode: "notification",
    reminderMinutesBefore: 5,
  };
  assert.deepEqual(
    unmatchedOverridesForSeriesEdit(event, "2026-11-18", nextInput).map(
      (item) => item.occurrenceDate,
    ),
    ["2026-11-20"],
  );

  const edited = splitSeriesForEdit(
    [event],
    event.id,
    "2026-11-18",
    nextInput,
  );
  const replacement = edited.find((item) => item.date === "2026-11-18");
  assert.deepEqual(
    replacement.occurrenceOverrides.map((item) => item.occurrenceDate),
    ["2026-11-22"],
  );
});

test("native storage migrates to v6 without losing account or events", () => {
  const storage = makeStorage();
  const event = makeSeries({ reminderMode: "notification" });
  storage.setItem(
    LEGACY_NATIVE_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      account: {
        username: "小风",
        passwordHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        passwordSalt: "AAAAAAAAAAAAAAAAAAAAAA==",
        passwordIterations: 1000,
        createdAt: "2026-11-01T00:00:00.000Z",
      },
      sessionActive: true,
      events: [event],
    }),
  );

  const migrated = migrateNativeState(storage);
  assert.equal(migrated.status, "ok");
  assert.equal(migrated.state.events[0].reminderMode, "notification");
  assert.ok(storage.getItem(NATIVE_STORAGE_KEY));
  assert.ok(storage.getItem(LEGACY_NATIVE_STORAGE_KEY));
});

test("invalid native storage version is rejected", () => {
  assert.equal(
    normalizeNativeState({
      version: 1,
      account: {},
      sessionActive: true,
      events: [],
    }),
    null,
  );
});

test("backup v1 remains importable and v6 omits account credentials", () => {
  const event = makeSeries({ reminderMode: "alarm" });
  const v2 = createBackup([event], {
    now: new Date("2026-11-15T00:00:00.000Z"),
  });
  assert.equal(v2.version, 6);
  assert.equal(JSON.stringify(v2).includes("passwordHash"), false);

  const v1 = {
    ...v2,
    version: 1,
    events: [
      {
        ...event,
        reminderMode: undefined,
        reminderEnabled: true,
      },
    ],
  };
  const parsed = parseBackup(JSON.stringify(v1));
  assert.equal(parsed.sourceVersion, 1);
  assert.equal(parsed.events[0].reminderMode, "notification");
});

test("backup summary counts reminders, pauses and overrides", () => {
  const event = makeSeries({ reminderMode: "notification" });
  const paused = pauseSeries(
    [event],
    event.id,
    "2026-11-16",
  );
  assert.equal(summarizeEvents(paused).pausedCount, 1);
  assert.equal(summarizeEvents([makeSeries({ reminderMode: "alarm" })]).alarmCount, 1);
});

test("reminder plan uses original-date identity for moved occurrences", () => {
  const original = makeSeries({ repeatCount: 2, reminderMode: "alarm" });
  const event = applyOccurrenceOverride(
    [original],
    original.id,
    "2026-11-16",
    {
      title: "移动会议",
      date: "2026-11-17",
      startTime: "10:00",
      endTime: "11:00",
      notes: "",
      reminderMode: "alarm",
      reminderMinutesBefore: 5,
    },
  )[0];
  const plan = buildReminderPlan([event], {
    startDate: "2026-11-16",
    endDate: "2026-11-18",
    now: new Date(2026, 10, 16, 8, 0),
  });

  assert.equal(plan[0].occurrenceDate, "2026-11-16");
  assert.equal(plan[0].effectiveDate, "2026-11-17");
  assert.equal(plan[0].mode, "alarm");
});

test("notification sync separates plugin notices from native alarm jobs", async () => {
  const scheduled = [];
  const nativeAlarms = [];
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    DailyRouteAlarmScheduler: {
      syncJobs: async ({ json }) => {
        const jobs = JSON.parse(json);
        nativeAlarms.push(...jobs);
        return {
          plannedJobs: jobs.length,
          scheduledSources: new Set(jobs.map((job) => job.sourceId)).size,
          nextAt: jobs[0]?.at ?? null,
        };
      },
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
      getPending: async () => ({ notifications: [] }),
      createChannel: async () => {},
      schedule: async ({ notifications }) => scheduled.push(...notifications),
    },
  };

  const notice = makeSeries({
    title: "普通通知",
    date: "2026-12-01",
    reminderMode: "notification",
    repeatCount: 1,
  });
  const alarm = makeSeries({
    title: "精确闹钟",
    date: "2026-12-02",
    reminderMode: "alarm",
    repeatCount: 1,
  });
  const status = await syncScheduledNotifications([notice, alarm]);
  const regular = scheduled.find((item) => item.title === "普通通知");

  assert.equal(status.scheduled, 2);
  assert.equal(status.alarmPlanned, 1);
  assert.equal(status.alarmScheduled, 1);
  assert.equal(status.downgraded, 0);
  assert.equal(regular.isExactNotification, false);
  assert.equal(regular.schedule.allowWhileIdle, false);
  assert.equal(nativeAlarms[0].title, "精确闹钟");
  assert.match(nativeAlarms[0].at, /^2026-12-02T/);
  delete globalThis.DailyRouteNative;
});

test("alarm sync downgrades when exact alarm access is denied", async () => {
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

  const status = await syncScheduledNotifications([
    makeSeries({
      reminderMode: "alarm",
      date: "2026-12-01",
      repeatCount: 1,
    }),
  ]);
  assert.equal(status.downgraded, 1);
  assert.equal(scheduled[0].isExactNotification, false);
  assert.equal(scheduled[0].extra.exact, false);
  delete globalThis.DailyRouteNative;
});

test("blocked alarm channel falls back to the normal notification channel", async () => {
  const scheduled = [];
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    DailyRouteDevice: {
      getReminderDiagnostics: async () => ({
        notificationsEnabled: true,
        exactAlarmGranted: true,
        notificationChannel: { exists: true, importance: 4 },
        alarmChannel: { exists: true, importance: 0 },
      }),
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
      getPending: async () => ({ notifications: [] }),
      createChannel: async () => {},
      schedule: async ({ notifications }) => scheduled.push(...notifications),
    },
  };

  const channels = await getReminderChannelState();
  assert.equal(channels.alarmChannelBlocked, true);
  const status = await syncScheduledNotifications([
    makeSeries({
      reminderMode: "alarm",
      date: "2026-12-01",
      repeatCount: 1,
    }),
  ]);
  assert.equal(status.downgraded, 1);
  assert.equal(scheduled[0].channelId, "daily-route-notifications-v1");
  assert.equal(scheduled[0].isExactNotification, false);
  assert.equal(scheduled[0].schedule.allowWhileIdle, false);
  delete globalThis.DailyRouteNative;
});

test("alarm test remains observable when exact access or alarm channel is unavailable", async () => {
  const scheduled = [];
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    DailyRouteDevice: {
      getReminderDiagnostics: async () => ({
        notificationsEnabled: true,
        exactAlarmGranted: false,
        notificationChannel: { exists: true, importance: 4 },
        alarmChannel: { exists: true, importance: 0 },
      }),
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "denied" }),
      createChannel: async () => {},
      schedule: async ({ notifications }) => scheduled.push(...notifications),
    },
  };

  const result = await scheduleTestReminder("alarm", { delaySeconds: 1 });
  assert.equal(result.exact, false);
  assert.equal(result.channelFallback, true);
  assert.equal(result.downgraded, true);
  assert.equal(scheduled[0].channelId, "daily-route-notifications-v1");
  assert.equal(scheduled[0].isExactNotification, false);
  delete globalThis.DailyRouteNative;
});

test("activity reminder sync never cancels an in-flight test notification", async () => {
  const cancelled = [];
  globalThis.DailyRouteNative = {
    Capacitor: { isNativePlatform: () => true },
    DailyRouteDevice: {
      getReminderDiagnostics: async () => ({
        notificationsEnabled: true,
        exactAlarmGranted: true,
        notificationChannel: { exists: true, importance: 4 },
        alarmChannel: { exists: true, importance: 5 },
      }),
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
      getPending: async () => ({
        notifications: [
          {
            id: 11,
            extra: { kind: "daily-route-reminder", seriesId: "activity" },
          },
          {
            id: 12,
            extra: { kind: "daily-route-reminder", test: true },
          },
        ],
      }),
      cancel: async ({ notifications }) =>
        cancelled.push(...notifications.map((item) => item.id)),
      createChannel: async () => {},
      schedule: async () => {},
    },
  };

  await syncScheduledNotifications([]);
  assert.deepEqual(cancelled, [11]);
  delete globalThis.DailyRouteNative;
});

test("widget snapshot separates schedules, todos and check-ins", () => {
  const event = makeSeries({ repeatCount: 2, repeatEvery: 1 });
  const snapshot = buildWidgetSnapshot([event], {
    startDate: "2026-11-16",
    endDate: "2026-11-18",
  });
  assert.equal(snapshot.version, 2);
  assert.equal(
    snapshot.days["2026-11-16"].schedules[0].title,
    "项目会议",
  );
  assert.equal(
    snapshot.days["2026-11-17"].schedules[0].startTime,
    "14:30",
  );
  assert.equal(snapshot.days["2026-11-18"], undefined);
});

test("recovery keeps five unique points and tracks manual export", () => {
  const storage = makeStorage();
  for (let index = 0; index < 7; index += 1) {
    addRecoveryPoint(
      [makeSeries({ title: `活动 ${index}` })],
      `恢复点 ${index}`,
      {
        storage,
        now: new Date(2026, 10, 15, 0, index),
      },
    );
  }
  assert.equal(readRecoveryPoints(storage).length, 5);
  assert.equal(readRecoveryPoints(storage)[0].reason, "恢复点 6");

  const exportedAt = markManualExport({
    storage,
    now: new Date("2026-11-15T00:00:00.000Z"),
  });
  assert.equal(readLastManualExport(storage), exportedAt);
  assert.equal(
    shouldRemindBackup(exportedAt, {
      now: new Date("2026-12-10T00:00:00.000Z"),
      days: 30,
    }),
    false,
  );
  clearRecoveryPoints(storage);
  assert.equal(readRecoveryPoints(storage).length, 0);
});

test("update checker validates manifests and compares version code", async () => {
  const manifest = {
    versionCode: 4,
    versionName: "0.4.0",
    apkUrl: "https://example.com/daily-route.apk",
    releaseUrl: "https://example.com/release",
    notes: ["更新"],
  };
  assert.equal(parseUpdateManifest(manifest).versionName, "0.4.0");
  assert.throws(
    () => parseUpdateManifest({ ...manifest, apkUrl: "http://insecure" }),
    /格式不正确/,
  );

  const result = await checkForUpdate({
    currentVersionCode: 3,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async () => ({
      ok: true,
      json: async () => manifest,
    }),
  });
  assert.equal(result.state, "available");
});
