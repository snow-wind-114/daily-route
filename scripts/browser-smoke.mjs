const pages = await fetch("http://localhost:9222/json").then((response) =>
  response.json(),
);
const page = pages.find(
  (item) => item.type === "page" && item.url.startsWith("http://localhost:4173"),
);
if (!page) {
  throw new Error("找不到本地 Daily Route 测试页");
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const exceptions = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
    } else {
      resolve(message.result);
    }
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "未知页面异常",
    );
  }
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result.value;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(`(async () => {
  localStorage.removeItem("daily-route.storage.v1");
  localStorage.removeItem("daily-route.activity-drafts.v1");
  localStorage.removeItem("daily-route.focus-session.v1");
  const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const keys = await caches?.keys?.() ?? [];
  await Promise.all(keys.map((key) => caches.delete(key)));
  return true;
})()`);
await evaluate(
  `location.replace(location.pathname + "?smoke=" + Date.now()); true`,
);
await new Promise((resolve) => setTimeout(resolve, 900));

const result = await evaluate(`(async () => {
  const wait = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const input = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error("缺少元素 " + selector);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const chooseKind = (kind) => {
    const radio = document.querySelector('input[name="activityKind"][value="' + kind + '"]');
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const submit = () => {
    document.querySelector("#eventForm").requestSubmit();
  };
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = [
    tomorrowDate.getFullYear(),
    String(tomorrowDate.getMonth() + 1).padStart(2, "0"),
    String(tomorrowDate.getDate()).padStart(2, "0"),
  ].join("-");
  const today = [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    String(new Date().getDate()).padStart(2, "0"),
  ].join("-");

  document.querySelector("#addFab").click();
  if (!document.querySelector("#eventDialog").open) throw new Error("添加弹窗未打开");
  input("#eventName", "自动化课程");
  input("#eventDate", tomorrow);
  input("#startTime", "10:00");
  input("#endTime", "11:00");
  submit();
  await wait();

  document.querySelector("#addFab").click();
  chooseKind("todo");
  input("#eventName", "自动化报告");
  input("#todoDeadlineDate", today);
  input("#todoDeadlineTime", "18:00");
  submit();
  await wait();

  document.querySelector("#addFab").click();
  chooseKind("checkin");
  input("#eventName", "自动化阅读");
  submit();
  await wait();

  const checkinButton = document.querySelector(".checkin-shortcut");
  if (!checkinButton) throw new Error("今天页缺少打卡快捷入口");
  checkinButton.click();
  await wait();

  document.querySelector("#reviewNavButton").click();
  await wait();
  const todayReviewEditable =
    !document.querySelector("#reviewSummary").disabled;
  const reviewAddActionsHidden =
    !document.querySelector("#addTopButton") &&
    document.querySelector("#addFab").hidden;
  input("#reviewSummary", "今天完成了自动化回顾");
  document.querySelector("#dayNavButton").click();
  await wait();
  const unsavedReviewDialogOpen =
    document.querySelector("#unsavedReviewDialog").open;
  document.querySelector("#cancelLeaveReviewButton").click();
  await wait();
  document.querySelector("#reviewForm").requestSubmit();
  await wait();
  const storedReview = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).reviewEntries.find((entry) => entry.date === today);
  const reviewIncludesCheckin =
    document.querySelector("#reviewCheckinList").textContent.includes("自动化阅读");
  const reviewIncludesTodo =
    document.querySelector("#reviewTodoList").textContent.includes("自动化报告");
  document.querySelector("#openReviewExportButton").click();
  const reviewExportDialogOpen =
    document.querySelector("#reviewExportDialog").open;
  const reviewExportCount =
    document.querySelector("#reviewExportCount").textContent;
  document.querySelector("#cancelReviewExportButton").click();
  document.querySelector("#previousReviewDayButton").click();
  await wait();
  const pastReviewReadonly =
    document.querySelector("#reviewSummary").disabled &&
    document.querySelector("#saveReviewButton").hidden;
  document.querySelector("#goTodayReviewButton").click();
  await wait();
  const todoCopyUsesCorrectCharacters =
    document.body.textContent.includes("待办") &&
    !document.body.textContent.includes("代办");
  document.querySelector("#dayNavButton").click();
  await wait();
  document.querySelector("#previousDayButton").click();
  await wait();
  document.querySelector("#dayReviewEntry").click();
  await wait();
  const dayReviewTargetedPrevious =
    !document.querySelector("#nextReviewDayButton").disabled &&
    document.querySelector("#viewKicker").textContent === "回顾记录";
  document.querySelector("#goTodayReviewButton").click();
  await wait();

  document.querySelector("#weekNavButton").click();
  await wait();
  const weekTodoRows = document.querySelectorAll(".week-overview-row").length;
  const weekCheckinRows = document.querySelectorAll(".week-checkin-row").length;
  const weekDayTodoRows = document.querySelectorAll(".week-event.is-todo").length;
  const weekDayCheckinRows = document.querySelectorAll(".week-event.is-checkin").length;
  document.querySelector(".week-checkin-row").click();
  const weekCalendarEditableDays = document.querySelectorAll(
    ".checkin-day:not(:disabled)",
  ).length;
  document.querySelector("#closeCheckinCalendar").click();

  document.querySelector("#activityNavButton").click();
  await wait();
  const sections = [
    "#activeActivitySection",
    "#todoActivitySection",
    "#checkinActivitySection",
  ].map((selector) => !document.querySelector(selector).hidden);

  document.querySelector("#activeActivityList .activity-main").click();
  await wait();
  const lifecycleLabels = {
    archive: document.querySelector("#archiveEventButton").textContent.trim(),
    delete: document.querySelector("#deleteEventButton").textContent.trim(),
  };
  const modalCalls = [];
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function patchedShowModal() {
    modalCalls.push(this.id);
    return originalShowModal.call(this);
  };
  let deleteButtonClickSeen = false;
  document.querySelector("#deleteEventButton").addEventListener(
    "click",
    () => { deleteButtonClickSeen = true; },
    { capture: true, once: true },
  );
  document.querySelector("#deleteEventButton").click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const scheduleDeleteDialogOpen = document.querySelector("#deleteDialog").open;
  document.querySelector("#cancelDeleteButton").click();
  await wait();

  document.querySelector("#monthNavButton").click();
  await wait();
  const todoBadge = document.querySelector(".todo-day-badge")?.textContent;

  document.querySelector("#activityNavButton").click();
  await wait();
  document.querySelector("#checkinActivityList .activity-resume").click();
  if (!document.querySelector("#checkinCalendarDialog").open) {
    throw new Error("打卡月历未打开");
  }
  const checkinDayCount = document.querySelectorAll(".checkin-day").length;
  const activityCalendarEditableDays = document.querySelectorAll(
    ".checkin-day:not(:disabled)",
  ).length;
  document.querySelector("#closeCheckinCalendar").click();

  document.querySelector("#todoActivityList .activity-resume").click();
  await wait();
  document.querySelector("#archiveToggleButton").click();
  await wait();
  const archiveText = document.querySelector("#inactiveActivityList").textContent;
  document.querySelector("#archiveToggleButton").click();
  await wait();

  document.querySelector("#manageCategoriesButton").click();
  document.querySelector("#newCategoryName").value = "学习";
  document.querySelector("#addCategoryButton").click();
  await wait();
  document.querySelector("#closeCategoryDialog").click();

  document.querySelector("#activityNavButton").click();
  await wait();
  document.querySelector("#activeActivityList .activity-main").click();
  document.querySelector("#archiveEventButton").click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const archiveDialogOpen = document.querySelector("#archiveDialog").open;
  document.querySelector("#confirmArchiveButton").click();
  await wait();
  const archivedBeforeRestore = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).events.find((event) => event.kind === "schedule").archivedAt;
  document.querySelector("#inactiveActivityList .activity-resume").click();
  await wait();
  const restoreOpenedEdit = document.querySelector("#eventDialog").open;
  const archivedDuringRestore = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).events.find((event) => event.kind === "schedule").archivedAt;
  input("#eventDate", tomorrow);
  submit();
  await wait();
  const eventDialogOpenAfterRestoreSave = document.querySelector("#eventDialog").open;
  const restoreSaveError = document.querySelector("#formError").textContent;
  const restoredSchedule = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).events.find((event) => event.kind === "schedule");
  const archivedAfterRestoreSave = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).events.find((event) => event.kind === "schedule").archivedAt;

  const stored = JSON.parse(localStorage.getItem("daily-route.storage.v1"));
  return {
    kinds: stored.events.map((event) => event.kind).sort(),
    checkInDates: stored.events.find((event) => event.kind === "checkin").checkInDates,
    categories: stored.categories,
    sections,
    todoBadge,
    checkinDayCount,
    weekTodoRows,
    weekCheckinRows,
    weekDayTodoRows,
    weekDayCheckinRows,
    todayReviewEditable,
    reviewAddActionsHidden,
    unsavedReviewDialogOpen,
    storedReviewSummary: storedReview?.summary,
    storedReviewSnapshot: storedReview?.activitySnapshot,
    reviewIncludesCheckin,
    reviewIncludesTodo,
    reviewExportDialogOpen,
    reviewExportCount,
    pastReviewReadonly,
    todoCopyUsesCorrectCharacters,
    dayReviewTargetedPrevious,
    weekCalendarEditableDays,
    activityCalendarEditableDays,
    lifecycleLabels,
    scheduleDeleteDialogOpen,
    eventDialogOpenAfterDelete: document.querySelector("#eventDialog").open,
    deleteMessageAfterClick: document.querySelector("#deleteDialogMessage").textContent,
    modalCalls,
    deleteButtonClickSeen,
    archiveDialogOpen,
    archivedBeforeRestore: Boolean(archivedBeforeRestore),
    restoreOpenedEdit,
    archivedDuringRestore: Boolean(archivedDuringRestore),
    archivedAfterRestoreSave,
    eventDialogOpenAfterRestoreSave,
    restoreSaveError,
    restoredScheduleDate: restoredSchedule.date,
    restoredScheduleCount: restoredSchedule.repeatCount,
    restoredScheduleStates: stored.events
      .filter((event) => event.kind === "schedule")
      .map((event) => ({
        id: event.id,
        date: event.date,
        archivedAt: event.archivedAt,
      })),
    checkinReminderHiddenOnWeb: document.querySelector("#checkinReminderField").hidden,
    archiveIncludesTodo: archiveText.includes("自动化报告"),
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    exceptions: []
  };
})()`);

result.exceptions = exceptions;
console.log(JSON.stringify(result, null, 2));
if (
  result.kinds.join(",") !== "checkin,schedule,todo" ||
  result.checkInDates.length !== 1 ||
  result.sections.some((visible) => !visible) ||
  result.todoBadge !== "1" ||
  result.checkinDayCount !== 42 ||
  result.weekTodoRows < 1 ||
  result.weekCheckinRows !== 1 ||
  result.weekDayTodoRows !== 0 ||
  result.weekDayCheckinRows !== 0 ||
  !result.todayReviewEditable ||
  !result.reviewAddActionsHidden ||
  !result.unsavedReviewDialogOpen ||
  result.storedReviewSummary !== "今天完成了自动化回顾" ||
  result.storedReviewSnapshot?.checkins?.[0]?.checked !== true ||
  !result.reviewIncludesCheckin ||
  !result.reviewIncludesTodo ||
  !result.reviewExportDialogOpen ||
  !result.reviewExportCount.includes("天回顾可导出") ||
  !result.pastReviewReadonly ||
  !result.todoCopyUsesCorrectCharacters ||
  !result.dayReviewTargetedPrevious ||
  result.weekCalendarEditableDays !== 0 ||
  result.activityCalendarEditableDays !== 0 ||
  result.lifecycleLabels.archive !== "归档活动" ||
  result.lifecycleLabels.delete !== "删除整个活动" ||
  !result.scheduleDeleteDialogOpen ||
  !result.checkinReminderHiddenOnWeb ||
  !result.archiveDialogOpen ||
  !result.archivedBeforeRestore ||
  !result.restoreOpenedEdit ||
  !result.archivedDuringRestore ||
  result.archivedAfterRestoreSave !== null ||
  !result.archiveIncludesTodo ||
  result.categories.length !== 1 ||
  result.categories[0]?.name !== "学习" ||
  result.documentWidth > result.viewportWidth ||
  exceptions.length > 0
) {
  process.exitCode = 1;
}
socket.close();
