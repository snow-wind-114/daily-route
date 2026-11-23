export const ACTIVITY_DRAFT_STORAGE_KEY = "daily-route.activity-drafts.v1";
export const ACTIVITY_DRAFT_KINDS = Object.freeze([
  "schedule",
  "todo",
  "checkin",
]);

function text(value, maximum = 500) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function normalizeDraft(kind, raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    kind,
    title: text(raw.title, 80),
    categoryId: text(raw.categoryId, 100),
    date: text(raw.date, 10),
    startTime: text(raw.startTime, 5),
    endTime: text(raw.endTime, 5),
    repeatMode:
      raw.repeatMode === "infinite" ? "infinite" : "limited",
    repeatEvery: text(raw.repeatEvery, 3),
    repeatCount: text(raw.repeatCount, 3),
    reminderMode: ["none", "notification", "alarm"].includes(
      raw.reminderMode,
    )
      ? raw.reminderMode
      : "none",
    reminderMinutesBefore: text(raw.reminderMinutesBefore, 4),
    deadlineDate: text(raw.deadlineDate, 10),
    deadlineTime: text(raw.deadlineTime, 5),
    todoReminderMode: ["none", "notification", "alarm"].includes(
      raw.todoReminderMode,
    )
      ? raw.todoReminderMode
      : "none",
    todoReminderDaysBefore: text(raw.todoReminderDaysBefore, 2),
    checkinReminderMode: ["none", "notification", "alarm"].includes(
      raw.checkinReminderMode,
    )
      ? raw.checkinReminderMode
      : "none",
    checkinReminderTime: text(raw.checkinReminderTime, 5),
    notes: text(raw.notes, 500),
    updatedAt:
      typeof raw.updatedAt === "string" &&
      !Number.isNaN(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function emptyActivityDrafts() {
  return {
    schedule: null,
    todo: null,
    checkin: null,
  };
}

export function readActivityDrafts(storage = localStorage) {
  try {
    const stored = storage.getItem(ACTIVITY_DRAFT_STORAGE_KEY);
    const payload = stored ? JSON.parse(stored) : {};
    const drafts = emptyActivityDrafts();
    for (const kind of ACTIVITY_DRAFT_KINDS) {
      drafts[kind] = normalizeDraft(kind, payload?.[kind]);
    }
    return drafts;
  } catch {
    return emptyActivityDrafts();
  }
}

export function writeActivityDraft(
  kind,
  draft,
  storage = localStorage,
) {
  if (!ACTIVITY_DRAFT_KINDS.includes(kind)) {
    return readActivityDrafts(storage);
  }
  const drafts = readActivityDrafts(storage);
  drafts[kind] = normalizeDraft(kind, {
    ...draft,
    updatedAt: new Date().toISOString(),
  });
  storage.setItem(ACTIVITY_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  return drafts;
}

export function removeActivityDraft(kind, storage = localStorage) {
  const drafts = readActivityDrafts(storage);
  if (ACTIVITY_DRAFT_KINDS.includes(kind)) {
    drafts[kind] = null;
    storage.setItem(ACTIVITY_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }
  return drafts;
}

export function clearActivityDrafts(storage = localStorage) {
  storage.removeItem(ACTIVITY_DRAFT_STORAGE_KEY);
}

export function mostRecentDraft(drafts) {
  return ACTIVITY_DRAFT_KINDS.map((kind) => drafts?.[kind])
    .filter(Boolean)
    .sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )[0] ?? null;
}
