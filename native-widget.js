import { getScheduleWindow, todayISO } from "./date-utils.js";
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
  for (const occurrence of occurrencesBetween(events, startDate, endDate)) {
    const items = days[occurrence.date] ?? [];
    items.push({
      seriesId: occurrence.series.id,
      originalDate: occurrence.originalDate,
      title: occurrence.series.title,
      startTime: occurrence.series.startTime,
      endTime: occurrence.series.endTime,
      reminderMode: occurrence.series.reminderMode,
    });
    days[occurrence.date] = items;
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
