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
  findConflictWithinRange,
  findScheduleConflict,
  getOccurrenceOverride,
  getOccurrenceIndex,
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
  ACTIVITY_KIND_LABELS,
  DEFAULT_CHECKIN_REMINDER_TIME,
  activeCheckinsForDate,
  addCategory,
  archiveActivity,
  categoryName,
  checkinFromInput,
  checkinDatesBetween,
  cloneActivityForYear,
  deleteCategory,
  finalizePreviousYears,
  isActivityArchived,
  isActivityPaused,
  isCheckedIn,
  isDatePausedForCheckin,
  isTodoOverdue,
  overdueTodos,
  pauseCheckin,
  renameCategory,
  resumeCheckin,
  todoCountByDate,
  todoFromInput,
  todosDueOnDate,
  toggleCheckin,
  validateTodoInput,
  validateCheckinInput,
} from "./activities.js";
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
  readWebState,
  removeNativeState,
  writeNativeState,
  writeWebState,
} from "./app-state.js";
import {
  createBackup,
  parseBackup,
  summarizeEvents,
} from "./backup.js";
import {
  consumeAlarmLaunch,
  registerAlarmLaunchListener,
} from "./alarm-scheduler.js";
import {
  clearScheduledNotifications,
  getExactAlarmPermissionState,
  isNativeApp,
  openReminderChannelSettings,
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

const APP_VERSION = "0.5.0";
const APP_VERSION_CODE = 7;
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
  dayShortcuts: document.querySelector("#dayShortcuts"),
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
  activityCategoryFilter: document.querySelector("#activityCategoryFilter"),
  manageCategoriesButton: document.querySelector("#manageCategoriesButton"),
  archiveToggleButton: document.querySelector("#archiveToggleButton"),
  yearMigrationBanner: document.querySelector("#yearMigrationBanner"),
  yearMigrationTitle: document.querySelector("#yearMigrationTitle"),
  yearMigrationMessage: document.querySelector("#yearMigrationMessage"),
  openMigrationButton: document.querySelector("#openMigrationButton"),
  activeActivitySection: document.querySelector("#activeActivitySection"),
  todoActivitySection: document.querySelector("#todoActivitySection"),
  checkinActivitySection: document.querySelector("#checkinActivitySection"),
  pausedActivitySection: document.querySelector("#pausedActivitySection"),
  archiveActivitySection: document.querySelector("#archiveActivitySection"),
  activeActivityCount: document.querySelector("#activeActivityCount"),
  todoActivityCount: document.querySelector("#todoActivityCount"),
  checkinActivityCount: document.querySelector("#checkinActivityCount"),
  pausedActivityCount: document.querySelector("#pausedActivityCount"),
  inactiveActivityCount: document.querySelector("#inactiveActivityCount"),
  activeActivityList: document.querySelector("#activeActivityList"),
  todoActivityList: document.querySelector("#todoActivityList"),
  checkinActivityList: document.querySelector("#checkinActivityList"),
  pausedActivityList: document.querySelector("#pausedActivityList"),
  inactiveActivityList: document.querySelector("#inactiveActivityList"),
  archiveYearSelect: document.querySelector("#archiveYearSelect"),
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
  activityKindField: document.querySelector("#activityKindField"),
  eventName: document.querySelector("#eventName"),
  activityKindInputs: document.querySelectorAll('input[name="activityKind"]'),
  activityCategory: document.querySelector("#activityCategory"),
  eventDate: document.querySelector("#eventDate"),
  eventDateField: document.querySelector("#eventDateField"),
  startTime: document.querySelector("#startTime"),
  startTimeField: document.querySelector("#startTimeField"),
  endTime: document.querySelector("#endTime"),
  endTimeField: document.querySelector("#endTimeField"),
  todoDeadlineDate: document.querySelector("#todoDeadlineDate"),
  todoDeadlineDateField: document.querySelector("#todoDeadlineDateField"),
  todoDeadlineTime: document.querySelector("#todoDeadlineTime"),
  todoDeadlineTimeField: document.querySelector("#todoDeadlineTimeField"),
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
  todoReminderField: document.querySelector("#todoReminderField"),
  todoReminderModeInputs: document.querySelectorAll(
    'input[name="todoReminderMode"]',
  ),
  todoReminderDaysField: document.querySelector("#todoReminderDaysField"),
  todoReminderDaysBefore: document.querySelector("#todoReminderDaysBefore"),
  todoReminderStatusNote: document.querySelector("#todoReminderStatusNote"),
  checkinFormNote: document.querySelector("#checkinFormNote"),
  checkinReminderField: document.querySelector("#checkinReminderField"),
  checkinReminderModeInputs: document.querySelectorAll(
    'input[name="checkinReminderMode"]',
  ),
  checkinReminderTimeField: document.querySelector(
    "#checkinReminderTimeField",
  ),
  checkinReminderTime: document.querySelector("#checkinReminderTime"),
  checkinReminderStatusNote: document.querySelector(
    "#checkinReminderStatusNote",
  ),
  eventNotes: document.querySelector("#eventNotes"),
  editScopeNote: document.querySelector("#editScopeNote"),
  formError: document.querySelector("#formError"),
  pauseEventButton: document.querySelector("#pauseEventButton"),
  archiveEventButton: document.querySelector("#archiveEventButton"),
  deleteEventButton: document.querySelector("#deleteEventButton"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogMessage: document.querySelector("#deleteDialogMessage"),
  cancelDeleteButton: document.querySelector("#cancelDeleteButton"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  archiveDialog: document.querySelector("#archiveDialog"),
  archiveDialogTitle: document.querySelector("#archiveDialogTitle"),
  archiveDialogMessage: document.querySelector("#archiveDialogMessage"),
  cancelArchiveButton: document.querySelector("#cancelArchiveButton"),
  confirmArchiveButton: document.querySelector("#confirmArchiveButton"),
  accountDialog: document.querySelector("#accountDialog"),
  accountName: document.querySelector("#accountName"),
  notificationPermissionText: document.querySelector(
    "#notificationPermissionText",
  ),
  exactAlarmPermissionText: document.querySelector(
    "#exactAlarmPermissionText",
  ),
  channelStatusText: document.querySelector("#channelStatusText"),
  accountVersionText: document.querySelector("#accountVersionText"),
  backupStatusText: document.querySelector("#backupStatusText"),
  closeAccountDialog: document.querySelector("#closeAccountDialog"),
  changePasswordButton: document.querySelector("#changePasswordButton"),
  exportDataButton: document.querySelector("#exportDataButton"),
  importDataButton: document.querySelector("#importDataButton"),
  recoveryButton: document.querySelector("#recoveryButton"),
  checkUpdateButton: document.querySelector("#checkUpdateButton"),
  testNotificationButton: document.querySelector("#testNotificationButton"),
  testAlarmButton: document.querySelector("#testAlarmButton"),
  openNotificationSettingsButton: document.querySelector(
    "#openNotificationSettingsButton",
  ),
  openAlarmChannelSettingsButton: document.querySelector(
    "#openAlarmChannelSettingsButton",
  ),
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
  checkinCalendarDialog: document.querySelector("#checkinCalendarDialog"),
  checkinCalendarTitle: document.querySelector("#checkinCalendarTitle"),
  closeCheckinCalendar: document.querySelector("#closeCheckinCalendar"),
  previousCheckinMonth: document.querySelector("#previousCheckinMonth"),
  nextCheckinMonth: document.querySelector("#nextCheckinMonth"),
  currentCheckinMonth: document.querySelector("#currentCheckinMonth"),
  checkinMonthTitle: document.querySelector("#checkinMonthTitle"),
  checkinCalendarGrid: document.querySelector("#checkinCalendarGrid"),
  categoryDialog: document.querySelector("#categoryDialog"),
  closeCategoryDialog: document.querySelector("#closeCategoryDialog"),
  categoryKindSelect: document.querySelector("#categoryKindSelect"),
  categoryList: document.querySelector("#categoryList"),
  newCategoryName: document.querySelector("#newCategoryName"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  migrationDialog: document.querySelector("#migrationDialog"),
  migrationDialogTitle: document.querySelector("#migrationDialogTitle"),
  closeMigrationDialog: document.querySelector("#closeMigrationDialog"),
  migrationList: document.querySelector("#migrationList"),
  migrationError: document.querySelector("#migrationError"),
  skipMigrationButton: document.querySelector("#skipMigrationButton"),
  confirmMigrationButton: document.querySelector("#confirmMigrationButton"),
};

const initialData = loadInitialData();
const state = {
  events: initialData.events,
  categories: initialData.categories,
  yearMigrationCompletedFor: initialData.yearMigrationCompletedFor,
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
  pendingArchive: null,
  restoringActivityId: null,
  activityQuery: "",
  autoScrollDay: true,
  dayScrollTarget: null,
  notificationStatus: null,
  pendingImportEvents: null,
  pendingImportCategories: null,
  pendingImportMigrationYear: null,
  pendingSeriesEdit: null,
  pendingPause: null,
  pendingUpdate: null,
  activityCategoryFilter: "",
  archiveMode: false,
  archiveYear: Number(todayISO().slice(0, 4)),
  checkinCalendarId: null,
  checkinMonthCursor: startOfMonth(todayISO()),
  migrationSelections: new Map(),
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
        categories: loaded.state.categories,
        yearMigrationCompletedFor:
          loaded.state.yearMigrationCompletedFor,
        account: loaded.state.account,
        authenticated: loaded.state.sessionActive,
        storageCorrupt: false,
      };
    }

    if (loaded.status === "migrate") {
      return {
        events: loaded.state.events,
        categories: loaded.state.categories,
        yearMigrationCompletedFor:
          loaded.state.yearMigrationCompletedFor,
        account: loaded.state.account,
        authenticated: loaded.state.sessionActive,
        storageCorrupt: false,
      };
    }

    return {
      events: [],
      categories: { schedule: [], todo: [], checkin: [] },
      yearMigrationCompletedFor: Number(todayISO().slice(0, 4)),
      account: null,
      authenticated: false,
      storageCorrupt: loaded.status === "corrupt",
    };
  }

  try {
    const loaded = readWebState();
    return {
      events: loaded.events,
      categories: loaded.categories,
      yearMigrationCompletedFor: loaded.yearMigrationCompletedFor,
      account: null,
      authenticated: true,
      storageCorrupt: false,
    };
  } catch (error) {
    console.error("读取本地活动失败", error);
    return {
      events: [],
      categories: { schedule: [], todo: [], checkin: [] },
      yearMigrationCompletedFor: Number(todayISO().slice(0, 4)),
      account: null,
      authenticated: true,
      storageCorrupt: false,
    };
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
        categories: state.categories,
        yearMigrationCompletedFor: state.yearMigrationCompletedFor,
      });
    } else {
      writeWebState({
        events: state.events,
        categories: state.categories,
        yearMigrationCompletedFor: state.yearMigrationCompletedFor,
      });
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
  if (status.channelState?.notificationsEnabled === false) {
    return "系统已关闭本应用通知；请在系统设置中重新允许通知。";
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
    const alarm =
      status.alarmPlanned > 0
        ? `；闹钟计划 ${status.alarmPlanned} 次，系统实际排程 ${status.alarmScheduled ?? 0} 个系列`
        : "";
    const error = status.lastError ? `；${status.lastError}` : "";
    return `通知权限已开启，当前已安排 ${status.scheduled} 次提醒${alarm}${downgraded}${error}。`;
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
  if (state.notificationStatus?.nextAt) {
    const nextAt = new Date(state.notificationStatus.nextAt);
    if (!Number.isNaN(nextAt.getTime())) {
      elements.exactAlarmPermissionText.textContent +=
        ` 下一项：${nextAt.getMonth() + 1}月${nextAt.getDate()}日 ${String(nextAt.getHours()).padStart(2, "0")}:${String(nextAt.getMinutes()).padStart(2, "0")}。`;
    }
  }
  const channels = state.notificationStatus?.channelState;
  if (!channels) {
    elements.channelStatusText.textContent = "正在检查通知通道…";
  } else if (!channels.supported) {
    elements.channelStatusText.textContent =
      "当前系统无法读取通知通道状态；可用下方设置入口检查。";
  } else if (channels.notificationChannelBlocked) {
    elements.channelStatusText.textContent =
      "「活动通知」通道已关闭，普通通知不会显示；请打开通知总设置。";
  } else if (channels.alarmChannelBlocked) {
    elements.channelStatusText.textContent =
      "「活动闹钟」通道已关闭，闹钟会改用「活动通知」通道；请打开闹钟通道设置。";
  } else {
    elements.channelStatusText.textContent =
      "「活动通知」与「活动闹钟」通道均已开启。";
  }
}

async function refreshNativeNotifications() {
  if (!nativeApp || !state.authenticated || !state.account) {
    return;
  }

  try {
    state.notificationStatus =
      await syncScheduledNotifications(state.events, {
        endDate: `${Math.max(
          Number(todayISO().slice(0, 4)),
          state.yearMigrationCompletedFor,
        )}-12-31`,
      });
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
  elements.todoReminderField.hidden = !nativeApp;
  elements.checkinReminderField.hidden = !nativeApp;
}

function openOccurrenceFromExternal({
  seriesId,
  date,
  originalDate,
  kind,
}) {
  if (!state.authenticated) {
    return;
  }
  if (
    kind === "checkinGroup" ||
    kind === "checkinSummary" ||
    seriesId?.startsWith("checkin-group:")
  ) {
    state.view = "activity";
    state.archiveMode = false;
    render();
    requestAnimationFrame(() => {
      elements.checkinActivitySection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return;
  }

  const series = state.events.find((event) => event.id === seriesId);
  if (series?.kind === "todo") {
    state.selectedDate = series.deadlineDate;
    state.monthCursor = startOfMonth(series.deadlineDate);
    state.view = "day";
    state.autoScrollDay = true;
    state.dayScrollTarget =
      timeToMinutes(series.deadlineTime) - 60;
    render();
    if (!isActivityArchived(series)) {
      openTodoEditDialog(series);
    }
    return;
  }
  if (series?.kind === "checkin") {
    state.selectedDate = date || series.createdAt.slice(0, 10);
    state.monthCursor = startOfMonth(state.selectedDate);
    state.view = "day";
    render();
    if (!isActivityArchived(series)) {
      openCheckinCalendar(series);
    }
    return;
  }
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

function handleNotificationAction({
  seriesId,
  occurrenceDate,
  effectiveDate,
  activityKind,
}) {
  openOccurrenceFromExternal({
    seriesId,
    date: effectiveDate || occurrenceDate,
    originalDate: occurrenceDate,
    kind: activityKind,
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

async function handleAlarmLaunch() {
  if (!nativeApp || !state.authenticated) {
    return;
  }
  try {
    const target = await consumeAlarmLaunch();
    if (target) {
      openOccurrenceFromExternal(target);
    }
  } catch (error) {
    console.error("读取闹钟入口失败", error);
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
      state.categories = { schedule: [], todo: [], checkin: [] };
      state.yearMigrationCompletedFor = Number(todayISO().slice(0, 4));
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
  elements.accountVersionText.textContent = `当前版本 v${APP_VERSION}`;
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
    addRecoveryPoint(
      {
        events: state.events,
        categories: state.categories,
        yearMigrationCompletedFor: state.yearMigrationCompletedFor,
      },
      reason,
    );
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
    state.categories = { schedule: [], todo: [], checkin: [] };
    state.yearMigrationCompletedFor = Number(todayISO().slice(0, 4));
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
      categories: state.categories,
      yearMigrationCompletedFor: state.yearMigrationCompletedFor,
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
    state.pendingImportCategories = backup.categories;
    state.pendingImportMigrationYear =
      backup.yearMigrationCompletedFor;
    const incoming = summarizeEvents(backup.events);
    elements.importDialogMessage.textContent =
      `将用 ${backup.eventCount} 项活动替换当前 ${state.events.length} 项活动。` +
      `导入内容含 ${incoming.notificationCount} 个通知、${incoming.alarmCount} 个闹钟、` +
      `其中 ${incoming.scheduleCount} 个定期、${incoming.todoCount} 个代办、` +
      `${incoming.checkinCount} 个打卡；${incoming.pausedCount} 个暂停项目和 ` +
      `${incoming.overrideCount} 次单次调整。账户与密码不会改变。`;
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
  state.categories =
    state.pendingImportCategories ??
    { schedule: [], todo: [], checkin: [] };
  state.yearMigrationCompletedFor =
    state.pendingImportMigrationYear ??
    state.yearMigrationCompletedFor;
  state.pendingImportEvents = null;
  state.pendingImportCategories = null;
  state.pendingImportMigrationYear = null;
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
        state.categories = point.categories;
        state.yearMigrationCompletedFor =
          point.yearMigrationCompletedFor;
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

function archiveCompletedSchedules() {
  const today = todayISO();
  const yearEnd = getScheduleWindow(today).endDate;
  let changed = false;
  const now = new Date().toISOString();
  state.events = state.events.map((activity) => {
    if (
      activity.kind !== "schedule" ||
      isActivityArchived(activity) ||
      state.restoringActivityId === activity.id ||
      isActivityPaused(activity)
    ) {
      return activity;
    }
    const future = occurrencesBetween([activity], today, yearEnd);
    const last = lastOccurrenceOnOrBefore(
      activity,
      addDays(today, -1),
    );
    if (future.length > 0 || !last) {
      return activity;
    }
    changed = true;
    return {
      ...activity,
      archivedAt: now,
      archiveReason: "已结束",
      updatedAt: now,
    };
  });
  if (changed) {
    persistEvents();
  }
}

function render(options = {}) {
  archiveCompletedSchedules();
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
  const today = todayISO();
  const isToday = state.selectedDate === today;
  const shortcutCount = renderDayShortcuts(isToday);
  const dueTodos = todosDueOnDate(
    state.events,
    state.selectedDate,
  ).filter((activity) => !isTodoOverdue(activity)).length;

  elements.viewKicker.textContent = isToday ? "今天" : "活动安排";
  elements.viewTitle.textContent = formatDayTitle(state.selectedDate);
  elements.viewSummary.textContent =
    occurrences.length + dueTodos + shortcutCount.todo + shortcutCount.checkin ===
    0
      ? "暂无活动"
      : `${occurrences.length} 项定期 · ${dueTodos + shortcutCount.overdue} 项代办 · ${shortcutCount.checkin} 项打卡`;

  elements.previousDayButton.disabled =
    state.selectedDate <= window.startDate;
  elements.nextDayButton.disabled = state.selectedDate >= window.endDate;
  elements.goTodayButton.disabled = isToday;
  elements.dayEmpty.hidden =
    occurrences.length > 0 ||
    shortcutCount.todo > 0 ||
    shortcutCount.overdue > 0 ||
    shortcutCount.checkin > 0;

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

function renderDayShortcuts(isToday) {
  const fragment = document.createDocumentFragment();
  const due = todosDueOnDate(
    state.events,
    state.selectedDate,
  ).filter((activity) => !isTodoOverdue(activity));
  const overdue = isToday ? overdueTodos(state.events) : [];
  const checkins =
    state.selectedDate <= todayISO()
      ? activeCheckinsForDate(state.events, state.selectedDate)
      : [];

  const appendSection = (title, items, type) => {
    if (items.length === 0) {
      return;
    }
    const section = document.createElement("section");
    const heading = document.createElement("div");
    heading.className = "shortcut-heading";
    heading.textContent = title;
    section.className = `day-shortcut-section is-${type}`;
    section.append(heading);
    for (const item of items) {
      section.append(item);
    }
    fragment.append(section);
  };

  appendSection(
    "今日截止",
    due.map((activity) => createTodoShortcut(activity, false)),
    "todo",
  );
  appendSection(
    "逾期代办",
    overdue.map((activity) => createTodoShortcut(activity, true)),
    "overdue",
  );
  appendSection(
    "快捷打卡",
    checkins.map((activity) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "checkin-shortcut";
      const checked = isCheckedIn(activity, state.selectedDate);
      button.classList.toggle("is-checked", checked);
      button.textContent = `${checked ? "已打卡" : "打卡"} · ${activity.title}`;
      button.disabled = isDatePausedForCheckin(
        activity,
        state.selectedDate,
      );
      button.addEventListener("click", () => {
        try {
          state.events = state.events.map((event) =>
            event.id === activity.id
              ? toggleCheckin(event, state.selectedDate)
              : event,
          );
          persistEvents();
          render();
          showToast(checked ? "已取消这次打卡" : "打卡已记录");
        } catch (error) {
          showToast(error.message);
        }
      });
      return button;
    }),
    "checkin",
  );

  elements.dayShortcuts.replaceChildren(fragment);
  elements.dayShortcuts.hidden =
    due.length + overdue.length + checkins.length === 0;
  return {
    todo: due.length,
    overdue: overdue.length,
    checkin: checkins.length,
  };
}

function createTodoShortcut(activity, overdue) {
  const row = document.createElement("div");
  const main = document.createElement("button");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  const complete = document.createElement("button");
  row.className = `todo-shortcut${overdue ? " is-overdue" : ""}`;
  main.type = "button";
  main.className = "todo-shortcut-main";
  copy.className = "todo-shortcut-copy";
  title.textContent = activity.title;
  detail.textContent = overdue
    ? `原截止 ${formatShortDate(activity.deadlineDate)} ${activity.deadlineTime}`
    : `截止 ${activity.deadlineTime}`;
  copy.append(title, detail);
  main.append(copy);
  main.addEventListener("click", () => openTodoEditDialog(activity));
  complete.type = "button";
  complete.className = "todo-complete-button";
  complete.textContent = "完成";
  complete.addEventListener("click", () => completeTodo(activity));
  row.append(main, complete);
  return row;
}

function completeTodo(activity) {
  snapshotBefore("完成代办前");
  state.events = archiveActivity(
    state.events,
    activity.id,
    "已完成",
  );
  persistEvents();
  render();
  showToast("代办已完成并归档");
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

  for (const todo of todosDueOnDate(state.events, state.selectedDate)) {
    const marker = document.createElement("button");
    const minutes = timeToMinutes(todo.deadlineTime);
    marker.type = "button";
    marker.className = "todo-deadline-marker";
    marker.style.top = `${minutes * PIXELS_PER_MINUTE}px`;
    marker.textContent = `截止 ${todo.deadlineTime} · ${todo.title}`;
    marker.addEventListener("click", () => openTodoEditDialog(todo));
    fragment.append(marker);
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
  const dayTodos = todosDueOnDate(state.events, state.selectedDate);

  if (state.dayScrollTarget !== null) {
    targetMinutes = state.dayScrollTarget;
  } else if (isToday) {
    targetMinutes = currentTimeParts().minutes - 60;
  } else if (occurrences.length > 0) {
    targetMinutes =
      timeToMinutes(occurrences[0].series.startTime) - 30;
  } else if (dayTodos.length > 0) {
    targetMinutes =
      Math.min(...dayTodos.map((todo) => timeToMinutes(todo.deadlineTime))) -
      30;
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
  const currentWeek = startOfWeek(todayISO());
  const overdue = overdueTodos(state.events);
  const dueByDate = new Map();
  if (visibleStart <= visibleEnd) {
    for (let date = visibleStart; date <= visibleEnd; date = addDays(date, 1)) {
      const items = todosDueOnDate(state.events, date).filter(
        (activity) => !isTodoOverdue(activity),
      );
      if (items.length > 0) {
        dueByDate.set(date, items);
      }
    }
  }
  const dueCount = [...dueByDate.values()].reduce(
    (total, items) => total + items.length,
    0,
  );
  const activeCheckins = state.events.filter(
    (activity) =>
      activity.kind === "checkin" &&
      !isActivityArchived(activity) &&
      !isActivityPaused(activity) &&
      !(
        weekEnd < `${activity.year}-01-01` ||
        weekStart > `${activity.year}-12-31`
      ),
  );

  elements.viewKicker.textContent =
    weekStart === currentWeek ? "本周" : "周安排";
  elements.viewTitle.textContent =
    `${formatShortDate(weekStart)}–${formatShortDate(weekEnd)}`;
  elements.viewSummary.textContent =
    `${occurrences.length} 项定期 · ${overdue.length + dueCount} 项代办 · ` +
    `${activeCheckins.length} 项打卡`;
  elements.previousWeekButton.disabled = weekStart <= firstWeek;
  elements.nextWeekButton.disabled = weekStart >= lastWeek;
  elements.goCurrentWeekButton.disabled = weekStart === currentWeek;

  const fragment = document.createDocumentFragment();
  const today = todayISO();
  const auxiliary = createWeekAuxiliary(
    overdue,
    dueByDate,
    activeCheckins,
    weekStart,
    weekEnd,
  );
  if (auxiliary) {
    fragment.append(auxiliary);
  }
  const regularHeading = document.createElement("div");
  regularHeading.className = "week-regular-heading";
  regularHeading.textContent = "七天定期安排";
  fragment.append(regularHeading);

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
    count.textContent = enabled
      ? `${dayOccurrences.length} 项定期`
      : "不可查看";
    dateButton.append(weekday, dateLabel);
    header.append(dateButton, count);
    events.className = "week-events";

    if (dayOccurrences.length === 0) {
      const empty = document.createElement("div");
      empty.className = "week-empty";
      empty.textContent = enabled ? "暂无定期安排" : "不在今年范围内";
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

function createWeekAuxiliary(
  overdue,
  dueByDate,
  activeCheckins,
  weekStart,
  weekEnd,
) {
  if (
    overdue.length === 0 &&
    dueByDate.size === 0 &&
    activeCheckins.length === 0
  ) {
    return null;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "week-auxiliary";

  if (overdue.length > 0 || dueByDate.size > 0) {
    const panel = document.createElement("section");
    const heading = document.createElement("div");
    const list = document.createElement("div");
    panel.className = "week-overview-panel is-todo";
    heading.className = "week-overview-heading";
    heading.textContent = "本周代办";
    list.className = "week-overview-list";
    if (overdue.length > 0) {
      const overdueLabel = document.createElement("div");
      overdueLabel.className = "week-overview-label is-overdue";
      overdueLabel.textContent = `逾期 · ${overdue.length}`;
      list.append(overdueLabel);
      for (const activity of overdue) {
        list.append(createWeekTodoItem(activity, true));
      }
    }
    for (const [date, items] of [...dueByDate.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const label = document.createElement("div");
      label.className = "week-overview-label";
      label.textContent = formatDayTitle(date);
      list.append(label);
      for (const activity of items) {
        list.append(createWeekTodoItem(activity, false));
      }
    }
    panel.append(heading, list);
    wrapper.append(panel);
  }

  if (activeCheckins.length > 0) {
    const panel = document.createElement("section");
    const heading = document.createElement("div");
    const list = document.createElement("div");
    panel.className = "week-overview-panel is-checkin";
    heading.className = "week-overview-heading";
    heading.textContent = "本周打卡";
    list.className = "week-overview-list";
    for (const activity of activeCheckins) {
      const start = weekStart < `${activity.year}-01-01`
        ? `${activity.year}-01-01`
        : weekStart;
      const end = weekEnd > `${activity.year}-12-31`
        ? `${activity.year}-12-31`
        : weekEnd;
      const count =
        start <= end
          ? checkinDatesBetween(activity, start, end).length
          : 0;
      const button = document.createElement("button");
      const name = document.createElement("span");
      const progress = document.createElement("span");
      button.type = "button";
      button.className = "week-checkin-row";
      name.className = "week-checkin-name";
      name.textContent = activity.title;
      progress.className = "week-checkin-progress";
      progress.textContent = `${count}/7 天`;
      button.append(name, progress);
      button.addEventListener("click", () =>
        openCheckinCalendar(activity, start),
      );
      list.append(button);
    }
    panel.append(heading, list);
    wrapper.append(panel);
  }

  return wrapper;
}

function createWeekTodoItem(activity, overdue) {
  const button = document.createElement("button");
  const time = document.createElement("span");
  const name = document.createElement("span");
  button.type = "button";
  button.className =
    `week-overview-row${overdue ? " is-overdue" : ""}`;
  time.className = "week-overview-time";
  time.textContent = overdue
    ? `${formatShortDate(activity.deadlineDate)} ${activity.deadlineTime}`
    : activity.deadlineTime;
  name.className = "week-overview-name";
  name.textContent = activity.title;
  button.append(time, name);
  button.addEventListener("click", () => openTodoEditDialog(activity));
  return button;
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
  const todoCounts = todoCountByDate(state.events);
  const busyCount = [...occupancy.entries()].filter(
    ([date]) => date >= monthStart && date <= monthEnd,
  ).length;

  elements.viewKicker.textContent = "本月";
  elements.viewTitle.textContent = formatMonthTitle(state.monthCursor);
  elements.viewSummary.textContent =
    busyCount === 0
      ? "本月暂无定期安排"
      : `本月 ${busyCount} 天有定期安排`;
  const firstMonth = startOfMonth(window.startDate);
  const lastMonth = startOfMonth(window.endDate);
  const currentMonth = startOfMonth(todayISO());
  elements.previousMonthButton.disabled = monthStart <= firstMonth;
  elements.nextMonthButton.disabled = monthStart >= lastMonth;
  elements.goCurrentMonthButton.disabled = monthStart === currentMonth;

  const fragment = document.createDocumentFragment();
  const today = todayISO();

  for (let offset = 0; offset < 42; offset += 1) {
    const date = addDays(gridStart, offset);
    const dayOccupancy = occupancy.get(date);
    const count = dayOccupancy?.count ?? 0;
    const todoCount = todoCounts.get(date) ?? 0;
    const enabled = date >= window.startDate && date <= window.endDate;
    const cell = document.createElement("button");
    const dayNumber = document.createElement("span");

    cell.type = "button";
    cell.className = "day-cell";
    cell.dataset.date = date;
    cell.disabled = !enabled;
    cell.classList.toggle("is-outside", date < monthStart || date > monthEnd);
    cell.classList.toggle("has-events", count > 0);
    cell.classList.toggle("has-todos", todoCount > 0);
    cell.classList.toggle("is-today", date === today);
    cell.classList.toggle("is-selected", date === state.selectedDate);
    cell.setAttribute(
      "aria-label",
      `${formatDayTitle(date)}，${count > 0 ? `${count} 项定期活动` : "无定期活动"}${
        dayOccupancy
          ? `，占用时间 ${describeOccupiedSlots(dayOccupancy.slots)}`
          : ""
      }${todoCount > 0 ? `，${todoCount} 个代办截止` : ""}${
        enabled ? "" : "，不在可查看范围"
      }`,
    );

    dayNumber.className = "day-number";
    dayNumber.textContent = String(parseISODate(date).getDate());
    cell.append(dayNumber);

    if (todoCount > 0) {
      const badge = document.createElement("span");
      badge.className = "todo-day-badge";
      badge.textContent = String(todoCount);
      badge.setAttribute("aria-hidden", "true");
      cell.append(badge);
    }

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
    ? "重复至年底"
    : `共 ${series.repeatCount} 次`;
  return `每 ${series.repeatEvery} 天 · ${count}`;
}

function reminderLabel(series) {
  if (series.kind === "checkin") {
    return series.reminderMode === "none"
      ? "不提醒"
      : `${series.reminderMode === "alarm" ? "闹钟" : "通知"} · 每天 ${series.reminderTime}`;
  }
  if (series.kind === "todo") {
    return series.reminderMode === "none"
      ? "不提醒"
      : `${series.reminderMode === "alarm" ? "闹钟" : "通知"} · 提前 ${series.reminderDaysBefore} 天`;
  }
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
  const today = todayISO();
  const query = state.activityQuery.trim().toLocaleLowerCase("zh-CN");
  const categoryId = state.activityCategoryFilter;
  const matches = (activity) =>
    (!categoryId || activity.categoryId === categoryId) &&
    activity.title.toLocaleLowerCase("zh-CN").includes(query);
  const currentYear = Number(today.slice(0, 4));
  const years = [
    ...new Set([
      currentYear,
      ...state.events.map((activity) => activity.year).filter(Boolean),
    ]),
  ].sort((left, right) => right - left);
  const archiveYears = [...new Set([...years, state.archiveYear])].sort(
    (left, right) => right - left,
  );
  elements.archiveYearSelect.replaceChildren(
    ...archiveYears.map((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = `${year}年`;
      option.selected = year === state.archiveYear;
      return option;
    }),
  );

  renderCategoryOptions();
  const active = state.events.filter(
    (activity) => !isActivityArchived(activity),
  );
  const scheduleGroups = active
    .filter((activity) => activity.kind === "schedule")
    .map((activity) => {
      const startDate =
        activity.date > today ? activity.date : today;
      const endDate = `${activity.year}-12-31`;
      return {
        activity,
        next:
          startDate <= endDate
            ? occurrencesBetween([activity], startDate, endDate)[0]
            : null,
      };
    })
    .filter((group) => group.next)
    .sort((left, right) => {
      const dateDifference = left.next.date.localeCompare(right.next.date);
      return (
        dateDifference ||
        timeToMinutes(left.activity.startTime) -
          timeToMinutes(right.activity.startTime) ||
        left.activity.title.localeCompare(right.activity.title, "zh-CN")
      );
    })
    .filter((group) => matches(group.activity));
  const todos = active
    .filter((activity) => activity.kind === "todo" && matches(activity))
    .sort((left, right) => {
      const leftOverdue = isTodoOverdue(left);
      const rightOverdue = isTodoOverdue(right);
      if (leftOverdue !== rightOverdue) {
        return leftOverdue ? -1 : 1;
      }
      return (
        left.deadlineDate.localeCompare(right.deadlineDate) ||
        left.deadlineTime.localeCompare(right.deadlineTime)
      );
    });
  const checkins = active
    .filter((activity) => activity.kind === "checkin" && matches(activity))
    .sort((left, right) =>
      left.title.localeCompare(right.title, "zh-CN"),
    );
  const paused = active
    .filter((activity) => isActivityPaused(activity) && matches(activity))
    .sort((left, right) =>
      left.title.localeCompare(right.title, "zh-CN"),
    );
  const archived = state.events
    .filter(
      (activity) =>
        isActivityArchived(activity) &&
        activity.year === state.archiveYear &&
        matches(activity),
    )
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );

  elements.viewKicker.textContent = state.archiveMode ? "归档" : "活动";
  elements.viewTitle.textContent = state.archiveMode
    ? `${state.archiveYear}年归档`
    : "活动项目";
  elements.viewSummary.textContent = state.archiveMode
    ? `${archived.length} 个归档项目`
    : `${scheduleGroups.length} 个定期 · ${todos.length} 个代办 · ${checkins.length + paused.length} 个打卡`;
  elements.archiveToggleButton.textContent = state.archiveMode
    ? "返回活动"
    : "查看归档";
  elements.archiveActivitySection.hidden = !state.archiveMode;
  for (const section of [
    elements.activeActivitySection,
    elements.todoActivitySection,
    elements.checkinActivitySection,
    elements.pausedActivitySection,
  ]) {
    section.hidden = state.archiveMode;
  }

  elements.activeActivityCount.textContent = String(scheduleGroups.length);
  elements.todoActivityCount.textContent = String(todos.length);
  elements.checkinActivityCount.textContent = String(checkins.length);
  elements.pausedActivityCount.textContent = String(paused.length);
  elements.inactiveActivityCount.textContent = String(archived.length);
  elements.activeActivityList.replaceChildren(
    ...scheduleGroups.map((group) =>
      createActiveScheduleRow(group),
    ),
  );
  elements.todoActivityList.replaceChildren(
    ...todos.map(createTodoActivityRow),
  );
  elements.checkinActivityList.replaceChildren(
    ...checkins.map(createCheckinActivityRow),
  );
  elements.pausedActivityList.replaceChildren(
    ...paused.map(createPausedActivityRow),
  );
  renderArchiveGroups(archived);

  if (scheduleGroups.length === 0) {
    elements.activeActivityList.append(createListEmpty("暂无定期活动"));
  }
  if (todos.length === 0) {
    elements.todoActivityList.append(createListEmpty("暂无代办"));
  }
  if (checkins.length === 0) {
    elements.checkinActivityList.append(createListEmpty("暂无打卡项目"));
  }
  if (paused.length === 0) {
    elements.pausedActivityList.append(createListEmpty("暂无已暂停项目"));
  }

  const noFilteredResults = state.archiveMode
    ? archived.length === 0
    : scheduleGroups.length +
        todos.length +
        checkins.length +
        paused.length ===
      0;
  elements.activityEmpty.hidden = !noFilteredResults;
  if (noFilteredResults) {
    const title = elements.activityEmpty.querySelector("strong");
    const detail = elements.activityEmpty.querySelector("span");
    title.textContent = query ? "没有找到相关活动" : "还没有活动项目";
    detail.textContent = query
      ? "换一个名称或分类试试"
      : "点击右上角按钮添加";
  }
  renderMigrationBanner();
}

function createActiveScheduleRow(group) {
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
  name.textContent = group.activity.title;
  rule.className = "activity-rule";
  rule.textContent = activityRuleText(group.activity);
  next.className = "activity-next";
  next.textContent =
    `${formatShortDate(group.next.date)} ${group.activity.startTime}`;
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

function createTodoActivityRow(activity) {
  const row = document.createElement("div");
  const main = document.createElement("button");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const due = document.createElement("span");
  const complete = document.createElement("button");
  const overdue = isTodoOverdue(activity);
  row.className = "activity-row";
  main.type = "button";
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = activity.title;
  rule.className = "activity-rule";
  rule.textContent =
    `${categoryName(state.categories, "todo", activity.categoryId)} · ` +
    reminderLabel(activity);
  due.className = `activity-next${overdue ? " is-overdue" : ""}`;
  due.textContent = overdue
    ? "已逾期"
    : `${formatShortDate(activity.deadlineDate)} ${activity.deadlineTime}`;
  complete.type = "button";
  complete.className = "activity-resume";
  complete.textContent = "完成";
  complete.addEventListener("click", () => completeTodo(activity));
  copy.append(name, rule);
  main.append(copy, due);
  main.addEventListener("click", () => openTodoEditDialog(activity));
  row.append(main, complete);
  return row;
}

function createCheckinActivityRow(activity) {
  const row = document.createElement("div");
  const main = document.createElement("button");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const calendar = document.createElement("button");
  row.className = "activity-row";
  main.type = "button";
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = activity.title;
  rule.className = "activity-rule";
  rule.textContent =
    `${categoryName(state.categories, "checkin", activity.categoryId)} · ` +
    `今年已打卡 ${checkinDatesBetween(
      activity,
      `${activity.year}-01-01`,
      `${activity.year}-12-31`,
    ).length} 天` +
    (nativeApp ? ` · ${reminderLabel(activity)}` : "");
  copy.append(name, rule);
  main.append(copy);
  main.addEventListener("click", () => openCheckinEditDialog(activity));
  calendar.type = "button";
  calendar.className = "activity-resume";
  calendar.textContent = "月历";
  calendar.addEventListener("click", () => openCheckinCalendar(activity));
  row.append(main, calendar);
  return row;
}

function createPausedActivityRow(activity) {
  const row = document.createElement("div");
  const main = document.createElement("button");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const resumeButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  row.className = "activity-row is-paused";
  main.type = "button";
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = activity.title;
  rule.className = "activity-rule";
  rule.textContent =
    `${ACTIVITY_KIND_LABELS[activity.kind]} · ` +
    categoryName(state.categories, activity.kind, activity.categoryId);
  resumeButton.type = "button";
  resumeButton.className = "activity-resume";
  resumeButton.textContent = "恢复";
  resumeButton.addEventListener("click", () => {
    snapshotBefore("恢复活动前");
    state.events = state.events.map((event) =>
      event.id === activity.id
        ? activity.kind === "schedule"
          ? resumeSeries([event], event.id, todayISO())[0]
          : resumeCheckin(event, todayISO())
        : event,
    );
    persistEvents();
    render();
    showToast("活动已恢复");
  });
  deleteButton.type = "button";
  deleteButton.className = "activity-delete";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", () => {
    openSeriesDeleteConfirmation(activity);
  });
  copy.append(name, rule);
  main.append(copy);
  main.addEventListener("click", () => {
    if (activity.kind === "schedule") {
      const next = occurrencesBetween(
        [{ ...activity, pauses: activity.pauses.filter((pause) => pause.endDate !== null) }],
        activity.date,
        `${activity.year}-12-31`,
      )[0];
      if (next) {
        openEditDialog(next.originalSeries, next.originalDate, {
          preferFuture: true,
        });
      }
    } else if (activity.kind === "checkin") {
      openCheckinEditDialog(activity);
    }
  });
  row.append(main, resumeButton, deleteButton);
  return row;
}

function createArchivedActivityRow(activity) {
  const row = document.createElement("div");
  const main = document.createElement("div");
  const copy = document.createElement("span");
  const name = document.createElement("span");
  const rule = document.createElement("span");
  const last = document.createElement("span");
  const deleteButton = document.createElement("button");

  row.className = "activity-row is-inactive";
  row.dataset.seriesId = activity.id;
  main.className = "activity-main";
  copy.className = "activity-copy";
  name.className = "activity-name";
  name.textContent = activity.title;
  rule.className = "activity-rule";
  rule.textContent =
    `${ACTIVITY_KIND_LABELS[activity.kind]} · ` +
    categoryName(state.categories, activity.kind, activity.categoryId) +
    (activity.archiveReason ? ` · ${activity.archiveReason}` : "");
  last.className = "activity-next";
  last.textContent = activity.kind === "todo"
    ? `${formatShortDate(activity.deadlineDate)} 截止`
    : activity.kind === "checkin"
      ? `${activity.checkInDates.length} 次打卡`
      : `${activity.year}年`;
  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.className = "activity-resume";
  restoreButton.textContent = "恢复";
  restoreButton.addEventListener("click", () => restoreArchivedActivity(activity));
  deleteButton.type = "button";
  deleteButton.className = "activity-delete";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除归档活动 ${activity.title}`);
  deleteButton.addEventListener("click", () => {
    openSeriesDeleteConfirmation(activity);
  });
  copy.append(name, rule);
  main.append(copy, last);
  row.append(main, restoreButton, deleteButton);
  return row;
}

function renderArchiveGroups(archived) {
  const fragment = document.createDocumentFragment();
  if (archived.length === 0) {
    fragment.append(createListEmpty("这一年暂无归档项目"));
  } else {
    for (const kind of ["schedule", "todo", "checkin"]) {
      const items = archived.filter((activity) => activity.kind === kind);
      if (items.length === 0) {
        continue;
      }
      const group = document.createElement("section");
      const heading = document.createElement("h3");
      const list = document.createElement("div");
      group.className = "archive-group";
      heading.textContent = `${ACTIVITY_KIND_LABELS[kind]} · ${items.length}`;
      list.className = "activity-list";
      list.append(...items.map(createArchivedActivityRow));
      group.append(heading, list);
      fragment.append(group);
    }
  }
  elements.inactiveActivityList.replaceChildren(fragment);
}

function restoreArchivedActivity(activity) {
  state.restoringActivityId = activity.id;
  if (activity.kind === "todo") {
    openTodoEditDialog(activity);
  } else if (activity.kind === "checkin") {
    openCheckinEditDialog(activity);
  } else {
    openEditDialog(activity, activity.date, { preferFuture: true });
  }
}

function renderCategoryOptions() {
  const selected = state.activityCategoryFilter;
  const options = [document.createElement("option")];
  options[0].value = "";
  options[0].textContent = "全部分类";
  for (const kind of ["schedule", "todo", "checkin"]) {
    for (const category of state.categories[kind]) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `${ACTIVITY_KIND_LABELS[kind]} · ${category.name}`;
      option.selected = category.id === selected;
      options.push(option);
    }
  }
  elements.activityCategoryFilter.replaceChildren(...options);
  elements.activityCategoryFilter.value = state.categories.schedule
    .concat(state.categories.todo, state.categories.checkin)
    .some((category) => category.id === selected)
    ? selected
    : "";
  if (!elements.activityCategoryFilter.value) {
    state.activityCategoryFilter = "";
  }
}

function migrationTargetYear(now = new Date()) {
  const month = now.getMonth() + 1;
  return month === 12 ? now.getFullYear() + 1 : now.getFullYear();
}

function migrationIsDue(now = new Date()) {
  if (!nativeApp) {
    return false;
  }
  const current = now.getFullYear();
  const month = now.getMonth() + 1;
  const target = migrationTargetYear(now);
  return (
    state.yearMigrationCompletedFor < target &&
    (month === 12 || month === 1)
  );
}

function renderMigrationBanner() {
  const now = new Date();
  const due = migrationIsDue(now);
  elements.yearMigrationBanner.hidden = !due;
  if (!due) {
    return;
  }
  const target = migrationTargetYear(now);
  elements.yearMigrationTitle.textContent = `${target}年度迁移`;
  elements.yearMigrationMessage.textContent =
    now.getMonth() === 11
      ? "现在可以先选择要续用到下一年的定期和打卡项目。"
      : "新年度尚未完成迁移；可继续选择要沿用的项目。";
}

function createListEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "activity-list-empty";
  empty.textContent = message;
  return empty;
}

function currentActivityKind() {
  return (
    [...elements.activityKindInputs].find((input) => input.checked)?.value ??
    "schedule"
  );
}

function setActivityKind(kind) {
  for (const input of elements.activityKindInputs) {
    input.checked = input.value === kind;
  }
  populateFormCategories(kind, null);
  updateActivityFormUi();
}

function currentTodoReminderMode() {
  return (
    [...elements.todoReminderModeInputs].find((input) => input.checked)
      ?.value ?? "none"
  );
}

function setTodoReminderMode(mode) {
  for (const input of elements.todoReminderModeInputs) {
    input.checked = input.value === mode;
  }
  updateTodoReminderUi();
}

function updateTodoReminderUi() {
  const enabled = currentTodoReminderMode() !== "none";
  elements.todoReminderDaysBefore.disabled = !enabled;
  elements.todoReminderDaysBefore.required = enabled;
  elements.todoReminderDaysField.classList.toggle("is-disabled", !enabled);
  elements.todoReminderField.classList.toggle("is-disabled", !enabled);
}

function currentCheckinReminderMode() {
  return (
    [...elements.checkinReminderModeInputs].find((input) => input.checked)
      ?.value ?? "none"
  );
}

function setCheckinReminderMode(mode) {
  for (const input of elements.checkinReminderModeInputs) {
    input.checked = input.value === mode;
  }
  updateCheckinReminderUi();
}

function updateCheckinReminderUi() {
  const enabled = currentCheckinReminderMode() !== "none";
  elements.checkinReminderTime.disabled = !enabled;
  elements.checkinReminderTime.required = enabled;
  elements.checkinReminderTimeField.classList.toggle(
    "is-disabled",
    !enabled,
  );
  elements.checkinReminderField.classList.toggle(
    "is-disabled",
    !enabled,
  );
}

function populateFormCategories(kind, selectedId = null) {
  const options = [document.createElement("option")];
  options[0].value = "";
  options[0].textContent = "未分类";
  for (const category of state.categories[kind] ?? []) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === selectedId;
    options.push(option);
  }
  elements.activityCategory.replaceChildren(...options);
  elements.activityCategory.value = selectedId ?? "";
}

function updateActivityFormUi() {
  const kind = currentActivityKind();
  const editing = Boolean(state.editing);
  elements.activityKindField.hidden = editing;
  const schedule = kind === "schedule";
  const todo = kind === "todo";
  const checkin = kind === "checkin";
  elements.eventDateField.hidden = !schedule;
  elements.startTimeField.hidden = !schedule;
  elements.endTimeField.hidden = !schedule;
  elements.repeatModeField.hidden = !schedule;
  elements.repeatEveryField.hidden = !schedule;
  elements.repeatCountField.hidden = !schedule || currentRepeatMode() === "infinite";
  elements.reminderField.hidden = !nativeApp || !schedule;
  elements.todoDeadlineDateField.hidden = !todo;
  elements.todoDeadlineTimeField.hidden = !todo;
  elements.todoReminderField.hidden = !nativeApp || !todo;
  elements.checkinFormNote.hidden = !checkin;
  elements.checkinReminderField.hidden = !nativeApp || !checkin;
  elements.editScopeField.hidden = !editing || !schedule;
  elements.editScopeNote.hidden = !editing || !schedule;
  const archived = state.editing?.archived === true;
  elements.pauseEventButton.hidden =
    !editing || archived || (!schedule && !checkin);
  elements.archiveEventButton.hidden = !editing || archived;
  elements.archiveEventButton.textContent =
    todo || checkin ? "完成并归档" : "归档活动";
  elements.deleteEventButton.hidden = !editing;
  if (!editing || !schedule) {
    elements.activityCategory.disabled = false;
  }
  if (schedule && editing) {
    updateEditScopeUi();
  }
}

function openAddDialog(date = state.selectedDate) {
  const window = getScheduleWindow();
  if (date < window.startDate || date > window.endDate) {
    date = window.startDate;
  }
  if (date < todayISO()) {
    date = todayISO();
  }

  const defaults = defaultTimes(date);
  const restored = Boolean(state.restoringActivityId);
  state.editing = null;
  state.restoringActivityId = null;
  if (restored) {
    state.archiveMode = false;
  }
  state.confirmedOverrideDiscard = false;
  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "新活动";
  elements.eventDialogTitle.textContent = "添加活动";
  elements.eventName.value = "";
  elements.eventDate.min = todayISO();
  elements.eventDate.max = window.endDate;
  elements.eventDate.value = date;
  elements.todoDeadlineDate.min = todayISO();
  elements.todoDeadlineDate.max = window.endDate;
  elements.todoDeadlineDate.value = todayISO();
  elements.todoDeadlineTime.value = "18:00";
  elements.startTime.value = defaults.startTime;
  elements.endTime.value = defaults.endTime;
  elements.repeatEvery.value = "1";
  elements.repeatCount.value = "1";
  elements.reminderMinutesBefore.value = "5";
  elements.todoReminderDaysBefore.value = "0";
  elements.checkinReminderTime.value = DEFAULT_CHECKIN_REMINDER_TIME;
  elements.eventNotes.value = "";
  setReminderMode("none");
  setRepeatMode("limited");
  setTodoReminderMode("none");
  setCheckinReminderMode("none");
  setActivityKind("schedule");
  updateReminderUi();
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
}

function openEditDialog(series, occurrenceDate, { preferFuture = false } = {}) {
  const window = getScheduleWindow(`${series.year}-01-01`);
  const remaining = remainingRepeatCount(series, occurrenceDate);
  const initialScope = preferFuture ? "future" : "single";
  if (getOccurrenceIndex(series, occurrenceDate) === null) {
    showToast("这条活动已无法编辑");
    return;
  }

  state.editing = {
    kind: "schedule",
    seriesId: series.id,
    occurrenceDate,
    scope: initialScope,
    archived: Boolean(series.archivedAt),
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
  state.activityKind = "schedule";
  setActivityKind("schedule");
  elements.eventName.value = displaySeries.title;
  populateFormCategories("schedule", displaySeries.categoryId);
  elements.eventDate.min = todayISO();
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
  setEditScope(initialScope);
  updateReminderUi();
  updateActivityFormUi();
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
}

function openTodoEditDialog(activity) {
  state.editing = {
    kind: "todo",
    activityId: activity.id,
    archived: Boolean(activity.archivedAt),
  };
  state.confirmedOverrideDiscard = false;
  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "编辑代办";
  elements.eventDialogTitle.textContent = "编辑代办";
  state.editing = {
    kind: "todo",
    activityId: activity.id,
    archived: Boolean(activity.archivedAt),
  };
  setActivityKind("todo");
  elements.eventName.value = activity.title;
  populateFormCategories("todo", activity.categoryId);
  elements.todoDeadlineDate.min = todayISO();
  elements.todoDeadlineDate.max = getScheduleWindow().endDate;
  elements.todoDeadlineDate.value = activity.deadlineDate;
  elements.todoDeadlineTime.value = activity.deadlineTime;
  elements.todoReminderDaysBefore.value = String(
    activity.reminderDaysBefore,
  );
  setTodoReminderMode(activity.reminderMode);
  elements.eventNotes.value = activity.notes;
  elements.formError.hidden = true;
  updateActivityFormUi();
  elements.eventDialog.showModal();
}

function openCheckinEditDialog(activity) {
  state.editing = {
    kind: "checkin",
    activityId: activity.id,
    archived: Boolean(activity.archivedAt),
  };
  state.confirmedOverrideDiscard = false;
  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "编辑打卡";
  elements.eventDialogTitle.textContent = "编辑打卡";
  setActivityKind("checkin");
  populateFormCategories("checkin", activity.categoryId);
  elements.eventName.value = activity.title;
  elements.eventNotes.value = activity.notes;
  elements.checkinReminderTime.value =
    activity.reminderTime ?? DEFAULT_CHECKIN_REMINDER_TIME;
  setCheckinReminderMode(activity.reminderMode ?? "none");
  elements.formError.hidden = true;
  updateActivityFormUi();
  elements.eventDialog.showModal();
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
    ? todayISO()
    : state.editing.occurrenceDate;
  elements.activityCategory.disabled = single;
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
    categoryId: elements.activityCategory.value || null,
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
  const kind = state.editing?.kind ?? currentActivityKind();
  if (kind === "todo") {
    handleTodoSubmit();
    return;
  }
  if (kind === "checkin") {
    handleCheckinSubmit();
    return;
  }
  handleScheduleSubmit();
}

function handleScheduleSubmit() {
  const editingSeries = state.editing
    ? state.events.find((event) => event.id === state.editing.seriesId)
    : null;
  const window = getScheduleWindow(
    `${editingSeries?.year ?? Number(todayISO().slice(0, 4))}-01-01`,
  );
  const input = readFormInput();
  const singleEdit =
    state.editing && currentEditScope() === "single";
  const minimumDate = singleEdit
    ? todayISO()
    : state.editing?.occurrenceDate ?? todayISO();
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
  state.restoringActivityId = null;
  state.confirmedOverrideDiscard = false;
  persistEvents();
  elements.eventDialog.close();
  render();
}

function handleTodoSubmit() {
  const input = {
    title: elements.eventName.value,
    deadlineDate: elements.todoDeadlineDate.value,
    deadlineTime: elements.todoDeadlineTime.value,
    reminderMode: nativeApp ? currentTodoReminderMode() : "none",
    reminderDaysBefore: Number(elements.todoReminderDaysBefore.value),
    notes: elements.eventNotes.value.trim(),
    categoryId: elements.activityCategory.value || null,
  };
  const error = validateTodoInput(input, {
    year: Number(todayISO().slice(0, 4)),
  });
  if (error) {
    elements.formError.textContent = error;
    elements.formError.hidden = false;
    return;
  }
  const existing =
    state.editing?.kind === "todo"
      ? state.events.find(
          (activity) => activity.id === state.editing.activityId,
        )
      : null;
  const candidate = todoFromInput(input, {
    id: existing?.id,
    createdAt: existing?.createdAt,
    categoryId: input.categoryId,
  });
  if (!candidate) {
    elements.formError.textContent = "代办内容不完整";
    elements.formError.hidden = false;
    return;
  }
  snapshotBefore(existing ? "修改代办前" : "添加代办前");
  state.events = existing
    ? state.events.map((activity) =>
        activity.id === existing.id
          ? { ...candidate, archivedAt: null, archiveReason: null, completedAt: null }
          : activity,
      )
    : [...state.events, candidate];
  finishActivitySave(
    candidate.deadlineDate,
    timeToMinutes(candidate.deadlineTime) - 60,
    existing ? "代办已更新" : "代办已添加",
  );
}

function handleCheckinSubmit() {
  const input = {
    title: elements.eventName.value,
    reminderMode: nativeApp ? currentCheckinReminderMode() : "none",
    reminderTime:
      elements.checkinReminderTime.value ||
      DEFAULT_CHECKIN_REMINDER_TIME,
  };
  const error = validateCheckinInput(input);
  if (error) {
    elements.formError.textContent = error;
    elements.formError.hidden = false;
    return;
  }
  const existing =
    state.editing?.kind === "checkin"
      ? state.events.find(
          (activity) => activity.id === state.editing.activityId,
        )
      : null;
  const currentYear =
    existing?.year ?? Number(todayISO().slice(0, 4));
  const candidate = checkinFromInput(
    {
      title: input.title,
      notes: elements.eventNotes.value.trim(),
      checkInDates:
        existing?.year === currentYear ? existing.checkInDates : [],
      pauses: existing?.year === currentYear ? existing.pauses : [],
      reminderMode: input.reminderMode,
      reminderTime: input.reminderTime,
    },
    {
      year: currentYear,
      id: existing?.id,
      createdAt: existing?.createdAt,
      categoryId: elements.activityCategory.value || null,
    },
  );
  if (!candidate) {
    elements.formError.textContent = "打卡内容不完整";
    elements.formError.hidden = false;
    return;
  }
  snapshotBefore(existing ? "修改打卡前" : "添加打卡前");
  state.events = existing
    ? state.events.map((activity) =>
        activity.id === existing.id
          ? { ...candidate, archivedAt: null, archiveReason: null, completedAt: null }
          : activity,
      )
    : [...state.events, candidate];
  finishActivitySave(todayISO(), undefined, existing ? "打卡已更新" : "打卡已添加");
}

function finishActivitySave(date, scrollMinutes, message) {
  const restored = Boolean(state.restoringActivityId);
  state.selectedDate = date;
  state.monthCursor = startOfMonth(date);
  state.view = "day";
  state.autoScrollDay = true;
  state.dayScrollTarget =
    Number.isFinite(scrollMinutes) ? scrollMinutes : null;
  state.editing = null;
  state.restoringActivityId = null;
  if (restored) {
    state.archiveMode = false;
  }
  state.confirmedOverrideDiscard = false;
  persistEvents();
  elements.eventDialog.close();
  render();
  showToast(message);
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

function showConfirmationAfterEdit(dialog) {
  const show = () => {
    window.setTimeout(() => {
      if (!dialog.open) {
        dialog.showModal();
      }
    }, 40);
  };
  if (elements.eventDialog.open) {
    elements.eventDialog.addEventListener("close", show, { once: true });
    elements.eventDialog.close();
  } else {
    show();
  }
}

function openDeleteConfirmation() {
  if (!state.editing) {
    return;
  }
  const activityId =
    state.editing.kind === "schedule"
      ? state.editing.seriesId
      : state.editing.activityId;
  const activity = state.events.find((event) => event.id === activityId);
  if (!activity) {
    showToast("找不到要删除的活动");
    return;
  }

  state.pendingDelete = {
    kind: "series",
    seriesId: activity.id,
  };
  elements.deleteDialogMessage.textContent =
    `将永久删除「${activity.title}」的整个活动及全部历史记录，且无法撤销。`;
  showConfirmationAfterEdit(elements.deleteDialog);
}

function openSeriesDeleteConfirmation(series) {
  state.pendingDelete = {
    kind: "series",
    seriesId: series.id,
  };
  elements.deleteDialogMessage.textContent =
    "将永久删除这个活动，且无法撤销。";
  elements.deleteDialog.showModal();
}

function confirmDelete() {
  if (!state.pendingDelete) {
    elements.deleteDialog.close();
    return;
  }

  try {
    snapshotBefore("删除活动前");
    state.events = state.events.filter(
      (event) => event.id !== state.pendingDelete.seriesId,
    );
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
  const activityId =
    state.editing.kind === "schedule"
      ? state.editing.seriesId
      : state.editing.activityId;
  const activity = state.events.find((event) => event.id === activityId);
  if (!activity) {
    showToast("找不到要暂停的活动");
    return;
  }

  state.pendingPause = {
    kind: activity.kind,
    seriesId: activity.id,
    occurrenceDate: state.editing.occurrenceDate,
  };
  elements.pauseDialogMessage.textContent =
    activity.kind === "checkin"
      ? `将从今天起暂停「${activity.title}」的打卡和提醒，之后可随时恢复。`
      : `将从 ${formatShortDate(state.editing.occurrenceDate)} 起暂停「${activity.title}」。` +
        "暂停期间不提醒，也不消耗有限次数；恢复后会从下一个原周期日期继续。";
  showConfirmationAfterEdit(elements.pauseDialog);
}

function confirmPause() {
  if (!state.pendingPause) {
    elements.pauseDialog.close();
    return;
  }

  try {
    snapshotBefore("暂停活动前");
    if (state.pendingPause.kind === "checkin") {
      state.events = state.events.map((event) =>
        event.id === state.pendingPause.seriesId
          ? pauseCheckin(event, todayISO())
          : event,
      );
    } else {
      state.events = pauseSeries(
        state.events,
        state.pendingPause.seriesId,
        state.pendingPause.occurrenceDate,
      );
    }
    state.pendingPause = null;
    state.editing = null;
    state.restoringActivityId = null;
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

function openArchiveConfirmation() {
  if (!state.editing) {
    return;
  }
  const activityId =
    state.editing.kind === "schedule"
      ? state.editing.seriesId
      : state.editing.activityId;
  const activity = state.events.find((event) => event.id === activityId);
  if (!activity) {
    return;
  }
  state.pendingArchive = { activityId: activity.id };
  const completed =
    activity.kind === "todo" || activity.kind === "checkin";
  elements.archiveDialogTitle.textContent = completed
    ? "完成并归档？"
    : "归档整个活动？";
  elements.archiveDialogMessage.textContent = completed
    ? `「${activity.title}」将标记为已完成并移入归档，未来提醒会停止。`
    : `「${activity.title}」将立即停止后续安排和提醒，并移入归档；之后可恢复编辑。`;
  elements.confirmArchiveButton.textContent = completed
    ? "完成并归档"
    : "归档活动";
  showConfirmationAfterEdit(elements.archiveDialog);
}

function confirmArchive() {
  if (!state.pendingArchive) {
    elements.archiveDialog.close();
    return;
  }
  const activity = state.events.find(
    (event) => event.id === state.pendingArchive.activityId,
  );
  if (!activity) {
    state.pendingArchive = null;
    elements.archiveDialog.close();
    return;
  }
  snapshotBefore("完成活动前");
  state.events = archiveActivity(
    state.events,
    activity.id,
    activity.kind === "schedule" ? "已归档" : "已完成",
  );
  state.pendingArchive = null;
  state.editing = null;
  state.restoringActivityId = null;
  persistEvents();
  elements.eventDialog.close();
  elements.archiveDialog.close();
  state.archiveMode = true;
  state.archiveYear = activity.year;
  state.view = "activity";
  render();
  showToast(
    activity.kind === "schedule"
      ? "活动已归档"
      : "活动已完成并归档",
  );
}

function renderCategoryManager() {
  const kind = elements.categoryKindSelect.value;
  const fragment = document.createDocumentFragment();
  const items = state.categories[kind] ?? [];
  if (items.length === 0) {
    fragment.append(createListEmpty("还没有自定义分类"));
  }
  for (const category of items) {
    const row = document.createElement("div");
    const input = document.createElement("input");
    const remove = document.createElement("button");
    row.className = "category-row";
    input.value = category.name;
    input.maxLength = 24;
    input.setAttribute("aria-label", "分类名称");
    input.addEventListener("change", () => {
      const nextName = input.value.trim();
      if (!nextName) {
        input.value = category.name;
        return;
      }
      state.categories = renameCategory(
        state.categories,
        kind,
        category.id,
        nextName,
      );
      persistEvents();
      renderCategoryManager();
      render();
    });
    remove.type = "button";
    remove.className = "activity-delete";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      snapshotBefore("删除分类前");
      state.categories = deleteCategory(
        state.categories,
        kind,
        category.id,
      );
      state.events = state.events.map((activity) =>
        activity.categoryId === category.id
          ? { ...activity, categoryId: null }
          : activity,
      );
      if (state.activityCategoryFilter === category.id) {
        state.activityCategoryFilter = "";
      }
      persistEvents();
      renderCategoryManager();
      render();
    });
    row.append(input, remove);
    fragment.append(row);
  }
  elements.categoryList.replaceChildren(fragment);
}

function openCheckinCalendar(activity, date = todayISO()) {
  state.checkinCalendarId = activity.id;
  const currentMonth = startOfMonth(date);
  state.checkinMonthCursor =
    currentMonth >= `${activity.year}-01-01` &&
    currentMonth <= `${activity.year}-12-01`
      ? currentMonth
      : `${activity.year}-01-01`;
  elements.checkinCalendarTitle.textContent = activity.title;
  elements.checkinCalendarDialog.showModal();
  renderCheckinCalendar();
}

function renderCheckinCalendar() {
  const activity = state.events.find(
    (item) => item.id === state.checkinCalendarId,
  );
  if (!activity || activity.kind !== "checkin") {
    elements.checkinCalendarDialog.close();
    return;
  }
  const monthStart = startOfMonth(state.checkinMonthCursor);
  const monthEnd = endOfMonth(monthStart);
  const firstMonth = `${activity.year}-01-01`;
  const lastMonth = `${activity.year}-12-01`;
  const gridStart = addDays(
    monthStart,
    -mondayBasedWeekday(monthStart),
  );
  const today = todayISO();
  const fragment = document.createDocumentFragment();
  elements.checkinMonthTitle.textContent = formatMonthTitle(monthStart);
  elements.previousCheckinMonth.disabled = monthStart <= firstMonth;
  elements.nextCheckinMonth.disabled = monthStart >= lastMonth;
  elements.currentCheckinMonth.disabled =
    monthStart === startOfMonth(today);

  for (let offset = 0; offset < 42; offset += 1) {
    const date = addDays(gridStart, offset);
    const button = document.createElement("button");
    const checked = activity.checkInDates.includes(date);
    const inMonth = date >= monthStart && date <= monthEnd;
    const inYear = date.startsWith(`${activity.year}-`);
    const paused = isDatePausedForCheckin(activity, date);
    button.type = "button";
    button.className = "checkin-day";
    button.textContent = String(parseISODate(date).getDate());
    button.classList.toggle("is-outside", !inMonth);
    button.classList.toggle("is-checked", checked);
    button.classList.toggle("is-today", date === today);
    button.disabled =
      !inMonth || !inYear || date > today || paused;
    button.setAttribute(
      "aria-label",
      `${formatDayTitle(date)}${checked ? "，已打卡" : "，未打卡"}`,
    );
    button.addEventListener("click", () => {
      try {
        state.events = state.events.map((item) =>
          item.id === activity.id
            ? toggleCheckin(item, date)
            : item,
        );
        persistEvents();
        renderCheckinCalendar();
        if (state.view === "day" || state.view === "week") {
          render();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
    fragment.append(button);
  }
  elements.checkinCalendarGrid.replaceChildren(fragment);
}

function migrationIsMandatory(now = new Date()) {
  return (
    nativeApp &&
    now.getMonth() === 0 &&
    state.yearMigrationCompletedFor < now.getFullYear()
  );
}

function openMigrationDialog() {
  const targetYear = migrationTargetYear();
  state.migrationSelections = new Map();
  for (const activity of state.events) {
    if (
      (!isActivityArchived(activity) ||
        activity.archiveReason === "年度结束") &&
      !isActivityPaused(activity) &&
      ["schedule", "checkin"].includes(activity.kind)
    ) {
      state.migrationSelections.set(activity.id, true);
    }
  }
  elements.migrationDialogTitle.textContent = `${targetYear}年度迁移`;
  elements.skipMigrationButton.textContent = migrationIsMandatory()
    ? "明确跳过本年迁移"
    : "稍后处理";
  elements.migrationError.hidden = true;
  renderMigrationRows();
  elements.migrationDialog.showModal();
}

function renderMigrationRows() {
  const fragment = document.createDocumentFragment();
  const candidates = state.events.filter(
    (activity) =>
      (!isActivityArchived(activity) ||
        activity.archiveReason === "年度结束") &&
      !isActivityPaused(activity) &&
      ["schedule", "checkin"].includes(activity.kind),
  );
  if (candidates.length === 0) {
    fragment.append(
      createListEmpty("没有可迁移的定期或打卡项目"),
    );
  }
  for (const activity of candidates) {
    const row = document.createElement("label");
    const checkbox = document.createElement("input");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    const edit = document.createElement("button");
    row.className = "migration-row";
    checkbox.type = "checkbox";
    checkbox.checked = state.migrationSelections.get(activity.id) !== false;
    checkbox.addEventListener("change", () => {
      state.migrationSelections.set(activity.id, checkbox.checked);
    });
    title.textContent = activity.title;
    detail.textContent =
      activity.kind === "schedule"
        ? `${formatRecurrenceRule(activity)} · ${activity.startTime}–${activity.endTime}`
        : `打卡项目 · 今年 ${activity.checkInDates.length} 次`;
    copy.append(title, detail);
    edit.type = "button";
    edit.className = "activity-resume";
    edit.textContent = "编辑";
    edit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      elements.migrationDialog.close();
      if (activity.kind === "schedule") {
        const next = occurrencesBetween(
          [activity],
          activity.date,
          `${activity.year}-12-31`,
        )[0];
        if (next) {
          openEditDialog(next.originalSeries, next.originalDate, {
            preferFuture: true,
          });
        }
      } else {
        openCheckinEditDialog(activity);
      }
    });
    row.append(checkbox, copy, edit);
    fragment.append(row);
  }
  elements.migrationList.replaceChildren(fragment);
}

function finishMigration(targetYear) {
  state.yearMigrationCompletedFor = targetYear;
  state.events = finalizePreviousYears(
    state.events,
    Math.min(targetYear, Number(todayISO().slice(0, 4))),
  );
  persistEvents();
  elements.migrationDialog.close();
  render();
}

function skipMigration() {
  const targetYear = migrationTargetYear();
  const mandatory = migrationIsMandatory();
  finishMigration(targetYear);
  showToast(
    mandatory
      ? `已跳过 ${targetYear} 年度迁移`
      : "已记录，今年稍后可继续迁移",
  );
}

function confirmMigration() {
  const targetYear = migrationTargetYear();
  const selected = state.events.filter(
    (activity) => state.migrationSelections.get(activity.id) === true,
  );
  const copies = [];
  for (const activity of selected) {
    const copy = cloneActivityForYear(activity, targetYear);
    if (copy) {
      copies.push(copy);
    }
  }
  if (copies.length === 0 && selected.length > 0) {
    elements.migrationError.textContent = "没有可迁移的活动";
    elements.migrationError.hidden = false;
    return;
  }
  snapshotBefore("年度迁移前");
  state.events = [...state.events, ...copies];
  finishMigration(targetYear);
  showToast(`已迁移 ${copies.length} 个项目到 ${targetYear} 年`);
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
      const result = await scheduleTestReminder("alarm");
      showToast(
        result.exact
          ? "测试闹钟将在约 5 秒后发送"
          : result.channelFallback
            ? "闹钟通道已关闭，测试已改用普通通知发送"
            : "精确闹钟未授权，测试已降级为普通通知",
      );
    } catch (error) {
      showToast(error.message);
    }
  });
  elements.openNotificationSettingsButton.addEventListener("click", async () => {
    try {
      await openReminderChannelSettings("app");
    } catch (error) {
      showToast(error.message);
    }
  });
  elements.openAlarmChannelSettingsButton.addEventListener("click", async () => {
    try {
      await openReminderChannelSettings("alarm");
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
  elements.eventDialog.addEventListener("close", () => {
    state.editing = null;
    state.restoringActivityId = null;
    state.confirmedOverrideDiscard = false;
  });
  elements.eventForm.addEventListener("submit", handleFormSubmit);
  elements.repeatModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateRepeatModeUI();
      updateActivityFormUi();
    });
  });
  elements.activityKindInputs.forEach((input) => {
    input.addEventListener("change", () => {
      setActivityKind(input.value);
    });
  });
  elements.editScopeInputs.forEach((input) => {
    input.addEventListener("change", updateEditScopeUi);
  });
  elements.reminderModeInputs.forEach((input) => {
    input.addEventListener("change", handleReminderToggle);
  });
  elements.todoReminderModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateTodoReminderUi();
      if (!nativeApp || currentTodoReminderMode() === "none") {
        return;
      }
      void (async () => {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          showToast("通知权限未开启，代办提醒可能无法送达");
        }
        if (currentTodoReminderMode() === "alarm") {
          const currentExact = await getExactAlarmPermissionState();
          if (!currentExact.granted) {
            await requestExactAlarmPermission();
          }
        }
      })();
    });
  });
  elements.checkinReminderModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateCheckinReminderUi();
      if (!nativeApp || currentCheckinReminderMode() === "none") {
        return;
      }
      void (async () => {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          showToast("通知权限未开启，打卡提醒可能无法送达");
        }
        if (currentCheckinReminderMode() === "alarm") {
          const currentExact = await getExactAlarmPermissionState();
          if (!currentExact.granted) {
            await requestExactAlarmPermission();
          }
        }
      })();
    });
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
  elements.archiveEventButton.addEventListener(
    "click",
    openArchiveConfirmation,
  );
  elements.cancelArchiveButton.addEventListener("click", () => {
    state.pendingArchive = null;
    elements.archiveDialog.close();
  });
  elements.confirmArchiveButton.addEventListener(
    "click",
    confirmArchive,
  );
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
  elements.activityCategoryFilter.addEventListener("change", () => {
    state.activityCategoryFilter = elements.activityCategoryFilter.value;
    render();
  });
  elements.archiveToggleButton.addEventListener("click", () => {
    state.archiveMode = !state.archiveMode;
    if (!state.archiveMode) {
      state.view = "activity";
    }
    render();
  });
  elements.archiveYearSelect.addEventListener("change", () => {
    state.archiveYear = Number(elements.archiveYearSelect.value);
    render();
  });
  elements.manageCategoriesButton.addEventListener("click", () => {
    elements.categoryKindSelect.value = "schedule";
    renderCategoryManager();
    elements.categoryDialog.showModal();
  });
  elements.closeCategoryDialog.addEventListener("click", () => {
    elements.categoryDialog.close();
  });
  elements.categoryKindSelect.addEventListener(
    "change",
    renderCategoryManager,
  );
  elements.addCategoryButton.addEventListener("click", () => {
    const kind = elements.categoryKindSelect.value;
    const next = addCategory(
      state.categories,
      kind,
      elements.newCategoryName.value,
    );
    if (next[kind].length === state.categories[kind].length) {
      showToast("请输入不重复的分类名称");
      return;
    }
    state.categories = next;
    elements.newCategoryName.value = "";
    persistEvents();
    renderCategoryManager();
    render();
  });
  elements.closeCheckinCalendar.addEventListener("click", () => {
    elements.checkinCalendarDialog.close();
    state.checkinCalendarId = null;
  });
  elements.previousCheckinMonth.addEventListener("click", () => {
    state.checkinMonthCursor = addMonthsToMonth(
      state.checkinMonthCursor,
      -1,
    );
    renderCheckinCalendar();
  });
  elements.nextCheckinMonth.addEventListener("click", () => {
    state.checkinMonthCursor = addMonthsToMonth(
      state.checkinMonthCursor,
      1,
    );
    renderCheckinCalendar();
  });
  elements.currentCheckinMonth.addEventListener("click", () => {
    state.checkinMonthCursor = startOfMonth(todayISO());
    renderCheckinCalendar();
  });
  elements.openMigrationButton.addEventListener("click", openMigrationDialog);
  elements.closeMigrationDialog.addEventListener("click", () => {
    if (migrationIsMandatory()) {
      return;
    }
    elements.migrationDialog.close();
  });
  elements.migrationDialog.addEventListener("cancel", (event) => {
    if (migrationIsMandatory()) {
      event.preventDefault();
    }
  });
  elements.skipMigrationButton.addEventListener("click", skipMigration);
  elements.confirmMigrationButton.addEventListener(
    "click",
    confirmMigration,
  );

  elements.timelineScroll.addEventListener(
    "scroll",
    () => {
      state.dayScrollTarget = null;
    },
    { passive: true },
  );

  window.addEventListener("storage", (event) => {
    if (!nativeApp && event.key === WEB_STORAGE_KEY) {
      const loaded = readWebState();
      state.events = loaded.events;
      state.categories = loaded.categories;
      state.yearMigrationCompletedFor =
        loaded.yearMigrationCompletedFor;
      render();
    } else if (nativeApp && event.key === NATIVE_STORAGE_KEY) {
      const loaded = readNativeState();
      if (loaded.status === "ok") {
        state.account = loaded.state.account;
        state.authenticated = loaded.state.sessionActive;
        state.events = loaded.state.events;
        state.categories = loaded.state.categories;
        state.yearMigrationCompletedFor =
          loaded.state.yearMigrationCompletedFor;
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
state.events = finalizePreviousYears(
  state.events,
  Number(todayISO().slice(0, 4)),
);
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
  void handleAlarmLaunch();
}

if (nativeApp) {
  void registerWidgetLaunchListener((target) => {
    if (state.authenticated) {
      openOccurrenceFromExternal(target);
    }
  }).catch((error) => {
    console.error("注册桌面组件点击监听失败", error);
  });
  void registerAlarmLaunchListener((target) => {
    if (state.authenticated) {
      openOccurrenceFromExternal(target);
    }
  }).catch((error) => {
    console.error("注册闹钟点击监听失败", error);
  });
  globalThis.DailyRouteNative?.App?.addListener?.(
    "appStateChange",
    ({ isActive }) => {
      if (isActive && state.authenticated) {
        void refreshNativeNotifications();
        void handleWidgetLaunch();
        void handleAlarmLaunch();
      }
    },
  );
}

requestAnimationFrame(() => {
  if (
    (!nativeApp || state.authenticated) &&
    migrationIsMandatory()
  ) {
    openMigrationDialog();
  }
});

