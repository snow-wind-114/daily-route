import { addDays, getScheduleWindow, todayISO } from "./date-utils.js";
import { isNativeApp } from "./notifications.js";
import { occurrencesBetween } from "./schedule.js";
import {
  activeCheckinsForDate,
  todosDueOnDate,
} from "./activities.js";

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
  for (const occurrence of occurrencesBetween(events, startDate, endDate)) {
    const items = days[occurrence.date] ?? [];
    items.push({
      kind: "schedule",
      seriesId: occurrence.series.id,
      originalDate: occurrence.originalDate,
      title: occurrence.series.title,
      startTime: occurrence.series.startTime,
      endTime: occurrence.series.endTime,
      reminderMode: occurrence.series.reminderMode,
    });
    days[occurrence.date] = items;
  }

  for (const activity of events) {
    if (activity.kind !== "todo") {
      continue;
    }
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      if (todosDueOnDate([activity], date).length === 0) {
        if (date === endDate) {
          break;
        }
        continue;
      }
      const items = days[date] ?? [];
      items.push({
        kind: "todo",
        seriesId: activity.id,
        originalDate: date,
        title: `截止：${activity.title}`,
        startTime: activity.deadlineTime,
        endTime: activity.deadlineTime,
        reminderMode: activity.reminderMode,
      });
      days[date] = items;
      break;
    }
  }

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const checkins = activeCheckinsForDate(events, date);
    if (checkins.length === 0) {
      if (date === endDate) {
        break;
      }
      continue;
    }
    const items = days[date] ?? [];
    items.push({
      kind: "checkin",
      seriesId: checkins[0].id,
      originalDate: date,
      title:
        checkins.length === 1
          ? `打卡：${checkins[0].title}`
          : `${checkins.length} 项打卡`,
      startTime: "",
      endTime: "",
      reminderMode: "none",
    });
    days[date] = items;
  }

  for (const items of Object.values(days)) {
    items.sort((left, right) =>
      (left.startTime || "99:99").localeCompare(
        right.startTime || "99:99",
      ),
    );
  }

  return {
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
  if (!result?.seriesId || !result?.date) {
    return null;
  }
  return {
    seriesId: result.seriesId,
    date: result.date,
    originalDate: result.originalDate || result.date,
  };
}

export async function registerWidgetLaunchListener(callback) {
  const plugin = getWidgetPlugin();
  if (!plugin?.addListener) {
    return () => {};
  }
  const listener = await plugin.addListener("widgetOpen", (event) => {
    if (event?.seriesId && event?.date) {
      callback({
        seriesId: event.seriesId,
        date: event.date,
        originalDate: event.originalDate || event.date,
      });
    }
  });
  return () => listener.remove();
}
