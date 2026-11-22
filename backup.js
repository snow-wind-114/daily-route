import {
  emptyCategories,
  normalizeActivities,
  normalizeCategories,
} from "./activities.js";

export const BACKUP_FORMAT = "daily-route-backup";
export const BACKUP_VERSION = 3;
export const SUPPORTED_BACKUP_VERSIONS = Object.freeze([1, 2, 3]);

export function createBackup(
  events,
  {
    appVersion = "0.4.0",
    categories = emptyCategories(),
    yearMigrationCompletedFor = new Date().getFullYear(),
    now = new Date(),
  } = {},
) {
  const normalizedEvents = normalizeActivities(events);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    eventCount: normalizedEvents.length,
    yearMigrationCompletedFor: Number(yearMigrationCompletedFor),
    categories: normalizeCategories(categories),
    events: normalizedEvents,
  };
}

export function parseBackup(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON");
  }

  if (
    !payload ||
    payload.format !== BACKUP_FORMAT ||
    !SUPPORTED_BACKUP_VERSIONS.includes(payload.version) ||
    !Array.isArray(payload.events)
  ) {
    throw new Error("备份文件格式或版本不受支持");
  }

  const events = normalizeActivities(payload.events);
  if (events.length !== payload.events.length) {
    throw new Error("备份中包含无法识别的活动");
  }

  if (
    payload.eventCount !== undefined &&
    payload.eventCount !== events.length
  ) {
    throw new Error("备份活动数量校验失败");
  }

  const year = Number(payload.yearMigrationCompletedFor);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    sourceVersion: payload.version,
    appVersion:
      typeof payload.appVersion === "string" ? payload.appVersion : "",
    exportedAt:
      typeof payload.exportedAt === "string" ? payload.exportedAt : "",
    eventCount: events.length,
    categories: normalizeCategories(payload.categories),
    yearMigrationCompletedFor:
      Number.isInteger(year) && year >= 1900
        ? year
        : new Date().getFullYear(),
    events,
  };
}

export function summarizeEvents(events) {
  const active = events.filter((event) => !event.archivedAt);
  return {
    eventCount: events.length,
    scheduleCount: events.filter((event) => event.kind === "schedule").length,
    todoCount: events.filter((event) => event.kind === "todo").length,
    checkinCount: events.filter((event) => event.kind === "checkin").length,
    notificationCount: active.filter(
      (event) => event.reminderMode === "notification",
    ).length,
    alarmCount: active.filter(
      (event) => event.reminderMode === "alarm",
    ).length,
    pausedCount: active.filter((event) =>
      event.pauses?.some((pause) => pause.endDate === null),
    ).length,
    overrideCount: events.reduce(
      (total, event) => total + (event.occurrenceOverrides?.length ?? 0),
      0,
    ),
  };
}
