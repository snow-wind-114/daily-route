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
      message.params.exceptionDetails?.text ?? "未知页面异常",
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
await evaluate(
  `localStorage.removeItem("daily-route.storage.v1"); location.reload(); true`,
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

  document.querySelector("#addTopButton").click();
  if (!document.querySelector("#eventDialog").open) throw new Error("添加弹窗未打开");
  input("#eventName", "自动化课程");
  input("#eventDate", tomorrow);
  input("#startTime", "10:00");
  input("#endTime", "11:00");
  submit();
  await wait();

  document.querySelector("#addTopButton").click();
  chooseKind("todo");
  input("#eventName", "自动化报告");
  input("#todoDeadlineDate", tomorrow);
  input("#todoDeadlineTime", "18:00");
  submit();
  await wait();

  document.querySelector("#addTopButton").click();
  chooseKind("checkin");
  input("#eventName", "自动化阅读");
  submit();
  await wait();

  const checkinButton = document.querySelector(".checkin-shortcut");
  if (!checkinButton) throw new Error("今天页缺少打卡快捷入口");
  checkinButton.click();
  await wait();

  document.querySelector("#activityNavButton").click();
  await wait();
  const sections = [
    "#activeActivitySection",
    "#todoActivitySection",
    "#checkinActivitySection",
  ].map((selector) => !document.querySelector(selector).hidden);

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

  const stored = JSON.parse(localStorage.getItem("daily-route.storage.v1"));
  return {
    kinds: stored.events.map((event) => event.kind).sort(),
    checkInDates: stored.events.find((event) => event.kind === "checkin").checkInDates,
    categories: stored.categories,
    sections,
    todoBadge,
    checkinDayCount,
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
  !result.archiveIncludesTodo ||
  result.categories.schedule.length !== 1 ||
  result.documentWidth > result.viewportWidth ||
  exceptions.length > 0
) {
  process.exitCode = 1;
}
socket.close();
