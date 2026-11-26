import assert from "node:assert/strict";
import test from "node:test";
import { createBackup, parseBackup } from "../backup.js";
import {
  addFocusProjectTime,
  focusProjectFromInput,
  normalizeFocusHistory,
  normalizeFocusProject,
} from "../focus.js";

function project() {
  return focusProjectFromInput({
    title: "刷真题",
    type: "focus",
    durationMinutes: 25,
    notes: "",
  });
}

test("focus daily history merges by local date and keeps completion counts", () => {
  const initial = project();
  const first = addFocusProjectTime(
    [initial],
    initial.id,
    600,
    {
      completed: true,
      now: new Date(2026, 10, 26, 9, 0),
    },
  );
  const sameDay = addFocusProjectTime(
    first,
    initial.id,
    90,
    {
      completed: false,
      now: new Date(2026, 10, 26, 20, 0),
    },
  );
  const nextDay = addFocusProjectTime(
    sameDay,
    initial.id,
    300,
    {
      completed: true,
      now: new Date(2026, 10, 27, 8, 0),
    },
  );
  assert.deepEqual(nextDay[0].dailyHistory, [
    {
      date: "2026-11-26",
      seconds: 690,
      completedRuns: 1,
    },
    {
      date: "2026-11-27",
      seconds: 300,
      completedRuns: 1,
    },
  ]);
});

test("focus history normalization deduplicates dates and rejects invalid rows", () => {
  assert.deepEqual(
    normalizeFocusHistory([
      { date: "2026-11-26", seconds: 30, completedRuns: 0 },
      { date: "2026-11-26", seconds: 40, completedRuns: 1 },
      { date: "2026-02-30", seconds: 20, completedRuns: 1 },
      { date: "invalid", seconds: 5, completedRuns: 1 },
    ]),
    [
      {
        date: "2026-11-26",
        seconds: 70,
        completedRuns: 1,
      },
    ],
  );
});

test("editing a focus project preserves its daily calendar history", () => {
  const original = normalizeFocusProject({
    ...project(),
    dailyHistory: [
      { date: "2026-11-26", seconds: 120, completedRuns: 1 },
    ],
  });
  const edited = focusProjectFromInput(
    {
      title: "刷真题第二轮",
      type: "focus",
      durationMinutes: 30,
      notes: "保留记录",
    },
    original,
  );
  assert.equal(edited.dailyHistory.length, 1);
  assert.deepEqual(edited.dailyHistory, original.dailyHistory);
});

test("v6 backup round trip keeps focus daily history", () => {
  const item = normalizeFocusProject({
    ...project(),
    dailyHistory: [
      { date: "2026-11-26", seconds: 600, completedRuns: 1 },
    ],
  });
  const parsed = parseBackup(
    JSON.stringify(
      createBackup([], {
        focusProjects: [item],
        now: new Date("2026-11-26T00:00:00.000Z"),
      }),
    ),
  );
  assert.deepEqual(
    parsed.focusProjects[0].dailyHistory,
    item.dailyHistory,
  );
});
