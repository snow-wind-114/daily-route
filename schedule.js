import {
  addDays,
  diffCalendarDays,
  isISODate,
  isWithinWindow,
  timeToMinutes,
} from "./date-utils.js";

export const STORAGE_VERSION = 1;
export const MAX_REPEAT_EVERY = 14;
export const MAX_REPEAT_COUNT = 20;
export const OCCUPANCY_SLOT_MINUTES = 120;
export const DEFAULT_REMINDER_MINUTES = 5;
export const MAX_REMINDER_MINUTES = 1440;

function createId() {
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
    title: title.slice(0, 80),
    date: raw.date,
    startTime: raw.startTime,
    endTime: raw.endTime,
    repeatEvery,
    repeatCount,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 500) : "",
    reminderEnabled: raw.reminderEnabled === true,
    reminderMinutesBefore:
      integerInRange(
        raw.reminderMinutesBefore,
        0,
        MAX_REMINDER_MINUTES,
      ) ?? DEFAULT_REMINDER_MINUTES,
    endBefore,
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
    return "日期必须位于今天起未来六个月内";
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
    input.reminderEnabled === true &&
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
    reminderEnabled: input.reminderEnabled === true,
    reminderMinutesBefore:
      input.reminderMinutesBefore ?? DEFAULT_REMINDER_MINUTES,
    endBefore: null,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
}

export function getOccurrenceIndex(series, occurrenceDate) {
  if (!isISODate(occurrenceDate) || occurrenceDate < series.date) {
    return null;
  }

  if (series.endBefore && occurrenceDate >= series.endBefore) {
    return null;
  }

  const rawIndex = diffCalendarDays(series.date, occurrenceDate);
  if (rawIndex % series.repeatEvery !== 0) {
    return null;
  }

  const index = rawIndex / series.repeatEvery;
  if (series.repeatCount !== null && index >= series.repeatCount) {
    return null;
  }

  return index;
}

export function remainingRepeatCount(series, occurrenceDate) {
  if (series.repeatCount === null) {
    return null;
  }

  const index = getOccurrenceIndex(series, occurrenceDate);
  return index === null ? 0 : Math.max(0, series.repeatCount - index);
}

export function occurrencesBetween(events, startDate, endDate) {
  const occurrences = [];

  for (const series of events) {
    if (series.date > endDate) {
      continue;
    }

    if (series.endBefore && startDate >= series.endBefore) {
      continue;
    }

    let candidate =
      series.date >= startDate ? series.date : startDate;
    const offset = diffCalendarDays(series.date, candidate);
    const remainder = ((offset % series.repeatEvery) + series.repeatEvery) %
      series.repeatEvery;

    if (remainder !== 0) {
      candidate = addDays(candidate, series.repeatEvery - remainder);
    }

    while (candidate <= endDate) {
      if (series.endBefore && candidate >= series.endBefore) {
        break;
      }

      const index = diffCalendarDays(series.date, candidate) /
        series.repeatEvery;
      if (series.repeatCount !== null && index >= series.repeatCount) {
        break;
      }

      occurrences.push({
        series,
        date: candidate,
        occurrenceIndex: index,
      });
      candidate = addDays(candidate, series.repeatEvery);
    }
  }

  return occurrences;
}

export function occurrencesOnDate(events, date) {
  return occurrencesBetween(events, date, date).sort((left, right) => {
    const startDifference =
      timeToMinutes(left.series.startTime) -
      timeToMinutes(right.series.startTime);
    return startDifference || left.series.title.localeCompare(right.series.title);
  });
}

export function findScheduleConflict(
  events,
  candidate,
  startDate,
  endDate,
  ignoreSeriesId = null,
) {
  const candidateStart = timeToMinutes(candidate.startTime);
  const candidateEnd = timeToMinutes(candidate.endTime);

  for (const occurrence of occurrencesBetween(
    [candidate],
    startDate,
    endDate,
  )) {
    for (const existingSeries of events) {
      if (existingSeries.id === ignoreSeriesId) {
        continue;
      }

      const existingOccurrences = occurrencesOnDate(
        [existingSeries],
        occurrence.date,
      );
      for (const existing of existingOccurrences) {
        const existingStart = timeToMinutes(existing.series.startTime);
        const existingEnd = timeToMinutes(existing.series.endTime);
        if (candidateStart < existingEnd && candidateEnd > existingStart) {
          return {
            date: occurrence.date,
            candidateSeries: candidate,
            existingSeries: existing.series,
          };
        }
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

  let effectiveDate = date;
  if (series.endBefore && effectiveDate >= series.endBefore) {
    effectiveDate = addDays(series.endBefore, -1);
  }

  if (effectiveDate < series.date) {
    return null;
  }

  let index = Math.floor(
    diffCalendarDays(series.date, effectiveDate) / series.repeatEvery,
  );
  if (series.repeatCount !== null) {
    index = Math.min(index, series.repeatCount - 1);
  }

  return index < 0
    ? null
    : addDays(series.date, index * series.repeatEvery);
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
    return events.map((event) => (event.id === target.id ? replacement : event));
  }

  const original = {
    ...target,
    endBefore: occurrenceDate,
    updatedAt: new Date().toISOString(),
  };
  const replacement = seriesFromInput(nextInput);

  return events.flatMap((event) => {
    if (event.id !== target.id) {
      return [event];
    }
    return [original, replacement];
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

