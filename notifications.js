import {
  isActivityArchived,
  todoReminderDate,
} from "./activities.js";
import {
  clearNativeAlarmJobs,
  scheduleNativeTestAlarm,
  syncNativeAlarmJobs,
} from "./alarm-scheduler.js";
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

export function notificationId(identity, occurrenceDate) {
  const value = `${identity}|${occurrenceDate}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

export function buildReminderPlan(
  activities,
  {
    startDate = todayISO(),
    endDate = getScheduleWindow(startDate).endDate,
    now = new Date(),
  } = {},
) {
  const plan = [];
  const usedIds = new Set();

  const addPlanItem = (item) => {
    if (!item.at || item.at.getTime() <= now.getTime()) {
      return;
    }
    let id = notificationId(item.seriesId, item.occurrenceDate);
    while (usedIds.has(id)) {
      id = (id + 1) & 0x7fffffff;
    }
    usedIds.add(id);
    plan.push({ ...item, id });
  };

  for (const occurrence of occurrencesBetween(activities, startDate, endDate)) {
    const { series } = occurrence;
    if (!series.reminderMode || series.reminderMode === "none") {
      continue;
    }
    const timeRange = `${series.startTime}–${series.endTime}`;
    const note = series.notes.trim();
    addPlanItem({
      kind: "schedule",
      seriesId: series.id,
      occurrenceDate: occurrence.originalDate,
      effectiveDate: occurrence.date,
      title: series.title,
      body: note ? `${timeRange} · ${note.slice(0, 120)}` : timeRange,
      at: reminderDate(occurrence, series.reminderMinutesBefore),
      minutesBefore: series.reminderMinutesBefore,
      mode: series.reminderMode,
    });
  }

  for (const activity of activities) {
    if (
      activity.kind !== "todo" ||
      isActivityArchived(activity) ||
      activity.reminderMode === "none" ||
      activity.deadlineDate < startDate ||
      activity.deadlineDate > endDate
    ) {
      continue;
    }
    const note = activity.notes.trim();
    addPlanItem({
      kind: "todo",
      seriesId: activity.id,
      occurrenceDate: activity.deadlineDate,
      effectiveDate: activity.deadlineDate,
      title: activity.title,
      body: note
        ? `截止 ${activity.deadlineDate} ${activity.deadlineTime} · ${note.slice(0, 110)}`
        : `截止 ${activity.deadlineDate} ${activity.deadlineTime}`,
      at: todoReminderDate(activity),
      minutesBefore: activity.reminderDaysBefore * 1440,
      mode: activity.reminderMode,
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
        alarmChannelImportance: Number(
          diagnostics.alarmChannel?.importance ?? -1,
        ),
        notificationChannelImportance: Number(
          diagnostics.notificationChannel?.importance ?? -1,
        ),
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
      activityKind: item.kind,
      seriesId: item.seriesId,
      occurrenceDate: item.occurrenceDate,
      effectiveDate: item.effectiveDate,
      reminderMode: item.mode,
      exact,
    },
  };
}

async function syncScheduledNotificationsInternal(
  activities,
  { endDate } = {},
) {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return {
      supported: false,
      granted: false,
      exactAlarmGranted: false,
      scheduled: 0,
      alarmPlanned: 0,
      alarmScheduled: 0,
      downgraded: 0,
      nextAt: null,
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
      alarmPlanned: 0,
      alarmScheduled: 0,
      downgraded: 0,
      nextAt: null,
    };
  }

  await createChannels(plugin);
  const channelState = await getReminderChannelState();
  const plan = buildReminderPlan(activities, {
    startDate: todayISO(),
    endDate:
      endDate ??
      getScheduleWindow(todayISO()).endDate,
  });
  const alarmJobs = plan.filter((item) => item.mode === "alarm");
  const regular = plan.filter((item) => item.mode !== "alarm");
  let downgraded = 0;
  let alarmDiagnostics = {
    plannedJobs: alarmJobs.length,
    scheduledSources: 0,
    nextAt: null,
    exactAlarmGranted: exactAlarm.granted,
    lastError: null,
  };

  const canUseNativeAlarm =
    alarmJobs.length > 0 &&
    exactAlarm.granted &&
    !channelState.alarmChannelBlocked;
  if (canUseNativeAlarm) {
    try {
      alarmDiagnostics = await syncNativeAlarmJobs(alarmJobs);
    } catch (error) {
      alarmDiagnostics.lastError = error.message;
    }
  }

  const useDowngradedAlarms =
    alarmJobs.length > 0 &&
    (!canUseNativeAlarm ||
      alarmDiagnostics.supported === false ||
      Number(alarmDiagnostics.scheduledSources ?? 0) === 0);
  const downgradedAlarms = useDowngradedAlarms ? alarmJobs : [];
  const localPlan = [...regular, ...downgradedAlarms];

  if (localPlan.length > 0) {
    await plugin.schedule({
      notifications: localPlan.map((item) => {
        const wantsAlarm = item.mode === "alarm";
        const alarmChannelId =
          wantsAlarm && !channelState.alarmChannelBlocked
            ? ALARM_CHANNEL_ID
            : NOTIFICATION_CHANNEL_ID;
        return scheduledNotification(item, false, alarmChannelId);
      }),
    });
  }
  downgraded += downgradedAlarms.length;

  return {
    ...permission,
    exactAlarmGranted: exactAlarm.granted,
    channelState,
    scheduled: plan.length,
    alarmPlanned: alarmJobs.length,
    alarmScheduled: Number(alarmDiagnostics.scheduledSources ?? 0),
    nextAt:
      alarmDiagnostics.nextAt ??
      (localPlan[0]?.at ? localPlan[0].at.toISOString() : null),
    downgraded,
    lastError: alarmDiagnostics.lastError ?? null,
  };
}

let notificationSyncQueue = Promise.resolve();

export function syncScheduledNotifications(activities, options = {}) {
  const next = notificationSyncQueue.then(
    () => syncScheduledNotificationsInternal(activities, options),
    () => syncScheduledNotificationsInternal(activities, options),
  );
  notificationSyncQueue = next.catch(() => {});
  return next;
}

export async function clearScheduledNotifications() {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    return;
  }
  await cancelOwnedNotifications(plugin);
  await clearNativeAlarmJobs();
}

export async function scheduleTestReminder(
  mode,
  { delaySeconds = 5 } = {},
) {
  const permission = await getNotificationPermissionState();
  if (!permission.granted) {
    throw new Error("请先开启通知权限");
  }

  if (mode === "alarm") {
    try {
      const channels = await getReminderChannelState();
      if (channels.alarmChannelBlocked) {
        throw new Error("活动闹钟通道已关闭");
      }
      await scheduleNativeTestAlarm({ delaySeconds });
      return {
        mode,
        exact: true,
        downgraded: false,
        channelFallback: false,
      };
    } catch (error) {
      const plugin = getPlugin("LocalNotifications");
      if (!plugin) {
        throw error;
      }
      await createChannels(plugin);
      const at = new Date(Date.now() + delaySeconds * 1000);
      await plugin.schedule({
        notifications: [
          {
            id: notificationId(`test-${Date.now()}`, todayISO()),
            title: "闹钟提醒测试",
            body: "原生闹钟不可用，本次已降级为普通通知。",
            channelId: NOTIFICATION_CHANNEL_ID,
            isExactNotification: false,
            isExactMandatory: false,
            schedule: { at, allowWhileIdle: false },
            extra: { kind: REMINDER_KIND, test: true, exact: false },
          },
        ],
      });
      return {
        mode,
        exact: false,
        downgraded: true,
        channelFallback: true,
      };
    }
  }

  const plugin = getPlugin("LocalNotifications");
  if (!plugin) {
    throw new Error("当前设备不支持本地提醒");
  }
  await createChannels(plugin);
  const channelState = await getReminderChannelState();
  if (channelState.notificationChannelBlocked) {
    throw new Error("活动通知通道已关闭，请到系统通知设置中重新开启");
  }
  const at = new Date(Date.now() + delaySeconds * 1000);
  await plugin.schedule({
    notifications: [
      {
        id: notificationId(`test-${Date.now()}`, todayISO()),
        title: "通知提醒测试",
        body: "普通通知最多允许系统延迟几分钟。",
        channelId: NOTIFICATION_CHANNEL_ID,
        isExactNotification: false,
        isExactMandatory: false,
        schedule: { at, allowWhileIdle: false },
        extra: { kind: REMINDER_KIND, test: true, exact: false },
      },
    ],
  });
  return {
    mode,
    exact: false,
    downgraded: false,
    channelFallback: false,
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
