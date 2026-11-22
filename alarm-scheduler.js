function getAlarmPlugin() {
  return globalThis.DailyRouteNative?.Capacitor?.isNativePlatform?.() === true
    ? globalThis.DailyRouteNative?.DailyRouteAlarmScheduler ?? null
    : null;
}

function toNativeJob(item) {
  return {
    id: String(item.id),
    sourceId: item.seriesId,
    kind: item.kind,
    occurrenceDate: item.occurrenceDate,
    destinationDate: item.effectiveDate,
    originalDate: item.occurrenceDate,
    at: item.at.toISOString(),
    title: item.title,
    body: item.body,
    checkinIds: item.checkinIds ?? [],
    test: item.test === true,
  };
}

export async function syncNativeAlarmJobs(items) {
  const plugin = getAlarmPlugin();
  if (!plugin?.syncJobs) {
    return {
      supported: false,
      plannedJobs: 0,
      scheduledSources: 0,
      nextAt: null,
    };
  }
  const result = await plugin.syncJobs({
    json: JSON.stringify(items.map(toNativeJob)),
  });
  return {
    supported: true,
    ...result,
  };
}

export async function getNativeAlarmDiagnostics() {
  const plugin = getAlarmPlugin();
  if (!plugin?.getDiagnostics) {
    return {
      supported: false,
      plannedJobs: 0,
      scheduledSources: 0,
      nextAt: null,
      exactAlarmGranted: false,
      channelImportance: -1,
      lastError: "当前安装包不包含新版闹钟排程器",
    };
  }
  const result = await plugin.getDiagnostics();
  return {
    supported: true,
    ...result,
  };
}

export async function scheduleNativeTestAlarm({ delaySeconds = 5 } = {}) {
  const plugin = getAlarmPlugin();
  if (!plugin?.scheduleTest) {
    throw new Error("当前安装包不包含新版闹钟排程器");
  }
  const at = new Date(Date.now() + delaySeconds * 1000);
  return plugin.scheduleTest({
    at: at.toISOString(),
    title: "闹钟提醒测试",
    body: "活动闹钟原生排程已生效。",
  });
}

export async function clearNativeAlarmJobs() {
  const plugin = getAlarmPlugin();
  if (plugin?.clearAllJobs) {
    await plugin.clearAllJobs();
  }
}

export async function consumeAlarmLaunch() {
  const plugin = getAlarmPlugin();
  if (!plugin?.consumePendingOpen) {
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
    kind: result.kind || "schedule",
  };
}

export async function registerAlarmLaunchListener(callback) {
  const plugin = getAlarmPlugin();
  if (!plugin?.addListener) {
    return () => {};
  }
  const listener = await plugin.addListener("alarmOpen", (event) => {
    if (event?.seriesId && event?.date) {
      callback({
        seriesId: event.seriesId,
        date: event.date,
        originalDate: event.originalDate || event.date,
        kind: event.kind || "schedule",
      });
    }
  });
  return () => listener.remove();
}
