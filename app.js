import {
  addDays,
  addMonthsToMonth,
  currentTimeParts,
  defaultTimes,
  diffCalendarDays,
  endOfMonth,
  formatDayTitle,
  formatMonthTitle,
  formatShortDate,
  getScheduleWindow,
  mondayBasedWeekday,
  parseISODate,
  startOfMonth,
  timeToMinutes,
  todayISO,
} from "./date-utils.js";
import {
  applyOccurrenceOverride,
  deleteOccurrenceAndFuture,
  findConflictWithinRange,
  findScheduleConflict,
  getOccurrenceOverride,
  getOccurrenceIndex,
  isSeriesPaused,
  lastOccurrenceOnOrBefore,
  occupancyByDayBetween,
  occurrencesBetween,
  occurrencesOnDate,
  pauseSeries,
  remainingRepeatCount,
  resumeSeries,
  seriesFromInput,
  splitSeriesForEdit,
  unmatchedOverridesForSeriesEdit,
  validateActivityInput,
} from "./schedule.js";
import {
  createLocalAccount,
  updateAccountPassword,
  validateAccountInput,
  verifyAccountPassword,
} from "./account.js";
import {
  NATIVE_STORAGE_KEY,
  WEB_STORAGE_KEY,
  migrateNativeState,
  readNativeState,
  readWebEvents,
  removeNativeState,
  writeNativeState,
  writeWebEvents,
} from "./app-state.js";
import {
  createBackup,
  parseBackup,
  summarizeEvents,
} from "./backup.js";
import {
  clearScheduledNotifications,
  getExactAlarmPermissionState,
  isNativeApp,
  registerNotificationActionListener,
  requestExactAlarmPermission,
  requestNotificationPermission,
  scheduleTestReminder,
  syncScheduledNotifications,
} from "./notifications.js";
import { shareNativeBackup } from "./native-files.js";
import {
  addRecoveryPoint,
  clearRecoveryPoints,
  markManualExport,
  readLastManualExport,
  readRecoveryPoints,
  shouldRemindBackup,
} from "./recovery.js";
import { checkForUpdate } from "./update-check.js";
import {
  clearNativeWidgetSnapshot,
  consumeWidgetLaunch,
  registerWidgetLaunchListener,
  syncNativeWidgetSnapshot,
} from "./native-widget.js";

const APP_VERSION = "0.3.0";
const APP_VERSION_CODE = 3;
const SLOT_HEIGHT = 44;
const PIXELS_PER_MINUTE = SLOT_HEIGHT / 30;
const nativeApp = isNativeApp();

if (nativeApp) {
  document.documentElement.classList.add("is-native");
}

const elements = {
  appShell: document.querySelector("#appShell"),
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  authKicker: document.querySelector("#authKicker"),
  authTitle: document.querySelector("#authTitle"),
  authDescription: document.querySelector("#authDescription"),
  authUsername: document.querySelector("#authUsername"),
  authPassword: document.querySelector("#authPassword"),
  authPasswordConfirm: document.querySelector("#authPasswordConfirm"),
  authConfirmField: document.querySelector("#authConfirmField"),
  authError: document.querySelector("#authError"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  forgotPasswordButton: document.querySelector("#forgotPasswordButton"),
  viewKicker: document.querySelector("#viewKicker"),
  viewTitle: document.querySelector("#viewTitle"),
  viewSummary: document.querySelector("#viewSummary"),
  webPreviewBanner: document.querySelector("#webPreviewBanner"),
  dayView: document.querySelector("#dayView"),
  weekView: document.querySelector("#weekView"),
  monthView: document.querySelector("#monthView"),
  activityView: document.querySelector("#activityView"),
  dayNavButton: document.querySelector("#dayNavButton"),
  weekNavButton: document.querySelector("#weekNavButton"),
  monthNavButton: document.querySelector("#monthNavButton"),
  activityNavButton: document.querySelector("#activityNavButton"),
  previousDayButton: document.querySelector("#previousDayButton"),
  nextDayButton: document.querySelector("#nextDayButton"),
  goTodayButton: document.querySelector("#goTodayButton"),
  dayEmpty: document.querySelector("#dayEmpty"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  timelineScroll: document.querySelector("#timelineScroll"),
  timeLabels: document.querySelector("#timeLabels"),
  eventLayer: document.querySelector("#eventLayer"),
  previousWeekButton: document.querySelector("#previousWeekButton"),
  nextWeekButton: document.querySelector("#nextWeekButton"),
  goCurrentWeekButton: document.querySelector("#goCurrentWeekButton"),
  weekList: document.querySelector("#weekList"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  goCurrentMonthButton: document.querySelector("#goCurrentMonthButton"),
  monthGrid: document.querySelector("#monthGrid"),
  activitySearch: document.querySelector("#activitySearch"),
  activeActivitySection: document.querySelector("#activeActivitySection"),
  pausedActivitySection: document.querySelector("#pausedActivitySection"),
  inactiveActivitySection: document.querySelector("#inactiveActivitySection"),
  activeActivityCount: document.querySelector("#activeActivityCount"),
  pausedActivityCount: document.querySelector("#pausedActivityCount"),
  inactiveActivityCount: document.querySelector("#inactiveActivityCount"),
  activeActivityList: document.querySelector("#activeActivityList"),
  pausedActivityList: document.querySelector("#pausedActivityList"),
  inactiveActivityList: document.querySelector("#inactiveActivityList"),
  activityEmpty: document.querySelector("#activityEmpty"),
  androidDownloadButton: document.querySelector("#androidDownloadButton"),
  webExportButton: document.querySelector("#webExportButton"),
  accountButton: document.querySelector("#accountButton"),
  addTopButton: document.querySelector("#addTopButton"),
  addFab: document.querySelector("#addFab"),
  eventDialog: document.querySelector("#eventDialog"),
  eventForm: document.querySelector("#eventForm"),
  eventDialogKicker: document.querySelector("#eventDialogKicker"),
  eventDialogTitle: document.querySelector("#eventDialogTitle"),
  closeEventDialog: document.querySelector("#closeEventDialog"),
  cancelEventButton: document.querySelector("#cancelEventButton"),
  eventName: document.querySelector("#eventName"),
  eventDate: document.querySelector("#eventDate"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  repeatEvery: document.querySelector("#repeatEvery"),
  repeatCount: document.querySelector("#repeatCount"),
  repeatCountField: document.querySelector("#repeatCountField"),
  repeatModeInputs: document.querySelectorAll('input[name="repeatMode"]'),
  editScopeField: document.querySelector("#editScopeField"),
  editScopeInputs: document.querySelectorAll('input[name="editScope"]'),
  repeatModeField: document.querySelector("#repeatModeField"),
  repeatEveryField: document.querySelector("#repeatEveryField"),
  reminderField: document.querySelector("#reminderField"),
  reminderModeInputs: document.querySelectorAll('input[name="reminderMode"]'),
  reminderMinutesField: document.querySelector("#reminderMinutesField"),
  reminderMinutesBefore: document.querySelector("#reminderMinutesBefore"),
  reminderStatusNote: document.querySelector("#reminderStatusNote"),
  eventNotes: document.querySelector("#eventNotes"),
  editScopeNote: document.querySelector("#editScopeNote"),
  formError: document.querySelector("#formError"),
  pauseEventButton: document.querySelector("#pauseEventButton"),
  deleteEventButton: document.querySelector("#deleteEventButton"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogMessage: document.querySelector("#deleteDialogMessage"),
  cancelDeleteButton: document.querySelector("#cancelDeleteButton"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  accountDialog: document.querySelector("#accountDialog"),
  accountName: document.querySelector("#accountName"),
  notificationPermissionText: document.querySelector(
    "#notificationPermissionText",
  ),
  exactAlarmPermissionText: document.querySelector(
    "#exactAlarmPermissionText",
  ),
  backupStatusText: document.querySelector("#backupStatusText"),
  closeAccountDialog: document.querySelector("#closeAccountDialog"),
  changePasswordButton: document.querySelector("#changePasswordButton"),
  exportDataButton: document.querySelector("#exportDataButton"),
  importDataButton: document.querySelector("#importDataButton"),
  recoveryButton: document.querySelector("#recoveryButton"),
  checkUpdateButton: document.querySelector("#checkUpdateButton"),
  testNotificationButton: document.querySelector("#testNotificationButton"),
  testAlarmButton: document.querySelector("#testAlarmButton"),
  openAlarmSettingsButton: document.querySelector("#openAlarmSettingsButton"),
  updateStatusText: document.querySelector("#updateStatusText"),
  logoutButton: document.querySelector("#logoutButton"),
  passwordDialog: document.querySelector("#passwordDialog"),
  passwordForm: document.querySelector("#passwordForm"),
  closePasswordDialog: document.querySelector("#closePasswordDialog"),
  cancelPasswordButton: document.querySelector("#cancelPasswordButton"),
  currentPassword: document.querySelector("#currentPassword"),
  newPassword: document.querySelector("#newPassword"),
  newPasswordConfirm: document.querySelector("#newPasswordConfirm"),
  passwordError: document.querySelector("#passwordError"),
  resetAccountDialog: document.querySelector("#resetAccountDialog"),
  resetConfirmInput: document.querySelector("#resetConfirmInput"),
  resetError: document.querySelector("#resetError"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  importDialog: document.querySelector("#importDialog"),
  importDialogMessage: document.querySelector("#importDialogMessage"),
  cancelImportButton: document.querySelector("#cancelImportButton"),
  confirmImportButton: document.querySelector("#confirmImportButton"),
  importFileInput: document.querySelector("#importFileInput"),
  pauseDialog: document.querySelector("#pauseDialog"),
  pauseDialogMessage: document.querySelector("#pauseDialogMessage"),
  cancelPauseButton: document.querySelector("#cancelPauseButton"),
  confirmPauseButton: document.querySelector("#confirmPauseButton"),
  overrideDiscardDialog: document.querySelector("#overrideDiscardDialog"),
  overrideDiscardMessage: document.querySelector(
    "#overrideDiscardMessage",
  ),
  cancelOverrideDiscardButton: document.querySelector(
    "#cancelOverrideDiscardButton",
  ),
  confirmOverrideDiscardButton: document.querySelector(
    "#confirmOverrideDiscardButton",
  ),
  recoveryDialog: document.querySelector("#recoveryDialog"),
  closeRecoveryDialog: document.querySelector("#closeRecoveryDialog"),
  recoveryList: document.querySelector("#recoveryList"),
  updateDialog: document.querySelector("#updateDialog"),
  updateDialogTitle: document.querySelector("#updateDialogTitle"),
  updateDialogMessage: document.querySelector("#updateDialogMessage"),
  updateNotes: document.querySelector("#updateNotes"),
  closeUpdateButton: document.querySelector("#closeUpdateButton"),
  openUpdateButton: document.querySelector("#openUpdateButton"),
  toast: document.querySelector("#toast"),
};

const initialData = loadInitialData();
const state = {
  events: initialData.events,
  account: initialData.account,
  authenticated: initialData.authenticated,
  storageCorrupt: initialData.storageCorrupt,
  platform: nativeApp ? "android" : "web",
  view: "day",
  selectedDate: todayISO(),
  weekCursor: startOfWeek(todayISO()),
  monthCursor: startOfMonth(todayISO()),
  editing: null,
  pendingDelete: null,
  activityQuery: "",
  autoScrollDay: true,
  dayScrollTarget: null,
  notificationStatus: null,
  pendingImportEvents: null,
  pendingSeriesEdit: null,
  pendingPause: null,
  pendingUpdate: null,
};

let toastTimer = null;

function startOfWeek(isoDate) {
  return addDays(isoDate, -mondayBasedWeekday(isoDate));
}

function endOfWeek(isoDate) {
  return addDays(startOfWeek(isoDate), 6);
}

function loadInitialData() {
  if (nativeApp) {
    const loaded = migrateNativeState();
    if (loaded.status === "ok") {
      return {
        events: loaded.state.events,
        account: loaded.state.account,
        authenticated: loaded.state.sessionActive,
        storageCorrupt: false,
      };
    }

    if (loaded.status === "migrate") {
      return {
        events: loaded.state.events,
        account: loaded.state.account,
        authenticated: loaded.state.sessionActive,
        storageCorrupt: false,
      };
    }

    return {
      events: [],
      account: null,
      authenticated: false,
      storageCorrupt: loaded.status === "corrupt",
    };
  }

  try {
    return {
      events: readWebEvents(),
      account: null,
      authenticated: true,
      storageCorrupt: false,
    };
  } catch (error) {
    console.error("读取本地活动失败", error);
    return {
      events: [],
      account: null,
      authenticated: true,
      storageCorrupt: false,
    };
  }
}

function loadEvents() {
  if (nativeApp) {
    const loaded = readNativeState();
    return loaded.status === "ok" ? loaded.state.events : [];
  }

  try {
    return readWebEvents();
  } catch (error) {
    console.error("读取本地活动失败", error);
    return [];
  }
}

function persistEvents() {
  try {
    if (nativeApp) {
      if (!state.account) {
        throw new Error("没有可用的本地账户");
      }
      writeNativeState({
        account: state.account,
        sessionActive: state.authenticated,
        events: state.events,
      });
    } else {
      writeWebEvents(state.events);
    }
    if (nativeApp && state.authenticated) {
      void syncNativeWidgetSnapshot(state.events);
    }
    void refreshNativeNotifications();
    return true;
  } catch (error) {
    console.error("保存本地活动失败", error);
    showToast("保存失败，请检查设备可用空间");
    return false;
  }
}

function notificationStatusText(status) {
  if (!nativeApp) {
    return "网页版不发送系统提醒。";
  }
  if (!status) {
    return "正在检查通知权限…";
  }
  if (!status?.supported) {
    return "当前设备未提供本地通知能力。";
  }
  if (status.display === "error") {
    return "提醒同步失败，请重新打开应用后再试。";
  }
  if (!status.granted) {
    return "通知权限未开启，活动提醒不会送达。";
  }
  if (status.scheduled > 0) {
    const downgraded = status.downgraded > 0
      ? `，其中 ${status.downgraded} 次闹钟因权限不足已降级`
      : "";
    return `通知权限已开启，当前已安排 ${status.scheduled} 次提醒${downgraded}。`;
  }
  return "通知权限已开启，目前没有待安排的活动提醒。";
}

function renderNotificationStatus() {
  const message = notificationStatusText(state.notificationStatus);
  elements.notificationPermissionText.textContent = message;
  elements.reminderStatusNote.textContent = message;
  const exactGranted = state.notificationStatus?.exactAlarmGranted;
  elements.exactAlarmPermissionText.textContent = exactGranted
    ? "精确闹钟权限已开启，闹钟提醒会尽量准点触发。"
    : "精确闹钟权限未开启；选择闹钟的活动会按普通通知降级。";
}

async function refreshNativeNotifications() {
  if (!nativeApp || !state.authenticated || !state.account) {
    return;
  }

  try {
    state.notificationStatus =
      await syncScheduledNotifications(state.events);
  } catch (error) {
    console.error("同步活动提醒失败", error);
    state.notificationStatus = {
      supported: true,
      granted: false,
      display: "error",
      scheduled: 0,
    };
  }
  renderNotificationStatus();
}

function currentReminderMode() {
  return (
    [...elements.reminderModeInputs].find((input) => input.checked)?.value ??
    "none"
  );
  void registerWidgetLaunchListener((target) => {
    if (state.authenticated) {
      openOccurrenceFromExternal(target);
    }
  }).catch((error) => {
    console.error("注册桌面组件点击监听失败", error);
  });
}

function setReminderMode(mode) {
  for (const input of elements.reminderModeInputs) {
    input.checked = input.value === mode;
  }
  updateReminderUi();
}

function updateReminderUi() {
  if (!nativeApp) {
    elements.reminderField.hidden = true;
    return;
  }

  const enabled = currentReminderMode() !== "none";
  elements.reminderMinutesField.classList.toggle(
    "is-disabled",
    !enabled,
  );
  elements.reminderMinutesBefore.disabled = !enabled;
  elements.reminderMinutesBefore.required = enabled;
  elements.reminderField.classList.toggle("is-disabled", !enabled);
}

function renderAuthScreen() {
  const corrupt = state.storageCorrupt;
  const hasAccount = Boolean(state.account);

  elements.authError.hidden = true;
  elements.resetError.hidden = true;
  elements.authSubmitButton.disabled = false;

  if (corrupt) {
    elements.authKicker.textContent = "存储错误";
    elements.authTitle.textContent = "无法读取本地账户";
    elements.authDescription.textContent =
      "应用没有覆盖原有数据。若已保留活动备份，可重置本地账户后重新导入。";
    elements.authForm.hidden = true;
    elements.forgotPasswordButton.hidden = false;
    elements.forgotPasswordButton.textContent = "重置本地账户";
    return;
  }

  elements.authForm.hidden = false;
  elements.authPassword.value = "";
  elements.authPasswordConfirm.value = "";
  elements.authConfirmField.hidden = hasAccount;
  elements.authPasswordConfirm.required = !hasAccount;
  elements.authPassword.autocomplete = hasAccount
    ? "current-password"
    : "new-password";
  elements.authUsername.value = hasAccount
    ? state.account.username
    : "";
  elements.authUsername.readOnly = hasAccount;
  elements.authKicker.textContent = "仅保存在这台手机";
  elements.authTitle.textContent = hasAccount ? "登录" : "创建账户";
  elements.authDescription.textContent = hasAccount
    ? "输入密码继续。登录状态会在此设备上保持。"
    : "创建本地账户后即可导入网页版导出的活动。";
  elements.authSubmitButton.textContent = hasAccount
    ? "登录并进入"
    : "创建并进入";
  elements.forgotPasswordButton.hidden = !hasAccount;
  elements.forgotPasswordButton.textContent = "忘记密码？";
}

function updateAppAccess() {
  if (!nativeApp) {
    elements.authScreen.hidden = true;
    elements.appShell.hidden = false;
    elements.addFab.hidden = false;
    elements.accountButton.hidden = true;
    return;
  }

  const needsAuth = !state.account || !state.authenticated;
  elements.authScreen.hidden = !needsAuth;
  elements.appShell.hidden = needsAuth;
  elements.addFab.hidden = needsAuth;
  elements.accountButton.hidden = needsAuth;

  if (needsAuth) {
    renderAuthScreen();
  }
}

function configurePlatformControls() {
  document.body.classList.toggle("is-native", nativeApp);
  document.body.classList.toggle("is-web", !nativeApp);
  elements.webPreviewBanner.hidden = nativeApp;
  elements.androidDownloadButton.hidden = nativeApp;
  elements.webExportButton.hidden = nativeApp;
  elements.accountButton.hidden = true;
  elements.reminderField.hidden = !nativeApp;
}

function openOccurrenceFromExternal({ seriesId, date, originalDate }) {
  if (!state.authenticated) {
    return;
  }

  const series = state.events.find((event) => event.id === seriesId);
  if (!series || getOccurrenceIndex(series, originalDate) === null) {
    showToast("这条提醒对应的活动已不存在");
    return;
  }

  const occurrences = occurrencesOnDate(state.events, date);
  const occurrence = occurrences.find(
    (item) =>
      item.series.id === seriesId && item.originalDate === originalDate,
  );
  state.selectedDate = date;
  state.monthCursor = startOfMonth(date);
  state.view = "day";
  state.autoScrollDay = true;
  state.dayScrollTarget =
    timeToMinutes(occurrence?.series.startTime ?? series.startTime) - 60;
  render({ scrollTargetMinutes: state.dayScrollTarget });
}

function handleNotificationAction({ seriesId, occurrenceDate, effectiveDate }) {
  openOccurrenceFromExternal({
    seriesId,
    date: effectiveDate || occurrenceDate,
    originalDate: occurrenceDate,
  });
}

async function handleWidgetLaunch() {
  if (!nativeApp || !state.authenticated) {
    return;
  }
  try {
    const target = await consumeWidgetLaunch();
    if (target) {
      openOccurrenceFromExternal(target);
    }
  } catch (error) {
    console.error("读取桌面组件入口失败", error);
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  const confirmation = elements.authPasswordConfirm.value;
  elements.authError.hidden = true;
  elements.authSubmitButton.disabled = true;

  try {
    if (!state.account) {
      const validationError = validateAccountInput(
        username,
        password,
        confirmation,
      );
      if (validationError) {
        throw new Error(validationError);
      }

      state.account = await createLocalAccount({
        username,
        password,
      });
      state.events = [];
      state.authenticated = true;
      state.storageCorrupt = false;
      persistEvents();
      updateAppAccess();
      render();
      showToast("本地账户已创建");
    } else {
      const valid =
        username === state.account.username &&
        (await verifyAccountPassword(state.account, password));
      if (!valid) {
        throw new Error("账户名或密码不正确");
      }

      state.authenticated = true;
      persistEvents();
      updateAppAccess();
      render();
      showToast("已登录");
    }

    void refreshNativeNotifications();
    void syncNativeWidgetSnapshot(state.events);
    void handleWidgetLaunch();
  } catch (error) {
    elements.authError.textContent = error.message;
    elements.authError.hidden = false;
  } finally {
    elements.authSubmitButton.disabled = false;
  }
}

function openAccountDialog() {
  if (!nativeApp || !state.account) {
    return;
  }

  elements.accountName.textContent = state.account.username;
  renderBackupStatus();
  renderNotificationStatus();
  elements.accountDialog.showModal();
  void refreshNativeNotifications();
}

function formatStoredTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "尚未手动导出";
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderBackupStatus() {
  if (!nativeApp) {
    elements.backupStatusText.textContent = "";
    return;
  }
  const lastExport = readLastManualExport();
  if (shouldRemindBackup(lastExport)) {
    elements.backupStatusText.textContent =
      `建议尽快导出一份活动 JSON。上次手动导出：${formatStoredTime(lastExport)}。`;
    elements.backupStatusText.classList.add("is-warning");
  } else {
    elements.backupStatusText.textContent =
      `上次手动导出：${formatStoredTime(lastExport)}。`;
    elements.backupStatusText.classList.remove("is-warning");
  }
}

function snapshotBefore(reason) {
  if (nativeApp && state.events.length > 0) {
    addRecoveryPoint(state.events, reason);
  }
}

function logout() {
  if (!nativeApp || !state.account) {
    return;
  }

  state.authenticated = false;
  persistEvents();
  void clearScheduledNotifications();
  void clearNativeWidgetSnapshot();
  elements.accountDialog.close();
  updateAppAccess();
}

async function handlePasswordChange(event) {
  event.preventDefault();
  elements.passwordError.hidden = true;

  try {
    const current = elements.currentPassword.value;
    const next = elements.newPassword.value;
    const confirmation = elements.newPasswordConfirm.value;
    if (!(await verifyAccountPassword(state.account, current))) {
      throw new Error("当前密码不正确");
    }
    const validationError = validateAccountInput(
      state.account.username,
      next,
      confirmation,
    );
    if (validationError) {
      throw new Error(validationError);
    }

    state.account = await updateAccountPassword(state.account, next);
    persistEvents();
    elements.passwordForm.reset();
    elements.passwordDialog.close();
    showToast("密码已更新");
  } catch (error) {
    elements.passwordError.textContent = error.message;
    elements.passwordError.hidden = false;
  }
}

function openResetDialog() {
  elements.resetConfirmInput.value = "";
  elements.resetError.hidden = true;
  elements.resetAccountDialog.showModal();
}

async function confirmAccountReset() {
  if (elements.resetConfirmInput.value.trim() !== "重置") {
    elements.resetError.textContent = "请输入“重置”两个字";
    elements.resetError.hidden = false;
    return;
  }

  try {
    removeNativeState();
    clearRecoveryPoints();
    await clearScheduledNotifications();
    await clearNativeWidgetSnapshot();
    state.account = null;
    state.authenticated = false;
    state.events = [];
    state.storageCorrupt = false;
    state.notificationStatus = null;
    elements.resetAccountDialog.close();
    updateAppAccess();
    showToast("本地账户已重置");
  } catch (error) {
    elements.resetError.textContent = error.message;
    elements.resetError.hidden = false;
  }
}

function backupFilename() {
  return `daily-route-backup-${todayISO()}.json`;
}

function downloadTextFile(filename, contents) {
  const blob = new Blob([contents], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportActivities() {
  try {
    const backup = createBackup(state.events, {
      appVersion: APP_VERSION,
    });
    const contents = JSON.stringify(backup, null, 2);
    const filename = backupFilename();

    if (nativeApp) {
      const shared = await shareNativeBackup(filename, contents);
      if (!shared) {
        throw new Error("当前设备无法打开系统分享面板");
      }
      markManualExport();
      renderBackupStatus();
      showToast("已打开备份分享面板");
    } else {
      downloadTextFile(filename, contents);
      showToast("活动备份已导出");
    }
  } catch (error) {
    showToast(error.message || "导出活动失败");
  }
}

function openImportFilePicker() {
  elements.importFileInput.value = "";
  elements.importFileInput.click();
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const backup = parseBackup(await file.text());
    const window = getScheduleWindow();
    const conflict = findConflictWithinRange(
      backup.events,
      window.startDate,
      window.endDate,
    );
    if (conflict) {
      throw new Error(
        `备份中有重叠活动：${formatShortDate(conflict.date)}「${conflict.firstSeries.title}」与「${conflict.secondSeries.title}」`,
      );
    }

    state.pendingImportEvents = backup.events;
    const incoming = summarizeEvents(backup.events);
    elements.importDialogMessage.textContent =
      `将用 ${backup.eventCount} 项活动替换当前 ${state.events.length} 项活动。` +
      `导入内容含 ${incoming.notificationCount} 个通知、${incoming.alarmCount} 个闹钟、` +
      `${incoming.pausedCount} 个暂停活动和 ${incoming.overrideCount} 次单次调整。账户与密码不会改变。`;
    elements.importDialog.showModal();
  } catch (error) {
    showToast(error.message || "无法读取备份文件");
  }
}

function confirmImport() {
  if (!state.pendingImportEvents) {
    elements.importDialog.close();
    return;
  }

  snapshotBefore("导入活动前");
  state.events = state.pendingImportEvents;
  state.pendingImportEvents = null;
  persistEvents();
  elements.importDialog.close();
  state.view = "day";
  state.selectedDate = todayISO();
  state.autoScrollDay = true;
  render();
  showToast("活动备份已导入");
}

function renderRecoveryDialog() {
  const points = readRecoveryPoints();
  const fragment = document.createDocumentFragment();

  if (points.length === 0) {
    const empty = document.createElement("p");
    empty.className = "recovery-empty";
    empty.textContent = "还没有自动恢复点。";
    fragment.append(empty);
  } else {
    for (const point of points) {
      const row = document.createElement("div");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const detail = document.createElement("small");
      const restore = document.createElement("button");
      row.className = "recovery-row";
      title.textContent = point.reason;
      detail.textContent = `${formatStoredTime(point.createdAt)} · ${point.events.length} 项活动`;
      restore.type = "button";
      restore.className = "secondary-button";
      restore.textContent = "恢复";
      restore.addEventListener("click", () => {
        snapshotBefore("恢复活动前");
        state.events = point.events;
        persistEvents();
        elements.recoveryDialog.close();
        state.view = "day";
        state.selectedDate = todayISO();
        state.autoScrollDay = true;
        render();
        showToast("已恢复本地活动");
      });
      copy.append(title, detail);
      row.append(copy, restore);
      fragment.append(row);
    }
  }

  elements.recoveryList.replaceChildren(fragment);
}

async function handleUpdateCheck() {
  elements.checkUpdateButton.disabled = true;
  elements.updateStatusText.hidden = false;
  elements.updateStatusText.textContent = "正在检查最新版本…";

  try {
    const result = await checkForUpdate({
      currentVersionCode: APP_VERSION_CODE,
    });
    if (result.state === "latest") {
      elements.updateStatusText.textContent =
        `当前已是最新版 v${APP_VERSION}。`;
      return;
    }

    state.pendingUpdate = result.manifest;
    elements.updateDialogTitle.textContent =
      `发现 v${result.manifest.versionName}`;
    elements.updateDialogMessage.textContent =
      `当前版本 v${APP_VERSION}。下载新 APK 后在浏览器中覆盖安装，账户和活动会保留。`;
    elements.updateNotes.replaceChildren(
      ...result.manifest.notes.map((note) => {
        const item = document.createElement("li");
        item.textContent = note;
        return item;
      }),
    );
    elements.updateDialog.showModal();
  } catch (error) {
    elements.updateStatusText.textContent =
      `暂时无法检查更新：${error.message || "请检查网络后重试"}。`;
  } finally {
    elements.checkUpdateButton.disabled = false;
  }
}

async function openExternalUrl(url) {
  const browser = globalThis.DailyRouteNative?.Browser;
  if (browser?.open) {
    await browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener");
}

function buildTimeLabels() {
  const fragment = document.createDocumentFragment();

  for (let slot = 0; slot <= 48; slot += 1) {
    const minutes = slot * 30;
    const label = document.createElement("span");
    label.className = "time-label";
    label.style.top = `${slot * SLOT_HEIGHT}px`;
    label.textContent =
      slot === 48
        ? "24:00"
        : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${
            minutes % 60 === 0 ? "00" : "30"
          }`;

    if (slot === 0) {
      label.classList.add("is-first");
    } else if (slot === 48) {
      label.classList.add("is-last");
    }

    fragment.append(label);
  }

  elements.timeLabels.append(fragment);
}

function ensureStateWithinWindow(window) {
  if (state.selectedDate < window.startDate) {
    state.selectedDate = window.startDate;
  } else if (state.selectedDate > window.endDate) {
    state.selectedDate = window.startDate;
  }

  const firstMonth = startOfMonth(window.startDate);
  const lastMonth = startOfMonth(window.endDate);
  if (state.monthCursor < firstMonth) {
    state.monthCursor = firstMonth;
  } else if (state.monthCursor > lastMonth) {
    state.monthCursor = lastMonth;
  }

  const firstWeek = startOfWeek(window.startDate);
  const lastWeek = startOfWeek(window.endDate);
  if (state.weekCursor < firstWeek) {
    state.weekCursor = firstWeek;
  } else if (state.weekCursor > lastWeek) {
    state.weekCursor = lastWeek;
  }
}

function setView(view) {
  if (view === "day") {
    state.selectedDate = todayISO();
    state.monthCursor = startOfMonth(state.selectedDate);
    state.autoScrollDay = true;
  } else if (view === "week") {
    state.weekCursor = startOfWeek(todayISO());
  } else if (view === "month") {
    state.monthCursor = startOfMonth(state.selectedDate);
  }

  state.view = view;
  render();
}

function render(options = {}) {
  const todaysDate = todayISO();
  const window = getScheduleWindow(todaysDate);
  ensureStateWithinWindow(window);

  elements.dayView.hidden = state.view !== "day";
  elements.weekView.hidden = state.view !== "week";
  elements.monthView.hidden = state.view !== "month";
  elements.activityView.hidden = state.view !== "activity";
  elements.dayNavButton.classList.toggle("is-active", state.view === "day");
  elements.weekNavButton.classList.toggle("is-active", state.view === "week");
  elements.monthNavButton.classList.toggle("is-active", state.view === "month");
  elements.activityNavButton.classList.toggle(
    "is-active",
    state.view === "activity",
  );
  elements.dayNavButton.setAttribute(
    "aria-current",
    state.view === "day" ? "page" : "false",
  );
  elements.monthNavButton.setAttribute(
    "aria-current",
    state.view === "month" ? "page" : "false",
  );
  elements.weekNavButton.setAttribute(
    "aria-current",
    state.view === "week" ? "page" : "false",
  );
  elements.activityNavButton.setAttribute(
    "aria-current",
    state.view === "activity" ? "page" : "false",
  );

  if (state.view === "day") {
    renderDay(window, options);
  } else if (state.view === "week") {
    renderWeek(window);
  } else if (state.view === "month") {
    renderMonth(window);
  } else {
    renderActivities(window);
  }
}

function renderDay(window, options = {}) {
  const previousScrollTop = elements.timelineScroll.scrollTop;
  const occurrences = occurrencesOnDate(state.events, state.selectedDate);
  const isToday = state.selectedDate === window.startDate;

  elements.viewKicker.textContent = isToday ? "今天" : "活动安排";
  elements.viewTitle.textContent = formatDayTitle(state.selectedDate);
  elements.viewSummary.textContent =
    occurrences.length === 0 ? "暂无活动" : `${occurrences.length} 项活动`;

  elements.previousDayButton.disabled =
    state.selectedDate <= window.startDate;
  elements.nextDayButton.disabled = state.selectedDate >= window.endDate;
  elements.goTodayButton.disabled = isToday;
  elements.dayEmpty.hidden = occurrences.length > 0;

  renderTimeline(occurrences, isToday);

  if (options.scrollTargetMinutes !== undefined) {
    state.dayScrollTarget = options.scrollTargetMinutes;
  }

  requestAnimationFrame(() => {
    if (state.autoScrollDay) {
      scrollTimelineToContext(occurrences, isToday);
      state.autoScrollDay = false;
      state.dayScrollTarget = null;
    } else {
      elements.timelineScroll.scrollTop = previousScrollTop;
    }
  });
}

function renderTimeline(occurrences, isToday) {
  const items = layoutOccurrences(occurrences);
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const startMinutes = timeToMinutes(item.occurrence.series.startTime);
    const endMinutes = timeToMinutes(item.occurrence.series.endTime);
    const actualHeight = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;
    const top = startMinutes * PIXELS_PER_MINUTE;
    const columnWidth = 100 / item.columns;
    const button = document.createElement("button");
    const name = document.createElement("span");
    const time = document.createElement("span");

    button.type = "button";
    button.className = "timeline-event";
    button.style.top = `${top}px`;
    button.style.height = `${Math.max(actualHeight, 22)}px`;
    button.style.left = `calc(${item.column * columnWidth}% + 2px)`;
    button.style.width = `calc(${columnWidth}% - 4px)`;
    button.dataset.seriesId = item.occurrence.series.id;
    button.dataset.occurrenceDate = state.selectedDate;
    button.title = `${item.occurrence.series.title} ${item.occurrence.series.startTime}–${item.occurrence.series.endTime}`;

    if (actualHeight < 56) {
      button.classList.add("is-short");
    }
    if (actualHeight < 34) {
      button.classList.add("is-compact");
    }

    name.className = "event-name";
    name.textContent = item.occurrence.series.title;
    time.className = "event-time";
    time.textContent = `${item.occurrence.series.startTime}–${item.occurrence.series.endTime}`;

    button.append(name, time);
    button.addEventListener("click", () => {
      openEditDialog(
        item.occurrence.originalSeries,
        item.occurrence.originalDate,
      );
    });
    fragment.append(button);
  }

  if (isToday) {
    const current = currentTimeParts();
    const line = document.createElement("div");
    line.className = "current-time-line";
    line.style.top = `${current.minutes * PIXELS_PER_MINUTE}px`;
    line.setAttribute("aria-hidden", "true");
    fragment.append(line);
  }

  elements.eventLayer.replaceChildren(fragment);
}

function layoutOccurrences(occurrences) {
  const items = occurrences
    .map((occurrence) => ({
      occurrence,
      start: timeToMinutes(occurrence.series.startTime),
      end: timeToMinutes(occurrence.series.endTime),
      column: 0,
      columns: 1,
    }))
    .sort((left, right) => left.start - right.start || right.end - left.end);

  let cursor = 0;
  while (cursor < items.length) {
    const group = [items[cursor]];
    let groupEnd = items[cursor].end;
    let next = cursor + 1;

    while (next < items.length && items[next].start < groupEnd) {
      group.push(items[next]);
      groupEnd = Math.max(groupEnd, items[next].end);
      next += 1;
    }

    const active = [];
    let maxColumns = 1;
    for (const item of group) {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (active[index].end <= item.start) {
          active.splice(index, 1);
        }
      }

      const usedColumns = new Set(active.map((entry) => entry.column));
      let column = 0;
      while (usedColumns.has(column)) {
        column += 1;
      }

      item.column = column;
      active.push(item);
      maxColumns = Math.max(maxColumns, active.length);
    }

    for (const item of group) {
      item.columns = maxColumns;
    }

    cursor = next;
  }

  return items;
}

function scrollTimelineToContext(occurrences, isToday) {
  let targetMinutes;

  if (state.dayScrollTarget !== null) {
    targetMinutes = state.dayScrollTarget;
  } else if (isToday) {
    targetMinutes = currentTimeParts().minutes - 60;
  } else if (occurrences.length > 0) {
    targetMinutes =
      timeToMinutes(occurrences[0].series.startTime) - 30;
  } else {
    targetMinutes = 7 * 60;
  }

  elements.timelineScroll.scrollTop = Math.max(
    0,
    targetMinutes * PIXELS_PER_MINUTE - 36,
  );
}

function renderWeek(window) {
  const weekStart = state.weekCursor;
  const weekEnd = addDays(weekStart, 6);
  const visibleStart =
    weekStart < window.startDate ? window.startDate : weekStart;
  const visibleEnd = weekEnd > window.endDate ? window.endDate : weekEnd;
  const occurrences =
    visibleStart <= visibleEnd
      ? occurrencesBetween(state.events, visibleStart, visibleEnd)
      : [];
  const firstWeek = startOfWeek(window.startDate);
  const lastWeek = startOfWeek(window.endDate);

  elements.viewKicker.textContent =
    weekStart === firstWeek ? "本周" : "周安排";
  elements.viewTitle.textContent =
    `${formatShortDate(weekStart)}–${formatShortDate(weekEnd)}`;
  elements.viewSummary.textContent = `${occurrences.length} 项活动`;
  elements.previousWeekButton.disabled = weekStart <= firstWeek;
  elements.nextWeekButton.disabled = weekStart >= lastWeek;
  elements.goCurrentWeekButton.disabled = weekStart === firstWeek;

  const fragment = document.createDocumentFragment();
  const today = todayISO();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const enabled = date >= window.startDate && date <= window.endDate;
    const dayOccurrences = enabled
      ? occurrencesOnDate(state.events, date)
      : [];
    const day = document.createElement("article");
    const header = document.createElement("div");
    const dateButton = document.createElement("button");
    const weekday = document.createElement("span");
    const dateLabel = document.createElement("span");
    const count = document.createElement("span");
    const events = document.createElement("div");

    day.className = "week-day";
    day.classList.toggle("is-today", date === today);
    day.classList.toggle("is-unavailable", !enabled);
    header.className = "week-day-header";
    dateButton.type = "button";
    dateButton.className = "week-date-button";
    dateButton.disabled = !enabled;
    dateButton.setAttribute("aria-label", formatDayTitle(date));
    weekday.className = "week-weekday";
    weekday.textContent = formatDayTitle(date).split(" ").at(-1);
    dateLabel.className = "week-date";
    dateLabel.textContent = formatShortDate(date);
    count.className = "week-day-count";
    count.textContent = enabled ? `${dayOccurrences.length} 项` : "不可查看";
    dateButton.append(weekday, dateLabel);
    header.append(dateButton, count);
    events.className = "week-events";

    if (dayOccurrences.length === 0) {
      const empty = document.createElement("div");
      empty.className = "week-empty";
      empty.textContent = enabled ? "暂无安排" : "过去日期不可查看";
      events.append(empty);
    } else {
      for (const occurrence of dayOccurrences) {
        const eventButton = document.createElement("button");
        const time = document.createElement("span");
        const name = document.createElement("span");
        eventButton.type = "button";
        eventButton.className = "week-event";
        eventButton.setAttribute(
          "aria-label",
          `${occurrence.series.title}，${occurrence.series.startTime}–${occurrence.series.endTime}`,
        );
        time.className = "week-event-time";
        time.textContent =
          `${occurrence.series.startTime}–${occurrence.series.endTime}`;
        name.className = "week-event-name";
        name.textContent = occurrence.series.title;
        eventButton.append(time, name);
        eventButton.addEventListener("click", () => {
          openEditDialog(
            occurrence.originalSeries,
            occurrence.originalDate,
          );
        });
        events.append(eventButton);
      }
    }

    if (enabled) {
      dateButton.addEventListener("click", () => {
        state.selectedDate = date;
        state.view = "day";
        state.autoScrollDay = true;
        render();
      });
    }

    day.append(header, events);
    fragment.append(day);
  }

  elements.weekList.replaceChildren(fragment);
}

function renderMonth(window) {
  const monthStart = startOfMonth(state.monthCursor);
  const monthEnd = endOfMonth(state.monthCursor);
  const leadingDays = mondayBasedWeekday(monthStart);
  const gridStart = addDays(monthStart, -leadingDays);
  const gridEnd = addDays(gridStart, 41);
  const occupancy = occupancyByDayBetween(
    state.events,
    window.startDate,
    window.endDate,
  );
  const busyCount = [...occupancy.entries()].filter(
    ([date]) => date >= monthStart && date <= monthEnd,
  ).length;

  elements.viewKicker.textContent = "本月";
  elements.viewTitle.textContent = formatMonthTitle(state.monthCursor);
  elements.viewSummary.textContent =
    busyCount === 0 ? "本月暂无活动" : `本月 ${busyCount} 天有安排`;
  const firstMonth = startOfMonth(window.startDate);
  const lastMonth = startOfMonth(window.endDate);
  elements.previousMonthButton.disabled = monthStart <= firstMonth;
  elements.nextMonthButton.disabled = monthStart >= lastMonth;
  elements.goCurrentMonthButton.disabled = monthStart === firstMonth;

  const fragment = document.createDocumentFragment();
  const today = todayISO();

  for (let offset = 0; offset < 42; offset += 1) {
    const date = addDays(gridStart, offset);
    const dayOccupancy = occupancy.get(date);
    const count = dayOccupancy?.count ?? 0;
    const enabled = date >= window.startDate && date <= window.endDate;
    const cell = document.createElement("button");
    const dayNumber = document.createElement("span");

    cell.type = "button";
    cell.className = "day-cell";
    cell.dataset.date = date;
    cell.disabled = !enabled;
    cell.classList.toggle("is-outside", date < monthStart || date > monthEnd);
    cell.classList.toggle("has-events", count > 0);
    cell.classList.toggle("is-today", date === today);
    cell.classList.toggle("is-selected", date === state.selectedDate);
    cell.setAttribute(
      "aria-label",
      `${formatDayTitle(date)}，${count > 0 ? `${count} 项活动` : "无活动"}${
        dayOccupancy
          ? `，占用时间 ${describeOccupiedSlots(dayOccupancy.slots)}`
          : ""
      }${
        enabled ? "" : "，不在可查看范围"
      }`,
    );

    dayNumber.className = "day-number";
    dayNumber.textContent = String(parseISODate(date).getDate());
    cell.append(dayNumber);

    if (enabled) {
      const strip = document.createElement("span");
      strip.className = "occupancy-strip";
      strip.setAttribute("aria-hidden", "true");

      for (let slot = 0; slot < 12; slot += 1) {
        const segment = document.createElement("i");
        segment.className = "occupancy-slot";
        segment.classList.toggle(
          "is-occupied",
          Boolean(dayOccupancy?.slots[slot]),
        );
        strip.append(segment);
      }

      cell.append(strip);
    }

    if (enabled) {
      cell.addEventListener("click", () => {
        state.selectedDate = date;
        state.view = "day";
        state.monthCursor = monthStart;
        state.autoScrollDay = true;
        render();
      });
    }

    fragment.append(cell);
  }

  elements.monthGrid.replaceChildren(fragment);
}

function describeOccupiedSlots(slots) {
  const ranges = [];
  let start = null;

  for (let slot = 0; slot <= slots.length; slot += 1) {
    if (slots[slot] && start === null) {
      start = slot;
    }

    if ((!slots[slot] || slot === slots.length) && start !== null) {
      ranges.push(`${slotTime(start)}–${slotTime(slot)}`);
      start = null;
    }
  }

  return ranges.join("、");
}

function slotTime(slot) {
  if (slot === 12) {
    return "24:00";
  }
  return `${String(slot * 2).padStart(2, "0")}:00`;
}

function formatRecurrenceRule(series) {
  if (series.repeatCount === 1) {
    return "单次活动";
  }

  const count = series.repeatCount === null
    ? "无限次"
    : `共 ${series.repeatCount} 次`;
  return `每 ${series.repeatEvery} 天 · ${count}`;
}

function reminderLabel(series) {
  if (series.reminderMode === "alarm") {
    return `闹钟 · 提前 ${series.reminderMinutesBefore} 分钟`;
  }
  if (series.reminderMode === "notification") {
    return `通知 · 提前 ${series.reminderMinutesBefore} 分钟`;
  }
  return "";
}

function activityRuleText(series) {
  const parts = [formatRecurrenceRule(series)];
  if (series.occurrenceOverrides.length > 0) {
    parts.push(`含 ${series.occurrenceOverrides.length} 次单次调整`);
  }
  const reminder = reminderLabel(series);
  if (reminder && nativeApp) {
    parts.push(reminder);
  }
  return parts.join(" · ");
}

function renderActivities(window) {
  const today = window.startDate;
  const groups = state.events.map((series) => {
    if (isSeriesPaused(series)) {
      return { series, state: "paused" };
    }
    const future = occurrencesBetween([series], today, window.endDate);
    if (future.length > 0) {
      return {
        series,
        state: "active",
        next: future[0],
      };
    }

    return {
      series,
      state: "inactive",
      lastDate: lastOccurrenceOnOrBefore(
        series,
        addDays(today, -1),
      ),
    };
  });
  const active = groups
    .filter((group) => group.state === "active")
    .sort((left, right) => {
      const dateDifference = left.next.date.localeCompare(right.next.date);
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return (
        timeToMinutes(left.series.startTime) -
          timeToMinutes(right.series.startTime) ||
        left.series.title.localeCompare(right.series.title, "zh-CN")
      );
    });
  const inactive = groups
    .filter((group) => group.state === "inactive")
    .sort((left, right) => {
      const leftDate = left.lastDate ?? left.series.date;
      const rightDate = right.lastDate ?? right.series.date;
      return rightDate.localeCompare(leftDate);
    });
  const paused = groups
    .filter((group) => group.state === "paused")
    .sort((left, right) =>
      left.series.title.localeCompare(right.series.title, "zh-CN"),
    );
  const query = state.activityQuery.trim().toLocaleLowerCase("zh-CN");
  const filteredActive = active.filter((group) =>
    group.series.title.toLocaleLowerCase("zh-CN").includes(query),
  );
  const filteredInactive = inactive.filter((group) =>
    group.series.title.toLocaleLowerCase("zh-CN").includes(query),
  );
  const filteredPaused = paused.filter((group) =>
    group.series.title.toLocaleLowerCase("zh-CN").includes(query),
  );

  elements.viewKicker.textContent = "活动";
  elements.viewTitle.textContent = "活动项目";
  elements.viewSummary.textContent = query
    ? `找到 ${filteredActive.length + filteredPaused.length + filteredInactive.length} 个活动`
    : `${active.length} 个进行中 · ${paused.length} 个已暂停 · ${inactive.length} 个已结束`;

  elements.activeActivityCount.textContent = String(filteredActive.length);
  elements.pausedActivityCount.textContent = String(filteredPaused.length);
  elements.inactiveActivityCount.textContent = String(filteredInactive.length);
  elements.activeActivityList.replaceChildren(
    ...filteredActive.map((group) => createActiveActivityRow(group)),
  );
  elements.inactiveActivityList.replaceChildren(
    ...filteredInactive.map((group) => createInactiveActivityRow(group)),
  );
  elements.pausedActivityList.replaceChildren(
    ...filteredPaused.map((group) => createPausedActivityRow(group)),
  );

  if (filteredActive.length === 0) {
    elements.activeActivityList.append(
      createListEmpty("暂无进行中的活动"),
    );
  }
  if (filteredInactive.length === 0) {
    elements.inactiveActivityList.append(
      createListEmpty("暂无已结束的活动"),
    );
  }
  if (filteredPaused.length === 0) {
    elements.pausedActivityList.append(
      createListEmpty("暂无已暂停的活动"),
    );
  }

  const noFilteredResults =
    filteredActive.length === 0 &&
    filteredPaused.length === 0 &&
    filteredInactive.length === 0;
  elements.activeActivitySection.hidden = noFilteredResults;
  elements.pausedActivitySection.hidden = noFilteredResults;
  elements.inactiveActivitySection.hidden = noFilteredResults;
  elements.activityEmpty.hidden = !noFilteredResults;

  if (noFilteredResults) {
    const title = elements.activityEmpty.querySelector("strong");
    const detail = elements.activityEmpty.querySelector("span");
    title.textContent = query ? "没有找到相关活动" : "还没有活动项目";
    detail.textContent = query ? "换一个名称试试" : "点击右上角按钮添加";
  }
}

function createActiveActivityRow(group) {
  const row = document.createElement("div");
  const main = document.createElement("button");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const next = document.createElement("span");
  const chevron = document.createElement("span");

  row.className = "activity-row";
  main.type = "button";
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = group.series.title;
  rule.className = "activity-rule";
  rule.textContent = activityRuleText(group.series);
  next.className = "activity-next";
  next.textContent =
    `${formatShortDate(group.next.date)} ${group.series.startTime}`;
  chevron.className = "activity-chevron";
  chevron.textContent = "›";
  copy.append(name, rule);
  main.append(copy, next, chevron);
  main.addEventListener("click", () => {
    openEditDialog(
      group.next.originalSeries,
      group.next.originalDate,
      { preferFuture: true },
    );
  });
  row.append(main);
  return row;
}

function createPausedActivityRow(group) {
  const row = document.createElement("div");
  const main = document.createElement("div");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const resumeButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  row.className = "activity-row is-paused";
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = group.series.title;
  rule.className = "activity-rule";
  rule.textContent = activityRuleText(group.series);
  resumeButton.type = "button";
  resumeButton.className = "activity-resume";
  resumeButton.textContent = "恢复";
  resumeButton.addEventListener("click", () => {
    snapshotBefore("恢复活动系列前");
    state.events = resumeSeries(
      state.events,
      group.series.id,
      todayISO(),
    );
    persistEvents();
    render();
    showToast("活动已恢复");
  });
  deleteButton.type = "button";
  deleteButton.className = "activity-delete";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", () => {
    openSeriesDeleteConfirmation(group.series);
  });
  copy.append(name, rule);
  main.append(copy);
  row.append(main, resumeButton, deleteButton);
  return row;
}

function createInactiveActivityRow(group) {
  const row = document.createElement("div");
  const main = document.createElement("div");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const last = document.createElement("span");
  const deleteButton = document.createElement("button");

  row.className = "activity-row is-inactive";
  row.dataset.seriesId = group.series.id;
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = group.series.title;
  rule.className = "activity-rule";
  rule.textContent = activityRuleText(group.series);
  last.className = "activity-next";
  last.textContent = group.lastDate
    ? `最后 ${formatShortDate(group.lastDate)}`
    : "无未来安排";
  deleteButton.type = "button";
  deleteButton.className = "activity-delete";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除已结束活动 ${group.series.title}`);
  deleteButton.addEventListener("click", () => {
    openSeriesDeleteConfirmation(group.series);
  });
  copy.append(name, rule);
  main.append(copy, last);
  row.append(main, deleteButton);
  return row;
}

function createListEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "activity-list-empty";
  empty.textContent = message;
  return empty;
}

function openAddDialog(date = state.selectedDate) {
  const window = getScheduleWindow();
  if (date < window.startDate || date > window.endDate) {
    date = window.startDate;
  }

  const defaults = defaultTimes(date);
  state.editing = null;
  state.confirmedOverrideDiscard = false;
  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "新活动";
  elements.eventDialogTitle.textContent = "添加活动";
  elements.eventName.value = "";
  elements.eventDate.min = window.startDate;
  elements.eventDate.max = window.endDate;
  elements.eventDate.value = date;
  elements.startTime.value = defaults.startTime;
  elements.endTime.value = defaults.endTime;
  elements.repeatEvery.value = "1";
  elements.repeatCount.value = "1";
  elements.reminderMinutesBefore.value = "5";
  elements.eventNotes.value = "";
  setReminderMode("none");
  setRepeatMode("limited");
  state.editing = null;
  elements.editScopeField.hidden = true;
  updateReminderUi();
  elements.editScopeNote.hidden = true;
  elements.pauseEventButton.hidden = true;
  elements.deleteEventButton.hidden = true;
  for (const field of [
    elements.repeatModeField,
    elements.repeatEveryField,
    elements.repeatCountField,
  ]) {
    field.hidden = false;
  }
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
}

function openEditDialog(series, occurrenceDate, { preferFuture = false } = {}) {
  const window = getScheduleWindow();
  const remaining = remainingRepeatCount(series, occurrenceDate);
  if (getOccurrenceIndex(series, occurrenceDate) === null) {
    showToast("这条活动已无法编辑");
    return;
  }

  state.editing = {
    seriesId: series.id,
    occurrenceDate,
    scope: preferFuture ? "future" : "single",
  };
  state.confirmedOverrideDiscard = false;

  const occurrence = occurrencesBetween(
    [series],
    window.startDate,
    window.endDate,
  ).find((item) => item.originalDate === occurrenceDate);
  const displaySeries = occurrence?.series ?? series;

  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "编辑活动";
  elements.eventDialogTitle.textContent = "编辑活动";
  elements.eventName.value = displaySeries.title;
  elements.eventDate.min = window.startDate;
  elements.eventDate.max = window.endDate;
  elements.eventDate.value = displaySeries.date;
  elements.startTime.value = displaySeries.startTime;
  elements.endTime.value = displaySeries.endTime;
  elements.repeatEvery.value = String(series.repeatEvery);
  setReminderMode(displaySeries.reminderMode);
  elements.reminderMinutesBefore.value = String(
    displaySeries.reminderMinutesBefore ?? 5,
  );

  if (remaining === null) {
    elements.repeatCount.value = "1";
    setRepeatMode("infinite");
  } else {
    elements.repeatCount.value = String(Math.max(1, remaining));
    setRepeatMode("limited");
  }

  elements.eventNotes.value = displaySeries.notes ?? "";
  setEditScope(state.editing.scope);
  updateReminderUi();
  elements.editScopeField.hidden = false;
  elements.editScopeNote.hidden = false;
  elements.pauseEventButton.hidden = false;
  elements.deleteEventButton.hidden = false;
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
}

function setEditScope(scope) {
  if (state.editing) {
    state.editing.scope = scope;
  }
  for (const input of elements.editScopeInputs) {
    input.checked = input.value === scope;
  }
  updateEditScopeUi();
}

function currentEditScope() {
  return (
    [...elements.editScopeInputs].find((input) => input.checked)?.value ??
    "single"
  );
}

function updateEditScopeUi() {
  if (!state.editing) {
    return;
  }

  const single = currentEditScope() === "single";
  state.editing.scope = currentEditScope();
  for (const field of [
    elements.repeatModeField,
    elements.repeatEveryField,
    elements.repeatCountField,
  ]) {
    field.hidden = single;
  }
  if (!single) {
    updateRepeatModeUI();
  }
  elements.eventDate.min = single
    ? getScheduleWindow().startDate
    : state.editing.occurrenceDate;
  elements.editScopeNote.textContent = single
    ? "只修改所选这一次；原日期会被跳过，其他安排保持不变。"
    : "保存后修改本次及以后，之前的安排保持不变；仍有效的单次调整会保留。";
}

function setRepeatMode(mode) {
  for (const input of elements.repeatModeInputs) {
    input.checked = input.value === mode;
  }
  updateRepeatModeUI();
}

function currentRepeatMode() {
  return (
    [...elements.repeatModeInputs].find((input) => input.checked)?.value ??
    "limited"
  );
}

function updateRepeatModeUI() {
  const isInfinite = currentRepeatMode() === "infinite";
  elements.repeatCountField.hidden = isInfinite;
  elements.repeatCount.disabled = isInfinite;
  elements.repeatEvery.closest(".field").classList.toggle("field-full", isInfinite);
}

function readFormInput() {
  return {
    title: elements.eventName.value,
    date: elements.eventDate.value,
    startTime: elements.startTime.value,
    endTime: elements.endTime.value,
    repeatEvery: Number(elements.repeatEvery.value),
    repeatCount:
      currentRepeatMode() === "infinite"
        ? null
        : Number(elements.repeatCount.value),
    reminderMode: nativeApp ? currentReminderMode() : "none",
    reminderMinutesBefore:
      elements.reminderMinutesBefore.value === ""
        ? null
        : Number(elements.reminderMinutesBefore.value),
    notes: elements.eventNotes.value.trim(),
  };
}

async function handleReminderToggle() {
  updateReminderUi();
  if (!nativeApp || currentReminderMode() === "none") {
    return;
  }

  try {
    const permission = await requestNotificationPermission();
    if (!permission.granted) {
      showToast("通知权限未开启，提醒可能无法送达");
    }
    if (currentReminderMode() === "alarm") {
      const currentExact = await getExactAlarmPermissionState();
      const exact = currentExact.granted
        ? currentExact
        : await requestExactAlarmPermission();
      if (!exact.granted) {
        showToast("精确闹钟权限未开启，保存后将按普通通知降级");
      }
    }
    await refreshNativeNotifications();
  } catch (error) {
    console.error("请求通知权限失败", error);
    showToast("无法请求通知权限，请检查系统设置");
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  const window = getScheduleWindow();
  const input = readFormInput();
  const singleEdit =
    state.editing && currentEditScope() === "single";
  const minimumDate = singleEdit
    ? window.startDate
    : state.editing?.occurrenceDate ?? window.startDate;
  const error = validateActivityInput(input, {
    ...window,
    minimumDate,
  });

  if (error) {
    elements.formError.textContent = error;
    elements.formError.hidden = false;
    return;
  }

  const eventStartMinutes = timeToMinutes(input.startTime);
  const editingSeries = state.editing
    ? state.events.find((event) => event.id === state.editing.seriesId)
    : null;
  const candidate = seriesFromInput(
    singleEdit
      ? { ...input, repeatEvery: 1, repeatCount: 1 }
      : input,
    {
    id: editingSeries?.id,
    createdAt: editingSeries?.createdAt,
    },
  );

  if (!candidate) {
    elements.formError.textContent = "活动内容不完整，请重新检查";
    elements.formError.hidden = false;
    return;
  }

  const conflict = findScheduleConflict(
    state.events,
    candidate,
    window.startDate,
    window.endDate,
    singleEdit
      ? {
          seriesId: state.editing.seriesId,
          originalDate: state.editing.occurrenceDate,
        }
      : state.editing?.seriesId ?? null,
  );
  if (conflict) {
    elements.formError.textContent =
      `${formatShortDate(conflict.date)} ${conflict.candidateSeries.startTime}–${conflict.candidateSeries.endTime} 与「${conflict.existingSeries.title}」时间重叠，请调整时间或日期`;
    elements.formError.hidden = false;
    return;
  }

  if (singleEdit) {
    try {
      snapshotBefore("单次修改活动前");
      const nextEvents = applyOccurrenceOverride(
        state.events,
        state.editing.seriesId,
        state.editing.occurrenceDate,
        input,
      );
      const finalConflict = findConflictWithinRange(
        nextEvents,
        window.startDate,
        window.endDate,
      );
      if (finalConflict) {
        throw new Error(
          `调整后与「${finalConflict.secondSeries.title}」时间重叠，请重新选择日期和时间`,
        );
      }
      state.events = nextEvents;
      showToast("已修改这一次活动");
    } catch (saveError) {
      elements.formError.textContent = saveError.message;
      elements.formError.hidden = false;
      return;
    }
  } else if (state.editing) {
    const unmatched = unmatchedOverridesForSeriesEdit(
      editingSeries,
      state.editing.occurrenceDate,
      input,
    );
    if (unmatched.length > 0 && !state.confirmedOverrideDiscard) {
      state.pendingSeriesEdit = { input, window };
      elements.overrideDiscardMessage.textContent =
        `${unmatched.length} 次单次调整不再对应修改后的发生日期：` +
        `${unmatched.map((item) => formatShortDate(item.occurrenceDate)).join("、")}。` +
        "继续保存会移除这些调整。";
      elements.overrideDiscardDialog.showModal();
      return;
    }
    try {
      snapshotBefore("修改活动系列前");
      const nextEvents = splitSeriesForEdit(
        state.events,
        state.editing.seriesId,
        state.editing.occurrenceDate,
        input,
      );
      const finalConflict = findConflictWithinRange(
        nextEvents,
        window.startDate,
        window.endDate,
      );
      if (finalConflict) {
        throw new Error(
          `修改后与「${finalConflict.secondSeries.title}」时间重叠，请调整重复规则或时间`,
        );
      }
      state.events = nextEvents;
      showToast("已更新本次及以后的活动");
    } catch (saveError) {
      elements.formError.textContent = saveError.message;
      elements.formError.hidden = false;
      return;
    }
  } else {
    state.events = [...state.events, candidate];
    showToast("活动已添加");
  }

  state.selectedDate = input.date;
  state.monthCursor = startOfMonth(input.date);
  state.view = "day";
  state.autoScrollDay = true;
  state.dayScrollTarget = eventStartMinutes - 60;
  state.editing = null;
  state.confirmedOverrideDiscard = false;
  persistEvents();
  elements.eventDialog.close();
  render();
}

function confirmOverrideDiscard() {
  const pending = state.pendingSeriesEdit;
  if (!pending || !state.editing) {
    elements.overrideDiscardDialog.close();
    return;
  }
  state.confirmedOverrideDiscard = true;
  elements.overrideDiscardDialog.close();
  elements.eventForm.requestSubmit();
  state.pendingSeriesEdit = null;
}

function openDeleteConfirmation() {
  if (!state.editing) {
    return;
  }

  const series = state.events.find(
    (event) => event.id === state.editing.seriesId,
  );
  const index = series
    ? getOccurrenceIndex(series, state.editing.occurrenceDate)
    : null;

  if (!series || index === null) {
    showToast("找不到要删除的活动");
    return;
  }

  elements.deleteDialogMessage.textContent =
    index === 0
      ? "将删除整个活动及其后续安排。"
      : "将删除本次及以后的活动，之前的安排保持不变。";
  state.pendingDelete = {
    kind: "occurrence",
    seriesId: state.editing.seriesId,
    occurrenceDate: state.editing.occurrenceDate,
  };
  elements.eventDialog.close();
  elements.deleteDialog.showModal();
}

function openSeriesDeleteConfirmation(series) {
  state.pendingDelete = {
    kind: "series",
    seriesId: series.id,
  };
  elements.deleteDialogMessage.textContent =
    "将永久删除这条已结束活动。";
  elements.deleteDialog.showModal();
}

function confirmDelete() {
  if (!state.pendingDelete) {
    elements.deleteDialog.close();
    return;
  }

  try {
    snapshotBefore("删除活动前");
    if (state.pendingDelete.kind === "series") {
      state.events = state.events.filter(
        (event) => event.id !== state.pendingDelete.seriesId,
      );
    } else {
      state.events = deleteOccurrenceAndFuture(
        state.events,
        state.pendingDelete.seriesId,
        state.pendingDelete.occurrenceDate,
      );
    }
    state.editing = null;
    state.pendingDelete = null;
    persistEvents();
    elements.deleteDialog.close();
    render();
    showToast("活动已删除");
  } catch (error) {
    state.pendingDelete = null;
    elements.deleteDialog.close();
    showToast(error.message);
  }
}

function openPauseConfirmation() {
  if (!state.editing) {
    return;
  }
  const series = state.events.find(
    (event) => event.id === state.editing.seriesId,
  );
  if (!series || getOccurrenceIndex(series, state.editing.occurrenceDate) === null) {
    showToast("找不到要暂停的活动");
    return;
  }

  state.pendingPause = {
    seriesId: state.editing.seriesId,
    occurrenceDate: state.editing.occurrenceDate,
  };
  elements.pauseDialogMessage.textContent =
    `将从 ${formatShortDate(state.editing.occurrenceDate)} 起暂停「${series.title}」。` +
    "暂停期间不提醒，也不消耗有限次数；恢复后会从下一个原周期日期继续。";
  elements.eventDialog.close();
  elements.pauseDialog.showModal();
}

function confirmPause() {
  if (!state.pendingPause) {
    elements.pauseDialog.close();
    return;
  }

  try {
    snapshotBefore("暂停活动前");
    state.events = pauseSeries(
      state.events,
      state.pendingPause.seriesId,
      state.pendingPause.occurrenceDate,
    );
    state.pendingPause = null;
    state.editing = null;
    persistEvents();
    elements.pauseDialog.close();
    render();
    showToast("活动已暂停");
  } catch (error) {
    state.pendingPause = null;
    elements.pauseDialog.close();
    showToast(error.message);
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2200);
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.forgotPasswordButton.addEventListener("click", openResetDialog);
  elements.cancelResetButton.addEventListener("click", () => {
    elements.resetAccountDialog.close();
  });
  elements.confirmResetButton.addEventListener(
    "click",
    confirmAccountReset,
  );

  elements.accountButton.addEventListener("click", openAccountDialog);
  elements.closeAccountDialog.addEventListener("click", () => {
    elements.accountDialog.close();
  });
  elements.changePasswordButton.addEventListener("click", () => {
    elements.passwordForm.reset();
    elements.passwordError.hidden = true;
    elements.accountDialog.close();
    elements.passwordDialog.showModal();
  });
  elements.closePasswordDialog.addEventListener("click", () => {
    elements.passwordDialog.close();
  });
  elements.cancelPasswordButton.addEventListener("click", () => {
    elements.passwordDialog.close();
  });
  elements.passwordForm.addEventListener(
    "submit",
    handlePasswordChange,
  );
  elements.logoutButton.addEventListener("click", logout);
  elements.exportDataButton.addEventListener("click", exportActivities);
  elements.importDataButton.addEventListener(
    "click",
    openImportFilePicker,
  );
  elements.recoveryButton.addEventListener("click", () => {
    renderRecoveryDialog();
    elements.recoveryDialog.showModal();
  });
  elements.closeRecoveryDialog.addEventListener("click", () => {
    elements.recoveryDialog.close();
  });
  elements.checkUpdateButton.addEventListener("click", handleUpdateCheck);
  elements.closeUpdateButton.addEventListener("click", () => {
    elements.updateDialog.close();
  });
  elements.openUpdateButton.addEventListener("click", () => {
    if (state.pendingUpdate?.apkUrl) {
      void openExternalUrl(state.pendingUpdate.apkUrl);
    }
    elements.updateDialog.close();
  });
  elements.testNotificationButton.addEventListener("click", async () => {
    try {
      await scheduleTestReminder("notification");
      showToast("测试通知将在约 5 秒后发送");
    } catch (error) {
      showToast(error.message);
    }
  });
  elements.testAlarmButton.addEventListener("click", async () => {
    try {
      const currentExact = await getExactAlarmPermissionState();
      const exact = currentExact.granted
        ? currentExact
        : await requestExactAlarmPermission();
      const result = await scheduleTestReminder("alarm");
      showToast(
        result.exact
          ? "测试闹钟将在约 5 秒后发送"
          : exact.granted
            ? "测试闹钟安排失败，已尝试降级"
            : "精确闹钟未授权，本次按普通通知测试",
      );
      void refreshNativeNotifications();
    } catch (error) {
      showToast(error.message);
    }
  });
  elements.openAlarmSettingsButton.addEventListener("click", async () => {
    await requestExactAlarmPermission();
    await refreshNativeNotifications();
    if (!elements.accountDialog.open) {
      elements.accountDialog.showModal();
    }
  });
  elements.importFileInput.addEventListener(
    "change",
    handleImportFile,
  );
  elements.cancelImportButton.addEventListener("click", () => {
    state.pendingImportEvents = null;
    elements.importDialog.close();
  });
  elements.confirmImportButton.addEventListener(
    "click",
    confirmImport,
  );
  elements.webExportButton.addEventListener(
    "click",
    exportActivities,
  );

  elements.dayNavButton.addEventListener("click", () => setView("day"));
  elements.weekNavButton.addEventListener("click", () => setView("week"));
  elements.monthNavButton.addEventListener("click", () => setView("month"));
  elements.activityNavButton.addEventListener("click", () =>
    setView("activity"),
  );

  elements.previousDayButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    if (state.selectedDate > window.startDate) {
      state.selectedDate = addDays(state.selectedDate, -1);
      state.autoScrollDay = true;
      render();
    }
  });

  elements.nextDayButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    if (state.selectedDate < window.endDate) {
      state.selectedDate = addDays(state.selectedDate, 1);
      state.autoScrollDay = true;
      render();
    }
  });

  elements.goTodayButton.addEventListener("click", () => {
    state.selectedDate = todayISO();
    state.autoScrollDay = true;
    render();
  });

  elements.previousWeekButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    const firstWeek = startOfWeek(window.startDate);
    if (state.weekCursor > firstWeek) {
      state.weekCursor = addDays(state.weekCursor, -7);
      render();
    }
  });

  elements.nextWeekButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    const lastWeek = startOfWeek(window.endDate);
    if (state.weekCursor < lastWeek) {
      state.weekCursor = addDays(state.weekCursor, 7);
      render();
    }
  });

  elements.goCurrentWeekButton.addEventListener("click", () => {
    state.weekCursor = startOfWeek(todayISO());
    render();
  });

  elements.previousMonthButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    const firstMonth = startOfMonth(window.startDate);
    if (state.monthCursor > firstMonth) {
      state.monthCursor = addMonthsToMonth(state.monthCursor, -1);
      render();
    }
  });

  elements.nextMonthButton.addEventListener("click", () => {
    const window = getScheduleWindow();
    const lastMonth = startOfMonth(window.endDate);
    if (state.monthCursor < lastMonth) {
      state.monthCursor = addMonthsToMonth(state.monthCursor, 1);
      render();
    }
  });

  elements.goCurrentMonthButton.addEventListener("click", () => {
    state.monthCursor = startOfMonth(todayISO());
    render();
  });

  for (const button of [
    elements.addTopButton,
    elements.addFab,
    elements.emptyAddButton,
  ]) {
    button.addEventListener("click", () => openAddDialog());
  }

  elements.closeEventDialog.addEventListener("click", () => {
    state.confirmedOverrideDiscard = false;
    elements.eventDialog.close();
  });
  elements.cancelEventButton.addEventListener("click", () => {
    state.confirmedOverrideDiscard = false;
    elements.eventDialog.close();
  });
  elements.eventForm.addEventListener("submit", handleFormSubmit);
  elements.repeatModeInputs.forEach((input) => {
    input.addEventListener("change", updateRepeatModeUI);
  });
  elements.editScopeInputs.forEach((input) => {
    input.addEventListener("change", updateEditScopeUi);
  });
  elements.reminderModeInputs.forEach((input) => {
    input.addEventListener("change", handleReminderToggle);
  });
  elements.pauseEventButton.addEventListener(
    "click",
    openPauseConfirmation,
  );
  elements.cancelPauseButton.addEventListener("click", () => {
    state.pendingPause = null;
    elements.pauseDialog.close();
  });
  elements.confirmPauseButton.addEventListener("click", confirmPause);
  elements.cancelOverrideDiscardButton.addEventListener("click", () => {
    state.pendingSeriesEdit = null;
    state.confirmedOverrideDiscard = false;
    elements.overrideDiscardDialog.close();
  });
  elements.confirmOverrideDiscardButton.addEventListener(
    "click",
    confirmOverrideDiscard,
  );
  elements.deleteEventButton.addEventListener(
    "click",
    openDeleteConfirmation,
  );
  elements.cancelDeleteButton.addEventListener("click", () => {
    state.pendingDelete = null;
    elements.deleteDialog.close();
  });
  elements.confirmDeleteButton.addEventListener("click", confirmDelete);

  elements.activitySearch.addEventListener("input", () => {
    state.activityQuery = elements.activitySearch.value;
    if (state.view === "activity") {
      renderActivities(getScheduleWindow());
    }
  });

  elements.timelineScroll.addEventListener(
    "scroll",
    () => {
      state.dayScrollTarget = null;
    },
    { passive: true },
  );

  window.addEventListener("storage", (event) => {
    if (!nativeApp && event.key === WEB_STORAGE_KEY) {
      state.events = loadEvents();
      render();
    } else if (nativeApp && event.key === NATIVE_STORAGE_KEY) {
      const loaded = readNativeState();
      if (loaded.status === "ok") {
        state.account = loaded.state.account;
        state.authenticated = loaded.state.sessionActive;
        state.events = loaded.state.events;
        state.storageCorrupt = false;
      } else if (loaded.status === "corrupt") {
        state.storageCorrupt = true;
        state.authenticated = false;
      }
      updateAppAccess();
      if (state.authenticated) {
        render();
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (!nativeApp || state.authenticated)) {
      render();
      void refreshNativeNotifications();
      void syncNativeWidgetSnapshot(state.events);
      void handleWidgetLaunch();
    }
  });
}

async function preparePersistentStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // The browser may decline; localStorage still works for normal use.
  }
}

function registerServiceWorker() {
  if (
    !nativeApp &&
    "serviceWorker" in navigator &&
    window.isSecureContext
  ) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("离线缓存注册失败", error);
    });
  }
}

buildTimeLabels();
configurePlatformControls();
bindEvents();
updateAppAccess();
render({ scrollTargetMinutes: undefined });
preparePersistentStorage();
registerServiceWorker();
if (nativeApp) {
  void registerNotificationActionListener(handleNotificationAction).catch(
    (error) => {
      console.error("注册通知点击监听失败", error);
    },
  );
}
if (nativeApp && state.authenticated) {
  void refreshNativeNotifications();
  void syncNativeWidgetSnapshot(state.events);
  void handleWidgetLaunch();
}

if (nativeApp) {
  globalThis.DailyRouteNative?.App?.addListener?.(
    "appStateChange",
    ({ isActive }) => {
      if (isActive && state.authenticated) {
        void refreshNativeNotifications();
        void handleWidgetLaunch();
      }
    },
  );
}

