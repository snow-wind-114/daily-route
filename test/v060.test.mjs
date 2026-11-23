import test from "node:test";
import assert from "node:assert/strict";
import {
  addCategory,
  categoryName,
  checkinFromInput,
} from "../activities.js";
import {
  NATIVE_STORAGE_KEY,
  PREVIOUS_NATIVE_STORAGE_KEY,
  PREVIOUS_NATIVE_STORAGE_VERSION,
  migrateNativeState,
} from "../app-state.js";
import {
  readActivityDrafts,
  removeActivityDraft,
  writeActivityDraft,
} from "../drafts.js";
import {
  addFocusProjectTime,
  createFocusPassword,
  createFocusRun,
  focusFlowDurationMinutes,
  focusProjectFromInput,
  focusTotalSeconds,
  focusFlowFromInput,
  normalizeFocusState,
  readFocusSession,
  verifyFocusPassword,
  writeFocusSession,
} from "../focus.js";
import { createLocalAccount } from "../account.js";
import { createBackup, parseBackup } from "../backup.js";
import { seriesFromInput } from "../schedule.js";
import {
  migrationCategoryGroups,
} from "../year-migration.js";

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

function schedule(categoryId = "legacy") {
  return seriesFromInput({
    title: "课程",
    date: "2026-11-23",
    startTime: "09:00",
    endTime: "10:00",
    repeatEvery: 1,
    repeatCount: 2,
    notes: "",
    reminderMode: "none",
    reminderMinutesBefore: 5,
    categoryId,
  });
}

test("v5 native storage migrates to v6 and clears categories", async () => {
  const storage = memoryStorage();
  const account = await createLocalAccount(
    { username: "小风", password: "secret123" },
    { iterations: 1000 },
  );
  storage.setItem(
    PREVIOUS_NATIVE_STORAGE_KEY,
    JSON.stringify({
      version: PREVIOUS_NATIVE_STORAGE_VERSION,
      account,
      sessionActive: true,
      events: [schedule()],
      categories: {
        schedule: [{ id: "legacy", name: "旧分类" }],
        todo: [],
        checkin: [],
      },
      yearMigrationCompletedFor: 2026,
      reviewEntries: [],
      reviewReminder: { enabled: false, time: "21:30" },
    }),
  );
  const migrated = migrateNativeState(storage);
  assert.equal(migrated.status, "ok");
  assert.equal(migrated.state.version, 6);
  assert.deepEqual(migrated.state.categories, []);
  assert.equal(migrated.state.events[0].categoryId, null);
  assert.deepEqual(migrated.state.focusProjects, []);
  assert.equal(JSON.parse(storage.getItem(NATIVE_STORAGE_KEY)).version, 6);
});

test("v6 backup keeps global categories and focus data but omits secrets and images", () => {
  const projects = [
    focusProjectFromInput({
      title: "背单词",
      type: "focus",
      durationMinutes: 25,
      notes: "",
    }),
    focusProjectFromInput({
      title: "休息",
      type: "rest",
      durationMinutes: 5,
      notes: "",
    }),
  ];
  const flow = focusFlowFromInput(
    {
      title: "单词循环",
      notes: "",
      steps: [
        { projectId: projects[0].id, durationMinutes: 25 },
        { projectId: projects[1].id, durationMinutes: 5 },
      ],
    },
    projects,
  );
  const backup = createBackup([schedule("study")], {
    categories: [{ id: "study", name: "考研" }],
    focusProjects: projects,
    focusFlows: [flow],
    focusQuotes: [{ id: "q", text: "保持专注", createdAt: new Date().toISOString() }],
    focusWallpapers: [
      { id: "w", name: "桌面.jpg", createdAt: new Date().toISOString() },
    ],
    now: new Date("2026-11-23T00:00:00.000Z"),
  });
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.version, 6);
  assert.equal(parsed.categories[0].name, "考研");
  assert.equal(parsed.focusProjects.length, 2);
  assert.equal(parsed.focusFlows.length, 1);
  assert.equal(parsed.focusWallpapers.length, 1);
  assert.equal(JSON.stringify(parsed).includes("passwordHash"), false);
  assert.equal(JSON.stringify(parsed).includes("data:image"), false);
});

test("v1-v5 backup categories are discarded into uncategorized activities", () => {
  const backup = createBackup([schedule("legacy")], {
    categories: [{ id: "legacy", name: "旧分类" }],
    now: new Date("2026-11-23T00:00:00.000Z"),
  });
  const parsed = parseBackup(
    JSON.stringify({
      ...backup,
      version: 5,
      categories: { schedule: [{ id: "legacy", name: "旧分类" }] },
    }),
  );
  assert.deepEqual(parsed.categories, []);
  assert.equal(parsed.events[0].categoryId, null);
});

test("global categories can hold multiple activity kinds and drive migration groups", () => {
  const categories = addCategory([], "考研");
  const category = categories[0];
  assert.equal(categoryName(categories, category.id), "考研");
  const regular = schedule(category.id);
  const reading = checkinFromInput(
    {
      title: "阅读",
      notes: "",
      checkInDates: [],
      reminderMode: "none",
      reminderTime: "21:00",
    },
    { year: 2026, categoryId: category.id },
  );
  const groups = migrationCategoryGroups(
    [regular, reading],
    categories,
    2027,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].categoryName, "考研");
  assert.deepEqual(
    groups[0].activities.map((item) => item.kind).sort(),
    ["checkin", "schedule"],
  );
});

test("activity drafts remain independent and can be removed", () => {
  const storage = memoryStorage();
  writeActivityDraft(
    "schedule",
    { title: "课程草稿", date: "2026-11-24" },
    storage,
  );
  writeActivityDraft(
    "todo",
    { title: "待办草稿", deadlineDate: "2026-11-25" },
    storage,
  );
  let drafts = readActivityDrafts(storage);
  assert.equal(drafts.schedule.title, "课程草稿");
  assert.equal(drafts.todo.title, "待办草稿");
  assert.equal(drafts.checkin, null);
  drafts = removeActivityDraft("schedule", storage);
  assert.equal(drafts.schedule, null);
  assert.equal(drafts.todo.title, "待办草稿");
});

test("focus projects accumulate focus and rest time separately", () => {
  const focusProject = focusProjectFromInput({
    title: "学习",
    type: "focus",
    durationMinutes: 25,
    notes: "",
  });
  const restProject = focusProjectFromInput({
    title: "休息",
    type: "rest",
    durationMinutes: 5,
    notes: "",
  });
  let projects = addFocusProjectTime(
    [focusProject, restProject],
    focusProject.id,
    600,
    { completed: true },
  );
  projects = addFocusProjectTime(
    projects,
    restProject.id,
    120,
    { completed: true },
  );
  assert.equal(projects[0].accumulatedSeconds, 600);
  assert.equal(projects[0].completedRuns, 1);
  assert.equal(projects[1].accumulatedSeconds, 120);
  assert.equal(focusTotalSeconds(projects), 600);
});

test("focus flow steps preserve overrides and build a runnable sequence", () => {
  const focusProject = focusProjectFromInput({
    title: "学习",
    type: "focus",
    durationMinutes: 25,
    notes: "",
  });
  const restProject = focusProjectFromInput({
    title: "休息",
    type: "rest",
    durationMinutes: 5,
    notes: "",
  });
  const flow = focusFlowFromInput(
    {
      title: "番茄流程",
      notes: "",
      steps: [
        { projectId: focusProject.id, durationMinutes: 20 },
        { projectId: restProject.id, durationMinutes: 4 },
      ],
    },
    [focusProject, restProject],
  );
  assert.equal(focusFlowDurationMinutes(flow, [focusProject, restProject]), 24);
  const run = createFocusRun({
    flow,
    projects: [focusProject, restProject],
  });
  assert.equal(run.steps.length, 2);
  assert.equal(run.steps[0].durationSeconds, 1200);
  assert.equal(run.steps[1].type, "rest");
});

test("focus password hashes, verifies and restores paused sessions", async () => {
  const record = await createFocusPassword("study123", {
    iterations: 1000,
  });
  assert.equal(await verifyFocusPassword(record, "study123"), true);
  assert.equal(await verifyFocusPassword(record, "wrong"), false);
  const normalized = normalizeFocusState({ focusPassword: record });
  assert.ok(normalized.focusPassword.passwordHash);

  const storage = memoryStorage();
  writeFocusSession(
    {
      version: 1,
      id: "run",
      title: "测试",
      status: "running",
      steps: [
        {
          projectId: "project",
          title: "学习",
          type: "focus",
          durationSeconds: 60,
        },
      ],
      stepIndex: 0,
      stepElapsedSeconds: 12,
      currentStepStartedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    storage,
  );
  const restored = readFocusSession(storage);
  assert.equal(restored.status, "paused");
  assert.equal(restored.stepElapsedSeconds, 12);
});
