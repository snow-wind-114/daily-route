const pages = await fetch("http://localhost:9222/json").then((response) =>
  response.json(),
);
const page = pages.find(
  (item) =>
    item.type === "page" && item.url.startsWith("http://localhost:4173"),
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
  localStorage.clear();
  const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const keys = await caches?.keys?.() ?? [];
  await Promise.all(keys.map((key) => caches.delete(key)));
  return true;
})()`);
await evaluate(
  `location.replace(location.pathname + "?v060=" + Date.now()); true`,
);
await new Promise((resolve) => setTimeout(resolve, 900));

const draftState = await evaluate(`(async () => {
  const wait = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const input = (selector, value) => {
    const element = document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const chooseKind = (kind) => {
    const radio = document.querySelector(
      'input[name="activityKind"][value="' + kind + '"]',
    );
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };

  document.querySelector("#addFab").click();
  input("#eventName", "定期草稿");
  document.querySelector("#cancelEventButton").click();
  await wait();
  document.querySelector("#addFab").click();
  chooseKind("todo");
  input("#eventName", "待办草稿");
  document.querySelector("#cancelEventButton").click();
  await wait();
  document.querySelector("#addFab").click();
  chooseKind("checkin");
  input("#eventName", "打卡草稿");
  document.querySelector("#cancelEventButton").click();
  await wait();
  return JSON.parse(localStorage.getItem("daily-route.activity-drafts.v1"));
})()`);

await evaluate(`location.reload(); true`);
await new Promise((resolve) => setTimeout(resolve, 900));

const result = await evaluate(`(async () => {
  const wait = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const input = (selector, value) => {
    const element = document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const chooseKind = (kind) => {
    const radio = document.querySelector(
      'input[name="activityKind"][value="' + kind + '"]',
    );
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const submit = () => document.querySelector("#eventForm").requestSubmit();
  const today = new Date();
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowISO = [
    tomorrowDate.getFullYear(),
    String(tomorrowDate.getMonth() + 1).padStart(2, "0"),
    String(tomorrowDate.getDate()).padStart(2, "0"),
  ].join("-");

  document.querySelector("#addFab").click();
  const restoredCheckinDraft =
    document.querySelector("#eventName").value === "打卡草稿" &&
    document.querySelector("#eventDraftStatus").hidden === false;
  input("#eventName", "阅读");
  submit();
  await wait();

  document.querySelector("#addFab").click();
  chooseKind("schedule");
  const restoredScheduleDraft =
    document.querySelector("#eventName").value === "定期草稿";
  input("#eventName", "学习课程");
  input("#eventDate", tomorrowISO);
  input("#startTime", "09:00");
  input("#endTime", "10:00");
  submit();
  await wait();

  document.querySelector("#addFab").click();
  chooseKind("todo");
  const restoredTodoDraft =
    document.querySelector("#eventName").value === "待办草稿";
  input("#eventName", "提交报告");
  input("#todoDeadlineDate", todayISO);
  submit();
  await wait();

  document.querySelector("#helpButton").click();
  const tutorialOpen = document.querySelector("#tutorialDialog").open;
  const tutorialSheetRect = document
    .querySelector(".tutorial-sheet")
    .getBoundingClientRect();
  const tutorialBoundsVisible =
    tutorialSheetRect.top >= 0 &&
    tutorialSheetRect.bottom <= innerHeight;
  const tutorialTopicsFit =
    document.querySelector("#tutorialTopicList").scrollWidth <=
    document.querySelector("#tutorialTopicList").clientWidth;
  const tutorialTopics = document.querySelectorAll(
    "#tutorialTopicList button",
  ).length;
  document.querySelector('#tutorialTopicList button[data-topic-id="focus"]').click();
  const tutorialMentionsPause =
    document.querySelector("#tutorialArticle").textContent.includes("自动暂停");
  document.querySelector("#closeTutorialDialog").click();

  document.querySelector("#activityNavButton").click();
  await wait();
  const toolbarButtons = [
    document.querySelector("#manageCategoriesButton"),
    document.querySelector("#activitySelectModeButton"),
    document.querySelector("#archiveToggleButton"),
  ].map((button) => button.getBoundingClientRect());
  const toolbarButtonsAligned =
    toolbarButtons.every(
      (rect) =>
        Math.abs(rect.top - toolbarButtons[0].top) < 1 &&
        Math.abs(rect.height - toolbarButtons[0].height) < 1,
    ) &&
    Math.max(...toolbarButtons.map((rect) => rect.width)) -
      Math.min(...toolbarButtons.map((rect) => rect.width)) <
      1;
  document.querySelector("#manageCategoriesButton").click();
  document.querySelector("#newCategoryName").value = "学习";
  document.querySelector("#addCategoryButton").click();
  const categoryId = JSON.parse(
    localStorage.getItem("daily-route.storage.v1"),
  ).categories[0].id;
  document.querySelector("#closeCategoryDialog").click();
  document.querySelector("#activitySelectModeButton").click();
  document.querySelector("#selectAllActivitiesButton").click();
  await wait();
  const selectedCount = document.querySelector("#bulkSelectionCount").textContent;
  const bulkButtons = [
    document.querySelector("#selectAllActivitiesButton"),
    document.querySelector("#clearActivitySelectionButton"),
    document.querySelector("#openBulkActionsButton"),
  ].map((button) => button.getBoundingClientRect());
  const bulkButtonsAligned =
    bulkButtons.every(
      (rect) =>
        Math.abs(rect.top - bulkButtons[0].top) < 1 &&
        Math.abs(rect.height - bulkButtons[0].height) < 1,
    ) &&
    Math.max(...bulkButtons.map((rect) => rect.width)) -
      Math.min(...bulkButtons.map((rect) => rect.width)) <
      1;
  document.querySelector("#openBulkActionsButton").click();
  const pauseDisabledForMixed = document.querySelector("#bulkPauseButton").disabled;
  document.querySelector("#bulkCategorizeButton").click();
  document.querySelector("#bulkCategorySelect").value = categoryId;
  document.querySelector("#confirmBulkCategoryButton").click();
  await wait();
  const storedAfterBulk = JSON.parse(localStorage.getItem("daily-route.storage.v1"));
  const allCategorized = storedAfterBulk.events.every(
    (event) => event.categoryId === categoryId,
  );

  document.querySelector("#focusNavButton").click();
  await wait();
  document.querySelector("#addFocusProjectButton").click();
  input("#focusProjectName", "学习");
  input("#focusProjectMinutes", "1");
  document.querySelector("#focusProjectForm").requestSubmit();
  await wait();
  document.querySelector("#addFocusProjectButton").click();
  const restRadio = document.querySelector(
    'input[name="focusProjectType"][value="rest"]',
  );
  restRadio.checked = true;
  restRadio.dispatchEvent(new Event("change", { bubbles: true }));
  input("#focusProjectName", "休息");
  input("#focusProjectMinutes", "1");
  document.querySelector("#focusProjectForm").requestSubmit();
  await wait();

  document.querySelector("#addFocusFlowButton").click();
  input("#focusFlowName", "学习循环");
  const stepSelect = document.querySelector("#focusFlowStepSelect");
  stepSelect.value = [...stepSelect.options].find(
    (option) => option.textContent.includes("学习"),
  ).value;
  stepSelect.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#addFocusFlowStepButton").click();
  stepSelect.value = [...stepSelect.options].find(
    (option) => option.textContent.includes("休息"),
  ).value;
  stepSelect.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#addFocusFlowStepButton").click();
  const flowSteps = document.querySelectorAll(".focus-flow-step").length;
  document.querySelector("#focusFlowForm").requestSubmit();
  await wait();

  input("#focusQuoteInput", "先完成，再完美");
  document.querySelector("#addFocusQuoteButton").click();
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 40;
  const context = canvas.getContext("2d");
  context.fillStyle = "#224466";
  context.fillRect(0, 0, 40, 40);
  const imageBlob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  const file = new File([imageBlob], "测试壁纸.png", { type: "image/png" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const wallpaperInput = document.querySelector("#focusWallpaperInput");
  wallpaperInput.files = transfer.files;
  wallpaperInput.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const wallpaperPreviewVisible =
    !document.querySelector("#focusWallpaperPreview").hidden &&
    document.querySelector("#focusWallpaperPreviewImage").naturalWidth > 0;
  const focusView = document.querySelector("#focusView");
  const focusOverflowY = getComputedStyle(focusView).overflowY;
  focusView.scrollTop = focusView.scrollHeight;
  const focusCanScroll =
    focusView.scrollHeight > focusView.clientHeight &&
    focusView.scrollTop > 0;
  const focusNoHorizontalOverflow =
    focusView.scrollWidth <= focusView.clientWidth;

  document.documentElement.requestFullscreen = async () => {};
  document.exitFullscreen = async () => {};
  document.querySelector("#focusFlowList .primary-button").click();
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const runnerVisible = !document.querySelector("#focusRunner").hidden;
  document.querySelector("#exitFocusButton").click();
  const exitDialogOpen = document.querySelector("#focusExitDialog").open;
  document.querySelector("#confirmFocusExitButton").click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const runnerClosed = document.querySelector("#focusRunner").hidden;
  const stored = JSON.parse(localStorage.getItem("daily-route.storage.v1"));

  return {
    restoredCheckinDraft,
    restoredScheduleDraft,
    restoredTodoDraft,
    tutorialOpen,
    tutorialTopics,
    tutorialMentionsPause,
    tutorialBoundsVisible,
    tutorialTopicsFit,
    toolbarButtonsAligned,
    bulkButtonsAligned,
    selectedCount,
    pauseDisabledForMixed,
    allCategorized,
    focusProjects: stored.focusProjects.length,
    focusFlows: stored.focusFlows.length,
    focusQuotes: stored.focusQuotes.length,
    focusWallpapers: stored.focusWallpapers.length,
    wallpaperPreviewVisible,
    focusOverflowY,
    focusCanScroll,
    focusNoHorizontalOverflow,
    flowSteps,
    runnerVisible,
    exitDialogOpen,
    runnerClosed,
    accumulation: stored.focusProjects.map((item) => item.accumulatedSeconds),
    navCount: document.querySelectorAll(".bottom-nav .nav-button").length,
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  };
})()`);

await send("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 700,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 100));
const narrow = await evaluate(`({
  viewportWidth: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  visibleNavLabels: [...document.querySelectorAll(".bottom-nav .nav-button span")]
    .filter((item) => getComputedStyle(item).display !== "none").length
})`);

result.draftState = draftState;
result.narrow = narrow;
result.exceptions = exceptions;
console.log(JSON.stringify(result, null, 2));

if (
  draftState?.schedule?.title !== "定期草稿" ||
  draftState?.todo?.title !== "待办草稿" ||
  draftState?.checkin?.title !== "打卡草稿" ||
  !result.restoredCheckinDraft ||
  !result.restoredScheduleDraft ||
  !result.restoredTodoDraft ||
  !result.tutorialOpen ||
  result.tutorialTopics !== 7 ||
  !result.tutorialMentionsPause ||
  !result.tutorialBoundsVisible ||
  !result.tutorialTopicsFit ||
  !result.toolbarButtonsAligned ||
  !result.bulkButtonsAligned ||
  result.selectedCount !== "已选 3 项" ||
  !result.pauseDisabledForMixed ||
  !result.allCategorized ||
  result.focusProjects !== 2 ||
  result.focusFlows !== 1 ||
  result.focusQuotes !== 1 ||
  result.focusWallpapers !== 1 ||
  !result.wallpaperPreviewVisible ||
  result.focusOverflowY !== "auto" ||
  !result.focusCanScroll ||
  !result.focusNoHorizontalOverflow ||
  result.flowSteps !== 2 ||
  !result.runnerVisible ||
  !result.exitDialogOpen ||
  !result.runnerClosed ||
  result.accumulation.every((seconds) => seconds <= 0) ||
  result.navCount !== 6 ||
  result.documentWidth > result.viewportWidth ||
  result.narrow.documentWidth > result.narrow.viewportWidth ||
  result.narrow.visibleNavLabels !== 0 ||
  result.exceptions.length > 0
) {
  process.exitCode = 1;
}

socket.close();
