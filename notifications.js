import {
  getScheduleWindow,
  parseISODate,
  timeToMinutes,
  todayISO,
} from "./date-utils.js";
import { occurrencesBetween } from "./schedule.js";

const REMINDER_KIND = "daily-route-reminder";
const NOTIFICATION_CHANNEL_ID = "daily-route-notifications-v1";
const ALARM_CHANNEL_ID = "daily-route-alarms-v1";

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

function getDevicePlugin() {
  return isNativeApp()
    ? globalThis.DailyRouteNative?.DailyRouteDevice ?? null
    : null;
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
    if (!series.reminderMode || series.reminderMode === "none") {
      continue;
    }

    const at = reminderDate(
      occurrence,
      series.reminderMinutesBefore,
    );
    if (!at || at.getTime() <= now.getTime()) {
      continue;
    }

    let id = notificationId(series.id, occurrence.originalDate);
    while (usedIds.has(id)) {
      id = (id + 1) & 0x7fffffff;
    }
    usedIds.add(id);

    const timeRange = `${series.startTime}–${series.endTime}`;
    const note = series.notes.trim();
    plan.push({
      id,
      seriesId: series.id,
      occurrenceDate: occurrence.originalDate,
      effectiveDate: occurrence.date,
      title: series.title,
      body: note ? `${timeRange} · ${note.slice(0, 120)}` : timeRange,
      at,
      minutesBefore: series.reminderMinutesBefore,
      mode: series.reminderMode,
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

export async function getExactAlarmPermissionState() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin?.checkExactNotificationSetting) {
    return { supported: false, granted: false, display: "unsupported" };
  }

  try {
    const result = await plugin.checkExactNotificationSetting();
    return {
      supported: true,
      granted: result.exact_alarm === "granted",
      display: result.exact_alarm,
    };
  } catch {
    return { supported: false, granted: false, display: "unsupported" };
  }
}

export async function requestExactAlarmPermission() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin?.changeExactNotificationSetting) {
    return { supported: false, granted: false, display: "unsupported" };
  }

  try {
    const result = await plugin.changeExactNotificationSetting();
    return {
      supported: true,
      granted: result.exact_alarm === "granted",
      display: result.exact_alarm,
    };
  } catch {
    return getExactAlarmPermissionState();
  }
}

async function createChannels(plugin) {
  await plugin.createChannel({
    id: NOTIFICATION_CHANNEL_ID,
    name: "活动通知",
    description: "不要求准点的活动提醒",
    importance: 4,
    visibility: 1,
    vibration: true,
    sound: "reminder_tone.wav",
  });
  await plugin.createChannel({
    id: ALARM_CHANNEL_ID,
    name: "活动闹钟",
    description: "尽量准点播报的活动闹钟",
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: "alarm_tone.wav",
  });
}

export async function getReminderChannelState() {
  const plugin = getPlugin("LocalNotifications");
  const device = getDevicePlugin();
  if (device?.getReminderDiagnostics) {
    try {
      const diagnostics = await device.getReminderDiagnostics();
      return {
        supported: true,
        notificationsEnabled: diagnostics.notificationsEnabled !== false,
        notificationChannelBlocked:
          diagnostics.notificationChannel?.importance === 0,
        alarmChannelBlocked: diagnostics.alarmChannel?.importance === 0,
        alarmChannelImportance:
          Number(diagnostics.alarmChannel?.importance ?? -1),
        notificationChannelImportance:
          Number(diagnostics.notificationChannel?.importance ?? -1),
      };
    } catch {
      // Fall back to Capacitor channel data below.
    }
  }

  if (!plugin?.listChannels) {
    return {
      supported: false,
      notificationsEnabled: true,
      notificationChannelBlocked: false,
      alarmChannelBlocked: false,
      alarmChannelImportance: -1,
      notificationChannelImportance: -1,
    };
  }

  const result = await plugin.listChannels();
  const channels = result.channels ?? [];
  const alarm = channels.find((channel) => channel.id === ALARM_CHANNEL_ID);
  const notification = channels.find(
    (channel) => channel.id === NOTIFICATION_CHANNEL_ID,
  );
  return {
    supported: true,
    notificationsEnabled: true,
    notificationChannelBlocked: notification?.importance === 0,
    alarmChannelBlocked: alarm?.importance === 0,
    alarmChannelImportance: Number(alarm?.importance ?? -1),
    notificationChannelImportance: Number(notification?.importance ?? -1),
  };
}

export async function openReminderChannelSettings(kind = "app") {
  const device = getDevicePlugin();
  if (!device?.openNotificationSettings) {
    throw new Error("当前设备无法打开通知设置");
  }
  const channelId =
    kind === "alarm"
      ? ALARM_CHANNEL_ID
      : kind === "notification"
        ? NOTIFICATION_CHANNEL_ID
        : null;
  await device.openNotificationSettings({ channelId });
}

async function cancelOwnedNotifications(plugin) {
  const pending = await plugin.getPending();
  const owned = (pending.notifications ?? []).filter(
    (notification) =>
      notification.extra?.kind === REMINDER_KIND &&
      notification.extra?.test !== true,
  );
  if (owned.length > 0) {
    await plugin.cancel({
      notifications: owned.map((notification) => ({
        id: notification.id,
      })),
    });
  }
}

function scheduledNotification(item, exact, channelId = null) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    channelId:
      channelId ??
      (item.mode === "alarm" ? ALARM_CHANNEL_ID : NOTIFICATION_CHANNEL_ID),
    isExactNotification: exact,
    isExactMandatory: exact,
    schedule: {
      at: item.at,
      allowWhileIdle: exact,
    },
    extra: {
      kind: REMINDER_KIND,
      seriesId: item.seriesId,
      occurrenceDate: item.occurrenceDate,
      effectiveDate: item.effectiveDate,
      reminderMode: item.mode,
      exact,
    },
  };
}

export async function syncScheduledNotifications(events) {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return {
      supported: false,
      granted: false,
      exactAlarmGranted: false,
      scheduled: 0,
      downgraded: 0,
    };
  }

  await cancelOwnedNotifications(plugin);
  const [permission, exactAlarm] = await Promise.all([
    getNotificationPermissionState(),
    getExactAlarmPermissionState(),
  ]);
  if (!permission.granted) {
    return {
      ...permission,
      exactAlarmGranted: exactAlarm.granted,
      scheduled: 0,
      downgraded: 0,
    };
  }

  await createChannels(plugin);
  const channelState = await getReminderChannelState();

  const plan = buildReminderPlan(events);
  const regular = plan.filter((item) => item.mode !== "alarm");
  const alarms = plan.filter((item) => item.mode === "alarm");
  let downgraded = 0;
  const alarmChannelId =
    channelState.alarmChannelBlocked
      ? NOTIFICATION_CHANNEL_ID
      : ALARM_CHANNEL_ID;

  if (regular.length > 0) {
    await plugin.schedule({
      notifications: regular.map((item) => scheduledNotification(item, false)),
    });
  }

  if (alarms.length > 0) {
    let alarmDowngraded = channelState.alarmChannelBlocked;
    if (exactAlarm.granted) {
      try {
        await plugin.schedule({
          notifications: alarms.map((item) =>
            scheduledNotification(item, true, alarmChannelId),
          ),
        });
      } catch (error) {
        console.error("精确闹钟安排失败，已降级为普通通知", error);
        await plugin.schedule({
          notifications: alarms.map((item) =>
            scheduledNotification(item, false, alarmChannelId),
          ),
        });
        alarmDowngraded = true;
      }
    } else {
      await plugin.schedule({
        notifications: alarms.map((item) =>
          scheduledNotification(item, false, alarmChannelId),
        ),
      });
      alarmDowngraded = true;
    }
    if (alarmDowngraded) {
      downgraded += alarms.length;
    }
  }

  return {
    ...permission,
    exactAlarmGranted: exactAlarm.granted,
    channelState,
    scheduled: plan.length,
    downgraded,
  };
}

export async function clearScheduledNotifications() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return;
  }
  await cancelOwnedNotifications(plugin);
}

export async function scheduleTestReminder(
  mode,
  { delaySeconds = 5 } = {},
) {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    throw new Error("当前设备不支持本地提醒");
  }

  const permission = await getNotificationPermissionState();
  if (!permission.granted) {
    throw new Error("请先开启通知权限");
  }

  const exactAlarm = await getExactAlarmPermissionState();
  const wantsAlarm = mode === "alarm";
  const exact = wantsAlarm && exactAlarm.granted;
  await createChannels(plugin);
  const channelState = await getReminderChannelState();
  const channelFallback = wantsAlarm && channelState.alarmChannelBlocked;
  const channelId =
    wantsAlarm && !channelFallback
      ? ALARM_CHANNEL_ID
      : NOTIFICATION_CHANNEL_ID;
  if (channelId === NOTIFICATION_CHANNEL_ID &&
      channelState.notificationChannelBlocked) {
    throw new Error("活动通知通道已关闭，请到系统通知设置中重新开启");
  }
  const at = new Date(Date.now() + delaySeconds * 1000);
  const id = notificationId(`test-${Date.now()}`, todayISO());

  const notification = (exactValue) => ({
        id,
        title: wantsAlarm ? "闹钟提醒测试" : "通知提醒测试",
        body: exactValue
          ? "精确闹钟已生效。"
          : wantsAlarm
            ? channelFallback
              ? "活动闹钟通道已关闭，本次改用普通通知发送。"
              : "精确闹钟权限未开启，本次按普通通知发送。"
            : "普通通知最多允许系统延迟几分钟。",
        channelId,
        isExactNotification: exactValue,
        isExactMandatory: exactValue,
        schedule: {
          at,
          allowWhileIdle: exactValue,
        },
        extra: {
          kind: REMINDER_KIND,
          test: true,
          exact: exactValue,
        },
      });

  try {
    await plugin.schedule({ notifications: [notification(exact)] });
  } catch (error) {
    if (!exact) {
      throw error;
    }
    await plugin.schedule({ notifications: [notification(false)] });
    return {
      mode,
      exact: false,
      downgraded: true,
      channelFallback,
    };
  }

  return {
    mode,
    exact,
    downgraded: wantsAlarm && (!exact || channelFallback),
    channelFallback,
  };
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
      if (extra?.kind === REMINDER_KIND && !extra.test) {
        callback(extra);
      }
    },
  );

  return () => listener.remove();
}
