import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonthsClamped,
  diffCalendarDays,
  getScheduleWindow,
} from "../date-utils.js";
import {
  deleteOccurrenceAndFuture,
  findScheduleConflict,
  lastOccurrenceOnOrBefore,
  occupancyByDayBetween,
  occurrencesBetween,
  occurrencesOnDate,
  remainingRepeatCount,
  seriesFromInput,
  splitSeriesForEdit,
  validateActivityInput,
} from "../schedule.js";

function makeSeries(overrides = {}) {
  return seriesFromInput({
    title: "高数课",
    date: "2026-11-01",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 2,
    repeatCount: 5,
    notes: "",
    ...overrides,
  });
}

test("six-month window ends the day before the same date six months later", () => {
  assert.deepEqual(getScheduleWindow("2026-11-13"), {
    startDate: "2026-11-13",
    endDate: "2027-05-12",
  });
  assert.equal(addMonthsClamped("2026-08-31", 6), "2027-02-28");
});

test("calendar difference is not affected by daylight-saving time", () => {
  assert.equal(diffCalendarDays("2026-11-01", "2026-11-03"), 2);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("repeat count includes the first occurrence", () => {
  const event = makeSeries();
  assert.deepEqual(
    occurrencesBetween([event], "2026-11-01", "2026-11-20").map(
      (item) => item.date,
    ),
    [
      "2026-11-01",
      "2026-11-03",
      "2026-11-05",
      "2026-11-07",
      "2026-11-09",
    ],
  );
  assert.equal(occurrencesOnDate([event], "2026-11-08").length, 0);
});

test("infinite repeat is computed only inside the requested range", () => {
  const event = makeSeries({ repeatCount: null, repeatEvery: 7 });
  const occurrences = occurrencesBetween(
    [event],
    "2026-11-15",
    "2026-12-20",
  );
  assert.deepEqual(
    occurrences.map((item) => item.date),
    ["2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"],
  );
});

test("editing this and future preserves earlier occurrences and splits the series", () => {
  const event = makeSeries({ repeatCount: null });
  const before = remainingRepeatCount(event, "2026-11-01");
  assert.equal(before, null);

  const edited = splitSeriesForEdit(
    [event],
    event.id,
    "2026-11-05",
    {
      title: "新安排",
      date: "2026-11-05",
      startTime: "16:00",
      endTime: "17:00",
      repeatEvery: 2,
      repeatCount: 3,
      notes: "更新后",
    },
  );

  assert.equal(edited.length, 2);
  assert.deepEqual(
    occurrencesBetween(edited, "2026-11-01", "2026-11-12").map((item) => ({
      date: item.date,
      title: item.series.title,
      time: item.series.startTime,
    })),
    [
      { date: "2026-11-01", title: "高数课", time: "14:30" },
      { date: "2026-11-03", title: "高数课", time: "14:30" },
      { date: "2026-11-05", title: "新安排", time: "16:00" },
      { date: "2026-11-07", title: "新安排", time: "16:00" },
      { date: "2026-11-09", title: "新安排", time: "16:00" },
    ],
  );
});

test("editing the first occurrence updates the whole series", () => {
  const event = makeSeries();
  const edited = splitSeriesForEdit(
    [event],
    event.id,
    "2026-11-01",
    {
      title: "新名称",
      date: "2026-11-01",
      startTime: "14:30",
      endTime: "15:50",
      repeatEvery: 2,
      repeatCount: 5,
      notes: "",
    },
  );

  assert.equal(edited.length, 1);
  assert.equal(edited[0].id, event.id);
  assert.equal(edited[0].title, "新名称");
  assert.equal(
    occurrencesBetween(edited, "2026-11-01", "2026-11-20").length,
    5,
  );
});

test("deleting this and future keeps previous occurrences", () => {
  const event = makeSeries();
  const remaining = deleteOccurrenceAndFuture(
    [event],
    event.id,
    "2026-11-05",
  );

  assert.deepEqual(
    occurrencesBetween(remaining, "2026-11-01", "2026-11-20").map(
      (item) => item.date,
    ),
    ["2026-11-01", "2026-11-03"],
  );
});

test("month occupancy marks every overlapping two-hour slot", () => {
  const first = makeSeries({
    date: "2026-11-01",
    startTime: "14:30",
    endTime: "15:50",
    repeatCount: 1,
  });
  const second = makeSeries({
    title: "晚课",
    date: "2026-11-01",
    startTime: "15:30",
    endTime: "18:05",
    repeatCount: 1,
  });
  const occupancy = occupancyByDayBetween(
    [first, second],
    "2026-11-01",
    "2026-11-01",
  ).get("2026-11-01");

  assert.equal(occupancy.count, 2);
  assert.deepEqual(
    occupancy.slots
      .map((occupied, index) => (occupied ? index : null))
      .filter((index) => index !== null),
    [7, 8, 9],
  );
});

test("last occurrence is limited by count and split boundary", () => {
  const finite = makeSeries();
  assert.equal(lastOccurrenceOnOrBefore(finite, "2026-11-30"), "2026-11-09");

  const splitInfinite = {
    ...makeSeries({ repeatCount: null }),
    endBefore: "2026-11-06",
  };
  assert.equal(
    lastOccurrenceOnOrBefore(splitInfinite, "2026-11-30"),
    "2026-11-05",
  );
});

test("overlapping occurrences are rejected but touching times are allowed", () => {
  const existing = makeSeries({
    title: "高数课",
    date: "2026-11-13",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 1,
    repeatCount: 3,
  });
  const overlapping = makeSeries({
    title: "项目会议",
    date: "2026-11-13",
    startTime: "15:00",
    endTime: "16:20",
    repeatCount: 1,
  });
  const touching = makeSeries({
    title: "答疑",
    date: "2026-11-13",
    startTime: "15:50",
    endTime: "16:30",
    repeatCount: 1,
  });

  const conflict = findScheduleConflict(
    [existing],
    overlapping,
    "2026-11-13",
    "2027-05-12",
  );
  assert.equal(conflict?.date, "2026-11-13");
  assert.equal(conflict?.existingSeries.title, "高数课");
  assert.equal(
    findScheduleConflict(
      [existing],
      touching,
      "2026-11-13",
      "2027-05-12",
    ),
    null,
  );
});

test("a recurring series catches overlaps on later occurrences", () => {
  const existing = makeSeries({
    date: "2026-11-13",
    startTime: "14:30",
    endTime: "15:50",
    repeatEvery: 2,
    repeatCount: 5,
  });
  const candidate = makeSeries({
    title: "单次会议",
    date: "2026-11-15",
    startTime: "14:30",
    endTime: "15:00",
    repeatCount: 1,
  });

  assert.equal(
    findScheduleConflict(
      [existing],
      candidate,
      "2026-11-13",
      "2027-05-12",
    )?.date,
    "2026-11-15",
  );
});

test("editing a series ignores its own previous occurrences", () => {
  const existing = makeSeries();
  assert.equal(
    findScheduleConflict(
      [existing],
      existing,
      "2026-11-01",
      "2027-05-12",
      existing.id,
    ),
    null,
  );
});

test("input rejects cross-midnight and out-of-range repeat values", () => {
  const base = {
    title: "会议",
    date: "2026-11-13",
    startTime: "23:30",
    endTime: "23:50",
    repeatEvery: 1,
    repeatCount: 1,
    notes: "",
  };
  const window = getScheduleWindow("2026-11-13");

  assert.equal(
    validateActivityInput(
      { ...base, endTime: "00:30" },
      { ...window, minimumDate: window.startDate },
    ),
    "结束时间必须晚于开始时间，且活动不能跨午夜",
  );
  assert.equal(
    validateActivityInput(
      { ...base, repeatEvery: 15 },
      { ...window, minimumDate: window.startDate },
    ),
    "重复间隔必须是 1–14 天",
  );
});
