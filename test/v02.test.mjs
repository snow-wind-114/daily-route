import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocalAccount,
  normalizeAccountRecord,
  updateAccountPassword,
  validateAccountInput,
  verifyAccountPassword,
} from "../account.js";
import {
  makeNativeStatePayload,
  normalizeNativeState,
  readNativeState,
  writeNativeState,
} from "../app-state.js";
import {
  createBackup,
  parseBackup,
} from "../backup.js";
import {
  buildReminderPlan,
} from "../notifications.js";
import {
  findConflictWithinRange,
  seriesFromInput,
} from "../schedule.js";

function makeSeries(overrides = {}) {
  return seriesFromInput({
    title: "项目会议",
    date: "2026-11-16",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 1,
    repeatCount: 1,
    notes: "带电脑",
    reminderEnabled: true,
    reminderMinutesBefore: 5,
    ...overrides,
  });
}

function makeMemoryStorage() {
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

test("local account hashes passwords and verifies them", async () => {
  const account = await createLocalAccount(
    { username: "  小风  ", password: "secret123" },
    { iterations: 1000, now: new Date("2026-11-15T00:00:00Z") },
  );

  assert.equal(account.username, "小风");
  assert.notEqual(account.passwordHash, "secret123");
  assert.equal(account.passwordIterations, 1000);
  assert.equal(normalizeAccountRecord(account)?.username, "小风");
  assert.equal(
    await verifyAccountPassword(account, "secret123"),
    true,
  );
  assert.equal(
    await verifyAccountPassword(account, "wrong-password"),
    false,
  );

  const changed = await updateAccountPassword(
    account,
    "new-secret",
    { iterations: 1000 },
  );
  assert.equal(await verifyAccountPassword(changed, "secret123"), false);
  assert.equal(await verifyAccountPassword(changed, "new-secret"), true);
  assert.equal(changed.createdAt, account.createdAt);
});

test("account validation enforces username, password and confirmation", () => {
  assert.equal(
    validateAccountInput("a", "secret123", "secret123"),
    "账户名必须是 2–64 个字符",
  );
  assert.equal(
    validateAccountInput("小风", "123", "123"),
    "密码必须是 6–64 个字符",
  );
  assert.equal(
    validateAccountInput("小风", "secret123", "secret456"),
    "两次输入的密码不一致",
  );
  assert.equal(
    validateAccountInput("小风", "secret123", "secret123"),
    null,
  );
});

test("native v2 state preserves account, session and reminder fields", async () => {
  const account = await createLocalAccount(
    { username: "小风", password: "secret123" },
    { iterations: 1000 },
  );
  const event = makeSeries();
  const payload = makeNativeStatePayload({
    account,
    sessionActive: true,
    events: [event],
  });
  const state = normalizeNativeState(payload);

  assert.equal(state.sessionActive, true);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].reminderEnabled, true);
  assert.equal(state.events[0].reminderMinutesBefore, 5);
  assert.equal(normalizeNativeState({ ...payload, version: 1 }), null);
});

test("native storage distinguishes empty and corrupt data", async () => {
  const storage = makeMemoryStorage();
  assert.equal(readNativeState(storage).status, "empty");

  storage.setItem("daily-route.storage.v2", "{broken");
  assert.equal(readNativeState(storage).status, "corrupt");

  const account = await createLocalAccount(
    { username: "小风", password: "secret123" },
    { iterations: 1000 },
  );
  writeNativeState(
    { account, sessionActive: false, events: [] },
    storage,
  );
  const loaded = readNativeState(storage);
  assert.equal(loaded.status, "ok");
  assert.equal(loaded.state.account.username, "小风");
  assert.equal(loaded.state.sessionActive, false);
});

test("backup round trip contains events but never account credentials", () => {
  const backup = createBackup([makeSeries()], {
    appVersion: "0.2.0",
    now: new Date("2026-11-15T01:00:00Z"),
  });
  const text = JSON.stringify(backup);
  const parsed = parseBackup(text);

  assert.equal(parsed.eventCount, 1);
  assert.equal(parsed.events[0].title, "项目会议");
  assert.equal("account" in parsed, false);
  assert.equal(text.includes("passwordHash"), false);
  assert.throws(
    () => parseBackup(JSON.stringify({ ...backup, eventCount: 2 })),
    /数量校验失败/,
  );
});

test("reminder plan uses local occurrence time and skips elapsed reminders", () => {
  const event = makeSeries({
    repeatEvery: 2,
    repeatCount: 3,
  });
  const plan = buildReminderPlan([event], {
    startDate: "2026-11-16",
    endDate: "2026-11-20",
    now: new Date(2026, 10, 16, 14, 30),
  });

  assert.equal(plan.length, 2);
  assert.equal(plan[0].occurrenceDate, "2026-11-18");
  assert.equal(plan[0].at.getTime(), new Date(2026, 10, 18, 14, 25).getTime());
  assert.match(plan[0].body, /14:30–15:50/);
});

test("disabled reminders do not create notification plans", () => {
  const event = makeSeries({ reminderEnabled: false });
  const plan = buildReminderPlan([event], {
    startDate: "2026-11-16",
    endDate: "2026-11-16",
    now: new Date(2026, 10, 15, 0, 0),
  });
  assert.deepEqual(plan, []);
});

test("import conflict scan catches overlaps across different series", () => {
  const first = makeSeries();
  const second = makeSeries({
    title: "重叠会议",
    startTime: "15:00",
    endTime: "16:00",
  });
  const conflict = findConflictWithinRange(
    [first, second],
    "2026-11-16",
    "2026-11-16",
  );

  assert.equal(conflict?.date, "2026-11-16");
  assert.equal(conflict?.secondSeries.title, "重叠会议");
});
