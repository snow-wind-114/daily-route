import {
  cloneActivityForYear,
  isActivityArchived,
} from "./activities.js";

export const MIGRATION_KINDS = Object.freeze(["schedule", "checkin"]);

export function migrationTargetYear(now = new Date()) {
  const month = now.getMonth() + 1;
  return month === 12 ? now.getFullYear() + 1 : now.getFullYear();
}

export function migrationIsDue(completedFor, now = new Date()) {
  const month = now.getMonth() + 1;
  const targetYear = migrationTargetYear(now);
  return (
    (month === 12 || month === 1) &&
    Number(completedFor) < targetYear
  );
}

export function migrationCandidates(events, targetYear) {
  const sourceYear = targetYear - 1;
  return events
    .filter(
      (activity) =>
        activity.year === sourceYear &&
        MIGRATION_KINDS.includes(activity.kind) &&
        (!isActivityArchived(activity) ||
          activity.archiveReason === "年度结束"),
    )
    .sort(
      (left, right) =>
        MIGRATION_KINDS.indexOf(left.kind) -
          MIGRATION_KINDS.indexOf(right.kind) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );
}

export function migrationCategoryGroups(
  events,
  categories,
  targetYear,
) {
  const candidates = migrationCandidates(events, targetYear);
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const groups = new Map();
  for (const activity of candidates) {
    const key =
      activity.categoryId && categoryMap.has(activity.categoryId)
        ? activity.categoryId
        : "";
    if (!groups.has(key)) {
      groups.set(key, {
        categoryId: key || null,
        categoryName: key ? categoryMap.get(key) : "未分类",
        activities: [],
      });
    }
    groups.get(key).activities.push(activity);
  }
  return [...groups.values()].sort((left, right) => {
    if (left.categoryId === null) {
      return 1;
    }
    if (right.categoryId === null) {
      return -1;
    }
    return left.categoryName.localeCompare(
      right.categoryName,
      "zh-CN",
    );
  });
}

export function buildMigrationCopies(
  events,
  selectedIds,
  targetYear,
) {
  const selected = new Set(selectedIds);
  return migrationCandidates(events, targetYear)
    .filter((activity) => selected.has(activity.id))
    .map((activity) => cloneActivityForYear(activity, targetYear))
    .filter(Boolean);
}
