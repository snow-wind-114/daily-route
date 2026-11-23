import {
  normalizeActivities,
  normalizeCategories,
} from "./activities.js";
import {
  emptyFocusState,
  normalizeFocusState,
} from "./focus.js";
import {
  normalizeReviewEntries,
  normalizeReviewReminder,
  removeReviewsBeforeYear,
} from "./review.js";

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
      const hasCurrentCategories = Array.isArray(point.categories);
      const categories = hasCurrentCategories
        ? normalizeCategories(point.categories)
        : [];
      const events = normalizeActivities(point.events).map((activity) =>
        hasCurrentCategories
          ? activity
          : { ...activity, categoryId: null },
      );
      return {
        id: String(point.id ?? ""),
        createdAt:
          typeof point.createdAt === "string" ? point.createdAt : "",
        reason: typeof point.reason === "string" ? point.reason : "自动恢复点",
        events,
        categories,
        yearMigrationCompletedFor: Number(
          point.yearMigrationCompletedFor ??
            new Date(point.createdAt).getFullYear(),
        ),
        reviewEntries: normalizeReviewEntries(point.reviewEntries),
        reviewReminder: normalizeReviewReminder(point.reviewReminder),
        ...normalizeFocusState(point),
      };
    })
    .filter((point) => point?.id && point.createdAt);
}

export function addRecoveryPoint(
  stateOrEvents,
  reason,
  { storage = localStorage, now = new Date() } = {},
) {
  const state = Array.isArray(stateOrEvents)
    ? {
        events: stateOrEvents,
        categories: {},
        yearMigrationCompletedFor: now.getFullYear(),
        reviewEntries: [],
        reviewReminder: normalizeReviewReminder(),
        ...emptyFocusState(),
      }
    : stateOrEvents;
  const normalizedEvents = normalizeActivities(state.events);
  const normalizedCategories = normalizeCategories(state.categories);
  const normalizedReviews = normalizeReviewEntries(state.reviewEntries);
  const normalizedFocus = normalizeFocusState(state);
  const signature = JSON.stringify({
    events: normalizedEvents,
    categories: normalizedCategories,
    reviewEntries: normalizedReviews,
    focusProjects: normalizedFocus.focusProjects,
    focusFlows: normalizedFocus.focusFlows,
    focusQuotes: normalizedFocus.focusQuotes,
    focusWallpapers: normalizedFocus.focusWallpapers,
  });
  const current = readRecoveryPoints(storage);
  const currentSignature = current[0]
    ? JSON.stringify({
        events: current[0].events,
        categories: current[0].categories,
        reviewEntries: current[0].reviewEntries,
        focusProjects: current[0].focusProjects,
        focusFlows: current[0].focusFlows,
        focusQuotes: current[0].focusQuotes,
        focusWallpapers: current[0].focusWallpapers,
      })
    : null;
  if (currentSignature === signature) {
    return current;
  }

  const point = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now.toISOString(),
    reason: String(reason || "自动恢复点").slice(0, 60),
    events: normalizedEvents,
    categories: normalizedCategories,
    yearMigrationCompletedFor: Number(
      state.yearMigrationCompletedFor ?? now.getFullYear(),
    ),
    reviewEntries: normalizedReviews,
    reviewReminder: normalizeReviewReminder(state.reviewReminder),
    ...normalizedFocus,
  };
  const updated = [point, ...current].slice(0, MAX_RECOVERY_POINTS);
  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearRecoveryPoints(storage = localStorage) {
  storage.removeItem(RECOVERY_STORAGE_KEY);
  storage.removeItem(LAST_EXPORT_STORAGE_KEY);
}

export function removeReviewsBeforeYearFromRecovery(
  year,
  { storage = localStorage } = {},
) {
  const points = readRecoveryPoints(storage).map((point) => ({
    ...point,
    reviewEntries: removeReviewsBeforeYear(point.reviewEntries, year),
  }));
  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(points));
  return points;
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
