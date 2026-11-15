import { normalizeSeries } from "./schedule.js";

export const RECOVERY_STORAGE_KEY = "daily-route.recovery.v1";
export const LAST_EXPORT_STORAGE_KEY = "daily-route.last-export.v1";
export const MAX_RECOVERY_POINTS = 5;

function readJson(storage, key, fallback) {
  try {
    const stored = storage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function readRecoveryPoints(storage = localStorage) {
  const points = readJson(storage, RECOVERY_STORAGE_KEY, []);
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => {
      if (!point || !Array.isArray(point.events)) {
        return null;
      }
      return {
        id: String(point.id ?? ""),
        createdAt:
          typeof point.createdAt === "string" ? point.createdAt : "",
        reason: typeof point.reason === "string" ? point.reason : "自动恢复点",
        events: point.events.map(normalizeSeries).filter(Boolean),
      };
    })
    .filter((point) => point?.id && point.createdAt);
}

export function addRecoveryPoint(
  events,
  reason,
  { storage = localStorage, now = new Date() } = {},
) {
  const normalizedEvents = events.map(normalizeSeries).filter(Boolean);
  const signature = JSON.stringify(normalizedEvents);
  const current = readRecoveryPoints(storage);
  if (current[0] && JSON.stringify(current[0].events) === signature) {
    return current;
  }

  const point = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now.toISOString(),
    reason: String(reason || "自动恢复点").slice(0, 60),
    events: normalizedEvents,
  };
  const updated = [point, ...current].slice(0, MAX_RECOVERY_POINTS);
  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearRecoveryPoints(storage = localStorage) {
  storage.removeItem(RECOVERY_STORAGE_KEY);
  storage.removeItem(LAST_EXPORT_STORAGE_KEY);
}

export function markManualExport(
  { storage = localStorage, now = new Date() } = {},
) {
  const exportedAt = now.toISOString();
  storage.setItem(LAST_EXPORT_STORAGE_KEY, exportedAt);
  return exportedAt;
}

export function readLastManualExport(storage = localStorage) {
  const value = storage.getItem(LAST_EXPORT_STORAGE_KEY);
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function shouldRemindBackup(
  lastExportedAt,
  { now = new Date(), days = 30 } = {},
) {
  if (!lastExportedAt) {
    return true;
  }
  return now.getTime() - Date.parse(lastExportedAt) >= days * 86_400_000;
}
