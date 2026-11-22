import {
  activeCheckinsForDate,
  isCheckedIn,
  todosDueOnDate,
} from "./activities.js";
import { addDays, getScheduleWindow, todayISO } from "./date-utils.js";
import { isNativeApp } from "./notifications.js";
import { occurrencesBetween } from "./schedule.js";

function getWidgetPlugin() {
  return isNativeApp()
    ? globalThis.DailyRouteNative?.DailyRouteWidget ?? null
    : null;
}

export function buildWidgetSnapshot(
  events,
  { startDate = todayISO(), endDate = getScheduleWindow(startDate).endDate } = {},
) {
  const days = {};
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const schedules = occurrencesBetween(events, date, date).map(
      (occurrence) => ({
        kind: "schedule",
        seriesId: occurrence.series.id,
        originalDate: occurrence.originalDate,
        title: occurrence.series.title,
        startTime: occurrence.series.startTime,
        endTime: occurrence.series.endTime,
        reminderMode: occurrence.series.reminderMode,
      }),
    );
    schedules.sort((left, right) =>
      left.startTime.localeCompare(right.startTime),
    );

    const todos = todosDueOnDate(events, date)
      .sort((left, right) =>
        left.deadlineTime.localeCompare(right.deadlineTime),
      )
      .map((activity) => ({
        kind: "todo",
        seriesId: activity.id,
        originalDate: date,
        title: activity.title,
        startTime: activity.deadlineTime,
        endTime: activity.deadlineTime,
        reminderMode: activity.reminderMode,
      }));
    const checkins = activeCheckinsForDate(events, date);
    const checked = checkins.filter((activity) =>
      isCheckedIn(activity, date),
    ).length;

    if (
      schedules.length > 0 ||
      todos.length > 0 ||
      checkins.length > 0
    ) {
      days[date] = {
        schedules,
        todos,
        checkins: {
          total: checkins.length,
          checked,
        },
      };
    }
  }

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    startDate,
    endDate,
    days,
  };
}

export async function syncNativeWidgetSnapshot(events) {
  const plugin = getWidgetPlugin();
  if (!plugin) {
    return false;
  }
  await plugin.setSnapshot({
    json: JSON.stringify(buildWidgetSnapshot(events)),
  });
  return true;
}

export async function clearNativeWidgetSnapshot() {
  const plugin = getWidgetPlugin();
  if (!plugin) {
    return false;
  }
  await plugin.clearSnapshot();
  return true;
}

export async function consumeWidgetLaunch() {
  const plugin = getWidgetPlugin();
  if (!plugin) {
    return null;
  }
  const result = await plugin.consumePendingOpen();
  if (!result?.kind) {
    return null;
  }
  return {
    seriesId: result.seriesId || "",
    date: result.date || todayISO(),
    originalDate: result.originalDate || result.date || todayISO(),
    kind: result.kind,
  };
}

export async function registerWidgetLaunchListener(callback) {
  const plugin = getWidgetPlugin();
  if (!plugin?.addListener) {
    return () => {};
  }
  const listener = await plugin.addListener("widgetOpen", (event) => {
    if (event?.kind) {
      callback({
        seriesId: event.seriesId || "",
        date: event.date || todayISO(),
        originalDate: event.originalDate || event.date || todayISO(),
        kind: event.kind,
      });
    }
  });
  return () => listener.remove();
}
