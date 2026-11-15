import {
  getScheduleWindow,
  parseISODate,
  timeToMinutes,
  todayISO,
} from "./date-utils.js";
import { occurrencesBetween } from "./schedule.js";

const REMINDER_KIND = "daily-route-reminder";
const CHANNEL_ID = "daily-route-reminders";

export function isNativeApp() {
  return (
    globalThis.DailyRouteNative?.Capacitor?.isNativePlatform?.() ===
    true
  );
}

function getPlugin(name) {
  if (!isNativeApp()) {
    return null;
  }
  return globalThis.DailyRouteNative?.[name] ?? null;
}

function reminderDate(occurrence, minutesBefore) {
  const date = parseISODate(occurrence.date);
  const minutes = timeToMinutes(occurrence.series.startTime);
  if (!date || minutes === null) {
    return null;
  }

  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
  result.setMinutes(result.getMinutes() - minutesBefore);
  return result;
}

function notificationId(seriesId, occurrenceDate) {
  const value = `${seriesId}|${occurrenceDate}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

export function buildReminderPlan(
  events,
  {
    startDate = todayISO(),
    endDate = getScheduleWindow(startDate).endDate,
    now = new Date(),
  } = {},
) {
  const plan = [];
  const usedIds = new Set();

  for (const occurrence of occurrencesBetween(events, startDate, endDate)) {
    const { series } = occurrence;
    if (!series.reminderEnabled) {
      continue;
    }

    const at = reminderDate(
      occurrence,
      series.reminderMinutesBefore,
    );
    if (!at || at.getTime() <= now.getTime()) {
      continue;
    }

    let id = notificationId(series.id, occurrence.date);
    while (usedIds.has(id)) {
      id = (id + 1) & 0x7fffffff;
    }
    usedIds.add(id);

    const timeRange = `${series.startTime}–${series.endTime}`;
    const note = series.notes.trim();
    plan.push({
      id,
      seriesId: series.id,
      occurrenceDate: occurrence.date,
      title: series.title,
      body: note ? `${timeRange} · ${note.slice(0, 120)}` : timeRange,
      at,
      minutesBefore: series.reminderMinutesBefore,
    });
  }

  return plan.sort(
    (left, right) =>
      left.at.getTime() - right.at.getTime() ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
}

export async function getNotificationPermissionState() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return { supported: false, granted: false, display: "unsupported" };
  }

  const result = await plugin.checkPermissions();
  return {
    supported: true,
    granted: result.display === "granted",
    display: result.display,
  };
}

export async function requestNotificationPermission() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return { supported: false, granted: false, display: "unsupported" };
  }

  const result = await plugin.requestPermissions();
  return {
    supported: true,
    granted: result.display === "granted",
    display: result.display,
  };
}

async function cancelOwnedNotifications(plugin) {
  const pending = await plugin.getPending();
  const owned = (pending.notifications ?? []).filter(
    (notification) => notification.extra?.kind === REMINDER_KIND,
  );
  if (owned.length > 0) {
    await plugin.cancel({
      notifications: owned.map((notification) => ({
        id: notification.id,
      })),
    });
  }
}

export async function syncScheduledNotifications(events) {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return { supported: false, granted: false, scheduled: 0 };
  }

  const permission = await getNotificationPermissionState();
  if (!permission.granted) {
    return { ...permission, scheduled: 0 };
  }

  await plugin.createChannel({
    id: CHANNEL_ID,
    name: "活动提醒",
    description: "Daily Route 活动开始前提醒",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
  await cancelOwnedNotifications(plugin);

  const plan = buildReminderPlan(events);
  if (plan.length > 0) {
    await plugin.schedule({
      notifications: plan.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channelId: CHANNEL_ID,
        isExactNotification: false,
        schedule: {
          at: item.at,
          allowWhileIdle: false,
        },
        extra: {
          kind: REMINDER_KIND,
          seriesId: item.seriesId,
          occurrenceDate: item.occurrenceDate,
        },
      })),
    });
  }

  return {
    ...permission,
    scheduled: plan.length,
  };
}

export async function clearScheduledNotifications() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return;
  }
  await cancelOwnedNotifications(plugin);
}

export async function registerNotificationActionListener(callback) {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin?.addListener) {
    return () => {};
  }

  const listener = await plugin.addListener(
    "localNotificationActionPerformed",
    (event) => {
      const extra = event.notification?.extra;
      if (extra?.kind === REMINDER_KIND) {
        callback(extra);
      }
    },
  );

  return () => listener.remove();
}
