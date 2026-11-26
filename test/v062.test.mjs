import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceFocusRun,
  focusRunExpectedEndAt,
  normalizeFocusSession,
  readFocusSession,
} from "../focus.js";
import {
  buildReminderPlan,
  syncScheduledNotifications,
} from "../notifications.js";

function focusRun(overrides = {}) {
  return {
    version: 1,
    continuityVersion: 2,
    id: "run-1",
    title: "学习流程",
    steps: [
      {
        projectId: "focus-project",
        title: "学习",
        type: "focus",
        durationSeconds: 60,
      },
      {
        projectId: "rest-project",
        title: "休息",
        type: "rest",
        durationSeconds: 30,
      },
    ],
    stepIndex: 0,
    stepElapsedSeconds: 0,
    currentStepStartedAt: "2026-11-23T00:00:00.000Z",
    status: "running",
    wallpaperId: "wallpaper-1",
    quoteId: "quote-1",
    createdAt: "2026-11-23T00:00:00.000Z",
    updatedAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

function projects() {
  return [
    {
      id: "focus-project",
      title: "学习",
      type: "focus",
      accumulatedSeconds: 0,
      completedRuns: 0,
    },
    {
      id: "rest-project",
      title: "休息",
      type: "rest",
      accumulatedSeconds: 0,
      completedRuns: 0,
    },
  ];
}

test("focus run catches up across completed steps after background time", () => {
  const first = advanceFocusRun(
    focusRun(),
    projects(),
    new Date("2026-11-23T00:01:20.000Z"),
  );
  assert.deepEqual(first.completedSteps.map((step) => step.projectId), [
    "focus-project",
  ]);
  assert.equal(first.finished, false);
  assert.equal(first.session.stepIndex, 1);
  assert.equal(first.session.stepElapsedSeconds, 20);
  assert.equal(first.projects[0].accumulatedSeconds, 60);
  assert.equal(first.projects[0].completedRuns, 1);

  const second = advanceFocusRun(
    first.session,
    first.projects,
    new Date("2026-11-23T00:01:45.000Z"),
  );
  assert.equal(second.finished, true);
  assert.equal(second.session.status, "completed");
  assert.equal(second.projects[1].accumulatedSeconds, 30);
  assert.equal(second.projects[1].completedRuns, 1);
});

test("focus expected completion follows the remaining wall-clock time", () => {
  const endAt = focusRunExpectedEndAt(
    focusRun({
      stepElapsedSeconds: 10,
      currentStepStartedAt: "2026-11-23T00:00:10.000Z",
    }),
    Date.parse("2026-11-23T00:00:20.000Z"),
  );
  assert.equal(endAt.toISOString(), "2026-11-23T00:01:30.000Z");
});

test("v0.6.1 sessions restore paused while v0.6.2 continues and keeps visuals", () => {
  const legacy = normalizeFocusSession(
    focusRun({
      continuityVersion: undefined,
      status: "running",
    }),
  );
  assert.equal(legacy.status, "paused");
  assert.equal(legacy.continuityVersion, 1);

  const storage = new Map([
    [
      "daily-route.focus-session.v1",
      JSON.stringify(focusRun()),
    ],
  ]);
  const restored = readFocusSession({
    getItem: (key) => storage.get(key) ?? null,
  });
  assert.equal(restored.status, "running");
  assert.equal(restored.wallpaperId, "wallpaper-1");
  assert.equal(restored.quoteId, "quote-1");
  assert.equal(
    normalizeFocusSession(
      focusRun({ status: "completed" }),
    ).status,
    "completed",
  );
});

test("focus completion joins the normal notification plan", () => {
  const at = new Date("2026-11-23T00:10:00.000Z");
  const plan = buildReminderPlan([], {
    now: new Date("2026-11-23T00:00:00.000Z"),
    startDate: "2026-11-23",
    endDate: "2026-11-23",
    focusCompletion: {
      sessionId: "run-1",
      title: "学习流程",
      at,
    },
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, "focusCompletion");
  assert.equal(plan[0].mode, "notification");
  assert.equal(plan[0].focusSessionId, "run-1");
  assert.equal(plan[0].at.getTime(), at.getTime());
});

test("focus completion replaces the previous serialized notification", async () => {
  const cancelled = [];
  const scheduled = [];
  globalThis.DailyRouteNative = {
    Capacitor: {
      isNativePlatform: () => true,
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: "granted" }),
      checkExactNotificationSetting: async () => ({
        exact_alarm: "granted",
      }),
      createChannel: async () => {},
      listChannels: async () => ({
        channels: [
          { id: "daily-route-notifications-v1", importance: 4 },
          { id: "daily-route-alarms-v1", importance: 5 },
        ],
      }),
      getPending: async () => ({
        notifications: [
          {
            id: 42,
            extra: { kind: "daily-route-reminder" },
          },
        ],
      }),
      cancel: async ({ notifications }) => {
        cancelled.push(...notifications.map((item) => item.id));
      },
      schedule: async ({ notifications }) => {
        scheduled.push(...notifications);
      },
    },
  };
  try {
    const at = new Date(Date.now() + 10 * 60 * 1000);
    const status = await syncScheduledNotifications([], {
      focusCompletion: {
        sessionId: "run-2",
        title: "背单词",
        at,
      },
    });
    assert.deepEqual(cancelled, [42]);
    assert.equal(status.scheduled, 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].extra.activityKind, "focusCompletion");
    assert.equal(scheduled[0].extra.focusSessionId, "run-2");
    assert.equal(scheduled[0].channelId, "daily-route-notifications-v1");
  } finally {
    delete globalThis.DailyRouteNative;
  }
});
