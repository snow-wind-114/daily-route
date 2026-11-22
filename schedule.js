import {
  addDays,
  diffCalendarDays,
  isISODate,
  isWithinWindow,
  timeToMinutes,
} from "./date-utils.js";

export const STORAGE_VERSION = 2;
export const MAX_REPEAT_EVERY = 14;
export const MAX_REPEAT_COUNT = 20;
export const OCCUPANCY_SLOT_MINUTES = 120;
export const DEFAULT_REMINDER_MINUTES = 5;
export const MAX_REMINDER_MINUTES = 1440;
export const REMINDER_MODES = Object.freeze([
  "none",
  "notification",
  "alarm",
]);

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function integerInRange(value, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function normalizeReminderMode(rawMode, legacyEnabled) {
  if (REMINDER_MODES.includes(rawMode)) {
    return rawMode;
  }
  return legacyEnabled === true ? "notification" : "none";
}

function normalizeReminderMinutes(value) {
  return (
    integerInRange(value, 0, MAX_REMINDER_MINUTES) ??
    DEFAULT_REMINDER_MINUTES
  );
}

function normalizeOverride(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const startMinutes = timeToMinutes(raw.startTime);
  const endMinutes = timeToMinutes(raw.endTime);
  if (
    !title ||
    !isISODate(raw.occurrenceDate) ||
    !isISODate(raw.date) ||
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  return {
    occurrenceDate: raw.occurrenceDate,
    title: title.slice(0, 80),
    date: raw.date,
    startTime: raw.startTime,
    endTime: raw.endTime,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 500) : "",
    reminderMode: normalizeReminderMode(raw.reminderMode, raw.reminderEnabled),
    reminderMinutesBefore: normalizeReminderMinutes(
      raw.reminderMinutesBefore,
    ),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

function normalizeOverrides(rawOverrides) {
  if (!Array.isArray(rawOverrides)) {
    return [];
  }

  const byDate = new Map();
  for (const raw of rawOverrides) {
    const override = normalizeOverride(raw);
    if (override) {
      byDate.set(override.occurrenceDate, override);
    }
  }
  return [...byDate.values()].sort((left, right) =>
    left.occurrenceDate.localeCompare(right.occurrenceDate),
  );
}

export function normalizePauses(rawPauses) {
  if (!Array.isArray(rawPauses)) {
    return [];
  }

  const pauses = rawPauses
    .map((raw) => {
      if (!raw || !isISODate(raw.startDate)) {
        return null;
      }
      const endDate =
        raw.endDate === null || raw.endDate === undefined
          ? null
          : isISODate(raw.endDate) && raw.endDate >= raw.startDate
            ? raw.endDate
            : null;
      return { startDate: raw.startDate, endDate };
    })
    .filter(Boolean)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  const merged = [];
  for (const pause of pauses) {
    const previous = merged.at(-1);
    if (!previous) {
      merged.push(pause);
      continue;
    }

    const previousEnd = previous.endDate;
    const touches =
      previousEnd === null ||
      pause.startDate <= addDays(previousEnd, 1);
    if (!touches) {
      merged.push(pause);
      continue;
    }

    if (previousEnd !== null) {
      previous.endDate =
        pause.endDate === null
          ? null
          : [previousEnd, pause.endDate].sort().at(-1);
    }
  }

  return merged;
}

export function normalizeSeries(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const repeatEvery = integerInRange(
    raw.repeatEvery,
    1,
    MAX_REPEAT_EVERY,
  );
  const repeatCount =
    raw.repeatCount === null
      ? null
      : integerInRange(raw.repeatCount, 1, MAX_REPEAT_COUNT);
  const startMinutes = timeToMinutes(raw.startTime);
  const endMinutes = timeToMinutes(raw.endTime);

  if (
    !title ||
    !isISODate(raw.date) ||
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes ||
    repeatEvery === null ||
    (raw.repeatCount !== null && repeatCount === null)
  ) {
    return null;
  }

  const endBefore =
    raw.endBefore === undefined || raw.endBefore === null
      ? null
      : isISODate(raw.endBefore)
        ? raw.endBefore
        : null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    kind: "schedule",
    title: title.slice(0, 80),
    date: raw.date,
    startTime: raw.startTime,
    endTime: raw.endTime,
    repeatEvery,
    repeatCount,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 500) : "",
    reminderMode: normalizeReminderMode(
      raw.reminderMode,
      raw.reminderEnabled,
    ),
    reminderMinutesBefore: normalizeReminderMinutes(
      raw.reminderMinutesBefore,
    ),
    occurrenceOverrides: normalizeOverrides(raw.occurrenceOverrides),
    pauses: normalizePauses(raw.pauses),
    endBefore,
    categoryId:
      typeof raw.categoryId === "string" && raw.categoryId
        ? raw.categoryId
        : null,
    year:
      Number.isInteger(Number(raw.year)) &&
      Number(raw.year) >= 1900 &&
      Number(raw.year) <= 9999
        ? Number(raw.year)
        : Number(raw.date.slice(0, 4)),
    archivedAt:
      typeof raw.archivedAt === "string" ? raw.archivedAt : null,
    archiveReason:
      typeof raw.archiveReason === "string" ? raw.archiveReason : null,
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function validateActivityInput(
  input,
  { startDate, endDate, minimumDate = startDate },
) {
  const title = String(input.title ?? "").trim();
  if (!title) {
    return "请填写活动名称";
  }

  if (!isWithinWindow(input.date, startDate, endDate)) {
    return "日期必须位于当前自然年内";
  }

  if (input.date < minimumDate) {
    return "修改后的日期不能早于所选活动日期";
  }

  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  if (startMinutes === null || endMinutes === null) {
    return "请填写有效的开始和结束时间";
  }

  if (endMinutes <= startMinutes) {
    return "结束时间必须晚于开始时间，且活动不能跨午夜";
  }

  if (integerInRange(input.repeatEvery, 1, MAX_REPEAT_EVERY) === null) {
    return "重复间隔必须是 1–14 天";
  }

  if (
    input.repeatCount !== null &&
    integerInRange(input.repeatCount, 1, MAX_REPEAT_COUNT) === null
  ) {
    return "重复次数必须是 1–20 次或无限次";
  }

  if (
    input.reminderMode !== "none" &&
    integerInRange(
      input.reminderMinutesBefore,
      0,
      MAX_REMINDER_MINUTES,
    ) === null
  ) {
    return "提醒时间必须是 0–1440 分钟";
  }

  return null;
}

export function seriesFromInput(input, { id, createdAt } = {}) {
  const now = new Date().toISOString();
  return normalizeSeries({
    id: id ?? createId(),
    title: input.title,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    repeatEvery: Number(input.repeatEvery),
    repeatCount: input.repeatCount === null ? null : Number(input.repeatCount),
    notes: input.notes,
    categoryId: input.categoryId ?? null,
    year: Number(input.date?.slice(0, 4)) || null,
    reminderMode: input.reminderMode,
    reminderMinutesBefore:
      input.reminderMinutesBefore ?? DEFAULT_REMINDER_MINUTES,
    occurrenceOverrides: [],
    pauses: [],
    endBefore: null,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
}

function isNominalOccurrenceDate(series, occurrenceDate) {
  if (!isISODate(occurrenceDate) || occurrenceDate < series.date) {
    return false;
  }
  if (occurrenceDate > `${series.date.slice(0, 4)}-12-31`) {
    return false;
  }
  if (series.endBefore && occurrenceDate >= series.endBefore) {
    return false;
  }

  const rawIndex = diffCalendarDays(series.date, occurrenceDate);
  return rawIndex % series.repeatEvery === 0;
}

export function isDatePaused(series, date) {
  return series.pauses.some(
    (pause) =>
      date >= pause.startDate &&
      (pause.endDate === null || date <= pause.endDate),
  );
}

export function isSeriesPaused(series) {
  return series.pauses.some((pause) => pause.endDate === null);
}

export function getOccurrenceIndex(series, occurrenceDate) {
  if (!isNominalOccurrenceDate(series, occurrenceDate)) {
    return null;
  }

  let candidate = series.date;
  let activeIndex = 0;
  while (candidate <= occurrenceDate) {
    if (!isDatePaused(series, candidate)) {
      if (series.repeatCount !== null && activeIndex >= series.repeatCount) {
        return null;
      }
      if (candidate === occurrenceDate) {
        return activeIndex;
      }
      activeIndex += 1;
    }
    candidate = addDays(candidate, series.repeatEvery);
  }

  return null;
}

export function remainingRepeatCount(series, occurrenceDate) {
  if (series.repeatCount === null) {
    return null;
  }

  const index = getOccurrenceIndex(series, occurrenceDate);
  return index === null ? 0 : Math.max(0, series.repeatCount - index);
}

function effectiveSeriesForOccurrence(series, candidate) {
  const override = series.occurrenceOverrides.find(
    (item) => item.occurrenceDate === candidate,
  );
  if (!override) {
    return {
      effectiveSeries: { ...series, date: candidate },
      override: null,
    };
  }

  return {
    override,
    effectiveSeries: {
      ...series,
      title: override.title,
      date: override.date,
      startTime: override.startTime,
      endTime: override.endTime,
      notes: override.notes,
      reminderMode: override.reminderMode,
      reminderMinutesBefore: override.reminderMinutesBefore,
      occurrenceOverrides: [],
      pauses: [],
    },
  };
}

export function occurrencesBetween(events, startDate, endDate) {
  const occurrences = [];
  if (!isISODate(startDate) || !isISODate(endDate) || startDate > endDate) {
    return occurrences;
  }

  for (const series of events) {
    if (series.kind && series.kind !== "schedule") {
      continue;
    }
    if (series.archivedAt) {
      continue;
    }
    if (series.date > endDate) {
      continue;
    }
    const seriesEnd = `${series.date.slice(0, 4)}-12-31`;
    const visibleEnd = seriesEnd < endDate ? seriesEnd : endDate;
    if (startDate > visibleEnd) {
      continue;
    }
    if (series.endBefore && startDate >= series.endBefore) {
      continue;
    }

    let candidate = series.date;
    let activeIndex = 0;
    while (candidate <= visibleEnd) {
      if (series.endBefore && candidate >= series.endBefore) {
        break;
      }
      if (series.repeatCount !== null && activeIndex >= series.repeatCount) {
        break;
      }
      if (isDatePaused(series, candidate)) {
        candidate = addDays(candidate, series.repeatEvery);
        continue;
      }

      const { effectiveSeries, override } = effectiveSeriesForOccurrence(
        series,
        candidate,
      );
      if (candidate >= startDate || effectiveSeries.date >= startDate) {
        if (
          effectiveSeries.date >= startDate &&
          effectiveSeries.date <= visibleEnd
        ) {
          occurrences.push({
            series: effectiveSeries,
            originalSeries: series,
            date: effectiveSeries.date,
            originalDate: candidate,
            occurrenceIndex: activeIndex,
            override,
          });
        }
      }

      activeIndex += 1;
      candidate = addDays(candidate, series.repeatEvery);
    }
  }

  return occurrences.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      timeToMinutes(left.series.startTime) -
        timeToMinutes(right.series.startTime) ||
      left.series.title.localeCompare(right.series.title, "zh-CN"),
  );
}

export function occurrencesOnDate(events, date) {
  return occurrencesBetween(events, date, date);
}

function normalizeConflictIgnore(ignore) {
  if (typeof ignore === "string") {
    return { seriesId: ignore, originalDate: null };
  }
  return {
    seriesId: ignore?.seriesId ?? null,
    originalDate: ignore?.originalDate ?? null,
  };
}

export function findScheduleConflict(
  events,
  candidate,
  startDate,
  endDate,
  ignore = null,
) {
  const ignored = normalizeConflictIgnore(ignore);

  for (const occurrence of occurrencesBetween(
    [candidate],
    startDate,
    endDate,
  )) {
    const existingOccurrences = occurrencesOnDate(events, occurrence.date);
    const candidateStart = timeToMinutes(occurrence.series.startTime);
    const candidateEnd = timeToMinutes(occurrence.series.endTime);

    for (const existing of existingOccurrences) {
      if (
        existing.series.id === ignored.seriesId &&
        (ignored.originalDate === null ||
          existing.originalDate === ignored.originalDate)
      ) {
        continue;
      }

      const existingStart = timeToMinutes(existing.series.startTime);
      const existingEnd = timeToMinutes(existing.series.endTime);
      if (candidateStart < existingEnd && candidateEnd > existingStart) {
        return {
          date: occurrence.date,
          candidateSeries: occurrence.series,
          existingSeries: existing.series,
        };
      }
    }
  }

  return null;
}

export function findConflictWithinRange(events, startDate, endDate) {
  const occurrences = occurrencesBetween(events, startDate, endDate).sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      timeToMinutes(left.series.startTime) -
        timeToMinutes(right.series.startTime),
  );
  const activeByDate = new Map();

  for (const occurrence of occurrences) {
    const start = timeToMinutes(occurrence.series.startTime);
    const end = timeToMinutes(occurrence.series.endTime);
    const active = activeByDate.get(occurrence.date) ?? [];

    for (const existing of active) {
      const existingStart = timeToMinutes(existing.series.startTime);
      const existingEnd = timeToMinutes(existing.series.endTime);
      if (start < existingEnd && end > existingStart) {
        return {
          date: occurrence.date,
          firstSeries: existing.series,
          secondSeries: occurrence.series,
        };
      }
    }

    active.push(occurrence);
    activeByDate.set(occurrence.date, active);
  }

  return null;
}

export function busyDaysBetween(events, startDate, endDate) {
  return new Map(
    [...occupancyByDayBetween(events, startDate, endDate)].map(
      ([date, occupancy]) => [date, occupancy.count],
    ),
  );
}

export function occupancyByDayBetween(events, startDate, endDate) {
  const occupancy = new Map();

  for (const occurrence of occurrencesBetween(events, startDate, endDate)) {
    const day =
      occupancy.get(occurrence.date) ??
      {
        count: 0,
        slots: Array.from(
          { length: 24 * 60 / OCCUPANCY_SLOT_MINUTES },
          () => false,
        ),
      };
    const startMinutes = timeToMinutes(occurrence.series.startTime);
    const endMinutes = timeToMinutes(occurrence.series.endTime);
    const firstSlot = Math.floor(startMinutes / OCCUPANCY_SLOT_MINUTES);
    const lastSlot = Math.floor(
      (endMinutes - 1) / OCCUPANCY_SLOT_MINUTES,
    );

    day.count += 1;
    for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
      day.slots[slot] = true;
    }
    occupancy.set(occurrence.date, day);
  }

  return occupancy;
}

export function lastOccurrenceOnOrBefore(series, date) {
  if (!isISODate(date) || date < series.date) {
    return null;
  }

  return occurrencesBetween([series], series.date, date).at(-1)?.date ?? null;
}

function occurrenceFromInput(input) {
  return seriesFromInput({
    ...input,
    repeatEvery: 1,
    repeatCount: 1,
  });
}

export function getOccurrenceOverride(series, occurrenceDate) {
  return (
    series.occurrenceOverrides.find(
      (override) => override.occurrenceDate === occurrenceDate,
    ) ?? null
  );
}

export function applyOccurrenceOverride(
  events,
  seriesId,
  occurrenceDate,
  nextInput,
) {
  const target = events.find((event) => event.id === seriesId);
  if (!target) {
    throw new Error("找不到活动");
  }
  if (getOccurrenceIndex(target, occurrenceDate) === null) {
    throw new Error("所选日期不是该活动的一次安排");
  }

  const candidate = occurrenceFromInput(nextInput);
  if (!candidate) {
    throw new Error("单次活动内容不完整");
  }
  const override = normalizeOverride({
    occurrenceDate,
    title: candidate.title,
    date: candidate.date,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    notes: candidate.notes,
    reminderMode: candidate.reminderMode,
    reminderMinutesBefore: candidate.reminderMinutesBefore,
    updatedAt: new Date().toISOString(),
  });

  return events.map((event) => {
    if (event.id !== seriesId) {
      return event;
    }
    return {
      ...event,
      occurrenceOverrides: normalizeOverrides([
        ...event.occurrenceOverrides.filter(
          (item) => item.occurrenceDate !== occurrenceDate,
        ),
        override,
      ]),
      updatedAt: new Date().toISOString(),
    };
  });
}

function matchingOverridesAfterEdit(replacement, overrides, afterDate) {
  return overrides.filter(
    (override) =>
      override.occurrenceDate > afterDate &&
      getOccurrenceIndex(replacement, override.occurrenceDate) !== null,
  );
}

export function unmatchedOverridesForSeriesEdit(
  series,
  occurrenceDate,
  nextInput,
) {
  const replacement = seriesFromInput(nextInput);
  if (!replacement) {
    return [];
  }
  return series.occurrenceOverrides.filter(
    (override) =>
      override.occurrenceDate > occurrenceDate &&
      getOccurrenceIndex(replacement, override.occurrenceDate) === null,
  );
}

export function splitSeriesForEdit(
  events,
  seriesId,
  occurrenceDate,
  nextInput,
) {
  const target = events.find((event) => event.id === seriesId);
  if (!target) {
    throw new Error("找不到活动");
  }

  const index = getOccurrenceIndex(target, occurrenceDate);
  if (index === null) {
    throw new Error("所选日期不是该活动的一次安排");
  }

  if (index === 0) {
    const replacement = seriesFromInput(nextInput, {
      id: target.id,
      createdAt: target.createdAt,
    });
    replacement.occurrenceOverrides = matchingOverridesAfterEdit(
      replacement,
      target.occurrenceOverrides,
      occurrenceDate,
    );
    replacement.pauses = target.pauses.filter(
      (pause) => pause.startDate > occurrenceDate,
    );
    return events.map((event) => (event.id === target.id ? replacement : event));
  }

  const original = {
    ...target,
    endBefore: occurrenceDate,
    occurrenceOverrides: target.occurrenceOverrides.filter(
      (override) => override.occurrenceDate < occurrenceDate,
    ),
    pauses: target.pauses.filter((pause) => pause.startDate < occurrenceDate),
    updatedAt: new Date().toISOString(),
  };
  const replacement = seriesFromInput(nextInput);
  replacement.occurrenceOverrides = matchingOverridesAfterEdit(
    replacement,
    target.occurrenceOverrides,
    occurrenceDate,
  );
  replacement.pauses = target.pauses.filter(
    (pause) => pause.startDate > occurrenceDate,
  );

  return events.flatMap((event) => {
    if (event.id !== target.id) {
      return [event];
    }
    return [original, replacement];
  });
}

export function pauseSeries(events, seriesId, occurrenceDate) {
  const target = events.find((event) => event.id === seriesId);
  if (!target) {
    throw new Error("找不到活动");
  }
  if (getOccurrenceIndex(target, occurrenceDate) === null) {
    throw new Error("所选日期不是该活动的一次安排");
  }

  return events.map((event) =>
    event.id === seriesId
      ? {
          ...event,
          pauses: normalizePauses([
            ...event.pauses,
            { startDate: occurrenceDate, endDate: null },
          ]),
          updatedAt: new Date().toISOString(),
        }
      : event,
  );
}

export function resumeSeries(events, seriesId, resumeDate) {
  const target = events.find((event) => event.id === seriesId);
  if (!target || !isSeriesPaused(target)) {
    return events;
  }

  const pauseEnd = addDays(resumeDate, -1);
  return events.map((event) => {
    if (event.id !== seriesId) {
      return event;
    }
    return {
      ...event,
      pauses: normalizePauses(
        event.pauses.flatMap((pause) => {
          if (pause.endDate !== null) {
            return [pause];
          }
          return resumeDate <= pause.startDate
            ? []
            : [{ startDate: pause.startDate, endDate: pauseEnd }];
        }),
      ),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function deleteOccurrenceAndFuture(events, seriesId, occurrenceDate) {
  const target = events.find((event) => event.id === seriesId);
  if (!target) {
    throw new Error("找不到活动");
  }

  const index = getOccurrenceIndex(target, occurrenceDate);
  if (index === null) {
    throw new Error("所选日期不是该活动的一次安排");
  }

  if (index === 0) {
    return events.filter((event) => event.id !== target.id);
  }

  return events.map((event) =>
    event.id === target.id
      ? {
          ...event,
          endBefore: occurrenceDate,
          occurrenceOverrides: event.occurrenceOverrides.filter(
            (override) => override.occurrenceDate < occurrenceDate,
          ),
          updatedAt: new Date().toISOString(),
        }
      : event,
  );
}

export function makeStoragePayload(events) {
  return {
    version: STORAGE_VERSION,
    events,
  };
}

export function readStoragePayload(payload) {
  if (!payload || !Array.isArray(payload.events)) {
    return [];
  }

  return payload.events.map(normalizeSeries).filter(Boolean);
}
