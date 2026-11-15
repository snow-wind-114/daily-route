import { normalizeSeries } from "./schedule.js";

export const BACKUP_FORMAT = "daily-route-backup";
export const BACKUP_VERSION = 2;
export const SUPPORTED_BACKUP_VERSIONS = Object.freeze([1, 2]);

export function createBackup(
  events,
  { appVersion = "0.3.0", now = new Date() } = {},
) {
  const normalizedEvents = events.map(normalizeSeries).filter(Boolean);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    eventCount: normalizedEvents.length,
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

  const events = payload.events.map(normalizeSeries).filter(Boolean);
  if (events.length !== payload.events.length) {
    throw new Error("备份中包含无法识别的活动");
  }

  if (
    payload.eventCount !== undefined &&
    payload.eventCount !== events.length
  ) {
    throw new Error("备份活动数量校验失败");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    sourceVersion: payload.version,
    appVersion:
      typeof payload.appVersion === "string" ? payload.appVersion : "",
    exportedAt:
      typeof payload.exportedAt === "string" ? payload.exportedAt : "",
    eventCount: events.length,
    events,
  };
}

export function summarizeEvents(events) {
  return {
    eventCount: events.length,
    notificationCount: events.filter(
      (event) =>
        event.reminderMode === "notification" && !event.pauses.some(
          (pause) => pause.endDate === null,
        ),
    ).length,
    alarmCount: events.filter(
      (event) =>
        event.reminderMode === "alarm" && !event.pauses.some(
          (pause) => pause.endDate === null,
        ),
    ).length,
    pausedCount: events.filter((event) =>
      event.pauses.some((pause) => pause.endDate === null),
    ).length,
    overrideCount: events.reduce(
      (total, event) => total + event.occurrenceOverrides.length,
      0,
    ),
  };
}
