import {
  addDays,
  endOfMonth,
  formatDayTitle,
  isISODate,
  mondayBasedWeekday,
  startOfMonth,
  timeToMinutes,
} from "./date-utils.js";
import {
  isActivityArchived,
  isActivityPaused,
  isDatePausedForCheckin,
} from "./activities.js";
import { occurrencesOnDate } from "./schedule.js";

export const REVIEW_TEXT_MAX = 1000;
export const DEFAULT_REVIEW_REMINDER = Object.freeze({
  enabled: false,
  time: "21:30",
});

function cleanText(value) {
  return typeof value === "string"
    ? value.trim().slice(0, REVIEW_TEXT_MAX)
    : "";
}

function cleanSnapshotItem(raw, fields) {
  const item = {};
  for (const field of fields) {
    const value = raw?.[field];
    item[field] = typeof value === "string" ? value.slice(0, 200) : "";
  }
  return item;
}

function normalizeSnapshot(raw) {
  const schedules = (Array.isArray(raw?.schedules) ? raw.schedules : [])
    .map((item) =>
      cleanSnapshotItem(item, ["title", "startTime", "endTime"]),
    )
    .filter((item) => item.title);
  const todos = (Array.isArray(raw?.todos) ? raw.todos : [])
    .map((item) => {
      const normalized = cleanSnapshotItem(item, [
        "title",
        "deadlineTime",
        "status",
      ]);
      if (!["completed", "pending", "archived"].includes(normalized.status)) {
        normalized.status = "pending";
      }
      return normalized;
    })
    .filter((item) => item.title);
  const checkins = (Array.isArray(raw?.checkins) ? raw.checkins : [])
    .map((item) => ({
      title: typeof item?.title === "string" ? item.title.slice(0, 200) : "",
      checked: item?.checked === true,
    }))
    .filter((item) => item.title);
  return { schedules, todos, checkins };
}

export function normalizeReviewEntry(raw) {
  if (!raw || typeof raw !== "object" || !isISODate(raw.date)) {
    return null;
  }
  const summary = cleanText(raw.summary);
  const reflection = cleanText(raw.reflection);
  const inspiration = cleanText(raw.inspiration);
  if (!summary && !reflection && !inspiration) {
    return null;
  }
  const createdAt =
    typeof raw.createdAt === "string" &&
    !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();
  return {
    date: raw.date,
    summary,
    reflection,
    inspiration,
    activitySnapshot: normalizeSnapshot(raw.activitySnapshot),
    createdAt,
    updatedAt:
      typeof raw.updatedAt === "string" &&
      !Number.isNaN(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : createdAt,
  };
}

export function normalizeReviewEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return [];
  }
  const byDate = new Map();
  for (const raw of rawEntries) {
    const entry = normalizeReviewEntry(raw);
    if (!entry) {
      continue;
    }
    const current = byDate.get(entry.date);
    if (!current || current.updatedAt <= entry.updatedAt) {
      byDate.set(entry.date, entry);
    }
  }
  return [...byDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export function normalizeReviewReminder(raw) {
  const time =
    typeof raw?.time === "string" && timeToMinutes(raw.time) !== null
      ? raw.time
      : DEFAULT_REVIEW_REMINDER.time;
  return {
    enabled: raw?.enabled === true,
    time,
  };
}

export function hasReviewContent(entry) {
  return Boolean(
    entry &&
      (entry.summary?.trim() ||
        entry.reflection?.trim() ||
        entry.inspiration?.trim()),
  );
}

export function buildReviewActivitySnapshot(events, date) {
  const schedules = occurrencesOnDate(events, date).map((occurrence) => ({
    title: occurrence.series.title,
    startTime: occurrence.series.startTime,
    endTime: occurrence.series.endTime,
  }));
  const todos = events
    .filter(
      (activity) =>
        activity.kind === "todo" && activity.deadlineDate === date,
    )
    .map((activity) => ({
      title: activity.title,
      deadlineTime: activity.deadlineTime,
      status: activity.completedAt
        ? "completed"
        : activity.archivedAt
          ? "archived"
          : "pending",
    }))
    .sort(
      (left, right) =>
        left.deadlineTime.localeCompare(right.deadlineTime) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );

  const checkedOrActive = events.filter(
    (activity) =>
      activity.kind === "checkin" &&
      activity.year === Number(date.slice(0, 4)) &&
      (activity.checkInDates.includes(date) ||
        (!isActivityArchived(activity) &&
          !isActivityPaused(activity) &&
          !isDatePausedForCheckin(activity, date))),
  );
  const checkins = checkedOrActive
    .map((activity) => ({
      title: activity.title,
      checked: activity.checkInDates.includes(date),
    }))
    .sort(
      (left, right) =>
        Number(right.checked) - Number(left.checked) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );

  return { schedules, todos, checkins };
}

export function createReviewEntry(
  input,
  { existing = null, activitySnapshot = null, now = new Date() } = {},
) {
  if (!isISODate(input?.date)) {
    throw new Error("回顾日期无效");
  }
  const summary = cleanText(input.summary);
  const reflection = cleanText(input.reflection);
  const inspiration = cleanText(input.inspiration);
  if (!summary && !reflection && !inspiration) {
    return null;
  }
  const updatedAt = now.toISOString();
  return {
    date: input.date,
    summary,
    reflection,
    inspiration,
    activitySnapshot:
      existing?.activitySnapshot ??
      normalizeSnapshot(activitySnapshot),
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
  };
}

export function removeReviewsBeforeYear(entries, year) {
  return normalizeReviewEntries(entries).filter(
    (entry) => Number(entry.date.slice(0, 4)) >= year,
  );
}

export function reviewRangeFor(scope, isoDate) {
  if (!isISODate(isoDate)) {
    throw new Error("回顾日期无效");
  }
  if (scope === "week") {
    const startDate = addDays(isoDate, -mondayBasedWeekday(isoDate));
    return { scope, startDate, endDate: addDays(startDate, 6) };
  }
  if (scope === "month") {
    return {
      scope,
      startDate: startOfMonth(isoDate),
      endDate: endOfMonth(isoDate),
    };
  }
  if (scope === "year") {
    const year = isoDate.slice(0, 4);
    return {
      scope,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
  throw new Error("回顾导出范围无效");
}

export function reviewEntriesInRange(entries, startDate, endDate) {
  if (
    !isISODate(startDate) ||
    !isISODate(endDate) ||
    startDate > endDate
  ) {
    return [];
  }
  return normalizeReviewEntries(entries)
    .filter(hasReviewContent)
    .filter(
      (entry) => entry.date >= startDate && entry.date <= endDate,
    );
}

function appendReportSection(lines, heading, value) {
  if (!value?.trim()) {
    return;
  }
  lines.push(heading, "", value.trim(), "");
}

export function buildReviewMarkdown(
  entries,
  { year, startDate, endDate, title } = {},
) {
  const selected = normalizeReviewEntries(entries)
    .filter(hasReviewContent)
    .filter(
      (entry) =>
        year === undefined ||
        Number(entry.date.slice(0, 4)) === Number(year),
    )
    .filter(
      (entry) =>
        (!startDate || entry.date >= startDate) &&
        (!endDate || entry.date <= endDate),
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const years = [
    ...new Set(selected.map((entry) => entry.date.slice(0, 4))),
  ];
  const defaultTitle =
    years.length === 1 ? `${years[0]} 年 Daily Route 回顾` : "Daily Route 回顾";
  const lines = [`# ${title || defaultTitle}`, ""];

  for (const entry of selected) {
    lines.push(`## ${entry.date.slice(0, 4)}年${formatDayTitle(entry.date)}`, "");
    const snapshot = normalizeSnapshot(entry.activitySnapshot);
    if (snapshot.schedules.length > 0) {
      lines.push("### 定期活动", "");
      for (const item of snapshot.schedules) {
        lines.push(`- ${item.startTime}–${item.endTime} ${item.title}`);
      }
      lines.push("");
    }
    if (snapshot.todos.length > 0) {
      lines.push("### 待办", "");
      for (const item of snapshot.todos) {
        const checked = item.status === "completed";
        const suffix =
          item.status === "archived"
            ? "（已归档）"
            : checked
              ? "（已完成）"
              : "（未完成）";
        lines.push(
          `- ${checked ? "[x]" : "[ ]"} ${item.deadlineTime} ${item.title}${suffix}`,
        );
      }
      lines.push("");
    }
    if (snapshot.checkins.length > 0) {
      lines.push("### 打卡", "");
      for (const item of snapshot.checkins) {
        lines.push(`- ${item.checked ? "[x]" : "[ ]"} ${item.title}`);
      }
      lines.push("");
    }
    appendReportSection(lines, "### 今日总结", entry.summary);
    appendReportSection(lines, "### 感想", entry.reflection);
    appendReportSection(lines, "### 灵感", entry.inspiration);
  }

  return `${lines.join("\n").trim()}\n`;
}
