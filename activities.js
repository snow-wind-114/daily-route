import {
  addDays,
  isISODate,
  parseISODate,
  timeToMinutes,
  toISODate,
} from "./date-utils.js";
import {
  createId,
  normalizePauses,
  normalizeSeries,
} from "./schedule.js";

export const ACTIVITY_KINDS = Object.freeze([
  "schedule",
  "todo",
  "checkin",
]);
export const ACTIVITY_KIND_LABELS = Object.freeze({
  schedule: "定期",
  todo: "待办",
  checkin: "打卡",
});
export const TODO_MAX_REMINDER_DAYS = 30;
export const DEFAULT_CHECKIN_REMINDER_TIME = "21:00";

function validYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 9999
    ? year
    : null;
}

function cleanText(value, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function archiveFields(raw) {
  return {
    archivedAt:
      typeof raw.archivedAt === "string" ? raw.archivedAt : null,
    archiveReason:
      typeof raw.archiveReason === "string"
        ? raw.archiveReason.slice(0, 40)
        : null,
  };
}

function normalizeReminderMode(raw) {
  return ["none", "notification", "alarm"].includes(raw) ? raw : "none";
}

function normalizeReminderTime(raw) {
  return timeToMinutes(raw) === null
    ? DEFAULT_CHECKIN_REMINDER_TIME
    : raw;
}

function normalizeCheckInDates(rawDates) {
  if (!Array.isArray(rawDates)) {
    return [];
  }
  return [...new Set(rawDates.filter(isISODate))].sort();
}

export function normalizeTodo(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = cleanText(raw.title, 80);
  if (
    !title ||
    !isISODate(raw.deadlineDate) ||
    timeToMinutes(raw.deadlineTime) === null
  ) {
    return null;
  }
  const reminderDaysBefore = Number(raw.reminderDaysBefore);
  if (
    !Number.isInteger(reminderDaysBefore) ||
    reminderDaysBefore < 0 ||
    reminderDaysBefore > TODO_MAX_REMINDER_DAYS
  ) {
    return null;
  }
  const completedAt =
    typeof raw.completedAt === "string" ? raw.completedAt : null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    kind: "todo",
    title,
    notes: cleanText(raw.notes),
    categoryId:
      typeof raw.categoryId === "string" && raw.categoryId
        ? raw.categoryId
        : null,
    year: Number(raw.deadlineDate.slice(0, 4)),
    deadlineDate: raw.deadlineDate,
    deadlineTime: raw.deadlineTime,
    reminderMode: normalizeReminderMode(raw.reminderMode),
    reminderDaysBefore,
    completedAt,
    ...archiveFields(raw),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function normalizeCheckin(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = cleanText(raw.title, 80);
  if (!title) {
    return null;
  }
  const completedAt =
    typeof raw.completedAt === "string" ? raw.completedAt : null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    kind: "checkin",
    title,
    notes: cleanText(raw.notes),
    categoryId:
      typeof raw.categoryId === "string" && raw.categoryId
        ? raw.categoryId
        : null,
    year: validYear(raw.year) ?? new Date().getFullYear(),
    checkInDates: normalizeCheckInDates(raw.checkInDates),
    pauses: normalizePauses(raw.pauses),
    reminderMode: normalizeReminderMode(raw.reminderMode),
    reminderTime: normalizeReminderTime(raw.reminderTime),
    completedAt,
    ...archiveFields(raw),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function normalizeActivity(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  if (raw.kind === "todo") {
    return normalizeTodo(raw);
  }
  if (raw.kind === "checkin") {
    return normalizeCheckin(raw);
  }
  return normalizeSeries(raw);
}

export function normalizeActivities(rawActivities) {
  if (!Array.isArray(rawActivities)) {
    return [];
  }
  return rawActivities.map(normalizeActivity).filter(Boolean);
}

export function emptyCategories() {
  return [];
}

export function normalizeCategories(raw) {
  const categories = [];
  const seenIds = new Set();
  const seenNames = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = cleanText(item?.name, 24);
    const id = typeof item?.id === "string" && item.id ? item.id : createId();
    const normalizedName = name.toLocaleLowerCase("zh-CN");
    if (!name || seenIds.has(id) || seenNames.has(normalizedName)) {
      continue;
    }
    seenIds.add(id);
    seenNames.add(normalizedName);
    categories.push({ id, name });
  }
  return categories;
}

export function addCategory(categories, name) {
  const normalized = normalizeCategories(categories);
  const cleanName = cleanText(name, 24);
  if (
    !cleanName ||
    normalized.some(
      (item) =>
        item.name.toLocaleLowerCase("zh-CN") ===
        cleanName.toLocaleLowerCase("zh-CN"),
    )
  ) {
    return normalized;
  }
  normalized.push({ id: createId(), name: cleanName });
  return normalized;
}

export function renameCategory(categories, categoryId, name) {
  const normalized = normalizeCategories(categories);
  const cleanName = cleanText(name, 24);
  if (
    !cleanName ||
    normalized.some(
      (item) =>
        item.id !== categoryId &&
        item.name.toLocaleLowerCase("zh-CN") ===
          cleanName.toLocaleLowerCase("zh-CN"),
    )
  ) {
    return normalized;
  }
  return normalized.map((item) =>
    item.id === categoryId ? { ...item, name: cleanName } : item,
  );
}

export function deleteCategory(categories, categoryId) {
  const normalized = normalizeCategories(categories);
  return normalized.filter(
    (item) => item.id !== categoryId,
  );
}

export function categoryName(categories, categoryId) {
  return (
    categories?.find((item) => item.id === categoryId)?.name ??
    "未分类"
  );
}

export function isActivityArchived(activity) {
  return Boolean(activity?.archivedAt);
}

export function isActivityPaused(activity) {
  return ["schedule", "checkin"].includes(activity?.kind)
    ? activity.pauses.some((pause) => pause.endDate === null)
    : false;
}

export function isDatePausedForCheckin(activity, date) {
  return activity?.kind === "checkin"
    ? activity.pauses.some(
        (pause) =>
          date >= pause.startDate &&
          (pause.endDate === null || date <= pause.endDate),
      )
    : false;
}

export function isCheckedIn(activity, date) {
  return activity?.kind === "checkin"
    ? activity.checkInDates.includes(date)
    : false;
}

export function toggleCheckin(activity, date, today = new Date()) {
  const todayDate = toISODate(today);
  if (
    activity?.kind !== "checkin" ||
    isActivityArchived(activity) ||
    !isISODate(date) ||
    date > todayDate ||
    Number(date.slice(0, 4)) !== activity.year ||
    isDatePausedForCheckin(activity, date)
  ) {
    throw new Error("这个日期不能打卡");
  }
  const dates = isCheckedIn(activity, date)
    ? activity.checkInDates.filter((item) => item !== date)
    : [...activity.checkInDates, date].sort();
  return {
    ...activity,
    checkInDates: dates,
    updatedAt: new Date().toISOString(),
  };
}

export function pauseCheckin(activity, date) {
  if (activity?.kind !== "checkin" || !isISODate(date)) {
    throw new Error("找不到打卡项目");
  }
  return {
    ...activity,
    pauses: normalizePauses([
      ...activity.pauses,
      { startDate: date, endDate: null },
    ]),
    updatedAt: new Date().toISOString(),
  };
}

export function resumeCheckin(activity, date) {
  if (activity?.kind !== "checkin" || !isISODate(date)) {
    throw new Error("找不到打卡项目");
  }
  return {
    ...activity,
    pauses: normalizePauses(
      activity.pauses.flatMap((pause) =>
        pause.endDate === null
          ? date <= pause.startDate
            ? []
            : [{ startDate: pause.startDate, endDate: addDays(date, -1) }]
          : [pause],
      ),
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function archiveActivity(
  activities,
  activityId,
  reason,
  now = new Date(),
) {
  const timestamp = now.toISOString();
  return activities.map((activity) => {
    if (activity.id !== activityId) {
      return activity;
    }
    return {
      ...activity,
      archivedAt: timestamp,
      archiveReason: String(reason || "已完成").slice(0, 40),
      completedAt:
        activity.kind === "todo" || activity.kind === "checkin"
          ? timestamp
          : activity.completedAt ?? null,
      updatedAt: timestamp,
    };
  });
}

export function restoreActivity(activities, activityId) {
  return activities.map((activity) =>
    activity.id === activityId
      ? {
          ...activity,
          archivedAt: null,
          archiveReason: null,
          completedAt: null,
          updatedAt: new Date().toISOString(),
        }
      : activity,
  );
}

export function finalizePreviousYears(
  activities,
  currentYear,
  now = new Date(),
) {
  return activities.map((activity) =>
    activity.year < currentYear && !isActivityArchived(activity)
      ? {
          ...activity,
          archivedAt: now.toISOString(),
          archiveReason:
            activity.kind === "todo"
              ? "年度结束·未完成"
              : "年度结束",
          updatedAt: now.toISOString(),
        }
      : activity,
  );
}

export function todoDeadlineDate(activity) {
  if (activity?.kind !== "todo") {
    return null;
  }
  const date = parseISODate(activity.deadlineDate);
  const minutes = timeToMinutes(activity.deadlineTime);
  if (!date || minutes === null) {
    return null;
  }
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
}

export function todoReminderDate(activity) {
  const due = todoDeadlineDate(activity);
  if (!due || activity.kind !== "todo") {
    return null;
  }
  due.setDate(due.getDate() - activity.reminderDaysBefore);
  return due;
}

export function isTodoOverdue(activity, now = new Date()) {
  const due = todoDeadlineDate(activity);
  return Boolean(
    activity?.kind === "todo" &&
      !isActivityArchived(activity) &&
      due &&
      due.getTime() < now.getTime(),
  );
}

export function todosDueOnDate(activities, date) {
  return activities.filter(
    (activity) =>
      activity.kind === "todo" &&
      !isActivityArchived(activity) &&
      activity.deadlineDate === date,
  );
}

export function overdueTodos(activities, now = new Date(), today = null) {
  const todayDate = today ?? toISODate(now);
  return activities
    .filter(
      (activity) =>
        activity.kind === "todo" &&
        !isActivityArchived(activity) &&
        activity.deadlineDate <= todayDate &&
        isTodoOverdue(activity, now),
    )
    .sort(
      (left, right) =>
        left.deadlineDate.localeCompare(right.deadlineDate) ||
        left.deadlineTime.localeCompare(right.deadlineTime),
    );
}

export function todoCountByDate(activities) {
  const counts = new Map();
  for (const activity of activities) {
    if (activity.kind !== "todo" || isActivityArchived(activity)) {
      continue;
    }
    counts.set(
      activity.deadlineDate,
      (counts.get(activity.deadlineDate) ?? 0) + 1,
    );
  }
  return counts;
}

export function checkinDatesBetween(activity, startDate, endDate) {
  if (activity?.kind !== "checkin") {
    return [];
  }
  return activity.checkInDates.filter(
    (date) => date >= startDate && date <= endDate,
  );
}

export function activeCheckinsForDate(activities, date) {
  return activities.filter(
    (activity) =>
      activity.kind === "checkin" &&
      !isActivityArchived(activity) &&
      !isActivityPaused(activity) &&
      Number(date.slice(0, 4)) === activity.year &&
      !isDatePausedForCheckin(activity, date),
  );
}

export function validateTodoInput(
  input,
  { year, now = new Date() },
) {
  const title = cleanText(input.title, 80);
  if (!title) {
    return "请填写待办名称";
  }
  if (
    !isISODate(input.deadlineDate) ||
    Number(input.deadlineDate.slice(0, 4)) !== year
  ) {
    return "截止日期必须位于当前自然年内";
  }
  if (timeToMinutes(input.deadlineTime) === null) {
    return "请填写有效的截止时间";
  }
  if (!["none", "notification", "alarm"].includes(input.reminderMode)) {
    return "提醒方式无效";
  }
  const days = Number(input.reminderDaysBefore);
  if (!Number.isInteger(days) || days < 0 || days > TODO_MAX_REMINDER_DAYS) {
    return "提前提醒必须是 0–30 天";
  }
  const candidate = normalizeTodo({
    title,
    deadlineDate: input.deadlineDate,
    deadlineTime: input.deadlineTime,
    reminderMode: input.reminderMode,
    reminderDaysBefore: days,
  });
  const reminderAt = candidate ? todoReminderDate(candidate) : null;
  if (
    candidate.reminderMode !== "none" &&
    (!reminderAt || reminderAt.getTime() <= now.getTime())
  ) {
    return "所选提前提醒时间已经过去，请缩短提前天数或关闭提醒";
  }
  return null;
}

export function validateCheckinInput(input) {
  const title = cleanText(input.title, 80);
  if (!title) {
    return "请填写打卡名称";
  }
  if (!["none", "notification", "alarm"].includes(input.reminderMode)) {
    return "提醒方式无效";
  }
  if (timeToMinutes(input.reminderTime) === null) {
    return "请选择有效的打卡提醒时间";
  }
  return null;
}

export function todoFromInput(input, { id, createdAt, categoryId } = {}) {
  const now = new Date().toISOString();
  return normalizeTodo({
    id: id ?? createId(),
    title: input.title,
    deadlineDate: input.deadlineDate,
    deadlineTime: input.deadlineTime,
    reminderMode: input.reminderMode,
    reminderDaysBefore: input.reminderDaysBefore,
    notes: input.notes,
    categoryId,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
}

export function checkinFromInput(
  input,
  { year, id, createdAt, categoryId } = {},
) {
  const now = new Date().toISOString();
  return normalizeCheckin({
    id: id ?? createId(),
    title: input.title,
    notes: input.notes,
    categoryId,
    year,
    checkInDates: input.checkInDates ?? [],
    pauses: input.pauses ?? [],
    reminderMode: input.reminderMode,
    reminderTime: input.reminderTime,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
}

function dateInYear(sourceDate, targetYear) {
  const source = parseISODate(sourceDate);
  if (!source) {
    return null;
  }
  const target = new Date(
    targetYear,
    source.getMonth(),
    source.getDate(),
    12,
  );
  if (target.getMonth() !== source.getMonth()) {
    target.setDate(0);
  }
  return toISODate(target);
}

export function cloneActivityForYear(activity, targetYear, overrides = {}) {
  if (activity.kind === "todo") {
    return null;
  }
  if (activity.kind === "checkin") {
    return checkinFromInput(
      {
        title: overrides.title ?? activity.title,
        notes: overrides.notes ?? activity.notes,
        reminderMode:
          overrides.reminderMode ?? activity.reminderMode,
        reminderTime:
          overrides.reminderTime ?? activity.reminderTime,
      },
      {
        year: targetYear,
        categoryId: overrides.categoryId ?? activity.categoryId,
      },
    );
  }

  const nextDate = dateInYear(
    overrides.date ?? activity.date,
    targetYear,
  );
  return normalizeSeries({
    ...activity,
    ...overrides,
    id: createId(),
    year: targetYear,
    date: nextDate,
    occurrenceOverrides: [],
    pauses: [],
    endBefore: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    categoryId: overrides.categoryId ?? activity.categoryId,
  });
}

export function archiveYear(activity) {
  return activity.year;
}
