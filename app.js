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
  deleteOccurrenceAndFuture,
  findScheduleConflict,
  getOccurrenceIndex,
  lastOccurrenceOnOrBefore,
  makeStoragePayload,
  occupancyByDayBetween,
  occurrencesBetween,
  occurrencesOnDate,
  readStoragePayload,
  remainingRepeatCount,
  seriesFromInput,
  splitSeriesForEdit,
  validateActivityInput,
} from "./schedule.js";

const STORAGE_KEY = "daily-route.storage.v1";
const SLOT_HEIGHT = 44;
const PIXELS_PER_MINUTE = SLOT_HEIGHT / 30;

const elements = {
  viewKicker: document.querySelector("#viewKicker"),
  viewTitle: document.querySelector("#viewTitle"),
  viewSummary: document.querySelector("#viewSummary"),
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
  inactiveActivitySection: document.querySelector("#inactiveActivitySection"),
  activeActivityCount: document.querySelector("#activeActivityCount"),
  inactiveActivityCount: document.querySelector("#inactiveActivityCount"),
  activeActivityList: document.querySelector("#activeActivityList"),
  inactiveActivityList: document.querySelector("#inactiveActivityList"),
  activityEmpty: document.querySelector("#activityEmpty"),
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
  eventNotes: document.querySelector("#eventNotes"),
  editScopeNote: document.querySelector("#editScopeNote"),
  formError: document.querySelector("#formError"),
  deleteEventButton: document.querySelector("#deleteEventButton"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogMessage: document.querySelector("#deleteDialogMessage"),
  cancelDeleteButton: document.querySelector("#cancelDeleteButton"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  toast: document.querySelector("#toast"),
};

const state = {
  events: loadEvents(),
  view: "day",
  selectedDate: todayISO(),
  weekCursor: startOfWeek(todayISO()),
  monthCursor: startOfMonth(todayISO()),
  editing: null,
  pendingDelete: null,
  activityQuery: "",
  autoScrollDay: true,
  dayScrollTarget: null,
};

let toastTimer = null;

function startOfWeek(isoDate) {
  return addDays(isoDate, -mondayBasedWeekday(isoDate));
}

function endOfWeek(isoDate) {
  return addDays(startOfWeek(isoDate), 6);
}

function loadEvents() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const payload = JSON.parse(stored);
    return Array.isArray(payload) ? readStoragePayload({ events: payload }) : readStoragePayload(payload);
  } catch (error) {
    console.error("读取本地活动失败", error);
    return [];
  }
}

function persistEvents() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(makeStoragePayload(state.events)),
    );
    return true;
  } catch (error) {
    console.error("保存本地活动失败", error);
    showToast("保存失败，请检查浏览器可用空间");
    return false;
  }
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
      openEditDialog(item.occurrence.series, state.selectedDate);
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
          openEditDialog(occurrence.series, date);
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

function renderActivities(window) {
  const today = window.startDate;
  const groups = state.events.map((series) => {
    const future = occurrencesBetween([series], today, window.endDate);
    if (future.length > 0) {
      return {
        series,
        active: true,
        next: future[0],
      };
    }

    return {
      series,
      active: false,
      lastDate: lastOccurrenceOnOrBefore(
        series,
        addDays(today, -1),
      ),
    };
  });
  const active = groups
    .filter((group) => group.active)
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
    .filter((group) => !group.active)
    .sort((left, right) => {
      const leftDate = left.lastDate ?? left.series.date;
      const rightDate = right.lastDate ?? right.series.date;
      return rightDate.localeCompare(leftDate);
    });
  const query = state.activityQuery.trim().toLocaleLowerCase("zh-CN");
  const filteredActive = active.filter((group) =>
    group.series.title.toLocaleLowerCase("zh-CN").includes(query),
  );
  const filteredInactive = inactive.filter((group) =>
    group.series.title.toLocaleLowerCase("zh-CN").includes(query),
  );

  elements.viewKicker.textContent = "活动";
  elements.viewTitle.textContent = "活动项目";
  elements.viewSummary.textContent = query
    ? `找到 ${filteredActive.length + filteredInactive.length} 个活动`
    : `${active.length} 个进行中 · ${inactive.length} 个已结束`;

  elements.activeActivityCount.textContent = String(filteredActive.length);
  elements.inactiveActivityCount.textContent = String(filteredInactive.length);
  elements.activeActivityList.replaceChildren(
    ...filteredActive.map((group) => createActiveActivityRow(group)),
  );
  elements.inactiveActivityList.replaceChildren(
    ...filteredInactive.map((group) => createInactiveActivityRow(group)),
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

  const noFilteredResults =
    filteredActive.length === 0 && filteredInactive.length === 0;
  elements.activeActivitySection.hidden = noFilteredResults;
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
  rule.textContent = formatRecurrenceRule(group.series);
  next.className = "activity-next";
  next.textContent =
    `${formatShortDate(group.next.date)} ${group.series.startTime}`;
  chevron.className = "activity-chevron";
  chevron.textContent = "›";
  copy.append(name, rule);
  main.append(copy, next, chevron);
  main.addEventListener("click", () => {
    openEditDialog(group.series, group.next.date);
  });
  row.append(main);
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
  rule.textContent = formatRecurrenceRule(group.series);
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
  elements.eventNotes.value = "";
  setRepeatMode("limited");
  elements.editScopeNote.hidden = true;
  elements.deleteEventButton.hidden = true;
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
}

function openEditDialog(series, occurrenceDate) {
  const window = getScheduleWindow();
  const remaining = remainingRepeatCount(series, occurrenceDate);
  if (getOccurrenceIndex(series, occurrenceDate) === null) {
    showToast("这条活动已无法编辑");
    return;
  }

  state.editing = {
    seriesId: series.id,
    occurrenceDate,
  };

  elements.eventForm.reset();
  elements.eventDialogKicker.textContent = "本次活动及以后";
  elements.eventDialogTitle.textContent = "编辑活动";
  elements.eventName.value = series.title;
  elements.eventDate.min = occurrenceDate;
  elements.eventDate.max = window.endDate;
  elements.eventDate.value = occurrenceDate;
  elements.startTime.value = series.startTime;
  elements.endTime.value = series.endTime;
  elements.repeatEvery.value = String(series.repeatEvery);

  if (remaining === null) {
    elements.repeatCount.value = "1";
    setRepeatMode("infinite");
  } else {
    elements.repeatCount.value = String(Math.max(1, remaining));
    setRepeatMode("limited");
  }

  elements.eventNotes.value = series.notes ?? "";
  elements.editScopeNote.hidden = false;
  elements.deleteEventButton.hidden = false;
  elements.formError.hidden = true;
  elements.eventDialog.showModal();
  requestAnimationFrame(() => elements.eventName.focus());
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
    notes: elements.eventNotes.value.trim(),
  };
}

function handleFormSubmit(event) {
  event.preventDefault();
  const window = getScheduleWindow();
  const input = readFormInput();
  const minimumDate = state.editing?.occurrenceDate ?? window.startDate;
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
  const candidate = seriesFromInput(input, {
    id: editingSeries?.id,
    createdAt: editingSeries?.createdAt,
  });

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
    state.editing?.seriesId ?? null,
  );
  if (conflict) {
    elements.formError.textContent =
      `${formatShortDate(conflict.date)} ${conflict.candidateSeries.startTime}–${conflict.candidateSeries.endTime} 与「${conflict.existingSeries.title}」时间重叠，请调整时间或日期`;
    elements.formError.hidden = false;
    return;
  }

  if (state.editing) {
    try {
      state.events = splitSeriesForEdit(
        state.events,
        state.editing.seriesId,
        state.editing.occurrenceDate,
        input,
      );
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
  persistEvents();
  elements.eventDialog.close();
  render();
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

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2200);
}

function bindEvents() {
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
    elements.eventDialog.close();
  });
  elements.cancelEventButton.addEventListener("click", () => {
    elements.eventDialog.close();
  });
  elements.eventForm.addEventListener("submit", handleFormSubmit);
  elements.repeatModeInputs.forEach((input) => {
    input.addEventListener("change", updateRepeatModeUI);
  });
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
    if (event.key === STORAGE_KEY) {
      state.events = loadEvents();
      render();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      render();
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
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("离线缓存注册失败", error);
    });
  }
}

buildTimeLabels();
bindEvents();
render({ scrollTargetMinutes: undefined });
preparePersistentStorage();
registerServiceWorker();

